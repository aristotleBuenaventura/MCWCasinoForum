<?php

if (!defined('ABSPATH')) {
    exit;
}

class MCW_Forum_REST
{
    public static function init(): void
    {
        add_action('rest_api_init', [self::class, 'register_routes']);
        add_filter('rest_request_before_callbacks', [self::class, 'maybe_switch_lang'], 10, 3);
    }

    /**
     * Honor ?lang=bn (or WPML language) on mcw/v1 routes for headless React.
     *
     * @param mixed            $response
     * @param array            $handler
     * @param WP_REST_Request  $request
     * @return mixed
     */
    public static function maybe_switch_lang($response, $handler, $request)
    {
        $route = (string) $request->get_route();
        if (!str_starts_with($route, '/mcw/v1')) {
            return $response;
        }

        $lang = self::request_lang($request);
        if ($lang === '') {
            return $response;
        }

        if (has_action('wpml_switch_language')) {
            do_action('wpml_switch_language', $lang);
        } elseif (class_exists('SitePress')) {
            global $sitepress;
            if ($sitepress instanceof SitePress && method_exists($sitepress, 'switch_lang')) {
                $sitepress->switch_lang($lang, true);
            }
        }

        return $response;
    }

    private static function request_lang(WP_REST_Request $request): string
    {
        $lang = sanitize_key((string) $request->get_param('lang'));
        return in_array($lang, ['en', 'bn'], true) ? $lang : '';
    }

    /**
     * Restrict WP_Query to WPML language (falls back to icl_translations when needed).
     *
     * @param array<string,mixed> $args
     * @return array<string,mixed>
     */
    private static function with_lang_query(array $args, string $lang): array
    {
        if ($lang === '') {
            return $args;
        }

        $args['lang'] = $lang;

        global $wpdb;
        $table = $wpdb->prefix . 'icl_translations';
        if ($wpdb->get_var($wpdb->prepare('SHOW TABLES LIKE %s', $table)) !== $table) {
            return $args;
        }

        $post_type = $args['post_type'] ?? 'mcw_thread';
        if (is_array($post_type)) {
            $post_type = $post_type[0] ?? 'mcw_thread';
        }
        $element_type = 'post_' . $post_type;

        if ($lang === 'bn') {
            $ids = $wpdb->get_col($wpdb->prepare(
                "SELECT element_id FROM {$table} WHERE element_type = %s AND language_code = %s",
                $element_type,
                'bn'
            ));
            $args['post__in'] = $ids ? array_map('intval', $ids) : [0];
            return $args;
        }

        // English: explicit en rows + posts not yet registered in WPML
        $bn_ids = $wpdb->get_col($wpdb->prepare(
            "SELECT element_id FROM {$table} WHERE element_type = %s AND language_code = %s",
            $element_type,
            'bn'
        ));
        if ($bn_ids) {
            $args['post__not_in'] = array_map('intval', $bn_ids);
        }
        return $args;
    }

    private static ?bool $has_icl_table = null;

    private static function has_icl_table(): bool
    {
        if (self::$has_icl_table !== null) {
            return self::$has_icl_table;
        }
        global $wpdb;
        $table = $wpdb->prefix . 'icl_translations';
        self::$has_icl_table = $wpdb->get_var($wpdb->prepare('SHOW TABLES LIKE %s', $table)) === $table;
        return self::$has_icl_table;
    }

    /** @return array<string,string> lang => post id */
    private static function thread_translations(int $post_id): array
    {
        $map = ['en' => (string) $post_id];
        global $wpdb;
        $table = $wpdb->prefix . 'icl_translations';
        if (!self::has_icl_table()) {
            return $map;
        }

        $trid = $wpdb->get_var($wpdb->prepare(
            "SELECT trid FROM {$table} WHERE element_type = 'post_mcw_thread' AND element_id = %d LIMIT 1",
            $post_id
        ));
        if (!$trid) {
            $translated = apply_filters('wpml_object_id', $post_id, 'mcw_thread', false, 'bn');
            if ($translated && (int) $translated !== $post_id) {
                $map['bn'] = (string) $translated;
            }
            return $map;
        }

        $rows = $wpdb->get_results($wpdb->prepare(
            "SELECT element_id, language_code FROM {$table} WHERE element_type = 'post_mcw_thread' AND trid = %d",
            $trid
        ), ARRAY_A) ?: [];
        $out = [];
        foreach ($rows as $row) {
            $code = (string) ($row['language_code'] ?? '');
            if ($code !== '') {
                $out[$code] = (string) $row['element_id'];
            }
        }
        if (!isset($out['en'])) {
            $out['en'] = (string) $post_id;
        }
        return $out;
    }

    /** Resolve a thread id to the version in $lang (falls back to original). */
    private static function resolve_thread_id(int $post_id, string $lang): int
    {
        if ($lang === '' || $lang === 'en') {
            $map = self::thread_translations($post_id);
            return isset($map['en']) ? (int) $map['en'] : $post_id;
        }
        $translated = apply_filters('wpml_object_id', $post_id, 'mcw_thread', true, $lang);
        if ($translated) {
            return (int) $translated;
        }
        $map = self::thread_translations($post_id);
        return isset($map[$lang]) ? (int) $map[$lang] : $post_id;
    }

    /** All thread ids in a WPML translation group (for shared comments). */
    private static function thread_group_ids(int $post_id): array
    {
        $map = self::thread_translations($post_id);
        $ids = array_values(array_unique(array_map('strval', $map)));
        if (!in_array((string) $post_id, $ids, true)) {
            $ids[] = (string) $post_id;
        }
        return $ids;
    }

    private static function set_post_language(int $post_id, string $post_type, string $lang, ?int $trid = null, ?string $source = null): void
    {
        if ($lang === '' || !defined('ICL_SITEPRESS_VERSION')) {
            return;
        }
        do_action('wpml_set_element_language_details', [
            'element_id' => $post_id,
            'element_type' => 'post_' . $post_type,
            'trid' => $trid,
            'language_code' => $lang,
            'source_language_code' => $source,
        ]);
    }

    public static function register_routes(): void
    {
        $ns = 'mcw/v1';

        register_rest_route($ns, '/health', [
            'methods' => 'GET',
            'callback' => static fn () => ['ok' => true],
            'permission_callback' => '__return_true',
        ]);

        register_rest_route($ns, '/bootstrap', [
            'methods' => 'GET',
            'callback' => [self::class, 'bootstrap'],
            'permission_callback' => '__return_true',
        ]);

        register_rest_route($ns, '/home', [
            'methods' => 'GET',
            'callback' => [self::class, 'home'],
            'permission_callback' => '__return_true',
        ]);

        register_rest_route($ns, '/threads', [
            [
                'methods' => 'GET',
                'callback' => [self::class, 'list_threads'],
                'permission_callback' => '__return_true',
            ],
            [
                'methods' => 'POST',
                'callback' => [self::class, 'create_thread'],
                'permission_callback' => '__return_true',
            ],
        ]);

        register_rest_route($ns, '/threads/(?P<id>[\\d]+)', [
            [
                'methods' => 'GET',
                'callback' => [self::class, 'get_thread'],
                'permission_callback' => '__return_true',
            ],
            [
                'methods' => 'PATCH',
                'callback' => [self::class, 'patch_thread'],
                'permission_callback' => '__return_true',
            ],
            [
                'methods' => 'DELETE',
                'callback' => [self::class, 'delete_thread'],
                'permission_callback' => '__return_true',
            ],
        ]);

        register_rest_route($ns, '/threads/(?P<id>[\\d]+)/comments', [
            'methods' => 'GET',
            'callback' => [self::class, 'list_comments'],
            'permission_callback' => '__return_true',
        ]);

        register_rest_route($ns, '/threads/(?P<id>[\\d]+)/view', [
            'methods' => 'POST',
            'callback' => [self::class, 'view_thread'],
            'permission_callback' => '__return_true',
        ]);

        register_rest_route($ns, '/threads/(?P<id>[\\d]+)/bookmark', [
            'methods' => 'POST',
            'callback' => [self::class, 'toggle_bookmark'],
            'permission_callback' => '__return_true',
        ]);

        register_rest_route($ns, '/threads/(?P<id>[\\d]+)/pin', [
            'methods' => 'POST',
            'callback' => [self::class, 'toggle_pin'],
            'permission_callback' => '__return_true',
        ]);

        register_rest_route($ns, '/comments', [
            'methods' => 'POST',
            'callback' => [self::class, 'create_comment'],
            'permission_callback' => '__return_true',
        ]);

        register_rest_route($ns, '/comments/(?P<id>[\\d]+)', [
            'methods' => 'DELETE',
            'callback' => [self::class, 'delete_comment'],
            'permission_callback' => '__return_true',
        ]);

        register_rest_route($ns, '/likes', [
            'methods' => 'POST',
            'callback' => [self::class, 'toggle_like'],
            'permission_callback' => '__return_true',
        ]);

        register_rest_route($ns, '/follows', [
            'methods' => 'POST',
            'callback' => [self::class, 'toggle_follow'],
            'permission_callback' => '__return_true',
        ]);

        register_rest_route($ns, '/reports', [
            'methods' => 'POST',
            'callback' => [self::class, 'create_report'],
            'permission_callback' => '__return_true',
        ]);

        register_rest_route($ns, '/search', [
            'methods' => 'GET',
            'callback' => [self::class, 'search'],
            'permission_callback' => '__return_true',
        ]);

        register_rest_route($ns, '/members', [
            'methods' => 'GET',
            'callback' => [self::class, 'members'],
            'permission_callback' => '__return_true',
        ]);

        register_rest_route($ns, '/users/(?P<username>[a-zA-Z0-9_\\-]+)', [
            'methods' => 'GET',
            'callback' => [self::class, 'user_profile'],
            'permission_callback' => '__return_true',
        ]);

        register_rest_route($ns, '/notifications', [
            'methods' => 'GET',
            'callback' => [self::class, 'notifications'],
            'permission_callback' => '__return_true',
        ]);

        register_rest_route($ns, '/notifications/read', [
            'methods' => 'POST',
            'callback' => [self::class, 'notifications_read'],
            'permission_callback' => '__return_true',
        ]);

        register_rest_route($ns, '/me', [
            'methods' => 'PATCH',
            'callback' => [self::class, 'patch_me'],
            'permission_callback' => '__return_true',
        ]);

        register_rest_route($ns, '/nameplate', [
            'methods' => 'GET',
            'callback' => [self::class, 'nameplate_catalog'],
            'permission_callback' => '__return_true',
        ]);

        register_rest_route($ns, '/me/nameplate', [
            'methods' => 'PATCH',
            'callback' => [self::class, 'patch_nameplate'],
            'permission_callback' => '__return_true',
        ]);

        register_rest_route($ns, '/auth/register', [
            'methods' => 'POST',
            'callback' => [self::class, 'register'],
            'permission_callback' => '__return_true',
        ]);

        register_rest_route($ns, '/auth/login', [
            'methods' => 'POST',
            'callback' => [self::class, 'login'],
            'permission_callback' => '__return_true',
        ]);

        register_rest_route($ns, '/auth/logout', [
            'methods' => 'POST',
            'callback' => [self::class, 'logout'],
            'permission_callback' => '__return_true',
        ]);

        register_rest_route($ns, '/auth/password', [
            'methods' => 'POST',
            'callback' => [self::class, 'change_password'],
            'permission_callback' => '__return_true',
        ]);

        register_rest_route($ns, '/auth/forgot', [
            'methods' => 'POST',
            'callback' => static fn () => ['ok' => true],
            'permission_callback' => '__return_true',
        ]);

        register_rest_route($ns, '/auth/reset', [
            'methods' => 'POST',
            'callback' => static fn () => ['ok' => true],
            'permission_callback' => '__return_true',
        ]);

        register_rest_route($ns, '/auth/verify-email', [
            'methods' => 'POST',
            'callback' => static fn () => ['ok' => true],
            'permission_callback' => '__return_true',
        ]);

        register_rest_route($ns, '/auth/account', [
            'methods' => 'DELETE',
            'callback' => [self::class, 'delete_account'],
            'permission_callback' => '__return_true',
        ]);

        register_rest_route($ns, '/admin/stats', [
            'methods' => 'GET',
            'callback' => [self::class, 'admin_stats'],
            'permission_callback' => '__return_true',
        ]);

        register_rest_route($ns, '/admin/users', [
            'methods' => 'GET',
            'callback' => [self::class, 'admin_users'],
            'permission_callback' => '__return_true',
        ]);

        register_rest_route($ns, '/admin/reports', [
            'methods' => 'GET',
            'callback' => [self::class, 'admin_reports'],
            'permission_callback' => '__return_true',
        ]);

        register_rest_route($ns, '/admin/nameplate', [
            [
                'methods' => 'GET',
                'callback' => static fn () => ['ok' => true, 'disabled' => ['frames' => [], 'emblems' => []]],
                'permission_callback' => '__return_true',
            ],
            [
                'methods' => 'POST',
                'callback' => static fn () => ['ok' => true],
                'permission_callback' => '__return_true',
            ],
        ]);

        register_rest_route($ns, '/admin/reset', [
            'methods' => 'POST',
            'callback' => [self::class, 'admin_reset'],
            'permission_callback' => '__return_true',
        ]);

        register_rest_route($ns, '/admin/categories', [
            'methods' => 'POST',
            'callback' => [self::class, 'admin_category'],
            'permission_callback' => '__return_true',
        ]);

        register_rest_route($ns, '/admin/categories/(?P<id>[\\w]+)', [
            'methods' => 'DELETE',
            'callback' => [self::class, 'admin_delete_category'],
            'permission_callback' => '__return_true',
        ]);

        register_rest_route($ns, '/admin/categories/(?P<id>[\\w]+)/featured', [
            'methods' => 'POST',
            'callback' => [self::class, 'admin_feature_category'],
            'permission_callback' => '__return_true',
        ]);

        register_rest_route($ns, '/admin/ads', [
            'methods' => 'POST',
            'callback' => [self::class, 'admin_ad'],
            'permission_callback' => '__return_true',
        ]);

        register_rest_route($ns, '/admin/ads/(?P<id>[\\d]+)', [
            'methods' => 'DELETE',
            'callback' => [self::class, 'admin_delete_post'],
            'permission_callback' => '__return_true',
        ]);

        register_rest_route($ns, '/admin/games', [
            'methods' => 'POST',
            'callback' => [self::class, 'admin_game'],
            'permission_callback' => '__return_true',
        ]);

        register_rest_route($ns, '/admin/games/(?P<id>[\\d]+)', [
            'methods' => 'DELETE',
            'callback' => [self::class, 'admin_delete_post'],
            'permission_callback' => '__return_true',
        ]);

        register_rest_route($ns, '/admin/providers', [
            'methods' => 'POST',
            'callback' => [self::class, 'admin_provider'],
            'permission_callback' => '__return_true',
        ]);

        register_rest_route($ns, '/admin/providers/(?P<id>[\\d]+)', [
            'methods' => 'DELETE',
            'callback' => [self::class, 'admin_delete_post'],
            'permission_callback' => '__return_true',
        ]);

        register_rest_route($ns, '/admin/settings/ads-rotate', [
            'methods' => 'POST',
            'callback' => [self::class, 'admin_ads_rotate'],
            'permission_callback' => '__return_true',
        ]);

        register_rest_route($ns, '/admin/users/(?P<id>[\\d]+)/role', [
            'methods' => 'POST',
            'callback' => [self::class, 'admin_set_role'],
            'permission_callback' => '__return_true',
        ]);

        register_rest_route($ns, '/admin/users/(?P<id>[\\d]+)/nameplate', [
            'methods' => 'POST',
            'callback' => [self::class, 'admin_user_nameplate'],
            'permission_callback' => '__return_true',
        ]);

        register_rest_route($ns, '/mod/reports/(?P<id>[\\w]+)/resolve', [
            'methods' => 'POST',
            'callback' => [self::class, 'resolve_report'],
            'permission_callback' => '__return_true',
        ]);

        register_rest_route($ns, '/mod/users/(?P<id>[\\d]+)/ban', [
            'methods' => 'POST',
            'callback' => [self::class, 'ban_user'],
            'permission_callback' => '__return_true',
        ]);

        register_rest_route($ns, '/uploads', [
            'methods' => 'POST',
            'callback' => [self::class, 'upload'],
            'permission_callback' => '__return_true',
        ]);
    }

    private static function guard(WP_REST_Request $request): ?WP_REST_Response
    {
        $err = MCW_Forum_Auth::require_same_origin($request);
        if ($err instanceof WP_Error) {
            return new WP_REST_Response(['ok' => false, 'error' => $err->get_error_message()], 403);
        }
        return null;
    }

    private static function require_user(): WP_User|WP_REST_Response
    {
        $user = MCW_Forum_Auth::current_wp_user();
        if (!$user) {
            return new WP_REST_Response(['ok' => false, 'error' => 'Please log in.'], 401);
        }
        if (get_user_meta($user->ID, 'mcw_banned', true)) {
            return new WP_REST_Response(['ok' => false, 'error' => 'Account banned.'], 403);
        }
        return $user;
    }

    public static function bootstrap(WP_REST_Request $request): WP_REST_Response
    {
        $user = MCW_Forum_Auth::current_wp_user();
        $lang = self::request_lang($request) ?: 'en';
        return new WP_REST_Response(array_merge(['ok' => true], MCW_Forum_Forum::load_bootstrap($user, $lang)));
    }

    public static function home(WP_REST_Request $request): WP_REST_Response
    {
        $tab = sanitize_text_field((string) $request->get_param('tab') ?: 'popular');
        $viewer = MCW_Forum_Auth::current_wp_user();
        $viewer_id = $viewer ? $viewer->ID : null;
        $lang = self::request_lang($request) ?: 'en';
        // sections=feed|extras|all — split so first paint is fast
        $sections = sanitize_key((string) ($request->get_param('sections') ?: 'all'));
        if (!in_array($sections, ['feed', 'extras', 'all'], true)) {
            $sections = 'all';
        }

        $base = [
            'post_type' => 'mcw_thread',
            'post_status' => 'publish',
            'suppress_filters' => false,
        ];

        $by_slug = static function (string $slug, int $limit) use ($base, $lang, $viewer_id): array {
            $term = get_term_by('slug', $slug, 'mcw_forum');
            $args = array_merge($base, [
                'posts_per_page' => $limit,
                'orderby' => 'date',
                'order' => 'DESC',
            ]);
            if ($term && !is_wp_error($term)) {
                $args['tax_query'] = [[
                    'taxonomy' => 'mcw_forum',
                    'field' => 'term_id',
                    'terms' => [(int) $term->term_id],
                ]];
            }
            $q = new WP_Query(self::with_lang_query($args, $lang));
            return MCW_Forum_Forum::decorate_threads($q->posts, $viewer_id, $lang, true);
        };

        $payload = [
            'ok' => true,
            'tab' => $tab,
            'lang' => $lang,
            'sections' => $sections,
            'weekly' => [],
        ];

        if ($sections === 'feed' || $sections === 'all') {
            $feed_q = new WP_Query(self::with_lang_query(array_merge($base, [
                'posts_per_page' => 15,
                'orderby' => 'date',
                'order' => 'DESC',
            ]), $lang));
            $payload['feed'] = [
                'page' => 1,
                'limit' => 15,
                'total' => (int) $feed_q->found_posts,
                'threads' => MCW_Forum_Forum::decorate_threads($feed_q->posts, $viewer_id, $lang, true),
            ];
        }

        if ($sections === 'extras' || $sections === 'all') {
            $payload['reviews'] = $by_slug('casino-reviews', 3);
            $payload['guides'] = $by_slug('guides', 3);
            $payload['wins'] = $by_slug('big-wins', 6);
        }

        return new WP_REST_Response($payload);
    }

    public static function list_threads(WP_REST_Request $request): WP_REST_Response
    {
        $viewer = MCW_Forum_Auth::current_wp_user();
        $limit = min(50, max(1, (int) ($request->get_param('limit') ?: 20)));
        $page = max(1, (int) ($request->get_param('page') ?: 1));
        $forum = sanitize_text_field((string) ($request->get_param('forum') ?: $request->get_param('slug') ?: ''));
        $lang = self::request_lang($request) ?: 'en';
        $args = self::with_lang_query([
            'post_type' => 'mcw_thread',
            'post_status' => 'publish',
            'posts_per_page' => $limit,
            'paged' => $page,
            'orderby' => 'date',
            'order' => 'DESC',
            'suppress_filters' => false,
        ], $lang);
        $term_id = MCW_Forum_Forum::term_id_from_forum_param($forum);
        if ($term_id) {
            $args['tax_query'] = [[
                'taxonomy' => 'mcw_forum',
                'field' => 'term_id',
                'terms' => [$term_id],
                'include_children' => true,
            ]];
        }
        $q = new WP_Query($args);
        return new WP_REST_Response([
            'ok' => true,
            'page' => $page,
            'limit' => $limit,
            'total' => (int) $q->found_posts,
            'threads' => MCW_Forum_Forum::decorate_threads($q->posts, $viewer ? $viewer->ID : null, $lang, true),
        ]);
    }

    public static function get_thread(WP_REST_Request $request): WP_REST_Response
    {
        $requested_id = (int) $request['id'];
        $lang = self::request_lang($request) ?: 'en';
        $resolved_id = self::resolve_thread_id($requested_id, $lang);
        $post = get_post($resolved_id);
        if (!$post || $post->post_type !== 'mcw_thread') {
            // Fallback to requested id if translation missing
            $post = get_post($requested_id);
        }
        if (!$post || $post->post_type !== 'mcw_thread') {
            return new WP_REST_Response(['ok' => false, 'error' => 'Thread not found.'], 404);
        }
        $viewer = MCW_Forum_Auth::current_wp_user();
        // Full body for detail view
        $threads = MCW_Forum_Forum::decorate_threads([$post], $viewer ? $viewer->ID : null, $lang, false);
        $translations = self::thread_translations((int) $post->ID);
        $threads[0]['translations'] = $translations;

        $payload = [
            'ok' => true,
            'lang' => $lang,
            'thread' => $threads[0],
            'translations' => $translations,
        ];

        // Bundle first-page comments so the SPA pays WP boot cost once.
        $include = $request->get_param('include_comments');
        $include_on = $include === null || $include === '' || $include === '1' || $include === 1 || $include === true;
        if ($include_on) {
            $page = max(1, (int) ($request->get_param('page') ?: 1));
            $limit = min(50, max(1, (int) ($request->get_param('limit') ?: 20)));
            $comments = self::load_thread_comments((int) $post->ID, $page, $limit, $lang, $viewer ? (int) $viewer->ID : null);
            $payload['comments'] = $comments['comments'];
            $payload['commentTotal'] = $comments['total'];
            $payload['commentPage'] = $page;
            $payload['commentLimit'] = $limit;
        }

        return new WP_REST_Response($payload);
    }

    /**
     * Fast comments loader with batched likes + authors.
     *
     * @return array{comments: array<int,array>, total: int}
     */
    private static function load_thread_comments(int $thread_id, int $page, int $limit, string $lang, ?int $viewer_id): array
    {
        global $wpdb;
        $group_ids = self::thread_group_ids($thread_id);
        $q = new WP_Query([
            'post_type' => 'mcw_reply',
            'post_status' => 'publish',
            'posts_per_page' => $limit,
            'paged' => $page,
            'orderby' => 'date',
            'order' => 'ASC',
            'suppress_filters' => true,
            'no_found_rows' => false,
            'update_post_meta_cache' => true,
            'update_post_term_cache' => false,
            'meta_query' => [[
                'key' => 'mcw_thread_id',
                'value' => $group_ids,
                'compare' => 'IN',
            ]],
        ]);

        $posts = $q->posts;
        if (!$posts) {
            return ['comments' => [], 'total' => (int) $q->found_posts];
        }

        $ids = array_map(static fn ($p) => (string) $p->ID, $posts);
        $placeholders = implode(',', array_fill(0, count($ids), '%s'));

        $like_map = array_fill_keys($ids, 0);
        $like_rows = $wpdb->get_results($wpdb->prepare(
            "SELECT target_id, COUNT(*) AS cnt
             FROM {$wpdb->prefix}mcw_likes
             WHERE target_type = 'comment' AND target_id IN ($placeholders)
             GROUP BY target_id",
            ...$ids
        ), ARRAY_A) ?: [];
        foreach ($like_rows as $row) {
            $like_map[(string) $row['target_id']] = (int) $row['cnt'];
        }

        $liked_set = [];
        if ($viewer_id) {
            $liked_rows = $wpdb->get_col($wpdb->prepare(
                "SELECT target_id FROM {$wpdb->prefix}mcw_likes
                 WHERE user_id = %d AND target_type = 'comment' AND target_id IN ($placeholders)",
                $viewer_id,
                ...$ids
            )) ?: [];
            foreach ($liked_rows as $tid) {
                $liked_set[(string) $tid] = true;
            }
        }

        $author_ids = array_values(array_unique(array_map(static fn ($p) => (int) $p->post_author, $posts)));
        $authors = [];
        if ($author_ids) {
            foreach (get_users(['include' => $author_ids]) as $u) {
                $authors[(int) $u->ID] = MCW_Forum_Serialize::public_user($u);
            }
        }

        $comments = [];
        foreach ($posts as $post) {
            $mapped = MCW_Forum_Serialize::map_comment($post, $lang);
            $sid = (string) $post->ID;
            $mapped['author'] = $authors[(int) $post->post_author] ?? null;
            $mapped['likeCount'] = $like_map[$sid] ?? 0;
            $mapped['liked'] = isset($liked_set[$sid]);
            $comments[] = $mapped;
        }

        return ['comments' => $comments, 'total' => (int) $q->found_posts];
    }

    public static function create_thread(WP_REST_Request $request): WP_REST_Response
    {
        if ($resp = self::guard($request)) {
            return $resp;
        }
        $user = self::require_user();
        if ($user instanceof WP_REST_Response) {
            return $user;
        }
        $body = MCW_Forum_Forum::json_body($request);
        $title = sanitize_text_field((string) ($body['title'] ?? ''));
        $forum_id = (string) ($body['forumId'] ?? '');
        $blocks = $body['body'] ?? [];
        if ($title === '' || !is_array($blocks)) {
            return new WP_REST_Response(['ok' => false, 'error' => 'Title and body required.'], 400);
        }
        $content = '';
        foreach ($blocks as $b) {
            if (($b['type'] ?? '') === 'text') {
                $content .= ($b['text'] ?? '') . "\n\n";
            }
        }
        $id = wp_insert_post([
            'post_type' => 'mcw_thread',
            'post_status' => 'publish',
            'post_title' => $title,
            'post_content' => trim($content),
            'post_author' => $user->ID,
        ], true);
        if (is_wp_error($id)) {
            return new WP_REST_Response(['ok' => false, 'error' => $id->get_error_message()], 400);
        }
        $term_id = MCW_Forum_Forum::term_id_from_forum_param($forum_id);
        if ($term_id) {
            wp_set_post_terms($id, [$term_id], 'mcw_forum');
        }
        update_post_meta($id, 'mcw_body', $blocks);
        update_post_meta($id, 'mcw_tags', $body['tags'] ?? []);
        update_post_meta($id, 'mcw_views', 0);
        $lang = self::request_lang($request) ?: 'en';
        self::set_post_language((int) $id, 'mcw_thread', $lang, null, $lang === 'en' ? null : 'en');
        MCW_Forum_Translate::ensure_thread((int) $id);
        $post = get_post($id);
        $threads = MCW_Forum_Forum::decorate_threads([$post], $user->ID, $lang, false);
        $threads[0]['translations'] = self::thread_translations((int) $id);
        return new WP_REST_Response(['ok' => true, 'thread' => $threads[0]]);
    }

    public static function patch_thread(WP_REST_Request $request): WP_REST_Response
    {
        if ($resp = self::guard($request)) {
            return $resp;
        }
        $user = self::require_user();
        if ($user instanceof WP_REST_Response) {
            return $user;
        }
        $post = get_post((int) $request['id']);
        if (!$post || $post->post_type !== 'mcw_thread') {
            return new WP_REST_Response(['ok' => false, 'error' => 'Not found.'], 404);
        }
        $body = MCW_Forum_Forum::json_body($request);
        $update = ['ID' => $post->ID];
        if (!empty($body['title'])) {
            $update['post_title'] = sanitize_text_field($body['title']);
        }
        if (isset($body['content'])) {
            $update['post_content'] = wp_kses_post($body['content']);
        }
        if (isset($body['body']) && is_array($body['body'])) {
            update_post_meta($post->ID, 'mcw_body', $body['body']);
        }
        wp_update_post($update);
        return new WP_REST_Response(['ok' => true]);
    }

    public static function delete_thread(WP_REST_Request $request): WP_REST_Response
    {
        if ($resp = self::guard($request)) {
            return $resp;
        }
        $user = self::require_user();
        if ($user instanceof WP_REST_Response) {
            return $user;
        }
        wp_trash_post((int) $request['id']);
        return new WP_REST_Response(['ok' => true]);
    }

    public static function list_comments(WP_REST_Request $request): WP_REST_Response
    {
        $thread_id = (int) $request['id'];
        $page = max(1, (int) ($request->get_param('page') ?: 1));
        $limit = min(50, max(1, (int) ($request->get_param('limit') ?: 20)));
        $viewer = MCW_Forum_Auth::current_wp_user();
        $lang = self::request_lang($request) ?: 'en';
        $payload = self::load_thread_comments(
            $thread_id,
            $page,
            $limit,
            $lang,
            $viewer ? (int) $viewer->ID : null
        );
        return new WP_REST_Response([
            'ok' => true,
            'page' => $page,
            'limit' => $limit,
            'total' => $payload['total'],
            'lang' => $lang,
            'comments' => $payload['comments'],
        ]);
    }

    public static function create_comment(WP_REST_Request $request): WP_REST_Response
    {
        if ($resp = self::guard($request)) {
            return $resp;
        }
        $user = self::require_user();
        if ($user instanceof WP_REST_Response) {
            return $user;
        }
        $body = MCW_Forum_Forum::json_body($request);
        $thread_id = (string) ($body['threadId'] ?? '');
        if ($thread_id === '' || !get_post((int) $thread_id)) {
            return new WP_REST_Response(['ok' => false, 'error' => 'Thread not found.'], 404);
        }
        $blocks = $body['body'] ?? [];
        $content = '';
        if (is_array($blocks)) {
            foreach ($blocks as $b) {
                if (($b['type'] ?? '') === 'text') {
                    $content .= ($b['text'] ?? '') . "\n\n";
                }
            }
        }
        if (trim($content) === '' && (!is_array($blocks) || count($blocks) === 0)) {
            return new WP_REST_Response(['ok' => false, 'error' => 'Write something or insert an image.'], 400);
        }
        $id = wp_insert_post([
            'post_type' => 'mcw_reply',
            'post_status' => 'publish',
            'post_title' => 'Reply',
            'post_content' => trim($content) ?: ' ',
            'post_author' => $user->ID,
        ], true);
        if (is_wp_error($id)) {
            return new WP_REST_Response(['ok' => false, 'error' => $id->get_error_message()], 400);
        }
        // Attach to canonical (EN) thread id so comments stay visible across language versions
        $translations = self::thread_translations((int) $thread_id);
        $canonical = $translations['en'] ?? $thread_id;
        update_post_meta($id, 'mcw_thread_id', (string) $canonical);
        $blocks = is_array($blocks) ? $blocks : [];
        update_post_meta($id, 'mcw_body', $blocks);
        if (!empty($body['parentId'])) {
            update_post_meta($id, 'mcw_parent_id', (string) $body['parentId']);
        }
        $lang = self::request_lang($request) ?: 'en';
        // Translate once → store EN + BN for all future viewers
        MCW_Forum_Translate::ensure_comment((int) $id, $blocks, $lang);
        self::set_post_language((int) $id, 'mcw_reply', $lang, null, $lang === 'en' ? null : 'en');

        $post = get_post($id);
        $mapped = MCW_Forum_Serialize::map_comment($post, $lang);
        $mapped['author'] = MCW_Forum_Serialize::public_user($user);
        $mapped['likeCount'] = 0;
        $mapped['liked'] = false;
        return new WP_REST_Response(['ok' => true, 'comment' => $mapped]);
    }

    public static function delete_comment(WP_REST_Request $request): WP_REST_Response
    {
        if ($resp = self::guard($request)) {
            return $resp;
        }
        $user = self::require_user();
        if ($user instanceof WP_REST_Response) {
            return $user;
        }
        wp_trash_post((int) $request['id']);
        return new WP_REST_Response(['ok' => true]);
    }

    public static function view_thread(WP_REST_Request $request): WP_REST_Response
    {
        $id = (int) $request['id'];
        $views = (int) get_post_meta($id, 'mcw_views', true);
        update_post_meta($id, 'mcw_views', $views + 1);
        return new WP_REST_Response(['ok' => true]);
    }

    public static function toggle_bookmark(WP_REST_Request $request): WP_REST_Response
    {
        if ($resp = self::guard($request)) {
            return $resp;
        }
        $user = self::require_user();
        if ($user instanceof WP_REST_Response) {
            return $user;
        }
        global $wpdb;
        $table = $wpdb->prefix . 'mcw_bookmarks';
        $thread_id = (int) $request['id'];
        $existing = $wpdb->get_var($wpdb->prepare(
            "SELECT id FROM {$table} WHERE user_id = %d AND thread_id = %d",
            $user->ID,
            $thread_id
        ));
        if ($existing) {
            $wpdb->delete($table, ['id' => $existing]);
            return new WP_REST_Response(['ok' => true, 'bookmarked' => false]);
        }
        $wpdb->insert($table, [
            'user_id' => $user->ID,
            'thread_id' => $thread_id,
            'created_at' => current_time('mysql'),
        ]);
        return new WP_REST_Response(['ok' => true, 'bookmarked' => true]);
    }

    public static function toggle_pin(WP_REST_Request $request): WP_REST_Response
    {
        if ($resp = self::guard($request)) {
            return $resp;
        }
        $user = self::require_user();
        if ($user instanceof WP_REST_Response) {
            return $user;
        }
        $role = MCW_Forum_Auth::role_of($user);
        if (!in_array($role, ['admin', 'moderator'], true)) {
            return new WP_REST_Response(['ok' => false, 'error' => 'Forbidden.'], 403);
        }
        $id = (int) $request['id'];
        $pinned = !(bool) get_post_meta($id, 'mcw_pinned', true);
        update_post_meta($id, 'mcw_pinned', $pinned ? 1 : 0);
        return new WP_REST_Response(['ok' => true, 'pinned' => $pinned]);
    }

    public static function toggle_like(WP_REST_Request $request): WP_REST_Response
    {
        if ($resp = self::guard($request)) {
            return $resp;
        }
        $user = self::require_user();
        if ($user instanceof WP_REST_Response) {
            return $user;
        }
        $body = MCW_Forum_Forum::json_body($request);
        $type = sanitize_text_field((string) ($body['targetType'] ?? ''));
        $target = sanitize_text_field((string) ($body['targetId'] ?? ''));
        global $wpdb;
        $table = $wpdb->prefix . 'mcw_likes';
        $existing = $wpdb->get_var($wpdb->prepare(
            "SELECT id FROM {$table} WHERE user_id = %d AND target_type = %s AND target_id = %s",
            $user->ID,
            $type,
            $target
        ));
        if ($existing) {
            $wpdb->delete($table, ['id' => $existing]);
            return new WP_REST_Response(['ok' => true, 'liked' => false]);
        }
        $wpdb->insert($table, [
            'user_id' => $user->ID,
            'target_type' => $type,
            'target_id' => $target,
            'created_at' => current_time('mysql'),
        ]);
        return new WP_REST_Response(['ok' => true, 'liked' => true]);
    }

    public static function toggle_follow(WP_REST_Request $request): WP_REST_Response
    {
        if ($resp = self::guard($request)) {
            return $resp;
        }
        $user = self::require_user();
        if ($user instanceof WP_REST_Response) {
            return $user;
        }
        $body = MCW_Forum_Forum::json_body($request);
        $following = (int) ($body['userId'] ?? 0);
        global $wpdb;
        $table = $wpdb->prefix . 'mcw_follows';
        $existing = $wpdb->get_var($wpdb->prepare(
            "SELECT id FROM {$table} WHERE follower_id = %d AND following_id = %d",
            $user->ID,
            $following
        ));
        if ($existing) {
            $wpdb->delete($table, ['id' => $existing]);
            return new WP_REST_Response(['ok' => true, 'following' => false]);
        }
        $wpdb->insert($table, [
            'follower_id' => $user->ID,
            'following_id' => $following,
            'created_at' => current_time('mysql'),
        ]);
        return new WP_REST_Response(['ok' => true, 'following' => true]);
    }

    public static function create_report(WP_REST_Request $request): WP_REST_Response
    {
        if ($resp = self::guard($request)) {
            return $resp;
        }
        $user = self::require_user();
        if ($user instanceof WP_REST_Response) {
            return $user;
        }
        $body = MCW_Forum_Forum::json_body($request);
        global $wpdb;
        $id = 'rep_' . wp_generate_password(10, false, false);
        $wpdb->insert($wpdb->prefix . 'mcw_reports', [
            'id' => $id,
            'reporter_id' => $user->ID,
            'target_type' => sanitize_text_field((string) ($body['targetType'] ?? '')),
            'target_id' => sanitize_text_field((string) ($body['targetId'] ?? '')),
            'reason' => sanitize_textarea_field((string) ($body['reason'] ?? '')),
            'resolved' => 0,
            'created_at' => current_time('mysql'),
        ]);
        return new WP_REST_Response(['ok' => true]);
    }

    public static function search(WP_REST_Request $request): WP_REST_Response
    {
        $q = sanitize_text_field((string) $request->get_param('q'));
        $lang = self::request_lang($request) ?: 'en';
        $query = new WP_Query(self::with_lang_query([
            'post_type' => 'mcw_thread',
            'post_status' => 'publish',
            's' => $q,
            'posts_per_page' => 30,
            'suppress_filters' => false,
        ], $lang));
        $viewer = MCW_Forum_Auth::current_wp_user();
        return new WP_REST_Response([
            'ok' => true,
            'threads' => MCW_Forum_Forum::decorate_threads($query->posts, $viewer ? $viewer->ID : null, $lang, true),
            'users' => [],
        ]);
    }

    public static function members(WP_REST_Request $request): WP_REST_Response
    {
        $users = get_users(['number' => 50, 'orderby' => 'registered', 'order' => 'DESC']);
        $members = [];
        foreach ($users as $u) {
            if (get_user_meta($u->ID, 'mcw_banned', true)) {
                continue;
            }
            $pub = MCW_Forum_Serialize::public_user($u);
            $members[] = [
                'user' => $pub,
                'messages' => 0,
                'reactions' => 0,
                'media' => 0,
            ];
        }
        return new WP_REST_Response(['ok' => true, 'members' => $members]);
    }

    public static function user_profile(WP_REST_Request $request): WP_REST_Response
    {
        $user = get_user_by('login', sanitize_user((string) $request['username']));
        if (!$user) {
            return new WP_REST_Response(['ok' => false, 'error' => 'User not found.'], 404);
        }
        $lang = self::request_lang($request) ?: 'en';
        $q = new WP_Query(self::with_lang_query([
            'post_type' => 'mcw_thread',
            'author' => $user->ID,
            'posts_per_page' => 20,
            'post_status' => 'publish',
            'suppress_filters' => false,
        ], $lang));
        $viewer = MCW_Forum_Auth::current_wp_user();
        return new WP_REST_Response([
            'ok' => true,
            'user' => MCW_Forum_Serialize::public_user($user, $viewer && $viewer->ID === $user->ID),
            'threads' => MCW_Forum_Forum::decorate_threads($q->posts, $viewer ? $viewer->ID : null, $lang, true),
            'comments' => [],
        ]);
    }

    public static function notifications(): WP_REST_Response
    {
        $user = self::require_user();
        if ($user instanceof WP_REST_Response) {
            return $user;
        }
        global $wpdb;
        $rows = $wpdb->get_results($wpdb->prepare(
            "SELECT * FROM {$wpdb->prefix}mcw_notifications WHERE user_id = %d ORDER BY created_at DESC LIMIT 50",
            $user->ID
        ));
        $notifications = array_map(static function ($r) {
            return [
                'id' => $r->id,
                'userId' => (string) $r->user_id,
                'type' => $r->type,
                'message' => $r->message,
                'link' => $r->link,
                'read' => (bool) $r->is_read,
                'createdAt' => gmdate('c', strtotime($r->created_at)),
            ];
        }, $rows ?: []);
        return new WP_REST_Response(['ok' => true, 'notifications' => $notifications]);
    }

    public static function notifications_read(WP_REST_Request $request): WP_REST_Response
    {
        if ($resp = self::guard($request)) {
            return $resp;
        }
        $user = self::require_user();
        if ($user instanceof WP_REST_Response) {
            return $user;
        }
        global $wpdb;
        $wpdb->update($wpdb->prefix . 'mcw_notifications', ['is_read' => 1], ['user_id' => $user->ID]);
        return new WP_REST_Response(['ok' => true]);
    }

    public static function patch_me(WP_REST_Request $request): WP_REST_Response
    {
        if ($resp = self::guard($request)) {
            return $resp;
        }
        $user = self::require_user();
        if ($user instanceof WP_REST_Response) {
            return $user;
        }
        $body = MCW_Forum_Forum::json_body($request);
        if (isset($body['displayName'])) {
            wp_update_user(['ID' => $user->ID, 'display_name' => sanitize_text_field($body['displayName'])]);
        }
        if (isset($body['bio'])) {
            update_user_meta($user->ID, 'mcw_bio', sanitize_textarea_field($body['bio']));
        }
        if (isset($body['avatar'])) {
            update_user_meta($user->ID, 'mcw_avatar', esc_url_raw($body['avatar']));
        }
        return new WP_REST_Response(['ok' => true, 'user' => MCW_Forum_Serialize::public_user(get_user_by('id', $user->ID), true)]);
    }

    public static function nameplate_catalog(): WP_REST_Response
    {
        return new WP_REST_Response([
            'ok' => true,
            'catalog' => [
                'frames' => ['none', 'gold', 'neon', 'royal'],
                'emblems' => ['none', 'crown', 'chip', 'diamond'],
            ],
        ]);
    }

    public static function patch_nameplate(WP_REST_Request $request): WP_REST_Response
    {
        if ($resp = self::guard($request)) {
            return $resp;
        }
        $user = self::require_user();
        if ($user instanceof WP_REST_Response) {
            return $user;
        }
        $body = MCW_Forum_Forum::json_body($request);
        if (isset($body['frame'])) {
            update_user_meta($user->ID, 'mcw_name_frame', sanitize_text_field($body['frame']));
        }
        if (isset($body['emblem'])) {
            update_user_meta($user->ID, 'mcw_name_emblem', sanitize_text_field($body['emblem']));
        }
        return new WP_REST_Response(['ok' => true, 'user' => MCW_Forum_Serialize::public_user(get_user_by('id', $user->ID), true)]);
    }

    public static function register(WP_REST_Request $request): WP_REST_Response
    {
        if ($resp = self::guard($request)) {
            return $resp;
        }
        $body = MCW_Forum_Forum::json_body($request);
        $username = sanitize_user((string) ($body['username'] ?? ''));
        $email = sanitize_email((string) ($body['email'] ?? ''));
        $password = (string) ($body['password'] ?? '');
        $display = sanitize_text_field((string) ($body['displayName'] ?? $username));
        if ($username === '' || $email === '' || strlen($password) < 8) {
            return new WP_REST_Response(['ok' => false, 'error' => 'Invalid registration.'], 400);
        }
        if (username_exists($username) || email_exists($email)) {
            return new WP_REST_Response(['ok' => false, 'error' => 'Username or email already taken.'], 400);
        }
        $id = wp_create_user($username, $password, $email);
        if (is_wp_error($id)) {
            return new WP_REST_Response(['ok' => false, 'error' => $id->get_error_message()], 400);
        }
        wp_update_user(['ID' => $id, 'display_name' => $display]);
        update_user_meta($id, 'mcw_role', 'user');
        update_user_meta($id, 'mcw_dob', sanitize_text_field((string) ($body['dateOfBirth'] ?? '')));
        MCW_Forum_Auth::issue_session((int) $id, false);
        return new WP_REST_Response(['ok' => true]);
    }

    public static function login(WP_REST_Request $request): WP_REST_Response
    {
        if ($resp = self::guard($request)) {
            return $resp;
        }
        $body = MCW_Forum_Forum::json_body($request);
        $login = sanitize_text_field((string) ($body['usernameOrEmail'] ?? $body['username'] ?? $body['email'] ?? ''));
        $password = (string) ($body['password'] ?? '');
        $stay = array_key_exists('stayLoggedIn', $body) ? (bool) $body['stayLoggedIn'] : true;
        $user = get_user_by('login', $login);
        if (!$user && is_email($login)) {
            $user = get_user_by('email', $login);
        }
        if (!$user || !wp_check_password($password, $user->user_pass, $user->ID)) {
            return new WP_REST_Response(['ok' => false, 'error' => 'Invalid username/email or password.'], 401);
        }
        if (get_user_meta($user->ID, 'mcw_banned', true)) {
            return new WP_REST_Response(['ok' => false, 'error' => 'Account banned.'], 403);
        }
        MCW_Forum_Auth::issue_session($user->ID, $stay);
        return new WP_REST_Response(['ok' => true, 'user' => MCW_Forum_Serialize::public_user($user, true)]);
    }

    public static function logout(WP_REST_Request $request): WP_REST_Response
    {
        if ($resp = self::guard($request)) {
            return $resp;
        }
        MCW_Forum_Auth::clear_session();
        return new WP_REST_Response(['ok' => true]);
    }

    public static function change_password(WP_REST_Request $request): WP_REST_Response
    {
        if ($resp = self::guard($request)) {
            return $resp;
        }
        $user = self::require_user();
        if ($user instanceof WP_REST_Response) {
            return $user;
        }
        $body = MCW_Forum_Forum::json_body($request);
        $current = (string) ($body['currentPassword'] ?? '');
        $next = (string) ($body['newPassword'] ?? $body['password'] ?? '');
        if (!wp_check_password($current, $user->user_pass, $user->ID)) {
            return new WP_REST_Response(['ok' => false, 'error' => 'Current password incorrect.'], 400);
        }
        wp_set_password($next, $user->ID);
        MCW_Forum_Auth::issue_session($user->ID, false);
        return new WP_REST_Response(['ok' => true]);
    }

    public static function delete_account(WP_REST_Request $request): WP_REST_Response
    {
        if ($resp = self::guard($request)) {
            return $resp;
        }
        $user = self::require_user();
        if ($user instanceof WP_REST_Response) {
            return $user;
        }
        require_once ABSPATH . 'wp-admin/includes/user.php';
        MCW_Forum_Auth::clear_session();
        wp_delete_user($user->ID);
        return new WP_REST_Response(['ok' => true]);
    }

    public static function admin_stats(): WP_REST_Response
    {
        $user = self::require_user();
        if ($user instanceof WP_REST_Response) {
            return $user;
        }
        return new WP_REST_Response([
            'ok' => true,
            'stats' => [
                'users' => (int) count_users()['total_users'],
                'threads' => (int) wp_count_posts('mcw_thread')->publish,
                'comments' => (int) wp_count_posts('mcw_reply')->publish,
                'reports' => 0,
            ],
        ]);
    }

    public static function admin_users(): WP_REST_Response
    {
        $users = get_users(['number' => 200]);
        return new WP_REST_Response([
            'ok' => true,
            'users' => array_map(static fn ($u) => MCW_Forum_Serialize::public_user($u, true), $users),
        ]);
    }

    public static function admin_reports(): WP_REST_Response
    {
        global $wpdb;
        $rows = $wpdb->get_results("SELECT * FROM {$wpdb->prefix}mcw_reports ORDER BY created_at DESC LIMIT 100");
        $reports = array_map(static function ($r) {
            return [
                'id' => $r->id,
                'reporterId' => (string) $r->reporter_id,
                'targetType' => $r->target_type,
                'targetId' => $r->target_id,
                'reason' => $r->reason,
                'resolved' => (bool) $r->resolved,
                'createdAt' => gmdate('c', strtotime($r->created_at)),
            ];
        }, $rows ?: []);
        return new WP_REST_Response(['ok' => true, 'reports' => $reports]);
    }

    public static function admin_reset(WP_REST_Request $request): WP_REST_Response
    {
        if ($resp = self::guard($request)) {
            return $resp;
        }
        $user = self::require_user();
        if ($user instanceof WP_REST_Response) {
            return $user;
        }
        if (MCW_Forum_Auth::role_of($user) !== 'admin') {
            return new WP_REST_Response(['ok' => false, 'error' => 'Forbidden.'], 403);
        }
        MCW_Forum_Seed::run(true);
        return new WP_REST_Response(['ok' => true]);
    }

    public static function admin_category(WP_REST_Request $request): WP_REST_Response
    {
        if ($resp = self::guard($request)) {
            return $resp;
        }
        $body = MCW_Forum_Forum::json_body($request);
        $result = wp_insert_term(sanitize_text_field($body['name'] ?? 'Forum'), 'mcw_forum', [
            'slug' => sanitize_title($body['slug'] ?? ''),
            'description' => sanitize_textarea_field($body['description'] ?? ''),
            'parent' => MCW_Forum_Forum::term_id_from_forum_param((string) ($body['parentId'] ?? '')) ?: 0,
        ]);
        if (is_wp_error($result)) {
            return new WP_REST_Response(['ok' => false, 'error' => $result->get_error_message()], 400);
        }
        update_term_meta($result['term_id'], 'mcw_order', (int) ($body['order'] ?? 0));
        update_term_meta($result['term_id'], 'mcw_featured', !empty($body['featured']) ? 1 : 0);
        return new WP_REST_Response(['ok' => true]);
    }

    public static function admin_delete_category(WP_REST_Request $request): WP_REST_Response
    {
        if ($resp = self::guard($request)) {
            return $resp;
        }
        $term_id = MCW_Forum_Forum::term_id_from_forum_param((string) $request['id']);
        if ($term_id) {
            wp_delete_term($term_id, 'mcw_forum');
        }
        return new WP_REST_Response(['ok' => true]);
    }

    public static function admin_feature_category(WP_REST_Request $request): WP_REST_Response
    {
        if ($resp = self::guard($request)) {
            return $resp;
        }
        $term_id = MCW_Forum_Forum::term_id_from_forum_param((string) $request['id']);
        if ($term_id) {
            $cur = (bool) get_term_meta($term_id, 'mcw_featured', true);
            update_term_meta($term_id, 'mcw_featured', $cur ? 0 : 1);
        }
        return new WP_REST_Response(['ok' => true]);
    }

    public static function admin_ad(WP_REST_Request $request): WP_REST_Response
    {
        if ($resp = self::guard($request)) {
            return $resp;
        }
        $body = MCW_Forum_Forum::json_body($request);
        $id = wp_insert_post([
            'post_type' => 'mcw_ad',
            'post_status' => 'publish',
            'post_title' => sanitize_text_field($body['title'] ?? 'Ad'),
        ]);
        update_post_meta($id, 'mcw_slot', sanitize_text_field($body['slot'] ?? 'sidebar'));
        update_post_meta($id, 'mcw_image_url', esc_url_raw($body['imageUrl'] ?? ''));
        update_post_meta($id, 'mcw_url', esc_url_raw($body['url'] ?? ''));
        update_post_meta($id, 'mcw_order', (int) ($body['order'] ?? 0));
        return new WP_REST_Response(['ok' => true]);
    }

    public static function admin_game(WP_REST_Request $request): WP_REST_Response
    {
        if ($resp = self::guard($request)) {
            return $resp;
        }
        $body = MCW_Forum_Forum::json_body($request);
        $id = wp_insert_post([
            'post_type' => 'mcw_game',
            'post_status' => 'publish',
            'post_title' => sanitize_text_field($body['title'] ?? 'Game'),
        ]);
        update_post_meta($id, 'mcw_subtitle', sanitize_text_field($body['subtitle'] ?? ''));
        update_post_meta($id, 'mcw_image_url', esc_url_raw($body['imageUrl'] ?? ''));
        update_post_meta($id, 'mcw_url', esc_url_raw($body['url'] ?? ''));
        update_post_meta($id, 'mcw_order', (int) ($body['order'] ?? 0));
        return new WP_REST_Response(['ok' => true]);
    }

    public static function admin_provider(WP_REST_Request $request): WP_REST_Response
    {
        if ($resp = self::guard($request)) {
            return $resp;
        }
        $body = MCW_Forum_Forum::json_body($request);
        $id = wp_insert_post([
            'post_type' => 'mcw_provider',
            'post_status' => 'publish',
            'post_title' => sanitize_text_field($body['name'] ?? $body['title'] ?? 'Provider'),
        ]);
        update_post_meta($id, 'mcw_subtitle', sanitize_text_field($body['subtitle'] ?? ''));
        update_post_meta($id, 'mcw_image_url', esc_url_raw($body['imageUrl'] ?? ''));
        update_post_meta($id, 'mcw_url', esc_url_raw($body['url'] ?? ''));
        update_post_meta($id, 'mcw_rating', (float) ($body['rating'] ?? 4.5));
        update_post_meta($id, 'mcw_order', (int) ($body['order'] ?? 0));
        return new WP_REST_Response(['ok' => true]);
    }

    public static function admin_delete_post(WP_REST_Request $request): WP_REST_Response
    {
        if ($resp = self::guard($request)) {
            return $resp;
        }
        wp_trash_post((int) $request['id']);
        return new WP_REST_Response(['ok' => true]);
    }

    public static function admin_ads_rotate(WP_REST_Request $request): WP_REST_Response
    {
        if ($resp = self::guard($request)) {
            return $resp;
        }
        $body = MCW_Forum_Forum::json_body($request);
        update_option('mcw_ad_rotate_sec', max(3, (int) ($body['sec'] ?? 8)));
        return new WP_REST_Response(['ok' => true]);
    }

    public static function admin_set_role(WP_REST_Request $request): WP_REST_Response
    {
        if ($resp = self::guard($request)) {
            return $resp;
        }
        $body = MCW_Forum_Forum::json_body($request);
        update_user_meta((int) $request['id'], 'mcw_role', sanitize_text_field($body['role'] ?? 'user'));
        return new WP_REST_Response(['ok' => true]);
    }

    public static function admin_user_nameplate(WP_REST_Request $request): WP_REST_Response
    {
        if ($resp = self::guard($request)) {
            return $resp;
        }
        $body = MCW_Forum_Forum::json_body($request);
        $id = (int) $request['id'];
        if (isset($body['membership'])) {
            update_user_meta($id, 'mcw_membership', sanitize_text_field($body['membership']));
        }
        if (isset($body['frame'])) {
            update_user_meta($id, 'mcw_name_frame', sanitize_text_field($body['frame']));
        }
        if (isset($body['emblem'])) {
            update_user_meta($id, 'mcw_name_emblem', sanitize_text_field($body['emblem']));
        }
        return new WP_REST_Response(['ok' => true]);
    }

    public static function resolve_report(WP_REST_Request $request): WP_REST_Response
    {
        if ($resp = self::guard($request)) {
            return $resp;
        }
        global $wpdb;
        $wpdb->update($wpdb->prefix . 'mcw_reports', ['resolved' => 1], ['id' => sanitize_text_field((string) $request['id'])]);
        return new WP_REST_Response(['ok' => true]);
    }

    public static function ban_user(WP_REST_Request $request): WP_REST_Response
    {
        if ($resp = self::guard($request)) {
            return $resp;
        }
        $body = MCW_Forum_Forum::json_body($request);
        update_user_meta((int) $request['id'], 'mcw_banned', !isset($body['banned']) || $body['banned'] ? 1 : 0);
        return new WP_REST_Response(['ok' => true]);
    }

    public static function upload(WP_REST_Request $request): WP_REST_Response
    {
        if ($resp = self::guard($request)) {
            return $resp;
        }
        $user = self::require_user();
        if ($user instanceof WP_REST_Response) {
            return $user;
        }
        $files = $request->get_file_params();
        if (empty($files['file'])) {
            return new WP_REST_Response(['ok' => false, 'error' => 'No file.'], 400);
        }
        require_once ABSPATH . 'wp-admin/includes/file.php';
        require_once ABSPATH . 'wp-admin/includes/media.php';
        require_once ABSPATH . 'wp-admin/includes/image.php';
        $attachment_id = media_handle_upload('file', 0);
        if (is_wp_error($attachment_id)) {
            return new WP_REST_Response(['ok' => false, 'error' => $attachment_id->get_error_message()], 400);
        }
        return new WP_REST_Response(['ok' => true, 'url' => wp_get_attachment_url($attachment_id)]);
    }
}

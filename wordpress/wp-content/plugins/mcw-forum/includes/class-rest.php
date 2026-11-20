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

        // Default to EN when UI omits ?lang= so WPML cookies from /bn cannot stick.
        $lang = self::request_lang($request) ?: 'en';

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
     * Canonical listing query for en + bn.
     * Same posts for both languages; $lang only affects serialization/translation on read.
     * Drops WPML BN sibling posts that already have an EN original (avoid duplicates).
     *
     * @param array<string,mixed> $args
     * @return array<string,mixed>
     */
    private static function with_lang_query(array $args, string $lang): array
    {
        // Do not filter the result set by UI language.
        $args['lang'] = 'all';

        if (!self::has_icl_table()) {
            return $args;
        }

        global $wpdb;
        $table = $wpdb->prefix . 'icl_translations';
        $post_type = $args['post_type'] ?? 'mcw_thread';
        if (is_array($post_type)) {
            $post_type = $post_type[0] ?? 'mcw_thread';
        }
        $element_type = 'post_' . $post_type;

        // BN translation clones that have a separate EN original → hide from feeds.
        $dup_bn = $wpdb->get_col($wpdb->prepare(
            "SELECT bn.element_id
             FROM {$table} bn
             INNER JOIN {$table} en
               ON en.trid = bn.trid
              AND en.element_type = bn.element_type
              AND en.language_code = 'en'
             WHERE bn.element_type = %s
               AND bn.language_code = 'bn'
               AND bn.element_id <> en.element_id",
            $element_type
        ));
        if ($dup_bn) {
            $exclude = array_map('intval', $dup_bn);
            $existing = isset($args['post__not_in']) ? array_map('intval', (array) $args['post__not_in']) : [];
            $args['post__not_in'] = array_values(array_unique(array_merge($existing, $exclude)));
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

    /**
     * Always resolve to the canonical EN post. BN is a translated view of the same thread,
     * not a separate WPML sibling used for reads.
     */
    private static function resolve_thread_id(int $post_id, string $lang): int
    {
        $map = self::thread_translations($post_id);
        return isset($map['en']) ? (int) $map['en'] : $post_id;
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

        register_rest_route($ns, '/online', [
            'methods' => 'GET',
            'callback' => [self::class, 'online'],
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
                'permission_callback' => [self::class, 'rest_permission_auth'],
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
                'permission_callback' => [self::class, 'rest_permission_auth'],
            ],
            [
                'methods' => 'DELETE',
                'callback' => [self::class, 'delete_thread'],
                'permission_callback' => [self::class, 'rest_permission_auth'],
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
            'permission_callback' => [self::class, 'rest_permission_auth'],
        ]);

        register_rest_route($ns, '/threads/(?P<id>[\\d]+)/pin', [
            'methods' => 'POST',
            'callback' => [self::class, 'toggle_pin'],
            'permission_callback' => [self::class, 'rest_permission_auth'],
        ]);

        register_rest_route($ns, '/comments', [
            'methods' => 'POST',
            'callback' => [self::class, 'create_comment'],
            'permission_callback' => [self::class, 'rest_permission_auth'],
        ]);

        register_rest_route($ns, '/comments/(?P<id>[\\d]+)', [
            'methods' => 'DELETE',
            'callback' => [self::class, 'delete_comment'],
            'permission_callback' => [self::class, 'rest_permission_auth'],
        ]);

        register_rest_route($ns, '/likes', [
            'methods' => 'POST',
            'callback' => [self::class, 'toggle_like'],
            'permission_callback' => [self::class, 'rest_permission_auth'],
        ]);

        register_rest_route($ns, '/follows', [
            'methods' => 'POST',
            'callback' => [self::class, 'toggle_follow'],
            'permission_callback' => [self::class, 'rest_permission_auth'],
        ]);

        register_rest_route($ns, '/reports', [
            'methods' => 'POST',
            'callback' => [self::class, 'create_report'],
            'permission_callback' => [self::class, 'rest_permission_auth'],
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
            'permission_callback' => [self::class, 'rest_permission_auth'],
        ]);

        register_rest_route($ns, '/notifications/read', [
            'methods' => 'POST',
            'callback' => [self::class, 'notifications_read'],
            'permission_callback' => [self::class, 'rest_permission_auth'],
        ]);

        register_rest_route($ns, '/me', [
            'methods' => 'PATCH',
            'callback' => [self::class, 'patch_me'],
            'permission_callback' => [self::class, 'rest_permission_auth'],
        ]);

        register_rest_route($ns, '/nameplate', [
            'methods' => 'GET',
            'callback' => [self::class, 'nameplate_catalog'],
            'permission_callback' => '__return_true',
        ]);

        register_rest_route($ns, '/me/nameplate', [
            'methods' => 'PATCH',
            'callback' => [self::class, 'patch_nameplate'],
            'permission_callback' => [self::class, 'rest_permission_auth'],
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
            'permission_callback' => [self::class, 'rest_permission_auth'],
        ]);

        register_rest_route($ns, '/auth/password', [
            'methods' => 'POST',
            'callback' => [self::class, 'change_password'],
            'permission_callback' => [self::class, 'rest_permission_auth'],
        ]);

        register_rest_route($ns, '/auth/forgot', [
            'methods' => 'POST',
            'callback' => [self::class, 'forgot_password'],
            'permission_callback' => '__return_true',
        ]);

        register_rest_route($ns, '/auth/reset', [
            'methods' => 'POST',
            'callback' => [self::class, 'reset_password'],
            'permission_callback' => '__return_true',
        ]);

        register_rest_route($ns, '/auth/verify-email', [
            'methods' => 'POST',
            'callback' => [self::class, 'verify_email_stub'],
            'permission_callback' => '__return_true',
        ]);

        register_rest_route($ns, '/auth/account', [
            'methods' => 'DELETE',
            'callback' => [self::class, 'delete_account'],
            'permission_callback' => [self::class, 'rest_permission_auth'],
        ]);

        register_rest_route($ns, '/admin/stats', [
            'methods' => 'GET',
            'callback' => [self::class, 'admin_stats'],
            'permission_callback' => [self::class, 'rest_permission_admin'],
        ]);

        register_rest_route($ns, '/admin/users', [
            'methods' => 'GET',
            'callback' => [self::class, 'admin_users'],
            'permission_callback' => [self::class, 'rest_permission_admin'],
        ]);

        register_rest_route($ns, '/admin/reports', [
            'methods' => 'GET',
            'callback' => [self::class, 'admin_reports'],
            'permission_callback' => [self::class, 'rest_permission_mod'],
        ]);

        register_rest_route($ns, '/admin/nameplate', [
            [
                'methods' => 'GET',
                'callback' => [self::class, 'admin_nameplate_get'],
                'permission_callback' => [self::class, 'rest_permission_admin'],
            ],
            [
                'methods' => 'POST',
                'callback' => [self::class, 'admin_nameplate_post'],
                'permission_callback' => [self::class, 'rest_permission_admin'],
            ],
        ]);

        register_rest_route($ns, '/admin/reset', [
            'methods' => 'POST',
            'callback' => [self::class, 'admin_reset'],
            'permission_callback' => [self::class, 'rest_permission_admin'],
        ]);

        register_rest_route($ns, '/admin/categories', [
            'methods' => 'POST',
            'callback' => [self::class, 'admin_category'],
            'permission_callback' => [self::class, 'rest_permission_admin'],
        ]);

        register_rest_route($ns, '/admin/categories/(?P<id>[\\w]+)', [
            'methods' => 'DELETE',
            'callback' => [self::class, 'admin_delete_category'],
            'permission_callback' => [self::class, 'rest_permission_admin'],
        ]);

        register_rest_route($ns, '/admin/categories/(?P<id>[\\w]+)/featured', [
            'methods' => 'POST',
            'callback' => [self::class, 'admin_feature_category'],
            'permission_callback' => [self::class, 'rest_permission_admin'],
        ]);

        register_rest_route($ns, '/admin/ads', [
            'methods' => 'POST',
            'callback' => [self::class, 'admin_ad'],
            'permission_callback' => [self::class, 'rest_permission_admin'],
        ]);

        register_rest_route($ns, '/admin/ads/(?P<id>[\\d]+)', [
            'methods' => 'DELETE',
            'callback' => [self::class, 'admin_delete_post'],
            'permission_callback' => [self::class, 'rest_permission_admin'],
        ]);

        register_rest_route($ns, '/admin/games', [
            'methods' => 'POST',
            'callback' => [self::class, 'admin_game'],
            'permission_callback' => [self::class, 'rest_permission_admin'],
        ]);

        register_rest_route($ns, '/admin/games/(?P<id>[\\d]+)', [
            'methods' => 'DELETE',
            'callback' => [self::class, 'admin_delete_post'],
            'permission_callback' => [self::class, 'rest_permission_admin'],
        ]);

        register_rest_route($ns, '/admin/providers', [
            'methods' => 'POST',
            'callback' => [self::class, 'admin_provider'],
            'permission_callback' => [self::class, 'rest_permission_admin'],
        ]);

        register_rest_route($ns, '/admin/providers/(?P<id>[\\d]+)/home-top', [
            'methods' => 'POST',
            'callback' => [self::class, 'admin_provider_home_top'],
            'permission_callback' => [self::class, 'rest_permission_admin'],
        ]);

        register_rest_route($ns, '/admin/providers/(?P<id>[\\d]+)', [
            'methods' => 'DELETE',
            'callback' => [self::class, 'admin_delete_post'],
            'permission_callback' => [self::class, 'rest_permission_admin'],
        ]);

        register_rest_route($ns, '/admin/settings/ads-rotate', [
            'methods' => 'POST',
            'callback' => [self::class, 'admin_ads_rotate'],
            'permission_callback' => [self::class, 'rest_permission_admin'],
        ]);

        register_rest_route($ns, '/admin/users/(?P<id>[\\d]+)/role', [
            'methods' => 'POST',
            'callback' => [self::class, 'admin_set_role'],
            'permission_callback' => [self::class, 'rest_permission_admin'],
        ]);

        register_rest_route($ns, '/admin/users/(?P<id>[\\d]+)/nameplate', [
            'methods' => 'POST',
            'callback' => [self::class, 'admin_user_nameplate'],
            'permission_callback' => [self::class, 'rest_permission_admin'],
        ]);

        register_rest_route($ns, '/mod/reports/(?P<id>[\\w]+)/resolve', [
            'methods' => 'POST',
            'callback' => [self::class, 'resolve_report'],
            'permission_callback' => [self::class, 'rest_permission_mod'],
        ]);

        register_rest_route($ns, '/mod/content/(?P<id>[\\d]+)/approve', [
            'methods' => 'POST',
            'callback' => [self::class, 'mod_approve_content'],
            'permission_callback' => [self::class, 'rest_permission_mod'],
        ]);
        register_rest_route($ns, '/mod/content/(?P<id>[\\d]+)/hold', [
            'methods' => 'POST',
            'callback' => [self::class, 'mod_hold_content'],
            'permission_callback' => [self::class, 'rest_permission_mod'],
        ]);

        register_rest_route($ns, '/mod/users/(?P<id>[\\d]+)/ban', [
            'methods' => 'POST',
            'callback' => [self::class, 'ban_user'],
            'permission_callback' => [self::class, 'rest_permission_mod'],
        ]);

        register_rest_route($ns, '/uploads', [
            'methods' => 'POST',
            'callback' => [self::class, 'upload'],
            'permission_callback' => [self::class, 'rest_permission_auth'],
        ]);
        register_rest_route($ns, '/uploads/(?P<id>[\\d]+)', [
            'methods' => 'DELETE',
            'callback' => [self::class, 'delete_upload'],
            'permission_callback' => [self::class, 'rest_permission_auth'],
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

    private static function require_admin(WP_REST_Request $request): WP_User|WP_REST_Response
    {
        if ($resp = self::guard($request)) {
            return $resp;
        }
        $user = self::require_user();
        if ($user instanceof WP_REST_Response) {
            return $user;
        }
        if (!MCW_Forum_Auth::is_admin_user($user) || !user_can($user, 'manage_options')) {
            return new WP_REST_Response(['ok' => false, 'error' => 'Forbidden.'], 403);
        }
        return $user;
    }

    private static function require_mod(WP_REST_Request $request): WP_User|WP_REST_Response
    {
        if ($resp = self::guard($request)) {
            return $resp;
        }
        $user = self::require_user();
        if ($user instanceof WP_REST_Response) {
            return $user;
        }
        if (!MCW_Forum_Auth::is_mod_user($user)) {
            return new WP_REST_Response(['ok' => false, 'error' => 'Forbidden.'], 403);
        }
        return $user;
    }

    /** REST permission_callback: authenticated non-banned forum user. */
    public static function rest_permission_auth(): bool
    {
        $user = MCW_Forum_Auth::current_wp_user();
        return $user instanceof WP_User && !get_user_meta($user->ID, 'mcw_banned', true);
    }

    /** REST permission_callback: admin with manage_options. */
    public static function rest_permission_admin(): bool
    {
        $user = MCW_Forum_Auth::current_wp_user();
        $ok = $user instanceof WP_User
            && !get_user_meta($user->ID, 'mcw_banned', true)
            && MCW_Forum_Auth::is_admin_user($user)
            && user_can($user, 'manage_options');
        if (!$ok) {
            $route = $_SERVER['REQUEST_URI'] ?? '';
            MCW_Forum_Security_Log::event('unauthorized_admin', [
                'user' => $user instanceof WP_User ? (string) $user->ID : '0',
                'route' => is_string($route) ? $route : '',
            ]);
        }
        return $ok;
    }

    /** REST permission_callback: moderator or admin. */
    public static function rest_permission_mod(): bool
    {
        $user = MCW_Forum_Auth::current_wp_user();
        $ok = $user instanceof WP_User
            && !get_user_meta($user->ID, 'mcw_banned', true)
            && MCW_Forum_Auth::is_mod_user($user);
        if (!$ok) {
            $route = $_SERVER['REQUEST_URI'] ?? '';
            MCW_Forum_Security_Log::event('unauthorized_mod', [
                'user' => $user instanceof WP_User ? (string) $user->ID : '0',
                'route' => is_string($route) ? $route : '',
            ]);
        }
        return $ok;
    }

    private static function client_ip(): string
    {
        return MCW_Forum_Security_Log::client_ip();
    }

    private static function rate_limit(string $bucket, int $max, int $window_sec): ?WP_REST_Response
    {
        $key = 'mcw_rl_' . md5($bucket . '|' . self::client_ip());
        $n = (int) get_transient($key);
        if ($n >= $max) {
            MCW_Forum_Security_Log::event('rate_limit', ['bucket' => $bucket]);
            return new WP_REST_Response(['ok' => false, 'error' => 'Too many attempts. Try again later.'], 429);
        }
        set_transient($key, $n + 1, $window_sec);
        return null;
    }

    /**
     * @param mixed $blocks
     * @return array|WP_REST_Response
     */
    private static function sanitize_blocks($blocks, string $context = 'post')
    {
        $clean = MCW_Forum_Content_Guard::sanitize_blocks($blocks, $context);
        if (is_wp_error($clean)) {
            return MCW_Forum_Content_Guard::error_response($clean);
        }
        return $clean;
    }

    private static function can_manage_post(WP_User $user, WP_Post $post): bool
    {
        if ((int) $post->post_author === (int) $user->ID) {
            return true;
        }
        return MCW_Forum_Auth::is_mod_user($user);
    }

    public static function bootstrap(WP_REST_Request $request): WP_REST_Response
    {
        $user = MCW_Forum_Auth::current_wp_user();
        $lang = self::request_lang($request) ?: 'en';
        return new WP_REST_Response(array_merge(['ok' => true], MCW_Forum_Forum::load_bootstrap($user, $lang)));
    }

    /** Online members (active session within 15 minutes). Touching auth refreshes last_seen. */
    public static function online(WP_REST_Request $request): WP_REST_Response
    {
        MCW_Forum_Auth::current_wp_user();
        $limit = min(24, max(1, (int) ($request->get_param('limit') ?: 8)));
        $payload = MCW_Forum_Forum::online_users($limit);
        return new WP_REST_Response([
            'ok' => true,
            'users' => $payload['users'],
            'total' => $payload['total'],
        ]);
    }

    public static function home(WP_REST_Request $request): WP_REST_Response
    {
        $tab = sanitize_key((string) ($request->get_param('tab') ?: 'latest'));
        if (!in_array($tab, ['latest', 'popular', 'trending', 'saved'], true)) {
            $tab = 'latest';
        }
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
            $payload['feed'] = self::build_home_feed($tab, 8, $viewer_id, $lang, $base);
        }

        if ($sections === 'extras' || $sections === 'all') {
            $cache_key = 'mcw_home_extras_' . $lang;
            $cached_extras = get_transient($cache_key);
            if (is_array($cached_extras)
                && isset($cached_extras['reviews'], $cached_extras['guides'], $cached_extras['wins'], $cached_extras['weekly'])
            ) {
                $payload['reviews'] = $cached_extras['reviews'];
                $payload['guides'] = $cached_extras['guides'];
                $payload['wins'] = $cached_extras['wins'];
                $payload['weekly'] = $cached_extras['weekly'];
            } else {
                $extras = [
                    'reviews' => $by_slug('casino-reviews', 3),
                    'guides' => $by_slug('guides', 3),
                    'wins' => $by_slug('big-wins', 3),
                    'weekly' => MCW_Forum_Forum::weekly_contributors(3),
                ];
                set_transient($cache_key, $extras, 45);
                $payload['reviews'] = $extras['reviews'];
                $payload['guides'] = $extras['guides'];
                $payload['wins'] = $extras['wins'];
                $payload['weekly'] = $extras['weekly'];
            }
        }

        return new WP_REST_Response($payload);
    }

    /**
     * Home discussion feed: compact (8) + tab-aware sorting.
     *
     * @param array<string,mixed> $base
     * @return array{page:int,limit:int,total:int,threads:array}
     */
    private static function build_home_feed(string $tab, int $limit, ?int $viewer_id, string $lang, array $base): array
    {
        global $wpdb;
        $limit = max(1, min(20, $limit));

        if ($tab === 'saved') {
            if (!$viewer_id) {
                return ['page' => 1, 'limit' => $limit, 'total' => 0, 'threads' => []];
            }
            $table = $wpdb->prefix . 'mcw_bookmarks';
            $total = (int) $wpdb->get_var($wpdb->prepare(
                "SELECT COUNT(*) FROM {$table} WHERE user_id = %d",
                $viewer_id
            ));
            $ids = array_map('intval', $wpdb->get_col($wpdb->prepare(
                "SELECT thread_id FROM {$table} WHERE user_id = %d ORDER BY created_at DESC LIMIT %d",
                $viewer_id,
                $limit
            )));
            if (!$ids) {
                return ['page' => 1, 'limit' => $limit, 'total' => $total, 'threads' => []];
            }
            $q = new WP_Query(self::with_lang_query(array_merge($base, [
                'post__in' => $ids,
                'posts_per_page' => $limit,
                'orderby' => 'post__in',
            ]), $lang));
            return [
                'page' => 1,
                'limit' => $limit,
                'total' => $total,
                'threads' => MCW_Forum_Forum::decorate_threads($q->posts, $viewer_id, $lang, true),
            ];
        }

        if ($tab === 'popular' || $tab === 'trending') {
            // Candidate pool (lang-filtered), then score in PHP.
            $pool = new WP_Query(self::with_lang_query(array_merge($base, [
                'posts_per_page' => 80,
                'orderby' => 'date',
                'order' => 'DESC',
                'fields' => 'ids',
                'no_found_rows' => true,
            ]), $lang));
            $candidate_ids = array_map('intval', $pool->posts ?: []);
            if (!$candidate_ids) {
                return ['page' => 1, 'limit' => $limit, 'total' => 0, 'threads' => []];
            }

            $likes_table = $wpdb->prefix . 'mcw_likes';
            $placeholders = implode(',', array_fill(0, count($candidate_ids), '%d'));
            $like_rows = $wpdb->get_results($wpdb->prepare(
                "SELECT target_id, COUNT(*) AS cnt
                 FROM {$likes_table}
                 WHERE target_type = 'thread' AND target_id IN ($placeholders)
                 GROUP BY target_id",
                ...$candidate_ids
            ), ARRAY_A) ?: [];
            $like_map = [];
            foreach ($like_rows as $row) {
                $like_map[(int) $row['target_id']] = (int) $row['cnt'];
            }

            update_meta_cache('post', $candidate_ids);
            $now = time();
            $ranked = [];
            foreach ($candidate_ids as $id) {
                $likes = $like_map[$id] ?? 0;
                $views = (int) get_post_meta($id, 'mcw_views', true);
                $pinned = (bool) get_post_meta($id, 'mcw_pinned', true);
                $gmt = get_post_field('post_date_gmt', $id);
                $created = $gmt ? strtotime($gmt . ' UTC') : $now;
                $age_h = max(0.5, ($now - $created) / 3600);
                if ($tab === 'popular') {
                    $score = ($likes * 4) + $views + ($pinned ? 1000 : 0);
                } else {
                    // Trending: engagement with recency boost
                    $score = (($likes * 3) + $views) / sqrt($age_h) + ($pinned ? 1000 : 0);
                }
                $ranked[] = ['id' => $id, 'score' => $score, 'pinned' => $pinned ? 1 : 0];
            }
            usort($ranked, static function ($a, $b) {
                return ($b['pinned'] <=> $a['pinned']) ?: ($b['score'] <=> $a['score']);
            });
            $total = count($ranked);
            $ids = array_map(static fn ($r) => (int) $r['id'], array_slice($ranked, 0, $limit));
            $q = new WP_Query(array_merge($base, [
                'post__in' => $ids,
                'posts_per_page' => $limit,
                'orderby' => 'post__in',
            ]));
            return [
                'page' => 1,
                'limit' => $limit,
                'total' => $total,
                'threads' => MCW_Forum_Forum::decorate_threads($q->posts, $viewer_id, $lang, true),
            ];
        }

        // latest (default): newest first; pinned floated to top after fetch
        $q = new WP_Query(self::with_lang_query(array_merge($base, [
            'posts_per_page' => max($limit * 3, 24),
            'orderby' => 'date',
            'order' => 'DESC',
        ]), $lang));
        $threads = MCW_Forum_Forum::decorate_threads($q->posts, $viewer_id, $lang, true);
        usort($threads, static function ($a, $b) {
            $ap = !empty($a['pinned']) ? 1 : 0;
            $bp = !empty($b['pinned']) ? 1 : 0;
            if ($ap !== $bp) {
                return $bp <=> $ap;
            }
            return strcmp((string) ($b['createdAt'] ?? ''), (string) ($a['createdAt'] ?? ''));
        });
        $threads = array_slice($threads, 0, $limit);
        return [
            'page' => 1,
            'limit' => $limit,
            'total' => (int) $q->found_posts,
            'threads' => $threads,
        ];
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
        $settings = MCW_Forum_Content_Guard::settings();
        if ($rl = self::rate_limit('thread:' . $user->ID, (int) $settings['thread_rate_max'], (int) $settings['thread_rate_window_sec'])) {
            return $rl;
        }
        $body = MCW_Forum_Forum::json_body($request);
        $title = MCW_Forum_Content_Guard::sanitize_title((string) ($body['title'] ?? ''));
        if (is_wp_error($title)) {
            return MCW_Forum_Content_Guard::error_response($title);
        }
        $forum_id = (string) ($body['forumId'] ?? '');
        $raw_blocks = $body['body'] ?? [];
        if (!is_array($raw_blocks)) {
            return new WP_REST_Response(['ok' => false, 'error' => 'Title and body required.'], 400);
        }
        $blocks = self::sanitize_blocks($raw_blocks);
        if ($blocks instanceof WP_REST_Response) {
            return $blocks;
        }
        $content = MCW_Forum_Content_Guard::plain_from_blocks($blocks);
        if ($content === '' && count($blocks) === 0) {
            return new WP_REST_Response(['ok' => false, 'error' => 'Title and body required.'], 400);
        }
        $hold = false;
        $gate = MCW_Forum_Content_Guard::assert_can_write($user, 'thread', $title, $content);
        if ($gate instanceof WP_Error) {
            if ($gate->get_error_code() === 'mcw_hold') {
                $hold = true;
            } else {
                return MCW_Forum_Content_Guard::error_response($gate);
            }
        }
        $tags = [];
        if (isset($body['tags']) && is_array($body['tags'])) {
            $tags = MCW_Forum_Content_Guard::sanitize_tags($body['tags']);
            if (is_wp_error($tags)) {
                return MCW_Forum_Content_Guard::error_response($tags);
            }
        }
        $id = wp_insert_post([
            'post_type' => 'mcw_thread',
            'post_status' => $hold ? 'pending' : 'publish',
            'post_title' => $title,
            'post_content' => $content,
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
        update_post_meta($id, 'mcw_tags', $tags);
        update_post_meta($id, 'mcw_views', 0);
        if ($hold) {
            update_post_meta($id, 'mcw_held', 1);
            update_post_meta($id, 'mcw_spam_score', (int) ($gate->get_error_data()['score'] ?? 50));
            MCW_Forum_Content_Guard::flag_for_moderation((int) $user->ID, 'thread', (string) $id, 'auto:soft-spam-hold');
        }
        $lang = self::request_lang($request) ?: 'en';
        // Canonical language is always EN; BN UI gets the same post with translated fields.
        self::set_post_language((int) $id, 'mcw_thread', 'en', null, null);
        update_post_meta((int) $id, 'mcw_source_lang', $lang);
        MCW_Forum_Translate::ensure_thread((int) $id);
        $post = get_post($id);
        if ($hold) {
            return new WP_REST_Response([
                'ok' => true,
                'held' => true,
                'error' => 'Post submitted for moderation review.',
                'thread' => null,
            ], 202);
        }
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
        if (!self::can_manage_post($user, $post)) {
            return new WP_REST_Response(['ok' => false, 'error' => 'Forbidden.'], 403);
        }
        $body = MCW_Forum_Forum::json_body($request);
        $update = ['ID' => $post->ID];
        if (!empty($body['title'])) {
            $title = MCW_Forum_Content_Guard::sanitize_title((string) $body['title']);
            if (is_wp_error($title)) {
                return MCW_Forum_Content_Guard::error_response($title);
            }
            $update['post_title'] = $title;
        }
        // Headless clients send block bodies only — never accept HTML into post_content.
        if (isset($body['content']) && is_string($body['content'])) {
            $plain = wp_strip_all_tags(sanitize_textarea_field($body['content']));
            foreach (MCW_Forum_Content_Guard::extract_urls($plain) as $u) {
                $checked = MCW_Forum_Content_Guard::check_url($u, 'link');
                if (is_wp_error($checked)) {
                    return MCW_Forum_Content_Guard::error_response($checked);
                }
            }
            $update['post_content'] = $plain;
        }
        if (isset($body['body']) && is_array($body['body'])) {
            $blocks = self::sanitize_blocks($body['body']);
            if ($blocks instanceof WP_REST_Response) {
                return $blocks;
            }
            update_post_meta($post->ID, 'mcw_body', $blocks);
            $update['post_content'] = MCW_Forum_Content_Guard::plain_from_blocks($blocks);
            MCW_Forum_Translate::ensure_thread((int) $post->ID);
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
        $post = get_post((int) $request['id']);
        if (!$post || $post->post_type !== 'mcw_thread') {
            return new WP_REST_Response(['ok' => false, 'error' => 'Not found.'], 404);
        }
        if (!self::can_manage_post($user, $post)) {
            return new WP_REST_Response(['ok' => false, 'error' => 'Forbidden.'], 403);
        }
        wp_trash_post((int) $post->ID);
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
        $settings = MCW_Forum_Content_Guard::settings();
        if ($rl = self::rate_limit('comment:' . $user->ID, (int) $settings['comment_rate_max'], (int) $settings['comment_rate_window_sec'])) {
            return $rl;
        }
        $blocks = self::sanitize_blocks($body['body'] ?? []);
        if ($blocks instanceof WP_REST_Response) {
            return $blocks;
        }
        $content = MCW_Forum_Content_Guard::plain_from_blocks($blocks);
        if ($content === '' && count($blocks) === 0) {
            return new WP_REST_Response(['ok' => false, 'error' => 'Write something or insert an image.'], 400);
        }
        $hold = false;
        $gate = MCW_Forum_Content_Guard::assert_can_write($user, 'comment', 'Reply', $content);
        if ($gate instanceof WP_Error) {
            if ($gate->get_error_code() === 'mcw_hold') {
                $hold = true;
            } else {
                return MCW_Forum_Content_Guard::error_response($gate);
            }
        }
        $id = wp_insert_post([
            'post_type' => 'mcw_reply',
            'post_status' => $hold ? 'pending' : 'publish',
            'post_title' => 'Reply',
            'post_content' => $content !== '' ? $content : ' ',
            'post_author' => $user->ID,
        ], true);
        if (is_wp_error($id)) {
            return new WP_REST_Response(['ok' => false, 'error' => $id->get_error_message()], 400);
        }
        // Attach to canonical (EN) thread id so comments stay visible across language versions
        $translations = self::thread_translations((int) $thread_id);
        $canonical = $translations['en'] ?? $thread_id;
        update_post_meta($id, 'mcw_thread_id', (string) $canonical);
        update_post_meta($id, 'mcw_body', $blocks);
        if ($hold) {
            update_post_meta($id, 'mcw_held', 1);
            update_post_meta($id, 'mcw_spam_score', (int) ($gate->get_error_data()['score'] ?? 50));
            MCW_Forum_Content_Guard::flag_for_moderation((int) $user->ID, 'comment', (string) $id, 'auto:soft-spam-hold');
        }
        if (!empty($body['parentId'])) {
            $parent_id = (string) $body['parentId'];
            $parent = get_post((int) $parent_id);
            if ($parent && $parent->post_type === 'mcw_reply') {
                $parent_thread = (string) get_post_meta($parent->ID, 'mcw_thread_id', true);
                if ($parent_thread === '' || $parent_thread === (string) $canonical) {
                    update_post_meta($id, 'mcw_parent_id', $parent_id);
                }
            }
        }
        $lang = self::request_lang($request) ?: 'en';
        // Translate once → store EN + BN for all future viewers; keep reply as EN canonical.
        MCW_Forum_Translate::ensure_comment((int) $id, $blocks, $lang);
        self::set_post_language((int) $id, 'mcw_reply', 'en', null, null);
        update_post_meta((int) $id, 'mcw_source_lang', $lang);

        if ($hold) {
            return new WP_REST_Response([
                'ok' => true,
                'held' => true,
                'error' => 'Reply submitted for moderation review.',
                'comment' => null,
            ], 202);
        }

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
        $post = get_post((int) $request['id']);
        if (!$post || $post->post_type !== 'mcw_reply') {
            return new WP_REST_Response(['ok' => false, 'error' => 'Not found.'], 404);
        }
        if (!self::can_manage_post($user, $post)) {
            return new WP_REST_Response(['ok' => false, 'error' => 'Forbidden.'], 403);
        }
        wp_trash_post((int) $post->ID);
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
        $thread = get_post($thread_id);
        if (!$thread || $thread->post_type !== 'mcw_thread' || $thread->post_status !== 'publish') {
            return new WP_REST_Response(['ok' => false, 'error' => 'Thread not found.'], 404);
        }
        $existing = $wpdb->get_var($wpdb->prepare(
            "SELECT id FROM {$table} WHERE user_id = %d AND thread_id = %d",
            $user->ID,
            $thread_id
        ));
        if ($existing) {
            MCW_Forum_DB::delete($table, ['id' => (int) $existing], ['id' => '%d']);
            return new WP_REST_Response(['ok' => true, 'bookmarked' => false]);
        }
        MCW_Forum_DB::insert($table, [
            'user_id' => $user->ID,
            'thread_id' => $thread_id,
            'created_at' => current_time('mysql'),
        ], [
            'user_id' => '%d',
            'thread_id' => '%d',
            'created_at' => '%s',
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
        $type = sanitize_key((string) ($body['targetType'] ?? ''));
        $target = sanitize_text_field((string) ($body['targetId'] ?? ''));
        if (!in_array($type, ['thread', 'comment'], true) || $target === '' || !ctype_digit($target)) {
            return new WP_REST_Response(['ok' => false, 'error' => 'Invalid like target.'], 400);
        }
        $target_post = get_post((int) $target);
        $expected_type = $type === 'thread' ? 'mcw_thread' : 'mcw_reply';
        if (!$target_post || $target_post->post_type !== $expected_type) {
            return new WP_REST_Response(['ok' => false, 'error' => 'Target not found.'], 404);
        }
        global $wpdb;
        $table = $wpdb->prefix . 'mcw_likes';
        $existing = $wpdb->get_var($wpdb->prepare(
            "SELECT id FROM {$table} WHERE user_id = %d AND target_type = %s AND target_id = %s",
            $user->ID,
            $type,
            $target
        ));
        if ($existing) {
            MCW_Forum_DB::delete($table, ['id' => (int) $existing], ['id' => '%d']);
            return new WP_REST_Response(['ok' => true, 'liked' => false]);
        }
        MCW_Forum_DB::insert($table, [
            'user_id' => $user->ID,
            'target_type' => $type,
            'target_id' => $target,
            'created_at' => current_time('mysql'),
        ], [
            'user_id' => '%d',
            'target_type' => '%s',
            'target_id' => '%s',
            'created_at' => '%s',
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
        if ($following <= 0 || $following === (int) $user->ID || !get_user_by('id', $following)) {
            return new WP_REST_Response(['ok' => false, 'error' => 'Invalid user.'], 400);
        }
        global $wpdb;
        $table = $wpdb->prefix . 'mcw_follows';
        $existing = $wpdb->get_var($wpdb->prepare(
            "SELECT id FROM {$table} WHERE follower_id = %d AND following_id = %d",
            $user->ID,
            $following
        ));
        if ($existing) {
            MCW_Forum_DB::delete($table, ['id' => (int) $existing], ['id' => '%d']);
            return new WP_REST_Response(['ok' => true, 'following' => false]);
        }
        MCW_Forum_DB::insert($table, [
            'follower_id' => $user->ID,
            'following_id' => $following,
            'created_at' => current_time('mysql'),
        ], [
            'follower_id' => '%d',
            'following_id' => '%d',
            'created_at' => '%s',
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
        $settings = MCW_Forum_Content_Guard::settings();
        if ($rl = self::rate_limit('report:' . $user->ID, (int) $settings['report_rate_max'], (int) $settings['report_rate_window_sec'])) {
            return $rl;
        }
        $body = MCW_Forum_Forum::json_body($request);
        $target_type = sanitize_key((string) ($body['targetType'] ?? ''));
        $target_id = sanitize_text_field((string) ($body['targetId'] ?? ''));
        $reason = sanitize_textarea_field((string) ($body['reason'] ?? ''));
        $reason = wp_strip_all_tags($reason);
        if ($target_type === '' || $target_id === '') {
            return new WP_REST_Response(['ok' => false, 'error' => 'Invalid report target.'], 400);
        }
        if (!in_array($target_type, ['thread', 'comment', 'user', 'reply'], true)) {
            return new WP_REST_Response(['ok' => false, 'error' => 'Invalid report type.'], 400);
        }
        if (mb_strlen($reason) > 1000) {
            return new WP_REST_Response(['ok' => false, 'error' => 'Reason is too long.'], 400);
        }
        global $wpdb;
        $table = $wpdb->prefix . 'mcw_reports';
        $dup = $wpdb->get_var($wpdb->prepare(
            "SELECT id FROM {$table} WHERE reporter_id = %d AND target_type = %s AND target_id = %s AND resolved = 0 LIMIT 1",
            $user->ID,
            $target_type,
            $target_id
        ));
        if ($dup) {
            return new WP_REST_Response(['ok' => true, 'duplicate' => true]);
        }
        $id = 'rep_' . wp_generate_password(10, false, false);
        MCW_Forum_DB::insert($table, [
            'id' => $id,
            'reporter_id' => $user->ID,
            'target_type' => $target_type,
            'target_id' => $target_id,
            'reason' => $reason,
            'resolved' => 0,
            'created_at' => current_time('mysql'),
        ], [
            'id' => '%s',
            'reporter_id' => '%d',
            'target_type' => '%s',
            'target_id' => '%s',
            'reason' => '%s',
            'resolved' => '%d',
            'created_at' => '%s',
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
            "SELECT id, user_id, type, message, link, is_read, created_at
             FROM {$wpdb->prefix}mcw_notifications
             WHERE user_id = %d
             ORDER BY created_at DESC
             LIMIT %d",
            $user->ID,
            50
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
        MCW_Forum_DB::update(
            $wpdb->prefix . 'mcw_notifications',
            ['is_read' => 1],
            ['user_id' => (int) $user->ID],
            ['is_read' => '%d'],
            ['user_id' => '%d']
        );
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
        $settings = MCW_Forum_Content_Guard::settings();
        if ($rl = self::rate_limit('profile:' . $user->ID, (int) $settings['profile_rate_max'], (int) $settings['profile_rate_window_sec'])) {
            return $rl;
        }
        $body = MCW_Forum_Forum::json_body($request);
        // Never accept role / capability / password mass-assignment on profile patch.
        unset($body['role'], $body['mcw_role'], $body['password'], $body['user_pass'], $body['capabilities']);
        if (isset($body['displayName'])) {
            $name = sanitize_text_field((string) $body['displayName']);
            $name = wp_strip_all_tags($name);
            if (mb_strlen($name) > 60) {
                return new WP_REST_Response(['ok' => false, 'error' => 'Display name is too long.'], 400);
            }
            if (MCW_Forum_Content_Guard::extract_urls($name)) {
                return new WP_REST_Response(['ok' => false, 'error' => 'Display name cannot contain links.'], 400);
            }
            $update = MCW_Forum_DB::filter_user_update_fields([
                'ID' => $user->ID,
                'display_name' => $name,
            ]);
            wp_update_user($update);
        }
        if (isset($body['bio'])) {
            $bio = MCW_Forum_Content_Guard::sanitize_bio((string) $body['bio']);
            if (is_wp_error($bio)) {
                return MCW_Forum_Content_Guard::error_response($bio);
            }
            MCW_Forum_DB::update_user_meta_allowed((int) $user->ID, 'mcw_bio', $bio);
        }
        if (isset($body['avatar'])) {
            $avatar = MCW_Forum_Content_Guard::check_url((string) $body['avatar'], 'avatar');
            if (is_wp_error($avatar)) {
                return MCW_Forum_Content_Guard::error_response($avatar);
            }
            MCW_Forum_DB::update_user_meta_allowed((int) $user->ID, 'mcw_avatar', $avatar);
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
        $allowed_frames = ['none', 'gold', 'neon', 'royal'];
        $allowed_emblems = ['none', 'crown', 'chip', 'diamond'];
        if (isset($body['frame'])) {
            $frame = sanitize_key((string) $body['frame']);
            if (!in_array($frame, $allowed_frames, true)) {
                return new WP_REST_Response(['ok' => false, 'error' => 'Invalid frame.'], 400);
            }
            MCW_Forum_DB::update_user_meta_allowed((int) $user->ID, 'mcw_name_frame', $frame);
        }
        if (isset($body['emblem'])) {
            $emblem = sanitize_key((string) $body['emblem']);
            if (!in_array($emblem, $allowed_emblems, true)) {
                return new WP_REST_Response(['ok' => false, 'error' => 'Invalid emblem.'], 400);
            }
            MCW_Forum_DB::update_user_meta_allowed((int) $user->ID, 'mcw_name_emblem', $emblem);
        }
        return new WP_REST_Response(['ok' => true, 'user' => MCW_Forum_Serialize::public_user(get_user_by('id', $user->ID), true)]);
    }

    public static function register(WP_REST_Request $request): WP_REST_Response
    {
        if ($resp = self::guard($request)) {
            return $resp;
        }
        if ($rl = self::rate_limit('register', 5, 30 * MINUTE_IN_SECONDS)) {
            return $rl;
        }
        $ts = MCW_Forum_Turnstile::verify_request($request);
        if (is_wp_error($ts)) {
            return new WP_REST_Response(['ok' => false, 'error' => $ts->get_error_message()], (int) ($ts->get_error_data()['status'] ?? 400));
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
        // Ignore any client-supplied role/capability fields — always subscriber/user.
        MCW_Forum_Auth::apply_forum_role((int) $id, 'user');
        MCW_Forum_DB::update_user_meta_allowed((int) $id, 'mcw_dob', sanitize_text_field((string) ($body['dateOfBirth'] ?? '')));
        MCW_Forum_Auth::issue_session((int) $id, false);
        return new WP_REST_Response(['ok' => true]);
    }

    public static function login(WP_REST_Request $request): WP_REST_Response
    {
        if ($resp = self::guard($request)) {
            return $resp;
        }
        if ($rl = self::rate_limit('login', 10, 15 * MINUTE_IN_SECONDS)) {
            return $rl;
        }
        $ts = MCW_Forum_Turnstile::verify_request($request);
        if (is_wp_error($ts)) {
            return new WP_REST_Response(['ok' => false, 'error' => $ts->get_error_message()], (int) ($ts->get_error_data()['status'] ?? 400));
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
            MCW_Forum_Security_Log::event('login_failed', [
                'login_len' => (string) strlen($login),
            ]);
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

    /**
     * Always returns a generic success to avoid account enumeration.
     * Token is stored hashed; plaintext is only emailed when mail works.
     */
    public static function forgot_password(WP_REST_Request $request): WP_REST_Response
    {
        if ($resp = self::guard($request)) {
            return $resp;
        }
        if ($rl = self::rate_limit('forgot', 5, 30 * MINUTE_IN_SECONDS)) {
            return $rl;
        }
        $ts = MCW_Forum_Turnstile::verify_request($request);
        if (is_wp_error($ts)) {
            return new WP_REST_Response(['ok' => false, 'error' => $ts->get_error_message()], (int) ($ts->get_error_data()['status'] ?? 400));
        }
        $body = MCW_Forum_Forum::json_body($request);
        $email = sanitize_email((string) ($body['email'] ?? ''));
        $generic = new WP_REST_Response([
            'ok' => true,
            'message' => 'If an account exists for that email, a reset link will be sent.',
        ]);
        if ($email === '' || !is_email($email)) {
            return $generic;
        }
        $user = get_user_by('email', $email);
        if (!$user) {
            return $generic;
        }
        $token = bin2hex(random_bytes(32));
        update_user_meta($user->ID, 'mcw_reset_hash', hash('sha256', $token));
        update_user_meta($user->ID, 'mcw_reset_expires', time() + HOUR_IN_SECONDS);
        $link = home_url('/?mcw_reset=1&uid=' . (int) $user->ID . '&token=' . rawurlencode($token));
        // Prefer SPA origin when configured.
        if (defined('MCW_CORS_ORIGIN') && is_string(MCW_CORS_ORIGIN) && MCW_CORS_ORIGIN !== '') {
            $link = rtrim(MCW_CORS_ORIGIN, '/') . '/reset-password?uid=' . (int) $user->ID . '&token=' . rawurlencode($token);
        }
        $sent = wp_mail(
            $user->user_email,
            'Password reset',
            "Use this link within one hour to reset your password:\n\n{$link}\n\nIf you did not request this, ignore this email."
        );
        if (!$sent) {
            MCW_Forum_Security_Log::event('password_reset_mail_failed', ['user' => (string) (int) $user->ID]);
        }
        return $generic;
    }

    public static function reset_password(WP_REST_Request $request): WP_REST_Response
    {
        if ($resp = self::guard($request)) {
            return $resp;
        }
        if ($rl = self::rate_limit('reset', 10, 30 * MINUTE_IN_SECONDS)) {
            return $rl;
        }
        $body = MCW_Forum_Forum::json_body($request);
        $uid = (int) ($body['userId'] ?? $body['uid'] ?? 0);
        $token = (string) ($body['token'] ?? '');
        $password = (string) ($body['password'] ?? $body['newPassword'] ?? '');
        if ($uid <= 0 || $token === '' || strlen($password) < 8) {
            return new WP_REST_Response(['ok' => false, 'error' => 'Invalid reset request.'], 400);
        }
        $user = get_user_by('id', $uid);
        if (!$user) {
            return new WP_REST_Response(['ok' => false, 'error' => 'Invalid or expired reset token.'], 400);
        }
        $hash = (string) get_user_meta($uid, 'mcw_reset_hash', true);
        $expires = (int) get_user_meta($uid, 'mcw_reset_expires', true);
        if ($hash === '' || $expires < time() || !hash_equals($hash, hash('sha256', $token))) {
            return new WP_REST_Response(['ok' => false, 'error' => 'Invalid or expired reset token.'], 400);
        }
        // Single-use: clear before setting password.
        delete_user_meta($uid, 'mcw_reset_hash');
        delete_user_meta($uid, 'mcw_reset_expires');
        wp_set_password($password, $uid);
        MCW_Forum_Auth::invalidate_user_sessions($uid);
        MCW_Forum_Security_Log::event('password_reset_completed', ['user' => (string) $uid]);
        return new WP_REST_Response(['ok' => true]);
    }

    /** Email verification not fully wired — rate-limited stub, no false success claims. */
    public static function verify_email_stub(WP_REST_Request $request): WP_REST_Response
    {
        if ($resp = self::guard($request)) {
            return $resp;
        }
        if ($rl = self::rate_limit('verify_email', 10, HOUR_IN_SECONDS)) {
            return $rl;
        }
        return new WP_REST_Response([
            'ok' => false,
            'error' => 'Email verification is not enabled on this deployment.',
        ], 501);
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
        if (strlen($next) < 8) {
            return new WP_REST_Response(['ok' => false, 'error' => 'Password must be at least 8 characters.'], 400);
        }
        if (!wp_check_password($current, $user->user_pass, $user->ID)) {
            return new WP_REST_Response(['ok' => false, 'error' => 'Current password incorrect.'], 400);
        }
        // Only the authenticated user can change their own password (no target user id accepted).
        wp_set_password($next, $user->ID);
        MCW_Forum_Auth::invalidate_user_sessions($user->ID);
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
        $body = MCW_Forum_Forum::json_body($request);
        $password = (string) ($body['password'] ?? $body['currentPassword'] ?? '');
        if ($password === '' || !wp_check_password($password, $user->user_pass, $user->ID)) {
            return new WP_REST_Response(['ok' => false, 'error' => 'Password required.'], 400);
        }
        if (MCW_Forum_Auth::is_admin_user($user)) {
            return new WP_REST_Response(['ok' => false, 'error' => 'Admin accounts cannot self-delete via API.'], 403);
        }
        require_once ABSPATH . 'wp-admin/includes/user.php';
        MCW_Forum_Auth::clear_session();
        wp_delete_user($user->ID);
        return new WP_REST_Response(['ok' => true]);
    }

    public static function admin_stats(WP_REST_Request $request): WP_REST_Response
    {
        $user = self::require_admin($request);
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

    public static function admin_users(WP_REST_Request $request): WP_REST_Response
    {
        $user = self::require_admin($request);
        if ($user instanceof WP_REST_Response) {
            return $user;
        }
        $users = get_users(['number' => 200]);
        return new WP_REST_Response([
            'ok' => true,
            'users' => array_map(static fn ($u) => MCW_Forum_Serialize::public_user($u, true), $users),
        ]);
    }

    public static function admin_reports(WP_REST_Request $request): WP_REST_Response
    {
        $user = self::require_mod($request);
        if ($user instanceof WP_REST_Response) {
            return $user;
        }
        global $wpdb;
        $rows = $wpdb->get_results(
            $wpdb->prepare(
                "SELECT id, reporter_id, target_type, target_id, reason, resolved, created_at
                 FROM {$wpdb->prefix}mcw_reports
                 ORDER BY created_at DESC
                 LIMIT %d",
                100
            )
        );
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

    public static function admin_nameplate_get(WP_REST_Request $request): WP_REST_Response
    {
        $user = self::require_admin($request);
        if ($user instanceof WP_REST_Response) {
            return $user;
        }
        return new WP_REST_Response([
            'ok' => true,
            'disabled' => [
                'frames' => array_values((array) get_option('mcw_disabled_frames', [])),
                'emblems' => array_values((array) get_option('mcw_disabled_emblems', [])),
            ],
        ]);
    }

    public static function admin_nameplate_post(WP_REST_Request $request): WP_REST_Response
    {
        $user = self::require_admin($request);
        if ($user instanceof WP_REST_Response) {
            return $user;
        }
        $body = MCW_Forum_Forum::json_body($request);
        if (isset($body['frames']) && is_array($body['frames'])) {
            update_option('mcw_disabled_frames', array_values(array_map('sanitize_key', $body['frames'])));
        }
        if (isset($body['emblems']) && is_array($body['emblems'])) {
            update_option('mcw_disabled_emblems', array_values(array_map('sanitize_key', $body['emblems'])));
        }
        return new WP_REST_Response(['ok' => true]);
    }

    public static function admin_reset(WP_REST_Request $request): WP_REST_Response
    {
        $user = self::require_admin($request);
        if ($user instanceof WP_REST_Response) {
            return $user;
        }
        MCW_Forum_Seed::run(true);
        return new WP_REST_Response(['ok' => true]);
    }

    public static function admin_category(WP_REST_Request $request): WP_REST_Response
    {
        $user = self::require_admin($request);
        if ($user instanceof WP_REST_Response) {
            return $user;
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
        $user = self::require_admin($request);
        if ($user instanceof WP_REST_Response) {
            return $user;
        }
        $term_id = MCW_Forum_Forum::term_id_from_forum_param((string) $request['id']);
        if ($term_id) {
            wp_delete_term($term_id, 'mcw_forum');
        }
        return new WP_REST_Response(['ok' => true]);
    }

    public static function admin_feature_category(WP_REST_Request $request): WP_REST_Response
    {
        $user = self::require_admin($request);
        if ($user instanceof WP_REST_Response) {
            return $user;
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
        $user = self::require_admin($request);
        if ($user instanceof WP_REST_Response) {
            return $user;
        }
        $body = MCW_Forum_Forum::json_body($request);
        $id = wp_insert_post([
            'post_type' => 'mcw_ad',
            'post_status' => 'publish',
            'post_title' => sanitize_text_field($body['title'] ?? 'Ad'),
        ]);
        update_post_meta($id, 'mcw_slot', sanitize_text_field($body['slot'] ?? 'sidebar'));
        $image = self::admin_safe_url((string) ($body['imageUrl'] ?? ''), 'image');
        if ($image instanceof WP_REST_Response) {
            return $image;
        }
        $link = self::admin_safe_url((string) ($body['url'] ?? ''), 'cms');
        if ($link instanceof WP_REST_Response) {
            return $link;
        }
        update_post_meta($id, 'mcw_image_url', $image);
        update_post_meta($id, 'mcw_url', $link);
        update_post_meta($id, 'mcw_order', (int) ($body['order'] ?? 0));
        return new WP_REST_Response(['ok' => true]);
    }

    public static function admin_game(WP_REST_Request $request): WP_REST_Response
    {
        $user = self::require_admin($request);
        if ($user instanceof WP_REST_Response) {
            return $user;
        }
        $body = MCW_Forum_Forum::json_body($request);
        $id = wp_insert_post([
            'post_type' => 'mcw_game',
            'post_status' => 'publish',
            'post_title' => sanitize_text_field($body['title'] ?? 'Game'),
        ]);
        update_post_meta($id, 'mcw_subtitle', sanitize_text_field($body['subtitle'] ?? ''));
        $image = self::admin_safe_url((string) ($body['imageUrl'] ?? ''), 'image');
        if ($image instanceof WP_REST_Response) {
            return $image;
        }
        $link = self::admin_safe_url((string) ($body['url'] ?? ''), 'cms');
        if ($link instanceof WP_REST_Response) {
            return $link;
        }
        update_post_meta($id, 'mcw_image_url', $image);
        update_post_meta($id, 'mcw_url', $link);
        update_post_meta($id, 'mcw_order', (int) ($body['order'] ?? 0));
        return new WP_REST_Response(['ok' => true]);
    }

    public static function admin_provider(WP_REST_Request $request): WP_REST_Response
    {
        $user = self::require_admin($request);
        if ($user instanceof WP_REST_Response) {
            return $user;
        }
        $body = MCW_Forum_Forum::json_body($request);
        $existing_id = isset($body['id']) ? (int) $body['id'] : 0;
        $title = sanitize_text_field($body['name'] ?? $body['title'] ?? 'Provider');
        if ($existing_id > 0 && get_post_type($existing_id) === 'mcw_provider') {
            $id = $existing_id;
            wp_update_post([
                'ID' => $id,
                'post_title' => $title,
                'post_status' => 'publish',
            ]);
        } else {
            $id = wp_insert_post([
                'post_type' => 'mcw_provider',
                'post_status' => 'publish',
                'post_title' => $title,
            ]);
        }
        if (is_wp_error($id) || !$id) {
            return new WP_REST_Response(['ok' => false, 'error' => 'Could not save provider.'], 500);
        }
        update_post_meta($id, 'mcw_subtitle', sanitize_text_field($body['subtitle'] ?? ''));
        $image = self::admin_safe_url((string) ($body['imageUrl'] ?? ''), 'image');
        if ($image instanceof WP_REST_Response) {
            return $image;
        }
        $url = self::admin_safe_url((string) ($body['url'] ?? ''), 'cms');
        if ($url instanceof WP_REST_Response) {
            return $url;
        }
        update_post_meta($id, 'mcw_image_url', $image);
        update_post_meta($id, 'mcw_url', $url);
        update_post_meta($id, 'mcw_rating', (float) ($body['rating'] ?? 4.5));
        update_post_meta($id, 'mcw_order', (int) ($body['order'] ?? 0));
        if (array_key_exists('homeTop', $body)) {
            $set = self::set_provider_home_top((int) $id, !empty($body['homeTop']));
            if (is_wp_error($set)) {
                return new WP_REST_Response(['ok' => false, 'error' => $set->get_error_message()], 400);
            }
        }
        return new WP_REST_Response(['ok' => true, 'id' => (string) $id]);
    }

    public static function admin_provider_home_top(WP_REST_Request $request): WP_REST_Response
    {
        $user = self::require_admin($request);
        if ($user instanceof WP_REST_Response) {
            return $user;
        }
        $body = MCW_Forum_Forum::json_body($request);
        $id = (int) $request['id'];
        if (get_post_type($id) !== 'mcw_provider') {
            return new WP_REST_Response(['ok' => false, 'error' => 'Provider not found.'], 404);
        }
        $want = array_key_exists('homeTop', $body) ? !empty($body['homeTop']) : !((bool) get_post_meta($id, 'mcw_home_top', true));
        $set = self::set_provider_home_top($id, $want);
        if (is_wp_error($set)) {
            return new WP_REST_Response(['ok' => false, 'error' => $set->get_error_message()], 400);
        }
        return new WP_REST_Response(['ok' => true, 'homeTop' => $want]);
    }

    /**
     * @return true|WP_Error
     */
    private static function set_provider_home_top(int $id, bool $home_top)
    {
        if (!$home_top) {
            update_post_meta($id, 'mcw_home_top', 0);
            return true;
        }
        $tops = get_posts([
            'post_type' => 'mcw_provider',
            'post_status' => 'publish',
            'numberposts' => -1,
            'fields' => 'ids',
            'meta_key' => 'mcw_home_top',
            'meta_value' => '1',
        ]);
        $others = array_filter(array_map('intval', $tops ?: []), static fn ($pid) => $pid !== $id);
        if (count($others) >= 4) {
            return new WP_Error('home_top_limit', 'You can pin at most 4 providers to the home carousel.');
        }
        update_post_meta($id, 'mcw_home_top', 1);
        return true;
    }

    public static function admin_delete_post(WP_REST_Request $request): WP_REST_Response
    {
        $user = self::require_admin($request);
        if ($user instanceof WP_REST_Response) {
            return $user;
        }
        $id = (int) $request['id'];
        $type = get_post_type($id);
        if (!in_array($type, ['mcw_ad', 'mcw_game', 'mcw_provider'], true)) {
            return new WP_REST_Response(['ok' => false, 'error' => 'Not found.'], 404);
        }
        wp_trash_post($id);
        return new WP_REST_Response(['ok' => true]);
    }

    public static function admin_ads_rotate(WP_REST_Request $request): WP_REST_Response
    {
        $user = self::require_admin($request);
        if ($user instanceof WP_REST_Response) {
            return $user;
        }
        $body = MCW_Forum_Forum::json_body($request);
        update_option('mcw_ad_rotate_sec', max(3, (int) ($body['sec'] ?? 8)));
        return new WP_REST_Response(['ok' => true]);
    }

    public static function admin_set_role(WP_REST_Request $request): WP_REST_Response
    {
        $actor = self::require_admin($request);
        if ($actor instanceof WP_REST_Response) {
            return $actor;
        }
        $body = MCW_Forum_Forum::json_body($request);
        $role = sanitize_key((string) ($body['role'] ?? 'user'));
        if (!in_array($role, ['user', 'moderator', 'admin'], true)) {
            return new WP_REST_Response(['ok' => false, 'error' => 'Invalid role.'], 400);
        }
        $target_id = (int) $request['id'];
        $target = get_user_by('id', $target_id);
        if ($target_id <= 0 || !$target instanceof WP_User) {
            return new WP_REST_Response(['ok' => false, 'error' => 'User not found.'], 404);
        }
        if ($target_id === (int) $actor->ID && $role !== 'admin') {
            return new WP_REST_Response(['ok' => false, 'error' => 'Cannot demote your own admin account.'], 400);
        }
        $was_admin = MCW_Forum_Auth::is_admin_user($target);
        if ($was_admin && $role !== 'admin' && MCW_Forum_Auth::count_forum_admins() <= 1) {
            return new WP_REST_Response(['ok' => false, 'error' => 'Cannot demote the last administrator.'], 400);
        }
        if (!MCW_Forum_Auth::apply_forum_role($target_id, $role)) {
            return new WP_REST_Response(['ok' => false, 'error' => 'Could not update role.'], 500);
        }
        // Force re-login after privilege change (does not touch other admins' accounts).
        MCW_Forum_Auth::invalidate_user_sessions($target_id);
        MCW_Forum_Security_Log::event('role_change', [
            'actor' => (string) (int) $actor->ID,
            'target' => (string) $target_id,
            'role' => $role,
        ]);
        return new WP_REST_Response(['ok' => true]);
    }

    public static function admin_user_nameplate(WP_REST_Request $request): WP_REST_Response
    {
        $user = self::require_admin($request);
        if ($user instanceof WP_REST_Response) {
            return $user;
        }
        $body = MCW_Forum_Forum::json_body($request);
        $id = (int) $request['id'];
        if ($id <= 0 || !get_user_by('id', $id)) {
            return new WP_REST_Response(['ok' => false, 'error' => 'User not found.'], 404);
        }
        if (isset($body['membership'])) {
            $m = sanitize_key((string) $body['membership']);
            if (in_array($m, ['free', 'member', 'vip', 'premium', 'elite'], true)) {
                MCW_Forum_DB::update_user_meta_allowed($id, 'mcw_membership', $m);
            }
        }
        if (isset($body['frame'])) {
            MCW_Forum_DB::update_user_meta_allowed($id, 'mcw_name_frame', sanitize_key((string) $body['frame']));
        }
        if (isset($body['emblem'])) {
            MCW_Forum_DB::update_user_meta_allowed($id, 'mcw_name_emblem', sanitize_key((string) $body['emblem']));
        }
        return new WP_REST_Response(['ok' => true]);
    }

    /**
     * Optional empty URL helper for CMS fields (ads/games/providers).
     *
     * @return string|WP_REST_Response
     */
    private static function admin_safe_url(string $url, string $kind)
    {
        $url = trim($url);
        if ($url === '') {
            return '';
        }
        $checked = MCW_Forum_Content_Guard::check_url($url, $kind === 'image' ? 'image' : 'cms');
        if (is_wp_error($checked)) {
            return MCW_Forum_Content_Guard::error_response($checked);
        }
        return $checked;
    }

    /** Publish held/pending UGC without deleting anything. */
    public static function mod_approve_content(WP_REST_Request $request): WP_REST_Response
    {
        $user = self::require_mod($request);
        if ($user instanceof WP_REST_Response) {
            return $user;
        }
        $post = get_post((int) $request['id']);
        if (!$post || !in_array($post->post_type, ['mcw_thread', 'mcw_reply'], true)) {
            return new WP_REST_Response(['ok' => false, 'error' => 'Not found.'], 404);
        }
        wp_update_post(['ID' => $post->ID, 'post_status' => 'publish']);
        delete_post_meta($post->ID, 'mcw_held');
        return new WP_REST_Response(['ok' => true]);
    }

    /** Soft-hide UGC from public listings (pending) — does not delete. */
    public static function mod_hold_content(WP_REST_Request $request): WP_REST_Response
    {
        $user = self::require_mod($request);
        if ($user instanceof WP_REST_Response) {
            return $user;
        }
        $post = get_post((int) $request['id']);
        if (!$post || !in_array($post->post_type, ['mcw_thread', 'mcw_reply'], true)) {
            return new WP_REST_Response(['ok' => false, 'error' => 'Not found.'], 404);
        }
        wp_update_post(['ID' => $post->ID, 'post_status' => 'pending']);
        update_post_meta($post->ID, 'mcw_held', 1);
        MCW_Forum_Content_Guard::flag_for_moderation((int) $user->ID, $post->post_type === 'mcw_reply' ? 'comment' : 'thread', (string) $post->ID, 'auto:mod-hold');
        return new WP_REST_Response(['ok' => true]);
    }

    public static function resolve_report(WP_REST_Request $request): WP_REST_Response
    {
        $user = self::require_mod($request);
        if ($user instanceof WP_REST_Response) {
            return $user;
        }
        $report_id = sanitize_text_field((string) $request['id']);
        if ($report_id === '' || !preg_match('/^rep_[\w-]+$/', $report_id)) {
            return new WP_REST_Response(['ok' => false, 'error' => 'Invalid report id.'], 400);
        }
        global $wpdb;
        MCW_Forum_DB::update(
            $wpdb->prefix . 'mcw_reports',
            ['resolved' => 1],
            ['id' => $report_id],
            ['resolved' => '%d'],
            ['id' => '%s']
        );
        return new WP_REST_Response(['ok' => true]);
    }

    public static function ban_user(WP_REST_Request $request): WP_REST_Response
    {
        $actor = self::require_mod($request);
        if ($actor instanceof WP_REST_Response) {
            return $actor;
        }
        $body = MCW_Forum_Forum::json_body($request);
        $id = (int) $request['id'];
        $target = get_user_by('id', $id);
        if (!$target) {
            return new WP_REST_Response(['ok' => false, 'error' => 'User not found.'], 404);
        }
        if (MCW_Forum_Auth::is_admin_user($target)) {
            return new WP_REST_Response(['ok' => false, 'error' => 'Cannot ban administrators.'], 403);
        }
        if ($id === (int) $actor->ID) {
            return new WP_REST_Response(['ok' => false, 'error' => 'Cannot ban yourself.'], 400);
        }
        $banned = !isset($body['banned']) || $body['banned'] ? 1 : 0;
        MCW_Forum_DB::update_user_meta_allowed($id, 'mcw_banned', $banned);
        if ($banned) {
            MCW_Forum_Auth::invalidate_user_sessions($id);
        }
        MCW_Forum_Security_Log::event('ban', [
            'actor' => (string) (int) $actor->ID,
            'target' => (string) $id,
            'banned' => $banned ? '1' : '0',
        ]);
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
        if ($rl = self::rate_limit('upload:' . $user->ID, 20, HOUR_IN_SECONDS)) {
            return $rl;
        }
        $files = $request->get_file_params();
        if (empty($files['file']) || !is_array($files['file'])) {
            return new WP_REST_Response(['ok' => false, 'error' => 'No file.'], 400);
        }
        $validated = MCW_Forum_Upload::validate_image_upload($files['file']);
        if (is_wp_error($validated)) {
            return new WP_REST_Response(['ok' => false, 'error' => $validated->get_error_message()], (int) ($validated->get_error_data()['status'] ?? 400));
        }

        // Force randomized safe filename before WordPress stores the file (anti-overwrite / traversal).
        $_FILES['file']['name'] = $validated['safe_name'];

        require_once ABSPATH . 'wp-admin/includes/file.php';
        require_once ABSPATH . 'wp-admin/includes/media.php';
        require_once ABSPATH . 'wp-admin/includes/image.php';
        $attachment_id = media_handle_upload('file', 0);
        if (is_wp_error($attachment_id)) {
            return new WP_REST_Response(['ok' => false, 'error' => $attachment_id->get_error_message()], 400);
        }

        $attached = get_attached_file((int) $attachment_id);
        if (!$attached || !MCW_Forum_Upload::path_is_in_uploads($attached)) {
            wp_delete_attachment((int) $attachment_id, true);
            return new WP_REST_Response(['ok' => false, 'error' => 'Upload path rejected.'], 400);
        }
        // Re-check magic on the stored file (defense in depth).
        if (MCW_Forum_Upload::detect_image_magic($attached) === null) {
            wp_delete_attachment((int) $attachment_id, true);
            return new WP_REST_Response(['ok' => false, 'error' => 'Stored file failed image verification.'], 400);
        }

        update_post_meta((int) $attachment_id, 'mcw_uploader_id', (int) $user->ID);
        wp_update_post([
            'ID' => (int) $attachment_id,
            'post_author' => (int) $user->ID,
        ]);

        return new WP_REST_Response([
            'ok' => true,
            'id' => (string) $attachment_id,
            'url' => wp_get_attachment_url((int) $attachment_id),
            'mime' => $validated['mime'],
        ]);
    }

    /** Authorized deletion only — never exposes arbitrary filesystem deletes. */
    public static function delete_upload(WP_REST_Request $request): WP_REST_Response
    {
        if ($resp = self::guard($request)) {
            return $resp;
        }
        $user = self::require_user();
        if ($user instanceof WP_REST_Response) {
            return $user;
        }
        $id = (int) $request['id'];
        if ($id <= 0 || !MCW_Forum_Upload::can_manage_attachment($user, $id)) {
            return new WP_REST_Response(['ok' => false, 'error' => 'Forbidden.'], 403);
        }
        $path = get_attached_file($id);
        if ($path && !MCW_Forum_Upload::path_is_in_uploads($path)) {
            return new WP_REST_Response(['ok' => false, 'error' => 'Refusing to delete file outside uploads.'], 403);
        }
        $deleted = wp_delete_attachment($id, true);
        if (!$deleted) {
            return new WP_REST_Response(['ok' => false, 'error' => 'Could not delete attachment.'], 400);
        }
        return new WP_REST_Response(['ok' => true]);
    }
}

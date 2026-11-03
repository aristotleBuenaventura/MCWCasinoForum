<?php

if (!defined('ABSPATH')) {
    exit;
}

class MCW_Forum_Forum
{
    public static function load_categories(): array
    {
        $terms = get_terms([
            'taxonomy' => 'mcw_forum',
            'hide_empty' => false,
        ]);
        if (is_wp_error($terms)) {
            return [];
        }
        $out = [];
        foreach ($terms as $term) {
            $q = new WP_Query([
                'post_type' => 'mcw_thread',
                'post_status' => 'publish',
                'posts_per_page' => 1,
                'fields' => 'ids',
                'tax_query' => [[
                    'taxonomy' => 'mcw_forum',
                    'field' => 'term_id',
                    'terms' => [$term->term_id],
                    'include_children' => false,
                ]],
            ]);
            $thread_count = (int) $q->found_posts;
            $out[] = MCW_Forum_Serialize::map_category($term, [
                'threadCount' => $thread_count,
                'postCount' => $thread_count,
            ]);
        }
        usort($out, static fn ($a, $b) => ($a['order'] <=> $b['order']) ?: strcmp($a['name'], $b['name']));
        return $out;
    }

    public static function load_bootstrap(?WP_User $viewer): array
    {
        global $wpdb;
        $ads = get_posts(['post_type' => 'mcw_ad', 'numberposts' => 50, 'post_status' => 'publish']);
        $games = get_posts(['post_type' => 'mcw_game', 'numberposts' => 50, 'post_status' => 'publish']);
        $providers = get_posts(['post_type' => 'mcw_provider', 'numberposts' => 50, 'post_status' => 'publish']);
        $unread = 0;
        if ($viewer) {
            $unread = (int) $wpdb->get_var($wpdb->prepare(
                "SELECT COUNT(*) FROM {$wpdb->prefix}mcw_notifications WHERE user_id = %d AND is_read = 0",
                $viewer->ID
            ));
        }
        $members = (int) $wpdb->get_var(
            "SELECT COUNT(*) FROM {$wpdb->users} u
             LEFT JOIN {$wpdb->usermeta} m ON m.user_id = u.ID AND m.meta_key = 'mcw_banned'
             WHERE m.meta_value IS NULL OR m.meta_value = '' OR m.meta_value = '0'"
        );
        return [
            'me' => $viewer && !get_user_meta($viewer->ID, 'mcw_banned', true)
                ? MCW_Forum_Serialize::public_user($viewer, true)
                : null,
            'unreadCount' => $unread,
            'memberCount' => $members,
            'categories' => self::load_categories(),
            'ads' => array_map([MCW_Forum_Serialize::class, 'map_ad'], $ads),
            'trendingGames' => array_map([MCW_Forum_Serialize::class, 'map_cms'], $games),
            'providers' => array_map([MCW_Forum_Serialize::class, 'map_provider'], $providers),
            'adRotateSec' => (int) (get_option('mcw_ad_rotate_sec', 8)),
        ];
    }

    public static function decorate_threads(array $posts, ?int $viewer_id): array
    {
        global $wpdb;
        $threads = [];
        foreach ($posts as $post) {
            if (!$post instanceof WP_Post) {
                continue;
            }
            $mapped = MCW_Forum_Serialize::map_thread($post);
            $author = get_user_by('id', (int) $post->post_author);
            $mapped['author'] = $author ? MCW_Forum_Serialize::public_user($author) : null;
            $like_count = (int) $wpdb->get_var($wpdb->prepare(
                "SELECT COUNT(*) FROM {$wpdb->prefix}mcw_likes WHERE target_type = 'thread' AND target_id = %s",
                (string) $post->ID
            ));
            $comment_count = (int) $wpdb->get_var($wpdb->prepare(
                "SELECT COUNT(*) FROM {$wpdb->posts} p
                 INNER JOIN {$wpdb->postmeta} m ON m.post_id = p.ID AND m.meta_key = 'mcw_thread_id' AND m.meta_value = %s
                 WHERE p.post_type = 'mcw_reply' AND p.post_status = 'publish'",
                (string) $post->ID
            ));
            $liked = false;
            $bookmarked = false;
            if ($viewer_id) {
                $liked = (bool) $wpdb->get_var($wpdb->prepare(
                    "SELECT id FROM {$wpdb->prefix}mcw_likes WHERE user_id = %d AND target_type = 'thread' AND target_id = %s",
                    $viewer_id,
                    (string) $post->ID
                ));
                $bookmarked = (bool) $wpdb->get_var($wpdb->prepare(
                    "SELECT id FROM {$wpdb->prefix}mcw_bookmarks WHERE user_id = %d AND thread_id = %d",
                    $viewer_id,
                    $post->ID
                ));
            }
            $mapped['likeCount'] = $like_count;
            $mapped['commentCount'] = $comment_count;
            $mapped['liked'] = $liked;
            $mapped['bookmarked'] = $bookmarked;
            $threads[] = $mapped;
        }
        return $threads;
    }

    public static function term_id_from_forum_param(string $param): ?int
    {
        if ($param === '') {
            return null;
        }
        if (str_starts_with($param, 'cat_')) {
            return (int) substr($param, 4);
        }
        if (ctype_digit($param)) {
            return (int) $param;
        }
        $term = get_term_by('slug', $param, 'mcw_forum');
        return $term ? (int) $term->term_id : null;
    }

    public static function json_body(WP_REST_Request $request): array
    {
        $json = $request->get_json_params();
        return is_array($json) ? $json : [];
    }
}

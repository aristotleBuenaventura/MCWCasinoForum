<?php

if (!defined('ABSPATH')) {
    exit;
}

class MCW_Forum_Forum
{
    public static function load_categories(string $lang = 'en'): array
    {
        global $wpdb;
        $lang = in_array($lang, ['en', 'bn'], true) ? $lang : 'en';
        $terms = get_terms([
            'taxonomy' => 'mcw_forum',
            'hide_empty' => false,
            'update_term_meta_cache' => true,
        ]);
        if (is_wp_error($terms) || !$terms) {
            return [];
        }

        // One query for all forum thread counts (include_children = false).
        $counts_raw = $wpdb->get_results(
            "SELECT tt.term_id, COUNT(DISTINCT p.ID) AS cnt
             FROM {$wpdb->term_taxonomy} tt
             LEFT JOIN {$wpdb->term_relationships} tr ON tr.term_taxonomy_id = tt.term_taxonomy_id
             LEFT JOIN {$wpdb->posts} p
               ON p.ID = tr.object_id
              AND p.post_type = 'mcw_thread'
              AND p.post_status = 'publish'
             WHERE tt.taxonomy = 'mcw_forum'
             GROUP BY tt.term_id",
            ARRAY_A
        );
        $count_map = [];
        foreach ($counts_raw as $row) {
            $count_map[(int) $row['term_id']] = (int) $row['cnt'];
        }

        $out = [];
        foreach ($terms as $term) {
            $n = $count_map[(int) $term->term_id] ?? 0;
            $out[] = MCW_Forum_Serialize::map_category($term, [
                'threadCount' => $n,
                'postCount' => $n,
            ], $lang);
        }
        usort($out, static fn ($a, $b) => ($a['order'] <=> $b['order']) ?: strcmp($a['name'], $b['name']));
        return $out;
    }

    public static function load_bootstrap(?WP_User $viewer, string $lang = 'en'): array
    {
        global $wpdb;
        $lang = in_array($lang, ['en', 'bn'], true) ? $lang : 'en';
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
            'categories' => self::load_categories($lang),
            'ads' => array_map([MCW_Forum_Serialize::class, 'map_ad'], $ads),
            'trendingGames' => array_map([MCW_Forum_Serialize::class, 'map_cms'], $games),
            'providers' => array_map([MCW_Forum_Serialize::class, 'map_provider'], $providers),
            'adRotateSec' => (int) (get_option('mcw_ad_rotate_sec', 8)),
            'lang' => $lang,
        ];
    }

    /**
     * @param WP_Post[] $posts
     * @param bool $light Skip full body blocks (feeds / lists).
     */
    public static function decorate_threads(array $posts, ?int $viewer_id, string $lang = 'en', bool $light = true): array
    {
        global $wpdb;
        $lang = in_array($lang, ['en', 'bn'], true) ? $lang : 'en';
        $valid = [];
        foreach ($posts as $post) {
            if ($post instanceof WP_Post) {
                $valid[] = $post;
            }
        }
        if (!$valid) {
            return [];
        }

        $ids = array_map(static fn (WP_Post $p) => (string) $p->ID, $valid);
        $id_ints = array_map('intval', $ids);
        $placeholders = implode(',', array_fill(0, count($ids), '%s'));
        $int_placeholders = implode(',', array_fill(0, count($id_ints), '%d'));

        // Batch like counts
        $like_map = array_fill_keys($ids, 0);
        $like_rows = $wpdb->get_results($wpdb->prepare(
            "SELECT target_id, COUNT(*) AS cnt
             FROM {$wpdb->prefix}mcw_likes
             WHERE target_type = 'thread' AND target_id IN ($placeholders)
             GROUP BY target_id",
            ...$ids
        ), ARRAY_A);
        foreach ($like_rows as $row) {
            $like_map[(string) $row['target_id']] = (int) $row['cnt'];
        }

        // Batch comment counts
        $comment_map = array_fill_keys($ids, 0);
        $comment_rows = $wpdb->get_results($wpdb->prepare(
            "SELECT m.meta_value AS thread_id, COUNT(*) AS cnt
             FROM {$wpdb->posts} p
             INNER JOIN {$wpdb->postmeta} m ON m.post_id = p.ID AND m.meta_key = 'mcw_thread_id'
             WHERE p.post_type = 'mcw_reply' AND p.post_status = 'publish'
               AND m.meta_value IN ($placeholders)
             GROUP BY m.meta_value",
            ...$ids
        ), ARRAY_A);
        foreach ($comment_rows as $row) {
            $comment_map[(string) $row['thread_id']] = (int) $row['cnt'];
        }

        $liked_set = [];
        $bookmark_set = [];
        if ($viewer_id) {
            $liked_rows = $wpdb->get_col($wpdb->prepare(
                "SELECT target_id FROM {$wpdb->prefix}mcw_likes
                 WHERE user_id = %d AND target_type = 'thread' AND target_id IN ($placeholders)",
                $viewer_id,
                ...$ids
            ));
            foreach ($liked_rows as $tid) {
                $liked_set[(string) $tid] = true;
            }
            $bookmark_rows = $wpdb->get_col($wpdb->prepare(
                "SELECT thread_id FROM {$wpdb->prefix}mcw_bookmarks
                 WHERE user_id = %d AND thread_id IN ($int_placeholders)",
                $viewer_id,
                ...$id_ints
            ));
            foreach ($bookmark_rows as $tid) {
                $bookmark_set[(string) $tid] = true;
            }
        }

        // Batch authors
        $author_ids = array_values(array_unique(array_map(static fn (WP_Post $p) => (int) $p->post_author, $valid)));
        $authors = [];
        if ($author_ids) {
            foreach (get_users(['include' => $author_ids, 'fields' => 'all']) as $u) {
                $authors[(int) $u->ID] = MCW_Forum_Serialize::public_user($u);
            }
        }

        // Warm post meta cache for the batch
        update_meta_cache('post', $id_ints);

        $threads = [];
        foreach ($valid as $post) {
            $sid = (string) $post->ID;
            $mapped = MCW_Forum_Serialize::map_thread($post, $lang, $light);
            $mapped['author'] = $authors[(int) $post->post_author] ?? null;
            $mapped['likeCount'] = $like_map[$sid] ?? 0;
            $mapped['commentCount'] = $comment_map[$sid] ?? 0;
            $mapped['replyCount'] = $comment_map[$sid] ?? 0;
            $mapped['liked'] = isset($liked_set[$sid]);
            $mapped['bookmarked'] = isset($bookmark_set[$sid]);
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

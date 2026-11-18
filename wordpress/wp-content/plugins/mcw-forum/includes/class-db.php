<?php
/**
 * Safe $wpdb helpers: prepared IN() lists, typed inserts/updates/deletes,
 * and allowlisted meta writes (mass-assignment defense).
 */
if (!defined('ABSPATH')) {
    exit;
}

class MCW_Forum_DB
{
    /** User meta keys the forum API may write. */
    public const USER_META_ALLOW = [
        'mcw_role',
        'mcw_bio',
        'mcw_avatar',
        'mcw_dob',
        'mcw_banned',
        'mcw_membership',
        'mcw_name_frame',
        'mcw_name_emblem',
    ];

    /** Post meta keys the forum API may write on UGC/CMS posts. */
    public const POST_META_ALLOW = [
        'mcw_body',
        'mcw_body_en',
        'mcw_body_bn',
        'mcw_content_en',
        'mcw_content_bn',
        'mcw_title_en',
        'mcw_title_bn',
        'mcw_source_lang',
        'mcw_tags',
        'mcw_views',
        'mcw_pinned',
        'mcw_held',
        'mcw_spam_score',
        'mcw_thread_id',
        'mcw_parent_id',
        'mcw_slot',
        'mcw_image_url',
        'mcw_url',
        'mcw_order',
        'mcw_subtitle',
        'mcw_rating',
        'mcw_home_top',
        'mcw_brand_code',
    ];

    /**
     * Build a prepared IN (...) clause.
     *
     * @param list<int|string> $values
     * @return array{0:string,1:list<int|string>}|null SQL fragment + values, or null if empty.
     */
    public static function prepare_in(array $values, string $specifier = '%d'): ?array
    {
        $values = array_values($values);
        if (!$values) {
            return null;
        }
        if ($specifier === '%d') {
            $values = array_map('intval', $values);
        } else {
            $values = array_map('strval', $values);
            $specifier = '%s';
        }
        $placeholders = implode(',', array_fill(0, count($values), $specifier));
        return [$placeholders, $values];
    }

    /**
     * @param array<string,mixed> $data
     * @param array<string,string> $formats map column => %d|%s|%f
     */
    public static function insert(string $table, array $data, array $formats): int|false
    {
        global $wpdb;
        $ordered = [];
        $format_list = [];
        foreach ($formats as $col => $fmt) {
            if (!array_key_exists($col, $data)) {
                continue;
            }
            $ordered[$col] = $data[$col];
            $format_list[] = $fmt;
        }
        if (!$ordered) {
            return false;
        }
        $ok = $wpdb->insert($table, $ordered, $format_list);
        return $ok ? (int) $wpdb->insert_id : false;
    }

    /**
     * @param array<string,mixed> $data
     * @param array<string,mixed> $where
     * @param array<string,string> $data_formats
     * @param array<string,string> $where_formats
     */
    public static function update(string $table, array $data, array $where, array $data_formats, array $where_formats): int|false
    {
        global $wpdb;
        $data_ordered = [];
        $data_fmt = [];
        foreach ($data_formats as $col => $fmt) {
            if (!array_key_exists($col, $data)) {
                continue;
            }
            $data_ordered[$col] = $data[$col];
            $data_fmt[] = $fmt;
        }
        $where_ordered = [];
        $where_fmt = [];
        foreach ($where_formats as $col => $fmt) {
            if (!array_key_exists($col, $where)) {
                continue;
            }
            $where_ordered[$col] = $where[$col];
            $where_fmt[] = $fmt;
        }
        if (!$data_ordered || !$where_ordered) {
            return false;
        }
        return $wpdb->update($table, $data_ordered, $where_ordered, $data_fmt, $where_fmt);
    }

    /**
     * @param array<string,mixed> $where
     * @param array<string,string> $where_formats
     */
    public static function delete(string $table, array $where, array $where_formats): int|false
    {
        global $wpdb;
        $where_ordered = [];
        $where_fmt = [];
        foreach ($where_formats as $col => $fmt) {
            if (!array_key_exists($col, $where)) {
                continue;
            }
            $where_ordered[$col] = $where[$col];
            $where_fmt[] = $fmt;
        }
        if (!$where_ordered) {
            return false;
        }
        return $wpdb->delete($table, $where_ordered, $where_fmt);
    }

    public static function update_user_meta_allowed(int $user_id, string $key, $value): bool
    {
        if ($user_id <= 0 || !in_array($key, self::USER_META_ALLOW, true)) {
            return false;
        }
        update_user_meta($user_id, $key, $value);
        return true;
    }

    public static function update_post_meta_allowed(int $post_id, string $key, $value): bool
    {
        if ($post_id <= 0 || !in_array($key, self::POST_META_ALLOW, true)) {
            return false;
        }
        update_post_meta($post_id, $key, $value);
        return true;
    }

    /**
     * Reject wp_update_user mass-assignment of privileged fields from request bodies.
     *
     * @param array<string,mixed> $fields
     * @return array<string,mixed>
     */
    public static function filter_user_update_fields(array $fields): array
    {
        $deny = [
            'role', 'roles', 'capabilities', 'allcaps', 'user_pass', 'user_login',
            'user_email', 'user_nicename', 'user_url', 'user_registered',
            'rich_editing', 'syntax_highlighting', 'admin_color', 'show_admin_bar_front',
            'locale', 'nickname', 'first_name', 'last_name',
        ];
        foreach ($deny as $key) {
            unset($fields[$key]);
        }
        // Only allow explicitly safe profile fields through this helper.
        $allow = ['ID', 'display_name', 'description'];
        $out = [];
        foreach ($allow as $key) {
            if (array_key_exists($key, $fields)) {
                $out[$key] = $fields[$key];
            }
        }
        return $out;
    }

    /** Table names owned by this plugin (for least-privilege docs / audits). */
    public static function plugin_tables(): array
    {
        global $wpdb;
        $p = $wpdb->prefix;
        return [
            $p . 'mcw_sessions',
            $p . 'mcw_likes',
            $p . 'mcw_follows',
            $p . 'mcw_bookmarks',
            $p . 'mcw_notifications',
            $p . 'mcw_reports',
        ];
    }
}

<?php

if (!defined('ABSPATH')) {
    exit;
}

class MCW_Forum_Install
{
    public static function activate(): void
    {
        self::create_tables();
        MCW_Forum_CPT::register();
        flush_rewrite_rules();
    }

    public static function create_tables(): void
    {
        global $wpdb;
        $charset = $wpdb->get_charset_collate();
        $sessions = $wpdb->prefix . 'mcw_sessions';
        $likes = $wpdb->prefix . 'mcw_likes';
        $follows = $wpdb->prefix . 'mcw_follows';
        $bookmarks = $wpdb->prefix . 'mcw_bookmarks';
        $notifications = $wpdb->prefix . 'mcw_notifications';
        $reports = $wpdb->prefix . 'mcw_reports';

        require_once ABSPATH . 'wp-admin/includes/upgrade.php';

        dbDelta("CREATE TABLE {$sessions} (
            id varchar(64) NOT NULL,
            user_id bigint(20) unsigned NOT NULL,
            token_hash varchar(64) NOT NULL,
            expires_at datetime NOT NULL,
            last_seen_at datetime NOT NULL,
            PRIMARY KEY  (id),
            KEY user_id (user_id),
            KEY token_hash (token_hash)
        ) {$charset};");

        dbDelta("CREATE TABLE {$likes} (
            id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
            user_id bigint(20) unsigned NOT NULL,
            target_type varchar(20) NOT NULL,
            target_id varchar(64) NOT NULL,
            created_at datetime NOT NULL,
            PRIMARY KEY  (id),
            UNIQUE KEY user_target (user_id, target_type, target_id),
            KEY target (target_type, target_id)
        ) {$charset};");

        dbDelta("CREATE TABLE {$follows} (
            id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
            follower_id bigint(20) unsigned NOT NULL,
            following_id bigint(20) unsigned NOT NULL,
            created_at datetime NOT NULL,
            PRIMARY KEY  (id),
            UNIQUE KEY follow_pair (follower_id, following_id)
        ) {$charset};");

        dbDelta("CREATE TABLE {$bookmarks} (
            id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
            user_id bigint(20) unsigned NOT NULL,
            thread_id bigint(20) unsigned NOT NULL,
            created_at datetime NOT NULL,
            PRIMARY KEY  (id),
            UNIQUE KEY user_thread (user_id, thread_id)
        ) {$charset};");

        dbDelta("CREATE TABLE {$notifications} (
            id varchar(64) NOT NULL,
            user_id bigint(20) unsigned NOT NULL,
            type varchar(40) NOT NULL,
            message text NOT NULL,
            link varchar(255) NOT NULL,
            is_read tinyint(1) NOT NULL DEFAULT 0,
            created_at datetime NOT NULL,
            PRIMARY KEY  (id),
            KEY user_read (user_id, is_read)
        ) {$charset};");

        dbDelta("CREATE TABLE {$reports} (
            id varchar(64) NOT NULL,
            reporter_id bigint(20) unsigned NOT NULL,
            target_type varchar(20) NOT NULL,
            target_id varchar(64) NOT NULL,
            reason text NOT NULL,
            resolved tinyint(1) NOT NULL DEFAULT 0,
            created_at datetime NOT NULL,
            PRIMARY KEY  (id)
        ) {$charset};");
    }
}

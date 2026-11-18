<?php

if (!defined('ABSPATH')) {
    exit;
}

/**
 * CPTs/taxonomies are WPML-translatable content types for the headless React app.
 */
class MCW_Forum_CPT
{
    public static function init(): void
    {
        add_action('init', [self::class, 'register']);
    }

    public static function register(): void
    {
        register_taxonomy('mcw_forum', ['mcw_thread'], [
            'labels' => [
                'name' => 'Forums',
                'singular_name' => 'Forum',
            ],
            'public' => true,
            'show_in_rest' => true,
            'hierarchical' => true,
            'rewrite' => ['slug' => 'forum'],
        ]);

        register_post_type('mcw_thread', [
            'labels' => [
                'name' => 'Threads',
                'singular_name' => 'Thread',
            ],
            'public' => true,
            'show_in_rest' => true,
            'supports' => ['title', 'editor', 'author', 'custom-fields'],
            'has_archive' => true,
            'rewrite' => ['slug' => 'thread'],
            'menu_icon' => 'dashicons-format-chat',
        ]);

        register_post_type('mcw_reply', [
            'labels' => [
                'name' => 'Replies',
                'singular_name' => 'Reply',
            ],
            'public' => false,
            'show_ui' => true,
            'show_in_rest' => true,
            'supports' => ['editor', 'author', 'custom-fields'],
            'menu_icon' => 'dashicons-format-status',
        ]);

        register_post_type('mcw_ad', [
            'labels' => ['name' => 'Ads', 'singular_name' => 'Ad'],
            'public' => false,
            'show_ui' => true,
            'show_in_rest' => true,
            'supports' => ['title', 'custom-fields'],
        ]);

        register_post_type('mcw_game', [
            'labels' => ['name' => 'Trending Games', 'singular_name' => 'Game'],
            'public' => false,
            'show_ui' => true,
            'show_in_rest' => true,
            'supports' => ['title', 'custom-fields'],
        ]);

        register_post_type('mcw_provider', [
            'labels' => ['name' => 'Providers', 'singular_name' => 'Provider'],
            'public' => false,
            'show_ui' => true,
            'show_in_rest' => true,
            'supports' => ['title', 'custom-fields'],
        ]);
    }
}

<?php

if (!defined('ABSPATH')) {
    exit;
}

class MCW_Forum_Serialize
{
    public static function public_user(WP_User $user, bool $self = false): array
    {
        $unlocks = get_user_meta($user->ID, 'mcw_name_unlocks', true);
        if (!is_array($unlocks)) {
            $unlocks = ['frames' => ['none'], 'emblems' => ['none']];
        }
        $dob = get_user_meta($user->ID, 'mcw_dob', true);
        return [
            'id' => (string) $user->ID,
            'username' => $user->user_login,
            'email' => $self ? $user->user_email : '',
            'password' => '',
            'displayName' => $user->display_name ?: $user->user_login,
            'bio' => (string) get_user_meta($user->ID, 'mcw_bio', true),
            'avatar' => (string) get_user_meta($user->ID, 'mcw_avatar', true),
            'role' => MCW_Forum_Auth::role_of($user),
            'membership' => (string) (get_user_meta($user->ID, 'mcw_membership', true) ?: 'free'),
            'nameFrame' => (string) (get_user_meta($user->ID, 'mcw_name_frame', true) ?: 'none'),
            'nameEmblem' => (string) (get_user_meta($user->ID, 'mcw_name_emblem', true) ?: 'none'),
            'nameUnlocks' => $self ? $unlocks : null,
            'banned' => (bool) get_user_meta($user->ID, 'mcw_banned', true),
            'createdAt' => gmdate('c', strtotime($user->user_registered)),
            'dateOfBirth' => $self && $dob ? (string) $dob : null,
        ];
    }

    public static function map_thread(WP_Post $post, string $lang = 'en'): array
    {
        $lang = in_array($lang, ['en', 'bn'], true) ? $lang : 'en';
        $terms = wp_get_post_terms($post->ID, 'mcw_forum');
        $forum_id = '';
        if (!is_wp_error($terms) && !empty($terms)) {
            $forum_id = 'cat_' . $terms[0]->term_id;
        }

        if ($lang !== 'en') {
            MCW_Forum_Translate::ensure_thread((int) $post->ID);
        }
        $title = MCW_Forum_Translate::localized_title((int) $post->ID, $lang);
        $body = MCW_Forum_Translate::localized_body((int) $post->ID, $lang);
        if (!$body) {
            $raw = get_post_meta((int) $post->ID, 'mcw_body', true);
            $body = is_array($raw) ? $raw : [['type' => 'text', 'text' => wp_strip_all_tags($post->post_content)]];
        }
        $content = MCW_Forum_Translate::localized_content((int) $post->ID, $lang);
        if ($content === '' || MCW_Forum_Translate::is_stub_body([['type' => 'text', 'text' => $content]])) {
            $content = MCW_Forum_Translate::plain_from_body($body);
        }
        if ($content === '') {
            $content = wp_strip_all_tags($post->post_content);
        }

        $tags = get_post_meta($post->ID, 'mcw_tags', true);
        return [
            'id' => (string) $post->ID,
            'forumId' => $forum_id,
            'authorId' => (string) $post->post_author,
            'title' => $title !== '' ? $title : get_the_title($post),
            'content' => $content,
            'body' => $body,
            'mediaUrl' => get_post_meta($post->ID, 'mcw_media_url', true) ?: null,
            'mediaType' => get_post_meta($post->ID, 'mcw_media_type', true) ?: null,
            'pinned' => (bool) get_post_meta($post->ID, 'mcw_pinned', true),
            'solved' => (bool) get_post_meta($post->ID, 'mcw_solved', true),
            'tags' => is_array($tags) ? $tags : [],
            'createdAt' => gmdate('c', strtotime($post->post_date_gmt ?: $post->post_date)),
            'updatedAt' => gmdate('c', strtotime($post->post_modified_gmt ?: $post->post_modified)),
            'views' => (int) get_post_meta($post->ID, 'mcw_views', true),
            'lang' => $lang,
        ];
    }

    public static function map_comment(WP_Post $post, string $lang = 'en'): array
    {
        $lang = in_array($lang, ['en', 'bn'], true) ? $lang : 'en';
        $body = MCW_Forum_Translate::localized_body((int) $post->ID, $lang);
        if (!$body) {
            $raw = get_post_meta($post->ID, 'mcw_body', true);
            $body = is_array($raw) ? $raw : [['type' => 'text', 'text' => wp_strip_all_tags($post->post_content)]];
        }
        $content = MCW_Forum_Translate::localized_content((int) $post->ID, $lang);
        if ($content === '') {
            $content = wp_strip_all_tags($post->post_content);
        }
        $parent = get_post_meta($post->ID, 'mcw_parent_id', true);
        $source = (string) get_post_meta($post->ID, 'mcw_source_lang', true);
        return [
            'id' => (string) $post->ID,
            'threadId' => (string) get_post_meta($post->ID, 'mcw_thread_id', true),
            'authorId' => (string) $post->post_author,
            'parentId' => $parent !== '' && $parent !== null ? (string) $parent : null,
            'content' => $content,
            'body' => $body,
            'lang' => $lang,
            'sourceLang' => $source !== '' ? $source : MCW_Forum_Translate::detect_lang($content),
            'createdAt' => gmdate('c', strtotime($post->post_date_gmt ?: $post->post_date)),
        ];
    }

    public static function map_category(WP_Term $term, array $counts, string $lang = 'en'): array
    {
        $lang = in_array($lang, ['en', 'bn'], true) ? $lang : 'en';
        $parent = $term->parent ? 'cat_' . $term->parent : null;
        $name = html_entity_decode($term->name, ENT_QUOTES | ENT_HTML5, 'UTF-8');
        $description = html_entity_decode($term->description ?: '', ENT_QUOTES | ENT_HTML5, 'UTF-8');
        if ($lang !== 'en') {
            $name = MCW_Forum_Translate::localized_term_field((int) $term->term_id, 'name', $name, $lang);
            if ($description !== '') {
                $description = MCW_Forum_Translate::localized_term_field((int) $term->term_id, 'description', $description, $lang);
            }
        }
        return [
            'id' => 'cat_' . $term->term_id,
            'slug' => $term->slug,
            'name' => $name,
            'description' => $description,
            'parentId' => $parent,
            'featured' => (bool) get_term_meta($term->term_id, 'mcw_featured', true),
            'order' => (int) get_term_meta($term->term_id, 'mcw_order', true),
            'threadCount' => $counts['threadCount'] ?? 0,
            'postCount' => $counts['postCount'] ?? 0,
        ];
    }

    public static function map_ad(WP_Post $post): array
    {
        return [
            'id' => (string) $post->ID,
            'slot' => (string) (get_post_meta($post->ID, 'mcw_slot', true) ?: 'sidebar'),
            'imageUrl' => (string) get_post_meta($post->ID, 'mcw_image_url', true),
            'url' => (string) get_post_meta($post->ID, 'mcw_url', true),
            'title' => get_the_title($post),
            'order' => (int) get_post_meta($post->ID, 'mcw_order', true),
        ];
    }

    public static function map_cms(WP_Post $post): array
    {
        return [
            'id' => (string) $post->ID,
            'title' => get_the_title($post),
            'subtitle' => (string) get_post_meta($post->ID, 'mcw_subtitle', true),
            'imageUrl' => (string) get_post_meta($post->ID, 'mcw_image_url', true),
            'url' => (string) get_post_meta($post->ID, 'mcw_url', true),
            'order' => (int) get_post_meta($post->ID, 'mcw_order', true),
        ];
    }

    public static function map_provider(WP_Post $post): array
    {
        return [
            'id' => (string) $post->ID,
            'name' => get_the_title($post),
            'subtitle' => (string) get_post_meta($post->ID, 'mcw_subtitle', true),
            'imageUrl' => (string) get_post_meta($post->ID, 'mcw_image_url', true),
            'url' => (string) get_post_meta($post->ID, 'mcw_url', true),
            'rating' => (float) get_post_meta($post->ID, 'mcw_rating', true),
            'order' => (int) get_post_meta($post->ID, 'mcw_order', true),
        ];
    }
}

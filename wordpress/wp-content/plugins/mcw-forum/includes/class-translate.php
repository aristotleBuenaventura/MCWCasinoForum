<?php

if (!defined('ABSPATH')) {
    exit;
}

/**
 * Translate comment bodies once and store for reuse.
 *
 * Meta:
 * - mcw_source_lang: en|bn
 * - mcw_body_en / mcw_body_bn: PostBody arrays
 * - mcw_content_en / mcw_content_bn: plain text
 *
 * Default engine: MyMemory free API (override via filter `mcw_translate_text`
 * or env MCW_DEEPL_KEY for DeepL).
 */
class MCW_Forum_Translate
{
    public const LANGS = ['en', 'bn'];

    public static function ensure_comment(int $post_id, array $blocks, string $source_lang): void
    {
        $source_lang = in_array($source_lang, self::LANGS, true) ? $source_lang : 'en';
        $target = $source_lang === 'en' ? 'bn' : 'en';

        update_post_meta($post_id, 'mcw_source_lang', $source_lang);
        update_post_meta($post_id, 'mcw_body_' . $source_lang, $blocks);
        update_post_meta($post_id, 'mcw_content_' . $source_lang, self::plain_from_body($blocks));
        // Keep legacy keys in sync with source
        update_post_meta($post_id, 'mcw_body', $blocks);

        $existing = get_post_meta($post_id, 'mcw_body_' . $target, true);
        if (is_array($existing) && $existing) {
            return;
        }

        $translated = self::translate_body($blocks, $source_lang, $target);
        update_post_meta($post_id, 'mcw_body_' . $target, $translated);
        update_post_meta($post_id, 'mcw_content_' . $target, self::plain_from_body($translated));
    }

    /**
     * Lazy-fill missing translation (for older comments). Runs once, then cached.
     */
    public static function ensure_missing(int $post_id): void
    {
        $source = (string) get_post_meta($post_id, 'mcw_source_lang', true);
        $body = get_post_meta($post_id, 'mcw_body', true);
        if (!is_array($body) || !$body) {
            $post = get_post($post_id);
            $text = $post ? wp_strip_all_tags($post->post_content) : '';
            $body = [['type' => 'text', 'text' => $text]];
        }
        if ($source === '' || !in_array($source, self::LANGS, true)) {
            $source = self::detect_lang(self::plain_from_body($body));
        }
        self::ensure_comment($post_id, $body, $source);
    }

    /**
     * @param bool $live When false (default for reads), never call external translators.
     */
    public static function localized_body(int $post_id, string $lang, bool $live = false): array
    {
        $lang = in_array($lang, self::LANGS, true) ? $lang : 'en';
        $source_id = self::english_sibling_id($post_id);

        $body = get_post_meta($post_id, 'mcw_body_' . $lang, true);
        if (is_array($body) && $body && !self::is_stub_body($body)) {
            if ($lang === 'en' || self::looks_like_lang(self::plain_from_body($body), $lang)) {
                return $body;
            }
        }
        if ($source_id !== $post_id) {
            $from_en = get_post_meta($source_id, 'mcw_body_' . $lang, true);
            if (is_array($from_en) && $from_en && !self::is_stub_body($from_en)) {
                if ($lang === 'en' || self::looks_like_lang(self::plain_from_body($from_en), $lang)) {
                    return $from_en;
                }
            }
        }

        if ($live) {
            if ($source_id !== $post_id) {
                self::ensure_thread($post_id);
            } else {
                self::ensure_missing($post_id);
            }
            $body = get_post_meta($post_id, 'mcw_body_' . $lang, true);
            if (is_array($body) && $body && !self::is_stub_body($body)) {
                return $body;
            }
            $from_en = get_post_meta($source_id, 'mcw_body_' . $lang, true);
            if (is_array($from_en) && $from_en) {
                return $from_en;
            }
        }

        $fallback = get_post_meta($source_id, 'mcw_body', true);
        if (!is_array($fallback) || !$fallback) {
            $fallback = get_post_meta($post_id, 'mcw_body', true);
        }
        return is_array($fallback) ? $fallback : [];
    }

    public static function localized_content(int $post_id, string $lang, bool $live = false): string
    {
        $lang = in_array($lang, self::LANGS, true) ? $lang : 'en';
        $content = get_post_meta($post_id, 'mcw_content_' . $lang, true);
        if (is_string($content) && $content !== '' && ($lang === 'en' || self::looks_like_lang($content, $lang))) {
            return $content;
        }
        $source_id = self::english_sibling_id($post_id);
        if ($source_id !== $post_id) {
            $alt = get_post_meta($source_id, 'mcw_content_' . $lang, true);
            if (is_string($alt) && $alt !== '' && ($lang === 'en' || self::looks_like_lang($alt, $lang))) {
                return $alt;
            }
        }
        return self::plain_from_body(self::localized_body($post_id, $lang, $live));
    }

    /**
     * Titles: prefer cache / WPML EN sibling. Live translate only when $live=true (backfill/CLI).
     */
    public static function localized_title(int $post_id, string $lang, bool $live = false): string
    {
        $lang = in_array($lang, self::LANGS, true) ? $lang : 'en';
        $source_id = self::english_sibling_id($post_id);
        $source_post = get_post($source_id) ?: get_post($post_id);
        $english = self::clean_title(
            $source_post
                ? html_entity_decode(get_the_title($source_post), ENT_QUOTES | ENT_HTML5, 'UTF-8')
                : ''
        );
        if ($english === '') {
            return '';
        }

        if ($lang === 'en') {
            return $english;
        }

        $cached = get_post_meta($post_id, 'mcw_title_' . $lang, true);
        if (!is_string($cached) || $cached === '' || !self::looks_like_lang($cached, $lang)) {
            $cached_en = get_post_meta($source_id, 'mcw_title_' . $lang, true);
            if (is_string($cached_en) && $cached_en !== '' && self::looks_like_lang($cached_en, $lang)) {
                $cached = $cached_en;
            } else {
                $cached = '';
            }
        }
        if (is_string($cached) && $cached !== '' && self::looks_like_lang($cached, $lang)) {
            return $cached;
        }

        if (!$live) {
            // Fast path: serve English until offline backfill fills the cache.
            return $english;
        }

        $translated = self::translate_text($english, 'en', $lang);
        if ($translated === '' || !self::looks_like_lang($translated, $lang)) {
            return $translated !== '' ? $translated : $english;
        }
        update_post_meta($post_id, 'mcw_title_' . $lang, $translated);
        update_post_meta($source_id, 'mcw_title_' . $lang, $translated);
        update_post_meta($source_id, 'mcw_title_en', $english);
        return $translated;
    }

    /** Ensure thread body+title have both language variants (once). */
    public static function ensure_thread(int $post_id): void
    {
        $post = get_post($post_id);
        if (!$post) {
            return;
        }
        // Force title localization for both langs (writes cache via live translate).
        self::localized_title($post_id, 'bn', true);
        self::localized_title($post_id, 'en', true);

        $source_id = self::english_sibling_id($post_id);
        $source_post = get_post($source_id) ?: $post;
        $body = get_post_meta($source_id, 'mcw_body', true);
        if (!is_array($body) || !$body) {
            $text = wp_strip_all_tags($source_post->post_content);
            $body = [['type' => 'text', 'text' => $text]];
        }
        // Skip WPML stub bodies ("এটি বাংলা ডেমো অনুবাদ…") — use EN sibling.
        if (self::is_stub_body($body)) {
            $en_body = get_post_meta($source_id, 'mcw_body', true);
            if (is_array($en_body) && $en_body && !self::is_stub_body($en_body)) {
                $body = $en_body;
            } else {
                $body = [['type' => 'text', 'text' => wp_strip_all_tags($source_post->post_content)]];
            }
        }
        self::ensure_comment($source_id, $body, 'en');
        // Mirror BN body onto the requested post so map_thread finds it.
        $bn = get_post_meta($source_id, 'mcw_body_bn', true);
        if (is_array($bn) && $bn) {
            update_post_meta($post_id, 'mcw_body_bn', $bn);
            update_post_meta($post_id, 'mcw_content_bn', self::plain_from_body($bn));
        }
    }

    public static function localized_term_field(int $term_id, string $field, string $native, string $lang, bool $live = false): string
    {
        $lang = in_array($lang, self::LANGS, true) ? $lang : 'en';
        $native = html_entity_decode($native, ENT_QUOTES | ENT_HTML5, 'UTF-8');
        if ($native === '') {
            return '';
        }
        $meta_key = 'mcw_' . $field . '_' . $lang;
        $cached = get_term_meta($term_id, $meta_key, true);
        if (is_string($cached) && $cached !== '') {
            return $cached;
        }
        $source = self::detect_lang($native);
        if ($source === $lang) {
            update_term_meta($term_id, $meta_key, $native);
            return $native;
        }
        if (!$live) {
            return $native;
        }
        $translated = self::translate_text($native, $source, $lang);
        update_term_meta($term_id, $meta_key, $translated);
        update_term_meta($term_id, 'mcw_' . $field . '_' . $source, $native);
        return $translated;
    }

    public static function translate_body(array $blocks, string $from, string $to): array
    {
        if ($from === $to) {
            return $blocks;
        }
        $out = [];
        foreach ($blocks as $block) {
            if (!is_array($block)) {
                continue;
            }
            $type = $block['type'] ?? 'text';
            if ($type === 'text') {
                $text = (string) ($block['text'] ?? '');
                $out[] = array_merge($block, [
                    'text' => $text === '' ? '' : self::translate_text($text, $from, $to),
                ]);
            } else {
                // images / non-text: keep as-is
                $out[] = $block;
            }
        }
        return $out;
    }

    public static function translate_text(string $text, string $from, string $to): string
    {
        $text = trim($text);
        if ($text === '' || $from === $to) {
            return $text;
        }

        $filtered = apply_filters('mcw_translate_text', null, $text, $from, $to);
        if (is_string($filtered) && $filtered !== '') {
            return $filtered;
        }

        $cache_key = 'mcw_tr_' . md5($from . '|' . $to . '|' . $text);
        $cached = get_transient($cache_key);
        if (is_string($cached) && $cached !== '') {
            return $cached;
        }

        $translated = self::via_deepl($text, $from, $to);
        if ($translated === null) {
            $translated = self::via_mymemory($text, $from, $to);
        }
        if ($translated === null) {
            // Last resort: keep original (UI still works)
            return $text;
        }

        set_transient($cache_key, $translated, MONTH_IN_SECONDS);
        return $translated;
    }

    private static function via_deepl(string $text, string $from, string $to): ?string
    {
        $key = getenv('MCW_DEEPL_KEY') ?: (defined('MCW_DEEPL_KEY') ? MCW_DEEPL_KEY : '');
        if (!$key) {
            return null;
        }
        $source = strtoupper($from === 'bn' ? 'BN' : 'EN');
        $target = strtoupper($to === 'bn' ? 'BN' : 'EN-US');
        $res = wp_remote_post('https://api-free.deepl.com/v2/translate', [
            'timeout' => 20,
            'headers' => [
                'Authorization' => 'DeepL-Auth-Key ' . $key,
                'Content-Type' => 'application/json',
            ],
            'body' => wp_json_encode([
                'text' => [$text],
                'source_lang' => $source,
                'target_lang' => $target,
            ]),
        ]);
        if (is_wp_error($res) || wp_remote_retrieve_response_code($res) >= 300) {
            return null;
        }
        $data = json_decode((string) wp_remote_retrieve_body($res), true);
        $out = $data['translations'][0]['text'] ?? null;
        return is_string($out) && $out !== '' ? $out : null;
    }

    private static function via_mymemory(string $text, string $from, string $to): ?string
    {
        // Free public endpoint — fine for short forum comments; results cached.
        $pair = rawurlencode($from . '|' . $to);
        $url = 'https://api.mymemory.translated.net/get?q=' . rawurlencode($text) . '&langpair=' . $pair;
        $res = wp_remote_get($url, ['timeout' => 20]);
        if (is_wp_error($res) || wp_remote_retrieve_response_code($res) >= 300) {
            return null;
        }
        $data = json_decode((string) wp_remote_retrieve_body($res), true);
        $out = $data['responseData']['translatedText'] ?? null;
        if (!is_string($out) || $out === '') {
            return null;
        }
        // MyMemory sometimes echoes "QUERY LENGTH LIMIT..." on failure
        if (stripos($out, 'QUERY LENGTH LIMIT') !== false) {
            return null;
        }
        return html_entity_decode($out, ENT_QUOTES | ENT_HTML5, 'UTF-8');
    }

    public static function plain_from_body(array $blocks): string
    {
        $parts = [];
        foreach ($blocks as $b) {
            if (($b['type'] ?? '') === 'text' && !empty($b['text'])) {
                $parts[] = (string) $b['text'];
            }
        }
        return trim(implode("\n\n", $parts));
    }

    /**
     * Majority-script heuristic. A single "(বাংলা)" suffix must not flip EN → BN.
     */
    public static function detect_lang(string $text): string
    {
        $text = self::clean_title($text);
        if ($text === '') {
            return 'en';
        }
        preg_match_all('/[\x{0980}-\x{09FF}]/u', $text, $bn);
        preg_match_all('/[A-Za-z]/', $text, $latin);
        $bn_n = count($bn[0] ?? []);
        $latin_n = count($latin[0] ?? []);
        if ($bn_n === 0) {
            return 'en';
        }
        if ($latin_n === 0) {
            return 'bn';
        }
        // Need Bengali to be a real share of letters, not a tiny marker.
        return ($bn_n / max(1, $bn_n + $latin_n)) >= 0.35 ? 'bn' : 'en';
    }

    public static function looks_like_lang(string $text, string $lang): bool
    {
        return self::detect_lang($text) === $lang;
    }

    /** Strip WPML stub markers like "(বাংলা)" from titles. */
    public static function clean_title(string $title): string
    {
        $title = html_entity_decode($title, ENT_QUOTES | ENT_HTML5, 'UTF-8');
        $title = preg_replace('/\s*[\(\[\{]\s*(বাংলা|Bengali|Bangla|BN)\s*[\)\]\}]\s*$/ui', '', $title) ?? $title;
        $title = preg_replace('/\s*[—\-]\s*(বাংলা|Bengali|Bangla)\s*$/ui', '', $title) ?? $title;
        return trim($title);
    }

    public static function english_sibling_id(int $post_id): int
    {
        if (has_filter('wpml_object_id')) {
            $en = apply_filters('wpml_object_id', $post_id, 'mcw_thread', true, 'en');
            if ($en) {
                return (int) $en;
            }
            $en = apply_filters('wpml_object_id', $post_id, 'post_mcw_thread', true, 'en');
            if ($en) {
                return (int) $en;
            }
        }
        return $post_id;
    }

    public static function is_stub_body(array $blocks): bool
    {
        $plain = self::plain_from_body($blocks);
        if ($plain === '') {
            return true;
        }
        // Seeded WPML stub copy used during BN duplication.
        if (mb_stripos($plain, 'বাংলা ডেমো') !== false || mb_stripos($plain, 'ডেমো অনুবাদ') !== false) {
            return true;
        }
        if (stripos($plain, 'WPML') !== false && mb_stripos($plain, 'অনুবাদ') !== false && mb_strlen($plain) < 200) {
            return true;
        }
        return false;
    }
}

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

    public static function localized_body(int $post_id, string $lang): array
    {
        $lang = in_array($lang, self::LANGS, true) ? $lang : 'en';
        $body = get_post_meta($post_id, 'mcw_body_' . $lang, true);
        if (is_array($body) && $body) {
            return $body;
        }
        self::ensure_missing($post_id);
        $body = get_post_meta($post_id, 'mcw_body_' . $lang, true);
        if (is_array($body) && $body) {
            return $body;
        }
        $fallback = get_post_meta($post_id, 'mcw_body', true);
        return is_array($fallback) ? $fallback : [];
    }

    public static function localized_content(int $post_id, string $lang): string
    {
        $lang = in_array($lang, self::LANGS, true) ? $lang : 'en';
        $content = get_post_meta($post_id, 'mcw_content_' . $lang, true);
        if (is_string($content) && $content !== '') {
            return $content;
        }
        return self::plain_from_body(self::localized_body($post_id, $lang));
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

    /** Very light heuristic for legacy comments without source_lang. */
    public static function detect_lang(string $text): string
    {
        if (preg_match('/[\x{0980}-\x{09FF}]/u', $text)) {
            return 'bn';
        }
        return 'en';
    }
}

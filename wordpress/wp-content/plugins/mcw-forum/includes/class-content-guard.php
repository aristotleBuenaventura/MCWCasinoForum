<?php
/**
 * Anti-spam / malicious-link / XSS hardening for UGC writes.
 * Gates create/update only — never mass-deletes existing content.
 */
if (!defined('ABSPATH')) {
    exit;
}

class MCW_Forum_Content_Guard
{
    public const OPTION_KEY = 'mcw_content_guard_settings';

    /** @return array<string,mixed> */
    public static function settings(): array
    {
        $defaults = [
            'max_links' => 4,
            'max_images' => 8,
            'max_title_len' => 200,
            'max_bio_len' => 2000,
            'max_text_len' => 50000,
            'max_tags' => 12,
            'max_tag_len' => 40,
            'new_account_delay_sec' => 15,
            'post_cooldown_sec' => 30,
            'duplicate_window_sec' => 600,
            'thread_rate_max' => 8,
            'thread_rate_window_sec' => 600,
            'comment_rate_max' => 20,
            'comment_rate_window_sec' => 600,
            'report_rate_max' => 10,
            'report_rate_window_sec' => 600,
            'profile_rate_max' => 20,
            'profile_rate_window_sec' => 600,
            'require_local_media' => false,
            'block_url_shorteners' => true,
            'auto_hold_on_soft_spam' => true,
            'url_allowlist' => [],
            'url_blocklist' => [
                'bit.ly', 'tinyurl.com', 't.co', 'goo.gl', 'ow.ly', 'is.gd', 'buff.ly',
                'rebrand.ly', 'cutt.ly', 'tiny.cc', 'rb.gy', 'shorturl.at', 'adf.ly',
                'grabify.link', 'iplogger.org', 'blasze.com',
            ],
        ];
        if (defined('MCW_URL_ALLOWLIST') && is_string(MCW_URL_ALLOWLIST) && MCW_URL_ALLOWLIST !== '') {
            $defaults['url_allowlist'] = array_values(array_filter(array_map('trim', explode(',', MCW_URL_ALLOWLIST))));
        }
        if (defined('MCW_URL_BLOCKLIST') && is_string(MCW_URL_BLOCKLIST) && MCW_URL_BLOCKLIST !== '') {
            $defaults['url_blocklist'] = array_values(array_filter(array_map('trim', explode(',', MCW_URL_BLOCKLIST))));
        }
        if (defined('MCW_MAX_LINKS_PER_POST')) {
            $defaults['max_links'] = max(0, (int) MCW_MAX_LINKS_PER_POST);
        }
        $stored = get_option(self::OPTION_KEY, []);
        if (!is_array($stored)) {
            $stored = [];
        }
        $merged = array_merge($defaults, $stored);
        /**
         * Filter content-guard settings (allowlist/blocklist, limits, etc.).
         *
         * @param array $merged
         */
        return apply_filters('mcw_content_guard_settings', $merged);
    }

    public static function error_response(WP_Error $err): WP_REST_Response
    {
        $status = (int) ($err->get_error_data()['status'] ?? 400);
        return new WP_REST_Response(['ok' => false, 'error' => $err->get_error_message()], $status);
    }

    /**
     * Extract http(s) URLs from Unicode text (EN/BN safe).
     *
     * @return list<string>
     */
    public static function extract_urls(string $text): array
    {
        if ($text === '') {
            return [];
        }
        $found = [];
        if (preg_match_all('#https?://[^\s<>"\']+#iu', $text, $m)) {
            foreach ($m[0] as $u) {
                $found[] = rtrim($u, '.,);]');
            }
        }
        // Protocol-relative (treat as malicious/hidden redirect bait).
        if (preg_match_all('#(?<![a-z0-9:])//[^\s<>"\']+#iu', $text, $m2)) {
            foreach ($m2[0] as $u) {
                $found[] = $u;
            }
        }
        return array_values(array_unique($found));
    }

    public static function plain_from_blocks(array $blocks): string
    {
        $parts = [];
        foreach ($blocks as $b) {
            if (!is_array($b)) {
                continue;
            }
            if (($b['type'] ?? '') === 'text') {
                $parts[] = (string) ($b['text'] ?? '');
            }
        }
        return trim(implode("\n\n", $parts));
    }

    /**
     * Validate and normalize a URL for a given kind: image|avatar|cms|link.
     *
     * @return string|WP_Error Normalized URL or error.
     */
    public static function check_url(string $url, string $kind = 'link')
    {
        $url = trim($url);
        if ($url === '') {
            return new WP_Error('mcw_url', 'Empty URL.', ['status' => 400]);
        }
        $lower = strtolower($url);

        // Block dangerous schemes and protocol-relative URLs.
        if (preg_match('#^(javascript|data|vbscript|file):#i', $lower)) {
            return new WP_Error('mcw_url', 'URL scheme not allowed.', ['status' => 400]);
        }
        if (str_starts_with($url, '//')) {
            return new WP_Error('mcw_url', 'Protocol-relative URLs are not allowed.', ['status' => 400]);
        }

        $settings = self::settings();
        $site_host = strtolower((string) wp_parse_url(home_url(), PHP_URL_HOST));
        $upload = wp_upload_dir();
        $upload_base = is_array($upload) ? (string) ($upload['baseurl'] ?? '') : '';
        $upload_path = $upload_base ? (string) wp_parse_url($upload_base, PHP_URL_PATH) : '/wp-content/uploads';

        // Relative site paths (must be real paths, not //host).
        if (str_starts_with($url, '/')) {
            if (str_starts_with($url, '//')) {
                return new WP_Error('mcw_url', 'Protocol-relative URLs are not allowed.', ['status' => 400]);
            }
            // Avatars/images: prefer uploads paths.
            if (in_array($kind, ['image', 'avatar'], true)) {
                if (!str_starts_with($url, $upload_path) && !str_starts_with($url, '/wp-content/uploads')) {
                    if (!empty($settings['require_local_media'])) {
                        return new WP_Error('mcw_url', 'Only uploaded media URLs are allowed.', ['status' => 400]);
                    }
                }
            }
            // Soft-normalize: strip control chars.
            $safe = preg_replace('/[\x00-\x1F\x7F]/', '', $url);
            return is_string($safe) ? $safe : $url;
        }

        if (!preg_match('#^https?://#i', $url)) {
            return new WP_Error('mcw_url', 'Only http(s) or site-relative URLs are allowed.', ['status' => 400]);
        }

        $safe = esc_url_raw($url);
        if (!$safe || !preg_match('#^https?://#i', $safe)) {
            return new WP_Error('mcw_url', 'Invalid URL.', ['status' => 400]);
        }

        $host = strtolower((string) wp_parse_url($safe, PHP_URL_HOST));
        if ($host === '') {
            return new WP_Error('mcw_url', 'Invalid URL host.', ['status' => 400]);
        }

        // Punycode / IDN phishing bait — still allowed if not blocklisted, but never for avatar when require_local.
        $blocklist = array_map('strtolower', (array) ($settings['url_blocklist'] ?? []));
        foreach ($blocklist as $blocked) {
            $blocked = trim((string) $blocked);
            if ($blocked === '') {
                continue;
            }
            if ($host === $blocked || str_ends_with($host, '.' . $blocked)) {
                return new WP_Error('mcw_url', 'Link domain is not allowed.', ['status' => 400]);
            }
        }

        $allowlist = array_map('strtolower', array_filter((array) ($settings['url_allowlist'] ?? [])));
        if ($allowlist) {
            $ok = false;
            foreach ($allowlist as $allowed) {
                if ($host === $allowed || str_ends_with($host, '.' . $allowed) || ($site_host && $host === $site_host)) {
                    $ok = true;
                    break;
                }
            }
            if (!$ok) {
                return new WP_Error('mcw_url', 'Link domain is not on the allowlist.', ['status' => 400]);
            }
        }

        if (!empty($settings['require_local_media']) && in_array($kind, ['image', 'avatar'], true)) {
            if (!$site_host || $host !== $site_host) {
                return new WP_Error('mcw_url', 'Only site-hosted media is allowed.', ['status' => 400]);
            }
        }

        // Soften open redirects: reject credentials in URL userinfo.
        if (str_contains($safe, '@') && preg_match('#^https?://[^/]*@#i', $safe)) {
            return new WP_Error('mcw_url', 'URLs with embedded credentials are not allowed.', ['status' => 400]);
        }

        return $safe;
    }

    /**
     * Sanitize post body blocks. Returns array or WP_Error.
     *
     * @param mixed $blocks
     * @return array|WP_Error
     */
    public static function sanitize_blocks($blocks, string $context = 'post')
    {
        if (!is_array($blocks)) {
            return [];
        }
        $settings = self::settings();
        $out = [];
        $images = 0;
        $text_len = 0;

        foreach ($blocks as $block) {
            if (!is_array($block)) {
                continue;
            }
            $type = sanitize_key((string) ($block['type'] ?? 'text'));
            if ($type === 'text') {
                $text = sanitize_textarea_field((string) ($block['text'] ?? ''));
                // Strip residual HTML entities that could smuggle markup in WP admin views.
                $text = wp_strip_all_tags($text);
                if ($text === '') {
                    continue;
                }
                $text_len += mb_strlen($text);
                if ($text_len > (int) $settings['max_text_len']) {
                    return new WP_Error('mcw_spam', 'Post text is too long.', ['status' => 400]);
                }
                $out[] = ['type' => 'text', 'text' => $text];
                continue;
            }
            if ($type === 'image') {
                $images++;
                if ($images > (int) $settings['max_images']) {
                    return new WP_Error('mcw_spam', 'Too many images in this post.', ['status' => 400]);
                }
                $checked = self::check_url((string) ($block['url'] ?? ''), 'image');
                if (is_wp_error($checked)) {
                    return $checked;
                }
                $out[] = ['type' => 'image', 'url' => $checked];
            }
            // Unknown types dropped (prevents nested HTML / script smuggling).
        }

        $plain = self::plain_from_blocks($out);
        $urls = self::extract_urls($plain);
        foreach ($urls as $u) {
            $checked = self::check_url($u, 'link');
            if (is_wp_error($checked)) {
                return $checked;
            }
        }
        // Image block URLs also count toward link budget for spam walls.
        $link_total = count($urls) + $images;
        $max_links = (int) $settings['max_links'];
        if ($context !== 'admin' && $link_total > $max_links) {
            return new WP_Error('mcw_spam', 'Too many links in this post.', ['status' => 400]);
        }

        return $out;
    }

    /** @return string|WP_Error */
    public static function sanitize_title(string $title)
    {
        $settings = self::settings();
        $title = sanitize_text_field($title);
        $title = wp_strip_all_tags($title);
        $title = trim($title);
        if ($title === '') {
            return new WP_Error('mcw_title', 'Title required.', ['status' => 400]);
        }
        if (mb_strlen($title) > (int) $settings['max_title_len']) {
            return new WP_Error('mcw_title', 'Title is too long.', ['status' => 400]);
        }
        foreach (self::extract_urls($title) as $u) {
            $checked = self::check_url($u, 'link');
            if (is_wp_error($checked)) {
                return $checked;
            }
        }
        return $title;
    }

    /** @return string|WP_Error */
    public static function sanitize_bio(string $bio)
    {
        $settings = self::settings();
        $bio = sanitize_textarea_field($bio);
        $bio = wp_strip_all_tags($bio);
        if (mb_strlen($bio) > (int) $settings['max_bio_len']) {
            return new WP_Error('mcw_bio', 'Bio is too long.', ['status' => 400]);
        }
        $urls = self::extract_urls($bio);
        if (count($urls) > (int) $settings['max_links']) {
            return new WP_Error('mcw_spam', 'Too many links in bio.', ['status' => 400]);
        }
        foreach ($urls as $u) {
            $checked = self::check_url($u, 'link');
            if (is_wp_error($checked)) {
                return $checked;
            }
        }
        return $bio;
    }

    /**
     * @param list<mixed> $tags
     * @return list<string>|WP_Error
     */
    public static function sanitize_tags(array $tags)
    {
        $settings = self::settings();
        $out = [];
        foreach ($tags as $tag) {
            $t = sanitize_text_field((string) $tag);
            $t = wp_strip_all_tags($t);
            if ($t === '') {
                continue;
            }
            if (mb_strlen($t) > (int) $settings['max_tag_len']) {
                return new WP_Error('mcw_tags', 'Tag is too long.', ['status' => 400]);
            }
            if (self::extract_urls($t)) {
                return new WP_Error('mcw_tags', 'Tags cannot contain links.', ['status' => 400]);
            }
            $out[] = $t;
            if (count($out) >= (int) $settings['max_tags']) {
                break;
            }
        }
        return $out;
    }

    public static function content_hash(string $title, string $content): string
    {
        return hash('sha256', mb_strtolower(trim($title)) . "\n" . mb_strtolower(trim($content)));
    }

    /**
     * New-account delay, cooldown, duplicate detection, link budget.
     * Mods/admins bypass soft spam gates (still get URL scheme checks elsewhere).
     *
     * @return WP_Error|null
     */
    public static function assert_can_write(WP_User $user, string $action, string $title, string $content): ?WP_Error
    {
        if (MCW_Forum_Auth::is_mod_user($user)) {
            return null;
        }
        $settings = self::settings();
        $created = strtotime($user->user_registered);
        if ($created && (time() - $created) < (int) $settings['new_account_delay_sec']) {
            return new WP_Error('mcw_spam', 'New accounts must wait a few seconds before posting.', ['status' => 429]);
        }

        $hash = self::content_hash($title, $content);
        $key = 'mcw_last_write_' . (int) $user->ID;
        $prev = get_transient($key);
        $now = time();
        if (is_array($prev)) {
            $at = (int) ($prev['at'] ?? 0);
            $prev_hash = (string) ($prev['hash'] ?? '');
            if ($at && ($now - $at) < (int) $settings['post_cooldown_sec']) {
                return new WP_Error('mcw_spam', 'Please wait a moment between posts.', ['status' => 429]);
            }
            if ($prev_hash !== '' && $prev_hash === $hash && ($now - $at) < (int) $settings['duplicate_window_sec']) {
                return new WP_Error('mcw_spam', 'Duplicate post detected.', ['status' => 409]);
            }
        }

        $links = count(self::extract_urls($title . "\n" . $content));
        if ($links > (int) $settings['max_links']) {
            return new WP_Error('mcw_spam', 'Too many links in this post.', ['status' => 400]);
        }

        // Soft spam signals (hidden promo / repetitive ASCII spam). Do not punish Bengali script.
        $score = self::spam_score($title, $content);
        if ($score >= 80) {
            if (class_exists('MCW_Forum_Security_Log')) {
                MCW_Forum_Security_Log::event('spam_blocked', ['score' => (string) $score]);
            }
            return new WP_Error('mcw_spam', 'Content blocked by spam filters.', ['status' => 400]);
        }

        set_transient($key, ['at' => $now, 'hash' => $hash], (int) $settings['duplicate_window_sec']);

        if ($score >= 50 && !empty($settings['auto_hold_on_soft_spam'])) {
            return new WP_Error('mcw_hold', 'held', ['status' => 202, 'score' => $score]);
        }

        return null;
    }

    /**
     * Lightweight spam score (0–100). Unicode/Bengali-heavy text is not treated as gibberish.
     */
    public static function spam_score(string $title, string $content): int
    {
        $text = $title . "\n" . $content;
        if ($text === '') {
            return 0;
        }
        $score = 0;
        $urls = self::extract_urls($text);
        $score += min(40, count($urls) * 10);

        // Repeated same URL.
        if (count($urls) >= 2 && count(array_unique($urls)) === 1) {
            $score += 25;
        }

        // Homoglyph / punycode hosts.
        foreach ($urls as $u) {
            $host = (string) wp_parse_url($u, PHP_URL_HOST);
            if ($host !== '' && (str_starts_with(strtolower($host), 'xn--') || preg_match('/[^\x00-\x7F]/', $host))) {
                $score += 20;
            }
        }

        // Excessive CAPS (Latin only).
        if (preg_match_all('/[A-Z]/', $text, $caps) && preg_match_all('/[a-z]/', $text, $low)) {
            $c = count($caps[0]);
            $l = count($low[0]);
            if ($c + $l > 20 && $c / max(1, $c + $l) > 0.7) {
                $score += 15;
            }
        }

        // Character spam: same char repeated (works for any script).
        if (preg_match('/(.)\1{12,}/u', $text)) {
            $score += 20;
        }

        // Hidden ad patterns (zero-width / soft hyphen stuffing).
        if (preg_match('/[\x{200B}-\x{200D}\x{FEFF}\x{00AD}]/u', $text)) {
            $score += 30;
        }

        return min(100, $score);
    }

    /**
     * Create a moderation report without deleting content.
     */
    public static function flag_for_moderation(int $reporter_id, string $target_type, string $target_id, string $reason): void
    {
        global $wpdb;
        $table = $wpdb->prefix . 'mcw_reports';
        // Dedupe open auto-flags for same target+reason prefix.
        $existing = $wpdb->get_var($wpdb->prepare(
            "SELECT id FROM {$table} WHERE target_type = %s AND target_id = %s AND resolved = 0 AND reason LIKE %s LIMIT 1",
            $target_type,
            $target_id,
            'auto:%'
        ));
        if ($existing) {
            return;
        }
        MCW_Forum_DB::insert($table, [
            'id' => 'rep_' . wp_generate_password(10, false, false),
            'reporter_id' => max(0, $reporter_id),
            'target_type' => sanitize_text_field($target_type),
            'target_id' => sanitize_text_field($target_id),
            'reason' => sanitize_textarea_field($reason),
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
    }

    /** Re-sanitize translated body caches (EN/BN). */
    public static function resanitize_translated_blocks($blocks): array
    {
        $clean = self::sanitize_blocks(is_array($blocks) ? $blocks : [], 'post');
        return is_wp_error($clean) ? [] : $clean;
    }
}

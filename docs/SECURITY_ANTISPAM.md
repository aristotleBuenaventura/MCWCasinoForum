# Forum anti-spam & malicious-link controls

**Date:** 2026-11-19  
**Scope:** UGC write paths in `mcw-forum` (threads, comments, profile, reports, CMS URLs)  
**Guarantee:** Existing legitimate content is **not** mass-deleted; gates apply to new/updated writes. Soft spam is held as `pending` + mod queue.

## Controls

| Control | Implementation |
|---------|----------------|
| Content sanitization | `MCW_Forum_Content_Guard::sanitize_blocks` — text via `sanitize_textarea_field` + `wp_strip_all_tags`; unknown block types dropped |
| URL policy | `check_url` — block `javascript:` / `data:` / `vbscript:` / `file:` / `//`; block credentialed URLs; configurable allow/block lists |
| URL shortener / phishing hosts | Default blocklist (`bit.ly`, `grabify.link`, …); override via option `mcw_content_guard_settings`, filter `mcw_content_guard_settings`, or `MCW_URL_BLOCKLIST` / `MCW_URL_ALLOWLIST` |
| Rate limits | Threads, comments, reports, profile patches (transients + IP) |
| Duplicate / flood | New-account delay, 30s cooldown, 10m duplicate hash (Node `assertCanPost` parity) |
| Link / image caps | Default max 4 links, 8 images per post |
| Soft moderation | Spam score → `pending` + `mcw_held` + auto report (`auto:soft-spam-hold`); mods approve/hold via `/mod/content/{id}/approve\|hold` |
| Profile | Bio length/URL density; avatar URL policy; display name cannot contain links |
| Translations | EN/BN caches re-sanitized in `translate_body` |
| Frontend | `safeExternalHref` on ad links/images; `rel="noopener noreferrer nofollow"` |

## Configuration

```php
// wp-config.php (optional)
define('MCW_URL_ALLOWLIST', 'cdn.example.com,images.example.com'); // empty = any https host (still scheme-safe)
define('MCW_URL_BLOCKLIST', 'bit.ly,tinyurl.com,evil.example');
define('MCW_MAX_LINKS_PER_POST', 4);

// Or WP option / filter:
update_option('mcw_content_guard_settings', [
  'require_local_media' => true, // images/avatars must be site-hosted
  'max_links' => 3,
]);
```

## Tests

```bash
npm run test:security:spam
# php wordpress/wp-content/plugins/mcw-forum/tests/anti-spam-content-guard.php
```

Tests create throwaway users/posts only and remove those artifacts. Published forum count is spot-checked to remain &gt; 0.

## Bengali / English

Sanitizers and spam scoring are Unicode-aware. Bengali script is not treated as gibberish; zero-width / shortener / link-wall signals still apply equally to both languages.

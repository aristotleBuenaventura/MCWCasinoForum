<?php
/**
 * Optional Cloudflare Turnstile server-side verification.
 *
 * Config (wp-config / env):
 *   MCW_TURNSTILE_SECRET or TURNSTILE_SECRET — real Cloudflare secret
 *   MCW_TURNSTILE_REQUIRED=true — fail closed when secret missing/test (production)
 *
 * When secret unset and REQUIRED is false: verification is skipped (dev).
 * Never claim CAPTCHA is enabled unless a real secret is configured.
 */
if (!defined('ABSPATH')) {
    exit;
}

class MCW_Forum_Turnstile
{
    public static function secret(): string
    {
        if (defined('MCW_TURNSTILE_SECRET') && is_string(MCW_TURNSTILE_SECRET)) {
            return MCW_TURNSTILE_SECRET;
        }
        if (defined('TURNSTILE_SECRET') && is_string(TURNSTILE_SECRET)) {
            return TURNSTILE_SECRET;
        }
        $env = getenv('MCW_TURNSTILE_SECRET') ?: getenv('TURNSTILE_SECRET');
        return is_string($env) ? $env : '';
    }

    public static function is_test_secret(string $secret): bool
    {
        return $secret === '' || str_starts_with($secret, '1x000000000000000000000');
    }

    public static function is_required(): bool
    {
        if (defined('MCW_TURNSTILE_REQUIRED') && MCW_TURNSTILE_REQUIRED) {
            return true;
        }
        $env = getenv('MCW_TURNSTILE_REQUIRED');
        return $env === '1' || strtolower((string) $env) === 'true';
    }

    public static function is_configured(): bool
    {
        $s = self::secret();
        return $s !== '' && !self::is_test_secret($s);
    }

    /**
     * @return true|WP_Error
     */
    public static function verify_request(WP_REST_Request $request)
    {
        $secret = self::secret();
        $required = self::is_required();

        if ($secret === '' || self::is_test_secret($secret)) {
            if ($required) {
                return new WP_Error(
                    'mcw_turnstile',
                    'Captcha is required but not configured.',
                    ['status' => 503]
                );
            }
            // Dev / optional mode — do not block; do not claim protection.
            return true;
        }

        $body = MCW_Forum_Forum::json_body($request);
        $token = (string) ($body['turnstileToken'] ?? $body['cf-turnstile-response'] ?? '');
        if ($token === '') {
            return new WP_Error('mcw_turnstile', 'Captcha required.', ['status' => 400]);
        }
        $ip = $_SERVER['REMOTE_ADDR'] ?? '';
        $resp = wp_remote_post('https://challenges.cloudflare.com/turnstile/siteverify', [
            'timeout' => 8,
            'body' => [
                'secret' => $secret,
                'response' => $token,
                'remoteip' => is_string($ip) ? $ip : '',
            ],
        ]);
        if (is_wp_error($resp)) {
            return new WP_Error('mcw_turnstile', 'Captcha verification unavailable.', ['status' => 503]);
        }
        $data = json_decode((string) wp_remote_retrieve_body($resp), true);
        if (!is_array($data) || empty($data['success'])) {
            if (class_exists('MCW_Forum_Security_Log')) {
                MCW_Forum_Security_Log::event('turnstile_failed', []);
            }
            return new WP_Error('mcw_turnstile', 'Captcha failed.', ['status' => 400]);
        }
        return true;
    }
}

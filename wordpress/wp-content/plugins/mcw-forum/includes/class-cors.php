<?php

if (!defined('ABSPATH')) {
    exit;
}

class MCW_Forum_CORS
{
    public static function allowed_origin(): string
    {
        $origin = getenv('MCW_CORS_ORIGIN') ?: (defined('MCW_CORS_ORIGIN') ? MCW_CORS_ORIGIN : 'http://localhost:5173');
        return rtrim((string) $origin, '/');
    }

    public static function init(): void
    {
        add_action('rest_api_init', [self::class, 'send_headers'], 5);
        add_action('init', [self::class, 'handle_preflight'], 1);
    }

    public static function handle_preflight(): void
    {
        if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'OPTIONS') {
            return;
        }
        $uri = $_SERVER['REQUEST_URI'] ?? '';
        if (strpos($uri, '/wp-json/') === false && strpos($uri, '/?rest_route=') === false) {
            return;
        }
        self::apply_headers();
        status_header(204);
        exit;
    }

    public static function send_headers(): void
    {
        self::apply_headers();
    }

    private static function apply_headers(): void
    {
        $allowed = self::allowed_origin();
        $request_origin = isset($_SERVER['HTTP_ORIGIN']) ? rtrim((string) $_SERVER['HTTP_ORIGIN'], '/') : '';
        if ($request_origin && $request_origin === $allowed) {
            header('Access-Control-Allow-Origin: ' . $allowed);
            header('Access-Control-Allow-Credentials: true');
            header('Access-Control-Allow-Headers: Content-Type, Authorization, X-WP-Nonce');
            header('Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS');
            header('Vary: Origin');
        }
        // Baseline browser hardening (API + SPA responses through this WP stack).
        if (!headers_sent()) {
            header('X-Content-Type-Options: nosniff');
            header('Referrer-Policy: strict-origin-when-cross-origin');
            header('X-Frame-Options: SAMEORIGIN');
            header("Content-Security-Policy: frame-ancestors 'self'");
        }
    }
}

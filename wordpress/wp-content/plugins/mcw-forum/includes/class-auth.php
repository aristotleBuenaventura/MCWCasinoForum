<?php

if (!defined('ABSPATH')) {
    exit;
}

class MCW_Forum_Auth
{
    public const COOKIE = 'mcw_session';

    public static function init(): void
    {
        // no-op; methods used by REST
    }

    public static function current_user_id(): ?int
    {
        $token = self::cookie_token();
        if (!$token) {
            return null;
        }
        global $wpdb;
        $table = $wpdb->prefix . 'mcw_sessions';
        $hash = hash('sha256', $token);
        $row = $wpdb->get_row(
            $wpdb->prepare(
                "SELECT user_id, expires_at FROM {$table} WHERE token_hash = %s LIMIT 1",
                $hash
            )
        );
        if (!$row) {
            return null;
        }
        if (strtotime($row->expires_at) < time()) {
            $wpdb->delete($table, ['token_hash' => $hash]);
            return null;
        }
        $wpdb->update($table, ['last_seen_at' => current_time('mysql')], ['token_hash' => $hash]);
        return (int) $row->user_id;
    }

    public static function current_wp_user(): ?WP_User
    {
        $id = self::current_user_id();
        if (!$id) {
            return null;
        }
        $user = get_user_by('id', $id);
        return $user instanceof WP_User ? $user : null;
    }

    public static function issue_session(int $user_id, bool $stay = false): string
    {
        global $wpdb;
        $table = $wpdb->prefix . 'mcw_sessions';
        $token = bin2hex(random_bytes(32));
        $id = 'sess_' . wp_generate_password(12, false, false);
        $days = $stay ? 30 : 1;
        $expires = gmdate('Y-m-d H:i:s', time() + $days * DAY_IN_SECONDS);
        $wpdb->insert($table, [
            'id' => $id,
            'user_id' => $user_id,
            'token_hash' => hash('sha256', $token),
            'expires_at' => $expires,
            'last_seen_at' => current_time('mysql'),
        ]);
        $secure = is_ssl();
        setcookie(self::COOKIE, $token, [
            'expires' => time() + $days * DAY_IN_SECONDS,
            'path' => '/',
            'secure' => $secure,
            'httponly' => true,
            'samesite' => 'Lax',
        ]);
        $_COOKIE[self::COOKIE] = $token;
        return $token;
    }

    public static function clear_session(): void
    {
        $token = self::cookie_token();
        if ($token) {
            global $wpdb;
            $wpdb->delete($wpdb->prefix . 'mcw_sessions', ['token_hash' => hash('sha256', $token)]);
        }
        setcookie(self::COOKIE, '', [
            'expires' => time() - 3600,
            'path' => '/',
            'httponly' => true,
            'samesite' => 'Lax',
        ]);
        unset($_COOKIE[self::COOKIE]);
    }

    private static function cookie_token(): string
    {
        return isset($_COOKIE[self::COOKIE]) ? (string) $_COOKIE[self::COOKIE] : '';
    }

    public static function role_of(WP_User $user): string
    {
        $role = get_user_meta($user->ID, 'mcw_role', true);
        if (is_string($role) && $role !== '') {
            return $role;
        }
        if (user_can($user, 'manage_options')) {
            return 'admin';
        }
        return 'user';
    }

    public static function require_same_origin(WP_REST_Request $request): ?WP_Error
    {
        $method = $request->get_method();
        if (in_array($method, ['GET', 'HEAD', 'OPTIONS'], true)) {
            return null;
        }
        $allowed = MCW_Forum_CORS::allowed_origin();
        $origin = isset($_SERVER['HTTP_ORIGIN']) ? rtrim((string) $_SERVER['HTTP_ORIGIN'], '/') : '';
        if ($origin) {
            if ($origin !== $allowed) {
                return new WP_Error('mcw_cors', 'Cross-origin request blocked.', ['status' => 403]);
            }
            return null;
        }
        $referer = isset($_SERVER['HTTP_REFERER']) ? (string) $_SERVER['HTTP_REFERER'] : '';
        if ($referer && strpos($referer, $allowed) !== 0) {
            return new WP_Error('mcw_cors', 'Cross-origin request blocked.', ['status' => 403]);
        }
        return null;
    }
}

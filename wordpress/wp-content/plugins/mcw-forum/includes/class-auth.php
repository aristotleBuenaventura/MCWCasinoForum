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
            MCW_Forum_DB::delete($table, ['token_hash' => $hash], ['token_hash' => '%s']);
            return null;
        }
        MCW_Forum_DB::update(
            $table,
            ['last_seen_at' => current_time('mysql')],
            ['token_hash' => $hash],
            ['last_seen_at' => '%s'],
            ['token_hash' => '%s']
        );
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
        MCW_Forum_DB::insert($table, [
            'id' => $id,
            'user_id' => $user_id,
            'token_hash' => hash('sha256', $token),
            'expires_at' => $expires,
            'last_seen_at' => current_time('mysql'),
        ], [
            'id' => '%s',
            'user_id' => '%d',
            'token_hash' => '%s',
            'expires_at' => '%s',
            'last_seen_at' => '%s',
        ]);
        $secure = self::cookie_secure();
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

    /**
     * Secure flag: true when request is HTTPS, or when ops force it
     * via MCW_FORCE_SECURE_COOKIES / FORCE_SSL_ADMIN (behind TLS terminators).
     */
    public static function cookie_secure(): bool
    {
        if (defined('MCW_FORCE_SECURE_COOKIES') && MCW_FORCE_SECURE_COOKIES) {
            return true;
        }
        if (defined('FORCE_SSL_ADMIN') && FORCE_SSL_ADMIN && is_ssl()) {
            return true;
        }
        $env = getenv('MCW_FORCE_SECURE_COOKIES');
        if ($env === '1' || strtolower((string) $env) === 'true') {
            return true;
        }
        return is_ssl();
    }

    public static function clear_session(): void
    {
        $token = self::cookie_token();
        if ($token) {
            global $wpdb;
            MCW_Forum_DB::delete(
                $wpdb->prefix . 'mcw_sessions',
                ['token_hash' => hash('sha256', $token)],
                ['token_hash' => '%s']
            );
        }
        setcookie(self::COOKIE, '', [
            'expires' => time() - 3600,
            'path' => '/',
            'secure' => self::cookie_secure(),
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
        if (is_string($role) && $role !== '' && in_array($role, ['user', 'moderator', 'admin'], true)) {
            return $role;
        }
        if (user_can($user, 'manage_options')) {
            return 'admin';
        }
        return 'user';
    }

    /** Sync forum role meta with a WordPress role (capabilities). */
    public static function apply_forum_role(int $user_id, string $forum_role): bool
    {
        if (!in_array($forum_role, ['user', 'moderator', 'admin'], true)) {
            return false;
        }
        $user = get_user_by('id', $user_id);
        if (!$user instanceof WP_User) {
            return false;
        }
        MCW_Forum_DB::update_user_meta_allowed($user_id, 'mcw_role', $forum_role);
        if ($forum_role === 'admin') {
            $user->set_role('administrator');
        } elseif ($forum_role === 'moderator') {
            $user->set_role('editor');
        } else {
            $user->set_role('subscriber');
        }
        return true;
    }

    public static function count_forum_admins(): int
    {
        $users = get_users([
            'meta_key' => 'mcw_role',
            'meta_value' => 'admin',
            'fields' => 'ID',
            'number' => 200,
        ]);
        $n = is_array($users) ? count($users) : 0;
        // Include WP capability admins that may lack meta yet.
        foreach (get_users(['role' => 'administrator', 'fields' => 'ID', 'number' => 50]) as $id) {
            if (get_user_meta((int) $id, 'mcw_role', true) !== 'admin') {
                $n++;
            }
        }
        return $n;
    }

    /** Drop all forum sessions for a user (role / password / ban changes). */
    public static function invalidate_user_sessions(int $user_id): void
    {
        global $wpdb;
        MCW_Forum_DB::delete(
            $wpdb->prefix . 'mcw_sessions',
            ['user_id' => $user_id],
            ['user_id' => '%d']
        );
    }

    public static function require_same_origin(WP_REST_Request $request): ?WP_Error
    {
        $method = $request->get_method();
        if (in_array($method, ['GET', 'HEAD', 'OPTIONS'], true)) {
            return null;
        }
        $allowed = MCW_Forum_CORS::allowed_origin();
        $origin = isset($_SERVER['HTTP_ORIGIN']) ? rtrim((string) $_SERVER['HTTP_ORIGIN'], '/') : '';
        if ($origin === '') {
            $hdr = $request->get_header('origin');
            $origin = $hdr ? rtrim((string) $hdr, '/') : '';
        }
        if ($origin) {
            if ($origin !== $allowed) {
                return new WP_Error('mcw_cors', 'Cross-origin request blocked.', ['status' => 403]);
            }
            return null;
        }
        $referer = isset($_SERVER['HTTP_REFERER']) ? (string) $_SERVER['HTTP_REFERER'] : '';
        if ($referer === '') {
            $referer = (string) ($request->get_header('referer') ?: '');
        }
        if ($referer !== '') {
            if (strpos($referer, $allowed) !== 0) {
                return new WP_Error('mcw_cors', 'Cross-origin request blocked.', ['status' => 403]);
            }
            return null;
        }
        // Mutating cookie-auth requests must carry Origin or Referer (blocks bare CSRF/curl abuse).
        return new WP_Error('mcw_cors', 'Missing Origin.', ['status' => 403]);
    }

    /**
     * Forum admin requires forum role admin + WordPress manage_options.
     * Heals legacy seed users that had mcw_role=admin without WP administrator.
     */
    public static function is_admin_user(WP_User $user): bool
    {
        $meta = (string) get_user_meta($user->ID, 'mcw_role', true);
        if ($meta === 'admin' || ($meta === '' && user_can($user, 'manage_options'))) {
            if ($meta !== 'admin') {
                MCW_Forum_DB::update_user_meta_allowed((int) $user->ID, 'mcw_role', 'admin');
            }
            if (!user_can($user, 'manage_options')) {
                $user->set_role('administrator');
            }
            return user_can($user, 'manage_options');
        }
        return false;
    }

    public static function is_mod_user(WP_User $user): bool
    {
        if (self::is_admin_user($user)) {
            return true;
        }
        return self::role_of($user) === 'moderator';
    }
}

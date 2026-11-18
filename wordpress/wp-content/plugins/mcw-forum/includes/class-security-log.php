<?php

if (!defined('ABSPATH')) {
    exit;
}

/**
 * Centralized security event logging. Never log passwords, tokens, or secrets.
 */
class MCW_Forum_Security_Log
{
    public static function client_ip(): string
    {
        $ip = $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
        return is_string($ip) ? $ip : '0.0.0.0';
    }

    /** @param array<string, scalar|null> $fields */
    public static function event(string $type, array $fields = []): void
    {
        $parts = ['[mcw-security]', $type];
        foreach ($fields as $k => $v) {
            if ($v === null || $v === '') {
                continue;
            }
            // Redact accidental secret-like keys
            $lk = strtolower((string) $k);
            if (preg_match('/pass|token|secret|cookie|authorization|salt/i', $lk)) {
                continue;
            }
            $parts[] = $k . '=' . self::safe((string) $v);
        }
        $parts[] = 'ip=' . self::client_ip();
        error_log(implode(' ', $parts));
    }

    private static function safe(string $v): string
    {
        $v = str_replace(["\r", "\n", "\0"], '', $v);
        if (strlen($v) > 120) {
            $v = substr($v, 0, 117) . '...';
        }
        return $v;
    }
}

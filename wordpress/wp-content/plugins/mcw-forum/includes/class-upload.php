<?php
/**
 * Strict image upload validation + uploads-directory hardening.
 * Blocks executables, SVG, MIME spoofing, path traversal, and unsafe names.
 */
if (!defined('ABSPATH')) {
    exit;
}

class MCW_Forum_Upload
{
    public const MAX_BYTES = 5_242_880; // 5MB
    public const ALLOWED_EXT = ['jpg', 'jpeg', 'png', 'webp', 'gif'];
    public const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

    /** Dangerous substrings / extensions that must never appear in upload names. */
    public const BLOCKED_NAME_FRAGMENTS = [
        '.php', '.phtml', '.phar', '.php3', '.php4', '.php5', '.php7', '.phps',
        '.cgi', '.pl', '.asp', '.aspx', '.jsp', '.exe', '.sh', '.bat', '.cmd',
        '.svg', '.svgz', '.htaccess', '.user.ini',
    ];

    public static function init(): void
    {
        add_action('init', [self::class, 'ensure_uploads_hardened'], 20);
        // Block SVG (and other non-image) even if another plugin re-enables them.
        add_filter('upload_mimes', [self::class, 'filter_upload_mimes'], 99);
        add_filter('wp_check_filetype_and_ext', [self::class, 'filter_filetype_and_ext'], 99, 5);
    }

    /**
     * @param array<string,string> $mimes
     * @return array<string,string>
     */
    public static function filter_upload_mimes(array $mimes): array
    {
        unset($mimes['svg'], $mimes['svgz'], $mimes['php'], $mimes['phar']);
        return $mimes;
    }

    /**
     * Extra defense: never let WordPress accept SVG/PHP via filetype sniff.
     *
     * @param array<string,mixed> $data
     * @param array<string,mixed>|null $mimes
     * @return array<string,mixed>
     */
    public static function filter_filetype_and_ext($data, $file, $filename, $mimes, $real_mime = null)
    {
        $name = strtolower((string) $filename);
        foreach (self::BLOCKED_NAME_FRAGMENTS as $frag) {
            if (str_contains($name, $frag)) {
                return ['ext' => false, 'type' => false, 'proper_filename' => false];
            }
        }
        return is_array($data) ? $data : ['ext' => false, 'type' => false, 'proper_filename' => false];
    }

    /** Drop .htaccess + index.php into uploads (idempotent, non-destructive). */
    public static function ensure_uploads_hardened(): void
    {
        $upload = wp_upload_dir();
        if (!empty($upload['error']) || empty($upload['basedir'])) {
            return;
        }
        $basedir = (string) $upload['basedir'];
        if (!is_dir($basedir)) {
            wp_mkdir_p($basedir);
        }

        $htaccess = $basedir . DIRECTORY_SEPARATOR . '.htaccess';
        $marker = '# BEGIN MCW Forum Upload Hardening';
        $rules = $marker . "\n"
            . "# Deny script execution in uploads\n"
            . "<IfModule mod_authz_core.c>\n"
            . "  <FilesMatch \"(?i)\\.(php|phtml|php3|php4|php5|php7|phar|pl|py|jsp|asp|aspx|sh|cgi|exe|htaccess)$\">\n"
            . "    Require all denied\n"
            . "  </FilesMatch>\n"
            . "</IfModule>\n"
            . "<IfModule !mod_authz_core.c>\n"
            . "  <FilesMatch \"(?i)\\.(php|phtml|php3|php4|php5|php7|phar|pl|py|jsp|asp|aspx|sh|cgi|exe|htaccess)$\">\n"
            . "    Order Allow,Deny\n"
            . "    Deny from all\n"
            . "  </FilesMatch>\n"
            . "</IfModule>\n"
            . "<IfModule mod_php.c>\n"
            . "  php_flag engine off\n"
            . "</IfModule>\n"
            . "Options -Indexes -ExecCGI\n"
            . "# END MCW Forum Upload Hardening\n";

        $write = true;
        if (is_file($htaccess)) {
            $existing = (string) file_get_contents($htaccess);
            if (str_contains($existing, $marker)) {
                $write = false;
            }
        }
        if ($write && is_writable($basedir)) {
            // Append if file exists without our marker; otherwise create.
            if (is_file($htaccess) && !str_contains((string) file_get_contents($htaccess), $marker)) {
                file_put_contents($htaccess, "\n" . $rules, FILE_APPEND | LOCK_EX);
            } else {
                file_put_contents($htaccess, $rules, LOCK_EX);
            }
        }

        // Prefer non-executable directory stub (index.html). Avoid leaving runnable PHP in uploads.
        $index_html = $basedir . DIRECTORY_SEPARATOR . 'index.html';
        if (!is_file($index_html) && is_writable($basedir)) {
            file_put_contents($index_html, "<!-- -->\n", LOCK_EX);
        }
        $index_php = $basedir . DIRECTORY_SEPARATOR . 'index.php';
        if (is_file($index_php) && is_writable($index_php)) {
            // Neutralize prior stub without deleting other media.
            file_put_contents($index_php, "<?php\nhttp_response_code(403);\nexit;\n", LOCK_EX);
        }
    }

    /**
     * Validate an uploaded file array from $_FILES / REST file params.
     *
     * @param array<string,mixed> $file
     * @return array{ext:string,mime:string,safe_name:string}|WP_Error
     */
    public static function validate_image_upload(array $file)
    {
        $tmp = (string) ($file['tmp_name'] ?? '');
        $name = (string) ($file['name'] ?? '');
        $size = (int) ($file['size'] ?? 0);
        $err = (int) ($file['error'] ?? UPLOAD_ERR_NO_FILE);

        if ($err !== UPLOAD_ERR_OK) {
            return new WP_Error('mcw_upload', 'Upload failed.', ['status' => 400]);
        }
        if ($tmp === '' || !is_uploaded_file($tmp)) {
            return new WP_Error('mcw_upload', 'Invalid upload.', ['status' => 400]);
        }
        if ($size <= 0 || $size > self::MAX_BYTES) {
            return new WP_Error('mcw_upload', 'File too large (max 5MB).', ['status' => 400]);
        }

        // Path traversal / null-byte / absolute paths in client filename.
        $base = self::sanitize_client_filename($name);
        if ($base === '') {
            return new WP_Error('mcw_upload', 'Invalid filename.', ['status' => 400]);
        }
        $lower = strtolower($base);
        foreach (self::BLOCKED_NAME_FRAGMENTS as $frag) {
            if (str_contains($lower, $frag)) {
                if (class_exists('MCW_Forum_Security_Log')) {
                    MCW_Forum_Security_Log::event('upload_rejected', ['reason' => 'blocked_name', 'ext' => pathinfo($lower, PATHINFO_EXTENSION)]);
                }
                return new WP_Error('mcw_upload', 'File type not allowed.', ['status' => 400]);
            }
        }

        $check = wp_check_filetype_and_ext($tmp, $base);
        $ext = strtolower((string) ($check['ext'] ?? ''));
        $type = strtolower((string) ($check['type'] ?? ''));
        if ($ext === 'jpeg') {
            $ext = 'jpg';
        }
        if ($ext === '' || !in_array($ext, self::ALLOWED_EXT, true) || !in_array($type, self::ALLOWED_MIME, true)) {
            if (class_exists('MCW_Forum_Security_Log')) {
                MCW_Forum_Security_Log::event('upload_rejected', ['reason' => 'type', 'ext' => $ext !== '' ? $ext : 'none']);
            }
            return new WP_Error('mcw_upload', 'Only JPG, PNG, WEBP, or GIF images are allowed.', ['status' => 400]);
        }

        // Magic-byte verification (MIME spoofing defense).
        $magic = self::detect_image_magic($tmp);
        if ($magic === null) {
            return new WP_Error('mcw_upload', 'Invalid image file.', ['status' => 400]);
        }
        // Ext must match magic family (jpeg≈jpg).
        $magic_ext = $magic['ext'];
        if ($magic_ext === 'jpeg') {
            $magic_ext = 'jpg';
        }
        if ($magic_ext !== $ext && !($ext === 'jpg' && $magic_ext === 'jpg')) {
            // Allow jpeg/jpg alias only.
            if (!($ext === 'jpg' && in_array($magic['ext'], ['jpg', 'jpeg'], true))) {
                return new WP_Error('mcw_upload', 'File extension does not match image contents.', ['status' => 400]);
            }
        }

        $info = @getimagesize($tmp);
        if ($info === false || empty($info[0]) || empty($info[1])) {
            return new WP_Error('mcw_upload', 'Invalid image file.', ['status' => 400]);
        }

        if (function_exists('finfo_open')) {
            $f = finfo_open(FILEINFO_MIME_TYPE);
            if ($f) {
                $detected = strtolower((string) finfo_file($f, $tmp));
                finfo_close($f);
                if ($detected && !in_array($detected, self::ALLOWED_MIME, true)) {
                    return new WP_Error('mcw_upload', 'MIME type not allowed.', ['status' => 400]);
                }
            }
        }

        // Randomize stored name to prevent overwrite / predictable paths.
        $safe_name = 'mcw_' . bin2hex(random_bytes(12)) . '.' . $ext;

        return [
            'ext' => $ext,
            'mime' => $magic['mime'],
            'safe_name' => $safe_name,
        ];
    }

    public static function sanitize_client_filename(string $name): string
    {
        $name = str_replace("\0", '', $name);
        // Normalize Windows/Unix separators before basename().
        $name = str_replace(['\\', '/'], DIRECTORY_SEPARATOR, $name);
        $name = basename($name);
        $name = str_replace(['../', '..\\'], '', $name);
        $name = preg_replace('/[^\w.\-]+/u', '_', $name) ?? '';
        return trim($name, '._');
    }

    /**
     * @return array{ext:string,mime:string}|null
     */
    public static function detect_image_magic(string $path): ?array
    {
        $fh = fopen($path, 'rb');
        if (!$fh) {
            return null;
        }
        $buf = fread($fh, 16);
        fclose($fh);
        if (!is_string($buf) || strlen($buf) < 12) {
            return null;
        }
        $b = array_values(unpack('C*', $buf) ?: []);
        if (count($b) > 2 && $b[0] === 0xff && $b[1] === 0xd8 && $b[2] === 0xff) {
            return ['ext' => 'jpg', 'mime' => 'image/jpeg'];
        }
        if (count($b) > 3 && $b[0] === 0x89 && $b[1] === 0x50 && $b[2] === 0x4e && $b[3] === 0x47) {
            return ['ext' => 'png', 'mime' => 'image/png'];
        }
        $ascii = substr($buf, 0, 6);
        if (str_starts_with($ascii, 'GIF8')) {
            return ['ext' => 'gif', 'mime' => 'image/gif'];
        }
        if (substr($buf, 0, 4) === 'RIFF' && substr($buf, 8, 4) === 'WEBP') {
            return ['ext' => 'webp', 'mime' => 'image/webp'];
        }
        return null;
    }

    /** Ensure a filesystem path stays inside the uploads basedir. */
    public static function path_is_in_uploads(string $path): bool
    {
        $upload = wp_upload_dir();
        if (!empty($upload['error']) || empty($upload['basedir'])) {
            return false;
        }
        $base = realpath((string) $upload['basedir']);
        $real = realpath($path);
        if ($base === false || $real === false) {
            return false;
        }
        $base = strtolower(str_replace('\\', '/', $base));
        $real = strtolower(str_replace('\\', '/', $real));
        return str_starts_with($real, rtrim($base, '/') . '/') || $real === $base;
    }

    /**
     * Attachment may be deleted only by uploader or forum mod/admin.
     */
    public static function can_manage_attachment(WP_User $user, int $attachment_id): bool
    {
        $post = get_post($attachment_id);
        if (!$post || $post->post_type !== 'attachment') {
            return false;
        }
        if (MCW_Forum_Auth::is_mod_user($user)) {
            return true;
        }
        $uploader = (int) get_post_meta($attachment_id, 'mcw_uploader_id', true);
        if ($uploader > 0) {
            return $uploader === (int) $user->ID;
        }
        return (int) $post->post_author === (int) $user->ID;
    }
}

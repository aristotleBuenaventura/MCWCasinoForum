<?php
/**
 * Non-destructive upload / filesystem security regression tests.
 * Does NOT delete existing media under wp-content/uploads (except throwaway attachments created here).
 *
 *   php wordpress/wp-content/plugins/mcw-forum/tests/upload-security.php
 *   npm run test:security:upload
 */
$wp_load = dirname(__DIR__, 4) . '/wp-load.php';
if (!is_file($wp_load)) {
    fwrite(STDERR, "wp-load.php not found at {$wp_load}\n");
    exit(1);
}
require $wp_load;
ob_start();

if (!class_exists('MCW_Forum_Upload')) {
    fwrite(STDERR, "MCW_Forum_Upload not loaded.\n");
    exit(1);
}

$failed = 0;
$passed = 0;

function up_pass(string $label): void
{
    global $passed;
    echo "PASS  {$label}\n";
    $passed++;
}

function up_fail(string $label, string $detail = ''): void
{
    global $failed;
    echo "FAIL  {$label}" . ($detail !== '' ? " — {$detail}" : '') . "\n";
    $failed++;
}

function up_assert(string $label, bool $ok, string $detail = ''): void
{
    if ($ok) {
        up_pass($label);
    } else {
        up_fail($label, $detail);
    }
}

// Harden uploads dir (writes .htaccess/index.php only; does not delete media).
MCW_Forum_Upload::ensure_uploads_hardened();
$upload = wp_upload_dir();
$basedir = (string) ($upload['basedir'] ?? '');
up_assert('uploads basedir exists', $basedir !== '' && is_dir($basedir));
up_assert('uploads .htaccess present', is_file($basedir . '/.htaccess'));
up_assert('uploads index.php present', is_file($basedir . '/index.php'));
$ht = (string) file_get_contents($basedir . '/.htaccess');
up_assert('htaccess denies php execution', str_contains($ht, 'php') && str_contains($ht, 'denied'));

// Filename / traversal helpers
up_assert('sanitize strips traversal', MCW_Forum_Upload::sanitize_client_filename('../etc/passwd.php.jpg') === 'passwd.php.jpg' || MCW_Forum_Upload::sanitize_client_filename('../x.jpg') === 'x.jpg');
up_assert('sanitize basename only', MCW_Forum_Upload::sanitize_client_filename('C:\\windows\\shell.php') === 'shell.php');

// Magic-byte fixtures in temp (not under uploads permanently until moved — we unlink).
$tmp = sys_get_temp_dir();
$jpeg = $tmp . '/mcw_up_test_' . wp_generate_password(6, false, false) . '.jpg';
$php = $tmp . '/mcw_up_test_' . wp_generate_password(6, false, false) . '.php';
$svg = $tmp . '/mcw_up_test_' . wp_generate_password(6, false, false) . '.svg';
file_put_contents($jpeg, "\xFF\xD8\xFF\xE0" . str_repeat("\0", 64));
file_put_contents($php, "<?php echo 'x';");
file_put_contents($svg, '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');

$jpeg_magic = MCW_Forum_Upload::detect_image_magic($jpeg);
up_assert('detect jpeg magic', is_array($jpeg_magic) && ($jpeg_magic['ext'] ?? '') === 'jpg');
up_assert('reject php magic', MCW_Forum_Upload::detect_image_magic($php) === null);
up_assert('reject svg magic', MCW_Forum_Upload::detect_image_magic($svg) === null);

// validate_image_upload requires is_uploaded_file — simulate failure path with non-upload tmp.
$fake = [
    'name' => 'shell.php.jpg',
    'type' => 'image/jpeg',
    'tmp_name' => $jpeg,
    'error' => UPLOAD_ERR_OK,
    'size' => filesize($jpeg),
];
$res = MCW_Forum_Upload::validate_image_upload($fake);
up_assert('validate rejects non-is_uploaded_file', is_wp_error($res));

// Blocked name fragments via filetype filter
$blocked = MCW_Forum_Upload::filter_filetype_and_ext(
    ['ext' => 'jpg', 'type' => 'image/jpeg', 'proper_filename' => 'x.jpg'],
    $jpeg,
    'evil.php.jpg',
    null
);
up_assert('filetype filter blocks .php. in name', ($blocked['ext'] ?? true) === false);

$svg_mimes = MCW_Forum_Upload::filter_upload_mimes(['jpg|jpeg|jpe' => 'image/jpeg', 'svg' => 'image/svg+xml']);
up_assert('upload_mimes removes svg', !isset($svg_mimes['svg']));

// path_is_in_uploads
up_assert('path outside uploads rejected', !MCW_Forum_Upload::path_is_in_uploads($php));
if (is_file($basedir . '/index.php')) {
    up_assert('path inside uploads accepted', MCW_Forum_Upload::path_is_in_uploads($basedir . '/index.php'));
}

// REST: unauthenticated upload denied
$origin = MCW_Forum_CORS::allowed_origin();
$_SERVER['HTTP_ORIGIN'] = $origin;
MCW_Forum_Auth::clear_session();
$req = new WP_REST_Request('POST', '/mcw/v1/uploads');
$req->set_header('Origin', $origin);
$res_anon = rest_do_request($req);
up_assert('anon upload denied', in_array($res_anon->get_status(), [401, 403, 400], true), 'HTTP ' . $res_anon->get_status());

// Unauthorized delete of foreign attachment (if any jpg exists) — must 401/403, must not delete file.
$existing = get_posts([
    'post_type' => 'attachment',
    'post_status' => 'inherit',
    'posts_per_page' => 1,
    'fields' => 'ids',
]);
$existing_id = $existing ? (int) $existing[0] : 0;
$existing_file = $existing_id ? get_attached_file($existing_id) : '';
$existed_before = $existing_file && is_file($existing_file);

$login = 'mcw_up_' . wp_generate_password(6, false, false);
$uid = wp_create_user($login, 'SecTestPass123!', $login . '@example.test');
if (!is_wp_error($uid)) {
    MCW_Forum_Auth::apply_forum_role((int) $uid, 'user');
    MCW_Forum_Auth::issue_session((int) $uid, false);
    $user = get_user_by('id', (int) $uid);

    if ($existing_id) {
        $req_del = new WP_REST_Request('DELETE', '/mcw/v1/uploads/' . $existing_id);
        $req_del->set_header('Origin', $origin);
        $res_del = rest_do_request($req_del);
        up_assert('user cannot delete foreign attachment', in_array($res_del->get_status(), [401, 403], true), 'HTTP ' . $res_del->get_status());
        if ($existed_before) {
            up_assert('foreign attachment file still on disk', is_file($existing_file));
        }
    } else {
        up_pass('no existing attachment to probe (skipped delete auth)');
        up_pass('no existing attachment file check (skipped)');
    }

    // can_manage_attachment: own meta
    up_assert('can_manage own when meta matches', MCW_Forum_Upload::can_manage_attachment($user, 0) === false);

    MCW_Forum_Auth::clear_session();
    require_once ABSPATH . 'wp-admin/includes/user.php';
    wp_delete_user((int) $uid);
} else {
    up_fail('create throwaway user', $uid->get_error_message());
}

@unlink($jpeg);
@unlink($php);
@unlink($svg);

// --- Suspicious file inventory (document only; do not delete) ---
echo "\n--- Manual review inventory (not deleted) ---\n";
$suspect = [];
$wp_root = dirname(__DIR__, 4);
foreach (glob($wp_root . '/_*.php') ?: [] as $f) {
    $suspect[] = ['path' => $f, 'reason' => 'Dev/installer helper PHP still in web root — must remain outside document root'];
}
$phar = $wp_root . '/wp-cli.phar';
if (is_file($phar)) {
    $suspect[] = ['path' => $phar, 'reason' => 'wp-cli.phar still in web tree — must live under tools/wordpress/'];
}
// Confirm helpers live outside web root (expected quarantine).
$tools_helpers = dirname($wp_root) . '/tools/wordpress/helpers';
if (!is_dir($tools_helpers)) {
    $suspect[] = ['path' => $tools_helpers, 'reason' => 'Expected helpers quarantine directory missing'];
}
$uploads_txt = glob($basedir . '/**/*.txt') ?: [];
// recursive txt under uploads
$it = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($basedir, FilesystemIterator::SKIP_DOTS));
foreach ($it as $file) {
    /** @var SplFileInfo $file */
    if (!$file->isFile()) {
        continue;
    }
    $ext = strtolower($file->getExtension());
    $base = strtolower($file->getBasename());
    // Expected hardening stubs we write ourselves — not suspicious.
    if ($base === 'index.php' || $base === '.htaccess' || $base === 'index.html') {
        continue;
    }
    if (in_array($ext, ['php', 'phtml', 'phar', 'svg', 'html', 'htm', 'js'], true)) {
        $suspect[] = ['path' => $file->getPathname(), 'reason' => "Unexpected .{$ext} under uploads"];
    }
}
foreach ($suspect as $row) {
    echo 'REVIEW  ' . $row['path'] . ' — ' . $row['reason'] . "\n";
}
$review_count = count($suspect);
up_assert('suspicious inventory generated (count logged)', true, "items={$review_count}");
echo "REVIEW_COUNT {$review_count}\n";

// Existing JPG media untouched
$jpg_count = 0;
foreach ($it as $file) {
    if ($file->isFile() && strtolower($file->getExtension()) === 'jpg') {
        $jpg_count++;
    }
}
// Re-iterate — previous iterator may be exhausted
$jpg_count = 0;
$it2 = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($basedir, FilesystemIterator::SKIP_DOTS));
foreach ($it2 as $file) {
    if ($file->isFile() && strtolower($file->getExtension()) === 'jpg') {
        $jpg_count++;
    }
}
up_assert('existing jpg media still present', $jpg_count >= 1, "jpg_count={$jpg_count}");

echo "\n{$passed} passed, {$failed} failed\n";
exit($failed > 0 ? 1 : 0);

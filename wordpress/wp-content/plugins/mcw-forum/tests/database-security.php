<?php
/**
 * Non-destructive WordPress database security regression tests.
 * Never DROP/TRUNCATE tables or modify production content; throwaways only.
 *
 *   php wordpress/wp-content/plugins/mcw-forum/tests/database-security.php
 *   npm run test:security:db
 */
$wp_load = dirname(__DIR__, 4) . '/wp-load.php';
if (!is_file($wp_load)) {
    fwrite(STDERR, "wp-load.php not found at {$wp_load}\n");
    exit(1);
}
require $wp_load;
ob_start();

if (!class_exists('MCW_Forum_DB') || !class_exists('MCW_Forum_REST')) {
    fwrite(STDERR, "mcw-forum DB helpers not loaded.\n");
    exit(1);
}

$failed = 0;
$passed = 0;

function db_pass(string $label): void
{
    global $passed;
    echo "PASS  {$label}\n";
    $passed++;
}

function db_fail(string $label, string $detail = ''): void
{
    global $failed;
    echo "FAIL  {$label}" . ($detail !== '' ? " — {$detail}" : '') . "\n";
    $failed++;
}

function db_assert(string $label, bool $ok, string $detail = ''): void
{
    if ($ok) {
        db_pass($label);
    } else {
        db_fail($label, $detail);
    }
}

global $wpdb;

// Snapshot published thread count — must not drop during tests.
$published_before = (int) wp_count_posts('mcw_thread')->publish;

// --- Helper unit checks ---
$in = MCW_Forum_DB::prepare_in([1, 2, 3], '%d');
db_assert('prepare_in builds placeholders', $in !== null && $in[0] === '%d,%d,%d');

$empty = MCW_Forum_DB::prepare_in([], '%d');
db_assert('prepare_in empty returns null', $empty === null);

$filtered = MCW_Forum_DB::filter_user_update_fields([
    'ID' => 9,
    'display_name' => 'Safe',
    'role' => 'administrator',
    'user_pass' => 'hacked',
    'user_email' => 'evil@example.com',
    'capabilities' => ['manage_options' => true],
]);
db_assert('filter_user_update_fields strips privileged keys', !isset($filtered['role'], $filtered['user_pass'], $filtered['user_email'], $filtered['capabilities']));
db_assert('filter_user_update_fields keeps display_name', ($filtered['display_name'] ?? '') === 'Safe');

db_assert(
    'deny arbitrary user meta key',
    MCW_Forum_DB::update_user_meta_allowed(1, 'wp_capabilities', ['administrator' => true]) === false
);
db_assert(
    'deny arbitrary post meta key',
    MCW_Forum_DB::update_post_meta_allowed(1, '_edit_lock', 'injected') === false
);

// Prepared SELECT with injection payload as value must not expand SQL.
$probe = "1' OR '1'='1";
$safe = $wpdb->get_var($wpdb->prepare(
    "SELECT COUNT(*) FROM {$wpdb->prefix}mcw_likes WHERE target_id = %s",
    $probe
));
db_assert('prepared like lookup with SQLi string returns numeric', is_numeric($safe));

// --- REST injection / unauthorized write probes (throwaway user) ---
$login = 'mcw_db_' . wp_generate_password(8, false, false);
$uid = wp_create_user($login, 'SecTestPass123!', $login . '@example.test');
if (is_wp_error($uid)) {
    db_fail('create throwaway', $uid->get_error_message());
} else {
    MCW_Forum_Auth::apply_forum_role((int) $uid, 'user');
    wp_update_user(['ID' => (int) $uid, 'user_registered' => gmdate('Y-m-d H:i:s', time() - 3600)]);
    $user = get_user_by('id', (int) $uid);
    $origin = MCW_Forum_CORS::allowed_origin();
    $_SERVER['HTTP_ORIGIN'] = $origin;
    MCW_Forum_Auth::clear_session();
    MCW_Forum_Auth::issue_session((int) $uid, false);

    $likes_before = (int) $wpdb->get_var("SELECT COUNT(*) FROM {$wpdb->prefix}mcw_likes");
    $reports_before = (int) $wpdb->get_var("SELECT COUNT(*) FROM {$wpdb->prefix}mcw_reports");
    $sessions_before = (int) $wpdb->get_var($wpdb->prepare(
        "SELECT COUNT(*) FROM {$wpdb->prefix}mcw_sessions WHERE user_id = %d",
        (int) $uid
    ));

    // Like with SQLi / invalid type — must reject, not insert.
    $req = new WP_REST_Request('POST', '/mcw/v1/likes');
    $req->set_header('Origin', $origin);
    $req->set_header('Content-Type', 'application/json');
    $req->set_body(wp_json_encode([
        'targetType' => "thread'; DROP TABLE {$wpdb->prefix}mcw_likes;--",
        'targetId' => "1 OR 1=1",
    ]));
    $res = rest_do_request($req);
    db_assert('like rejects malicious targetType', in_array($res->get_status(), [400, 403, 404], true), 'HTTP ' . $res->get_status());

    $likes_after = (int) $wpdb->get_var("SELECT COUNT(*) FROM {$wpdb->prefix}mcw_likes");
    db_assert('like table row count unchanged after SQLi attempt', $likes_after === $likes_before);

    // Confirm likes table still exists (no DROP succeeded).
    $likes_table = $wpdb->prefix . 'mcw_likes';
    $exists = $wpdb->get_var($wpdb->prepare('SHOW TABLES LIKE %s', $likes_table));
    db_assert('mcw_likes table still exists', $exists === $likes_table);

    // Mass-assignment via PATCH /me — role must not stick; capabilities meta denied.
    $req2 = new WP_REST_Request('PATCH', '/mcw/v1/me');
    $req2->set_header('Origin', $origin);
    $req2->set_header('Content-Type', 'application/json');
    $req2->set_body(wp_json_encode([
        'displayName' => 'DB Tester',
        'role' => 'administrator',
        'mcw_role' => 'admin',
        'capabilities' => ['manage_options' => true],
        'user_pass' => 'HackedPass999!',
    ]));
    $res2 = rest_do_request($req2);
    db_assert('patch_me accepts sanitized profile fields', in_array($res2->get_status(), [200, 403], true), 'HTTP ' . $res2->get_status());
    $reload = get_user_by('id', (int) $uid);
    db_assert('mass-assignment did not grant manage_options', !user_can($reload, 'manage_options'));
    db_assert('mass-assignment did not set mcw_role admin', MCW_Forum_Auth::role_of($reload) === 'user');

    // Follow self / nonexistent — no insert.
    $follows_before = (int) $wpdb->get_var("SELECT COUNT(*) FROM {$wpdb->prefix}mcw_follows");
    $req3 = new WP_REST_Request('POST', '/mcw/v1/follows');
    $req3->set_header('Origin', $origin);
    $req3->set_header('Content-Type', 'application/json');
    $req3->set_body(wp_json_encode(['userId' => (int) $uid]));
    $res3 = rest_do_request($req3);
    db_assert('follow self rejected', in_array($res3->get_status(), [400, 403], true), 'HTTP ' . $res3->get_status());
    $follows_after = (int) $wpdb->get_var("SELECT COUNT(*) FROM {$wpdb->prefix}mcw_follows");
    db_assert('follows table unchanged after self-follow', $follows_after === $follows_before);

    // Report with SQLi in target id — prepared insert, no schema change.
    $req4 = new WP_REST_Request('POST', '/mcw/v1/reports');
    $req4->set_header('Origin', $origin);
    $req4->set_header('Content-Type', 'application/json');
    $req4->set_body(wp_json_encode([
        'targetType' => 'thread',
        'targetId' => "1'; DELETE FROM {$wpdb->prefix}mcw_reports;--",
        'reason' => 'db-security-probe',
    ]));
    $res4 = rest_do_request($req4);
    // May 200 (stored as sanitized string) or 400 — either way table must remain.
    db_assert('report endpoint responds', $res4->get_status() < 500, 'HTTP ' . $res4->get_status());
    $reports_table = $wpdb->prefix . 'mcw_reports';
    db_assert(
        'mcw_reports table still exists after report SQLi payload',
        $wpdb->get_var($wpdb->prepare('SHOW TABLES LIKE %s', $reports_table)) === $reports_table
    );

    // Unauthorized admin DB read
    $req5 = new WP_REST_Request('GET', '/mcw/v1/admin/users');
    $req5->set_header('Origin', $origin);
    $res5 = rest_do_request($req5);
    db_assert('regular user cannot read admin users', in_array($res5->get_status(), [401, 403], true), 'HTTP ' . $res5->get_status());

    $req6 = new WP_REST_Request('GET', '/mcw/v1/admin/reports');
    $req6->set_header('Origin', $origin);
    $res6 = rest_do_request($req6);
    db_assert('regular user cannot read admin reports', in_array($res6->get_status(), [401, 403], true), 'HTTP ' . $res6->get_status());

    // Notifications scoped — mark-read only own rows (no cross-user update vector via body).
    $req7 = new WP_REST_Request('POST', '/mcw/v1/notifications/read');
    $req7->set_header('Origin', $origin);
    $req7->set_header('Content-Type', 'application/json');
    $req7->set_body(wp_json_encode(['userId' => 1]));
    $res7 = rest_do_request($req7);
    db_assert('notifications/read does not 500 with foreign userId body', $res7->get_status() < 500);

    // Cleanup throwaway report rows only (reason marker), then user.
    $wpdb->query($wpdb->prepare(
        "DELETE FROM {$wpdb->prefix}mcw_reports WHERE reporter_id = %d AND reason = %s",
        (int) $uid,
        'db-security-probe'
    ));

    MCW_Forum_Auth::clear_session();
    require_once ABSPATH . 'wp-admin/includes/user.php';
    wp_delete_user((int) $uid);

    $sessions_after = (int) $wpdb->get_var($wpdb->prepare(
        "SELECT COUNT(*) FROM {$wpdb->prefix}mcw_sessions WHERE user_id = %d",
        (int) $uid
    ));
    db_assert('throwaway sessions removed', $sessions_after === 0);
}

$published_after = (int) wp_count_posts('mcw_thread')->publish;
db_assert('published thread count unchanged', $published_after === $published_before, "before={$published_before} after={$published_after}");

// Credentials hygiene: wp-config should not live in the tracked plugin tree.
$config_in_plugin = is_file(dirname(__DIR__) . '/wp-config.php');
db_assert('no wp-config.php inside mcw-forum plugin', !$config_in_plugin);

$tables = MCW_Forum_DB::plugin_tables();
db_assert('plugin table list non-empty', count($tables) === 6);

echo "\n{$passed} passed, {$failed} failed\n";
exit($failed > 0 ? 1 : 0);

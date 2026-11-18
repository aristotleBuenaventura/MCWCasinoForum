<?php
/**
 * Non-destructive admin account authorization regression tests.
 *
 * Usage (from repo root):
 *   php wordpress/wp-content/plugins/mcw-forum/tests/admin-account-security.php
 *
 * Does NOT demote/delete/modify existing administrator accounts.
 */

// tests → mcw-forum → plugins → wp-content → wordpress/wp-load.php
$wp_load = dirname(__DIR__, 4) . '/wp-load.php';
if (!is_file($wp_load)) {
    fwrite(STDERR, "wp-load.php not found at {$wp_load}\n");
    exit(1);
}
require $wp_load;

if (!class_exists('MCW_Forum_Auth') || !class_exists('MCW_Forum_REST')) {
    fwrite(STDERR, "mcw-forum plugin not loaded.\n");
    exit(1);
}

// Avoid setcookie() warnings when CLI has already written output.
ob_start();

$failed = 0;
$passed = 0;

function assert_status(string $label, WP_REST_Response $res, array $ok_codes): void
{
    global $failed, $passed;
    $code = $res->get_status();
    if (in_array($code, $ok_codes, true)) {
        echo "PASS  {$label} (HTTP {$code})\n";
        $passed++;
        return;
    }
    $data = $res->get_data();
    $err = is_array($data) ? ($data['error'] ?? json_encode($data)) : (string) $data;
    echo "FAIL  {$label} (HTTP {$code}) {$err}\n";
    $failed++;
}

function as_user_request(string $method, string $route, ?WP_User $user, array $body = []): WP_REST_Response
{
    // Isolate cookie session (cookie jar only — CLI cannot emit Set-Cookie).
    MCW_Forum_Auth::clear_session();
    if ($user) {
        MCW_Forum_Auth::issue_session((int) $user->ID, false);
    }

    $origin = MCW_Forum_CORS::allowed_origin();
    $_SERVER['HTTP_ORIGIN'] = $origin;

    $req = new WP_REST_Request($method, '/mcw/v1' . $route);
    $req->set_header('Origin', $origin);
    if ($body) {
        $req->set_header('Content-Type', 'application/json');
        $req->set_body(wp_json_encode($body));
    }

    $res = rest_do_request($req);
    if (!($res instanceof WP_REST_Response)) {
        return new WP_REST_Response(['ok' => false, 'error' => 'bad response'], 500);
    }
    return $res;
}

$login = 'mcw_sec_' . wp_generate_password(8, false, false);
$email = $login . '@example.test';
$pass = 'SecTestPass123!';
$user_id = wp_create_user($login, $pass, $email);
if (is_wp_error($user_id)) {
    fwrite(STDERR, 'Could not create throwaway user: ' . $user_id->get_error_message() . "\n");
    exit(1);
}
MCW_Forum_Auth::apply_forum_role((int) $user_id, 'user');
$regular = get_user_by('id', (int) $user_id);

// Find an existing admin id for "target" attempts — never modify them.
$admin = null;
foreach (get_users(['number' => 50]) as $u) {
    if (MCW_Forum_Auth::is_admin_user($u)) {
        $admin = $u;
        break;
    }
}
$admin_id = $admin ? (int) $admin->ID : 1;

echo "Throwaway user #{$user_id} ({$login}); admin target #{$admin_id} (read-only attempts)\n";

// --- Unauthenticated ---
MCW_Forum_Auth::clear_session();
assert_status('anon GET /admin/users', as_user_request('GET', '/admin/users', null), [401, 403]);
assert_status('anon POST /admin/users/{admin}/role', as_user_request('POST', "/admin/users/{$admin_id}/role", null, ['role' => 'user']), [401, 403]);
assert_status('anon POST /mod/users/{admin}/ban', as_user_request('POST', "/mod/users/{$admin_id}/ban", null, ['banned' => true]), [401, 403]);

// --- Regular user escalation attempts (must fail; admin unchanged) ---
assert_status('user GET /admin/users', as_user_request('GET', '/admin/users', $regular), [401, 403]);
assert_status('user GET /admin/stats', as_user_request('GET', '/admin/stats', $regular), [401, 403]);
assert_status(
    'user self-promote to admin',
    as_user_request('POST', '/admin/users/' . $user_id . '/role', $regular, ['role' => 'admin']),
    [401, 403]
);
assert_status(
    'user demote administrator',
    as_user_request('POST', "/admin/users/{$admin_id}/role", $regular, ['role' => 'user']),
    [401, 403]
);
assert_status(
    'user ban administrator',
    as_user_request('POST', "/mod/users/{$admin_id}/ban", $regular, ['banned' => true]),
    [401, 403]
);
assert_status(
    'user nameplate on administrator',
    as_user_request('POST', "/admin/users/{$admin_id}/nameplate", $regular, ['membership' => 'elite']),
    [401, 403]
);
assert_status(
    'user PATCH /me with role mass-assignment',
    as_user_request('PATCH', '/me', $regular, ['role' => 'admin', 'displayName' => $regular->display_name]),
    [200]
);

// Confirm mass-assignment did not stick
$reload = get_user_by('id', (int) $user_id);
if (MCW_Forum_Auth::role_of($reload) === 'user' && !MCW_Forum_Auth::is_admin_user($reload)) {
    echo "PASS  user role unchanged after /me role attempt\n";
    $passed++;
} else {
    echo "FAIL  user became admin via /me\n";
    $failed++;
}

// Password change accepts only the session user (no targetUserId); admin passhash must stay intact.
$admin_hash_before = $admin ? (string) $admin->user_pass : '';
assert_status(
    'user password change rejects foreign target id',
    as_user_request('POST', '/auth/password', $regular, [
        'currentPassword' => $pass,
        'newPassword' => 'SecTestPass123!',
        'userId' => $admin_id,
        'targetUserId' => $admin_id,
    ]),
    [200]
);
if ($admin && $admin_hash_before !== '') {
    $admin_pw = get_user_by('id', $admin_id);
    if ($admin_pw && (string) $admin_pw->user_pass === $admin_hash_before) {
        echo "PASS  administrator password hash unchanged\n";
        $passed++;
    } else {
        echo "FAIL  administrator password was modified\n";
        $failed++;
    }
}

// DELETE /auth/account always targets the session user; injected admin ids must be ignored.
$del_login = 'mcw_del_' . wp_generate_password(6, false, false);
$del_pass = 'SecTestPass123!';
$del_id = wp_create_user($del_login, $del_pass, $del_login . '@example.test');
if (!is_wp_error($del_id)) {
    MCW_Forum_Auth::apply_forum_role((int) $del_id, 'user');
    $del_user = get_user_by('id', (int) $del_id);
    assert_status(
        'DELETE /auth/account ignores injected admin userId (deletes self only)',
        as_user_request('DELETE', '/auth/account', $del_user, [
            'password' => $del_pass,
            'userId' => $admin_id,
            'id' => $admin_id,
        ]),
        [200]
    );
    if ($admin && get_user_by('id', $admin_id) && MCW_Forum_Auth::is_admin_user(get_user_by('id', $admin_id))) {
        echo "PASS  administrator account untouched by injected delete\n";
        $passed++;
    } else {
        echo "FAIL  administrator account missing after injected delete\n";
        $failed++;
    }
    if (!get_user_by('id', (int) $del_id)) {
        echo "PASS  throwaway self-delete succeeded (session user only)\n";
        $passed++;
    } else {
        echo "FAIL  throwaway user still present after self-delete\n";
        $failed++;
    }
} else {
    echo "FAIL  could not create delete-test throwaway\n";
    $failed++;
}

// Register must not honor role in body
$reg_login = 'mcw_reg_' . wp_generate_password(6, false, false);
$reg = as_user_request('POST', '/auth/register', null, [
    'username' => $reg_login,
    'email' => $reg_login . '@example.test',
    'password' => 'RegisterPass123!',
    'displayName' => 'Reg',
    'role' => 'admin',
    'mcw_role' => 'admin',
]);
assert_status('register ignores role=admin in body', $reg, [200]);
$reg_user = get_user_by('login', $reg_login);
if ($reg_user && MCW_Forum_Auth::role_of($reg_user) === 'user' && !user_can($reg_user, 'manage_options')) {
    echo "PASS  registered user is not administrator\n";
    $passed++;
} else {
    echo "FAIL  registered user has elevated privileges\n";
    $failed++;
}

// Verify admin target untouched
if ($admin) {
    $admin_after = get_user_by('id', $admin_id);
    if ($admin_after && MCW_Forum_Auth::is_admin_user($admin_after)) {
        echo "PASS  existing administrator #{$admin_id} unchanged\n";
        $passed++;
    } else {
        echo "FAIL  administrator #{$admin_id} was modified\n";
        $failed++;
    }
}

// Cleanup throwaway users only
MCW_Forum_Auth::clear_session();
require_once ABSPATH . 'wp-admin/includes/user.php';
wp_delete_user((int) $user_id);
if ($reg_user) {
    wp_delete_user((int) $reg_user->ID);
}

echo "\n{$passed} passed, {$failed} failed\n";
exit($failed > 0 ? 1 : 0);

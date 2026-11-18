<?php
/**
 * Non-destructive anti-spam / malicious-link regression tests.
 * Does NOT delete or alter existing legitimate forum threads/comments.
 *
 *   php wordpress/wp-content/plugins/mcw-forum/tests/anti-spam-content-guard.php
 *   npm run test:security:spam
 */
$wp_load = dirname(__DIR__, 4) . '/wp-load.php';
if (!is_file($wp_load)) {
    fwrite(STDERR, "wp-load.php not found at {$wp_load}\n");
    exit(1);
}
require $wp_load;
ob_start();

if (!class_exists('MCW_Forum_Content_Guard')) {
    fwrite(STDERR, "MCW_Forum_Content_Guard not loaded.\n");
    exit(1);
}

$failed = 0;
$passed = 0;

function t_pass(string $label): void
{
    global $passed;
    echo "PASS  {$label}\n";
    $passed++;
}

function t_fail(string $label, string $detail = ''): void
{
    global $failed;
    echo "FAIL  {$label}" . ($detail !== '' ? " — {$detail}" : '') . "\n";
    $failed++;
}

function t_assert(string $label, bool $ok, string $detail = ''): void
{
    if ($ok) {
        t_pass($label);
    } else {
        t_fail($label, $detail);
    }
}

// --- URL policy ---
$bad_schemes = ['javascript:alert(1)', 'data:text/html,x', '//evil.example/x.png', 'file:///etc/passwd'];
foreach ($bad_schemes as $u) {
    $r = MCW_Forum_Content_Guard::check_url($u, 'image');
    t_assert("reject scheme/url {$u}", is_wp_error($r), is_wp_error($r) ? '' : 'accepted');
}

$short = MCW_Forum_Content_Guard::check_url('https://bit.ly/abc', 'link');
t_assert('reject URL shortener bit.ly', is_wp_error($short));

$cred = MCW_Forum_Content_Guard::check_url('https://user:pass@evil.example/phish', 'link');
t_assert('reject credentialed URL', is_wp_error($cred));

$ok_https = MCW_Forum_Content_Guard::check_url('https://example.com/img.png', 'image');
t_assert('allow normal https image', !is_wp_error($ok_https) && is_string($ok_https));

$ok_rel = MCW_Forum_Content_Guard::check_url('/wp-content/uploads/2024/01/a.jpg', 'image');
t_assert('allow uploads relative path', !is_wp_error($ok_rel));

// --- Block sanitize / XSS ---
$xss = MCW_Forum_Content_Guard::sanitize_blocks([
    ['type' => 'text', 'text' => '<script>alert(1)</script>Hello বাংলা'],
    ['type' => 'image', 'url' => '//cdn.evil/x.png'],
    ['type' => 'raw_html', 'html' => '<img onerror=alert(1)>'],
]);
t_assert('sanitize_blocks returns error on protocol-relative image', is_wp_error($xss));

$bn = MCW_Forum_Content_Guard::sanitize_blocks([
    ['type' => 'text', 'text' => 'স্বাগতম এমসিডব্লিউ ফোরামে — tips for slots'],
]);
t_assert('Bengali+English text accepted', is_array($bn) && count($bn) === 1);
if (is_array($bn)) {
    t_assert('script tags stripped from text', strpos($bn[0]['text'], '<script>') === false);
    t_assert('Bengali preserved', str_contains($bn[0]['text'], 'স্বাগতম'));
}

$too_many = [];
for ($i = 0; $i < 6; $i++) {
    $too_many[] = ['type' => 'text', 'text' => "https://example{$i}.com/spam "];
}
$links = MCW_Forum_Content_Guard::sanitize_blocks($too_many);
t_assert('reject too many links in body', is_wp_error($links));

// --- Title / bio ---
$title = MCW_Forum_Content_Guard::sanitize_title('<b>Visit</b> https://bit.ly/x');
t_assert('title with blocked shortener rejected', is_wp_error($title));

$bio = MCW_Forum_Content_Guard::sanitize_bio("Player from ঢাকা\n" . str_repeat('a', 50));
t_assert('normal EN/BN bio accepted', is_array($bio) === false && is_string($bio));

// --- Spam score / duplicate helpers ---
$score_clean = MCW_Forum_Content_Guard::spam_score('Hello', 'স্বাগতম — sharing my experience');
t_assert('clean EN/BN score low', $score_clean < 50, "score={$score_clean}");

$score_zw = MCW_Forum_Content_Guard::spam_score('Ad', "Buy now\xE2\x80\x8Bhttps://example.com");
t_assert('zero-width stuffing raises score', $score_zw >= 30, "score={$score_zw}");

$hash1 = MCW_Forum_Content_Guard::content_hash('Same', 'Body');
$hash2 = MCW_Forum_Content_Guard::content_hash('same', 'body');
t_assert('content hash case-insensitive', $hash1 === $hash2);

// --- REST path smoke (throwaway user only; no edits to existing threads) ---
$login = 'mcw_spam_' . wp_generate_password(8, false, false);
$uid = wp_create_user($login, 'SecTestPass123!', $login . '@example.test');
if (is_wp_error($uid)) {
    t_fail('create throwaway user', $uid->get_error_message());
} else {
    MCW_Forum_Auth::apply_forum_role((int) $uid, 'user');
    // Backdate account so new-account delay does not interfere with URL tests.
    wp_update_user(['ID' => (int) $uid, 'user_registered' => gmdate('Y-m-d H:i:s', time() - 3600)]);
    $user = get_user_by('id', (int) $uid);

    $origin = MCW_Forum_CORS::allowed_origin();
    $_SERVER['HTTP_ORIGIN'] = $origin;
    MCW_Forum_Auth::clear_session();
    MCW_Forum_Auth::issue_session((int) $uid, false);

    $req = new WP_REST_Request('POST', '/mcw/v1/threads');
    $req->set_header('Origin', $origin);
    $req->set_header('Content-Type', 'application/json');
    $req->set_body(wp_json_encode([
        'title' => 'Spam XSS probe',
        'forumId' => '',
        'body' => [
            ['type' => 'text', 'text' => '<script>alert(1)</script>'],
            ['type' => 'image', 'url' => 'javascript:alert(1)'],
        ],
    ]));
    $res = rest_do_request($req);
    $code = $res->get_status();
    t_assert('REST create_thread rejects malicious payload', in_array($code, [400, 403], true), "HTTP {$code}");

    $req2 = new WP_REST_Request('PATCH', '/mcw/v1/me');
    $req2->set_header('Origin', $origin);
    $req2->set_header('Content-Type', 'application/json');
    $req2->set_body(wp_json_encode([
        'bio' => 'https://bit.ly/phish https://t.co/x https://goo.gl/y https://tinyurl.com/z https://ow.ly/a',
        'avatar' => 'javascript:alert(1)',
    ]));
    $res2 = rest_do_request($req2);
    t_assert('REST patch_me rejects malicious bio/avatar', in_array($res2->get_status(), [400, 403], true), 'HTTP ' . $res2->get_status());

    // Legitimate EN/BN post should succeed (may 429 if cooldown from prior attempt — clear transient).
    delete_transient('mcw_last_write_' . (int) $uid);
    $req3 = new WP_REST_Request('POST', '/mcw/v1/threads');
    $req3->set_header('Origin', $origin);
    $req3->set_header('Content-Type', 'application/json');
    $req3->set_body(wp_json_encode([
        'title' => 'বাংলা ও English welcome',
        'forumId' => '',
        'body' => [
            ['type' => 'text', 'text' => "আমার অভিজ্ঞতা ভালো ছিল। Sharing a fair review."],
        ],
    ]));
    $res3 = rest_do_request($req3);
    $ok_legit = in_array($res3->get_status(), [200, 202], true);
    t_assert('REST create_thread allows legitimate EN/BN', $ok_legit, 'HTTP ' . $res3->get_status());

    // Cleanup only the throwaway thread we just created (if any) + user — never other content.
    $data = $res3->get_data();
    if (is_array($data) && !empty($data['thread']['id'])) {
        wp_delete_post((int) $data['thread']['id'], true);
    } else {
        // Held pending posts by this author
        $mine = get_posts([
            'post_type' => 'mcw_thread',
            'author' => (int) $uid,
            'post_status' => ['publish', 'pending', 'draft'],
            'numberposts' => 5,
            'fields' => 'ids',
        ]);
        foreach ($mine as $pid) {
            wp_delete_post((int) $pid, true);
        }
    }

    MCW_Forum_Auth::clear_session();
    require_once ABSPATH . 'wp-admin/includes/user.php';
    wp_delete_user((int) $uid);
}

// Confirm seed/legitimate threads still published (spot-check count did not go to zero).
$published = (int) wp_count_posts('mcw_thread')->publish;
t_assert('existing published threads still present', $published > 0, "count={$published}");

echo "\n{$passed} passed, {$failed} failed\n";
exit($failed > 0 ? 1 : 0);

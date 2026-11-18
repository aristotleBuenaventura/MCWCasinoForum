<?php

if (!defined('ABSPATH')) {
    exit;
}

class MCW_Forum_Seed
{
    public static function run(bool $reset = false): void
    {
        if ($reset) {
            self::wipe();
        }

        $users = [
            ['login' => 'admin', 'email' => 'admin@mcw.forum', 'pass' => 'admin123', 'name' => 'Forum Admin', 'role' => 'admin', 'bio' => 'Keeping the community fair and fun.'],
            ['login' => 'moderator', 'email' => 'mod@mcw.forum', 'pass' => 'moderator123', 'name' => 'Moderator', 'role' => 'moderator', 'bio' => 'Reports and pins.'],
            ['login' => 'alicewins', 'email' => 'alice@mcw.forum', 'pass' => 'password123', 'name' => 'Alice Wins', 'role' => 'user', 'bio' => 'Slot grinder. Mahjong Ways main.'],
            ['login' => 'bobdealer', 'email' => 'bob@mcw.forum', 'pass' => 'password123', 'name' => 'Bob Dealer', 'bio' => 'Live tables and cashout reviews.', 'role' => 'user'],
            ['login' => 'caraspins', 'email' => 'cara@mcw.forum', 'pass' => 'password123', 'name' => 'Cara Spins', 'bio' => 'Bonus math and mid-vol picks.', 'role' => 'user'],
        ];

        $ids = [];
        foreach ($users as $u) {
            $existing = get_user_by('login', $u['login']);
            if ($existing) {
                $ids[$u['login']] = $existing->ID;
                update_user_meta($existing->ID, 'mcw_role', $u['role']);
                update_user_meta($existing->ID, 'mcw_bio', $u['bio']);
                continue;
            }
            $id = wp_create_user($u['login'], $u['pass'], $u['email']);
            if (is_wp_error($id)) {
                continue;
            }
            wp_update_user(['ID' => $id, 'display_name' => $u['name']]);
            update_user_meta($id, 'mcw_role', $u['role']);
            update_user_meta($id, 'mcw_bio', $u['bio']);
            update_user_meta($id, 'mcw_membership', 'free');
            update_user_meta($id, 'mcw_name_frame', 'none');
            update_user_meta($id, 'mcw_name_emblem', 'none');
            $ids[$u['login']] = $id;
        }

        // Ensure WP admin also has mcw admin role
        $wp_admin = get_user_by('login', 'admin');
        if ($wp_admin) {
            update_user_meta($wp_admin->ID, 'mcw_role', 'admin');
            $ids['admin'] = $wp_admin->ID;
        }

        $forums = [
            ['slug' => 'slot-games', 'name' => 'Slot Games', 'desc' => 'Discuss slots, bonuses, and volatility.', 'parent' => 0, 'order' => 1, 'featured' => 1],
            ['slug' => 'game-providers', 'name' => 'Game Providers', 'desc' => 'Studios and their game catalogs.', 'parent' => 0, 'order' => 2, 'featured' => 1],
            // Brand sub-forums are synced from MCW_Forum_Providers::catalog() after terms below.
            ['slug' => 'casino-reviews', 'name' => 'Casino Reviews', 'desc' => 'Player reviews of casinos and platforms.', 'parent' => 'game-providers', 'order' => 100, 'featured' => 0],
            ['slug' => 'bonuses', 'name' => 'Bonuses', 'desc' => 'Welcome offers, wagering, and promo math.', 'parent' => 0, 'order' => 3, 'featured' => 1],
            ['slug' => 'rtp-volatility', 'name' => 'RTP & Volatility', 'desc' => 'How RTP and variance affect your bankroll.', 'parent' => 0, 'order' => 4, 'featured' => 0],
            ['slug' => 'responsible-gambling', 'name' => 'Responsible Gambling', 'desc' => 'Limits, tools, and staying in control.', 'parent' => 0, 'order' => 5, 'featured' => 0],
            ['slug' => 'big-wins', 'name' => 'Big Wins', 'desc' => 'Share screenshots and verified hit stories.', 'parent' => 0, 'order' => 6, 'featured' => 0],
            ['slug' => 'guides', 'name' => 'Guides & Resources', 'desc' => 'How-tos for RTP, wagering, and bankroll.', 'parent' => 0, 'order' => 7, 'featured' => 1],
        ];

        $term_ids = [];
        foreach ($forums as $f) {
            $existing = term_exists($f['slug'], 'mcw_forum');
            if ($existing) {
                $term_ids[$f['slug']] = (int) (is_array($existing) ? $existing['term_id'] : $existing);
            } else {
                $parent = 0;
                if ($f['parent'] && isset($term_ids[$f['parent']])) {
                    $parent = $term_ids[$f['parent']];
                }
                $created = wp_insert_term($f['name'], 'mcw_forum', [
                    'slug' => $f['slug'],
                    'description' => $f['desc'],
                    'parent' => $parent,
                ]);
                if (is_wp_error($created)) {
                    continue;
                }
                $term_ids[$f['slug']] = (int) $created['term_id'];
            }
            update_term_meta($term_ids[$f['slug']], 'mcw_order', $f['order']);
            update_term_meta($term_ids[$f['slug']], 'mcw_featured', $f['featured']);
        }

        // Brand sub-forums + CMS providers (needed before demo threads that target jili/pg-soft/pp).
        MCW_Forum_Providers::sync();
        foreach (MCW_Forum_Providers::catalog() as $brand) {
            $existing = term_exists($brand['slug'], 'mcw_forum');
            if ($existing) {
                $term_ids[$brand['slug']] = (int) (is_array($existing) ? $existing['term_id'] : $existing);
            }
        }

        $threads = [
            ['title' => 'My go-to “Mahjong Ways” strategy — what RTP are you guys actually getting lately?', 'forum' => 'pg-soft', 'author' => 'alicewins', 'content' => 'Posting my usual bet sizing and bonus-buy notes. Curious what RTP others are seeing on Mahjong Ways this month.'],
            ['title' => 'Start here before posting slot results', 'forum' => 'slot-games', 'author' => 'moderator', 'content' => 'Include game name, stake, session length, and whether it was a bonus buy. Screenshots help.', 'pinned' => true],
            ['title' => 'How we tag provider discussions', 'forum' => 'game-providers', 'author' => 'admin', 'content' => 'Keep studio-specific questions in the matching sub-forum so players can find them later.', 'pinned' => true],
            ['title' => 'Forum rules & how to report content', 'forum' => 'responsible-gambling', 'author' => 'moderator', 'content' => 'Be respectful. No spam. No scams. Use Report on posts. Moderators review quickly.', 'pinned' => true],
            ['title' => 'Anyone else hitting a long dry spell on medium volatility?', 'forum' => 'slot-games', 'author' => 'bobdealer', 'content' => 'Three sessions, no bonus. Checking if it is just variance or a week of dead games.'],
            ['title' => 'Gates of Olympus — 2,546x MAX WIN', 'forum' => 'big-wins', 'author' => 'alicewins', 'content' => 'Screenshot attached from last night’s session. Not advice, just the hit.'],
            ['title' => 'Which JILI titles are actually hitting this week?', 'forum' => 'jili', 'author' => 'alicewins', 'content' => 'Looking for mid-volatility picks that still have a decent bonus round.'],
            ['title' => 'Mahjong Ways — Hit 56x Bold Multiplier', 'forum' => 'big-wins', 'author' => 'bobdealer', 'content' => 'Stacked symbols finally lined up. Sharing the setup I used.'],
            ['title' => 'Reviewed my cashout experience at CasinoX — verified withdrawal in 4 hours.', 'forum' => 'casino-reviews', 'author' => 'bobdealer', 'content' => 'Submitted KYC once, then the payout hit in about four hours.'],
            ['title' => 'KYC timelines this month — who got approved fast?', 'forum' => 'casino-reviews', 'author' => 'caraspins', 'content' => 'Collecting recent KYC times so new players know what to expect.'],
            ['title' => 'Welcome bonus worth it after wagering?', 'forum' => 'bonuses', 'author' => 'caraspins', 'content' => 'Ran the numbers on a 100% match with 35x. Sharing the spreadsheet logic.'],
            ['title' => 'Super Ace — Wild Jacket hit', 'forum' => 'big-wins', 'author' => 'caraspins', 'content' => 'Short session, lucky timing. Always cash a piece back to the bank.'],
            ['title' => 'Best strategy for Gates of Olympus?', 'forum' => 'pragmatic-play', 'author' => 'caraspins', 'content' => 'Do you play base game only or bonus buy when the balance allows?'],
            ['title' => 'How to Calculate RTP & Volatility', 'forum' => 'guides', 'author' => 'moderator', 'content' => 'A practical walkthrough of published RTP vs session variance.'],
            ['title' => 'Casino Bonuses: What Are Wagering Requirements?', 'forum' => 'guides', 'author' => 'alicewins', 'content' => 'Playthrough, game weighting, max bet rules — the three things that decide if a bonus is worth it.'],
            ['title' => 'Responsible Bankroll Management', 'forum' => 'guides', 'author' => 'bobdealer', 'content' => 'Set a session cap, a monthly cap, and a stop-loss before you load the wallet.'],
        ];

        foreach ($threads as $t) {
            $author = $ids[$t['author']] ?? ($ids['admin'] ?? 1);
            $existing = get_page_by_title($t['title'], OBJECT, 'mcw_thread');
            if ($existing) {
                continue;
            }
            $id = wp_insert_post([
                'post_type' => 'mcw_thread',
                'post_status' => 'publish',
                'post_title' => $t['title'],
                'post_content' => $t['content'],
                'post_author' => $author,
            ]);
            if (is_wp_error($id) || !$id) {
                continue;
            }
            if (!empty($term_ids[$t['forum']])) {
                wp_set_post_terms($id, [$term_ids[$t['forum']]], 'mcw_forum');
            }
            update_post_meta($id, 'mcw_body', [['type' => 'text', 'text' => $t['content']]]);
            update_post_meta($id, 'mcw_views', wp_rand(40, 240));
            update_post_meta($id, 'mcw_pinned', !empty($t['pinned']) ? 1 : 0);
            update_post_meta($id, 'mcw_tags', []);

            // one sample reply
            $reply = wp_insert_post([
                'post_type' => 'mcw_reply',
                'post_status' => 'publish',
                'post_title' => 'Reply',
                'post_content' => 'Thanks for sharing — adding this to my notes.',
                'post_author' => $ids['caraspins'] ?? $author,
            ]);
            if (!is_wp_error($reply) && $reply) {
                update_post_meta($reply, 'mcw_thread_id', (string) $id);
                update_post_meta($reply, 'mcw_body', [['type' => 'text', 'text' => 'Thanks for sharing — adding this to my notes.']]);
            }
        }

        self::seed_cms();
        update_option('mcw_ad_rotate_sec', 8);
        update_option('mcw_seeded', 1);
    }

    private static function seed_cms(): void
    {
        if (!get_posts(['post_type' => 'mcw_ad', 'numberposts' => 1, 'post_status' => 'any'])) {
            $ad = wp_insert_post(['post_type' => 'mcw_ad', 'post_status' => 'publish', 'post_title' => 'Welcome Bonus']);
            update_post_meta($ad, 'mcw_slot', 'sidebar');
            update_post_meta($ad, 'mcw_image_url', '');
            update_post_meta($ad, 'mcw_url', '#');
            update_post_meta($ad, 'mcw_order', 1);
        }
        if (!get_posts(['post_type' => 'mcw_game', 'numberposts' => 1, 'post_status' => 'any'])) {
            foreach (['Gates of Olympus' => 'Pragmatic Play', 'Mahjong Ways' => 'PG Soft', 'Super Ace' => 'JILI'] as $title => $sub) {
                $id = wp_insert_post(['post_type' => 'mcw_game', 'post_status' => 'publish', 'post_title' => $title]);
                update_post_meta($id, 'mcw_subtitle', $sub);
                update_post_meta($id, 'mcw_image_url', '');
                update_post_meta($id, 'mcw_url', '#');
                update_post_meta($id, 'mcw_order', 1);
            }
        }
        // Providers + brand communities come from MCW_Forum_Providers::sync().
    }

    private static function wipe(): void
    {
        foreach (['mcw_thread', 'mcw_reply', 'mcw_ad', 'mcw_game', 'mcw_provider'] as $type) {
            $posts = get_posts(['post_type' => $type, 'numberposts' => -1, 'post_status' => 'any', 'fields' => 'ids']);
            foreach ($posts as $id) {
                wp_delete_post($id, true);
            }
        }
        $terms = get_terms(['taxonomy' => 'mcw_forum', 'hide_empty' => false]);
        if (!is_wp_error($terms)) {
            foreach ($terms as $term) {
                wp_delete_term($term->term_id, 'mcw_forum');
            }
        }
    }
}

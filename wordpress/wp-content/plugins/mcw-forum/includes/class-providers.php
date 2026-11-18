<?php

if (!defined('ABSPATH')) {
    exit;
}

/**
 * Slot-Meter brand catalog → forum communities + CMS providers.
 */
class MCW_Forum_Providers
{
    /**
     * @return list<array{code:string,name:string,slug:string,logo:string}>
     */
    public static function catalog(): array
    {
        return [
            ['code' => '5G', 'name' => '5G Games', 'slug' => '5g-games', 'logo' => '/manuf-logos/5G.png'],
            ['code' => 'AE', 'name' => 'AE Sexy', 'slug' => 'ae-sexy', 'logo' => '/manuf-logos/AE.png'],
            ['code' => 'AMBS', 'name' => 'Ambs', 'slug' => 'ambs', 'logo' => '/manuf-logos/AMBS.png'],
            ['code' => 'AW', 'name' => 'Awesome Gaming', 'slug' => 'awesome-gaming', 'logo' => '/manuf-logos/AW.png'],
            ['code' => 'BTG', 'name' => 'Big Time Gaming', 'slug' => 'big-time-gaming', 'logo' => '/manuf-logos/BTG.png'],
            ['code' => 'BNG', 'name' => 'Booongo', 'slug' => 'booongo', 'logo' => '/manuf-logos/BNG.png'],
            ['code' => 'BT', 'name' => 'BT Gaming', 'slug' => 'bt-gaming', 'logo' => '/manuf-logos/BT.png'],
            ['code' => 'CQ9', 'name' => 'CQ9', 'slug' => 'cq9', 'logo' => '/manuf-logos/CQ9.png'],
            ['code' => 'DNA', 'name' => 'DNA Gaming', 'slug' => 'dna-gaming', 'logo' => '/manuf-logos/DNA.png'],
            ['code' => 'DRS', 'name' => 'Drsot', 'slug' => 'drsot', 'logo' => '/manuf-logos/DRS.png'],
            ['code' => 'FC', 'name' => 'Fa Chai', 'slug' => 'fa-chai', 'logo' => '/manuf-logos/FC.png'],
            ['code' => 'HS', 'name' => 'Hacksaw Gaming', 'slug' => 'hacksaw-gaming', 'logo' => '/manuf-logos/HS.png'],
            ['code' => 'JDB', 'name' => 'JDB', 'slug' => 'jdb', 'logo' => '/manuf-logos/JDB.png'],
            ['code' => 'JILI', 'name' => 'JILI', 'slug' => 'jili', 'logo' => '/manuf-logos/JILI.png'],
            ['code' => 'KA', 'name' => 'KA Gaming', 'slug' => 'ka-gaming', 'logo' => '/manuf-logos/KA.png'],
            ['code' => 'MAHA', 'name' => 'Maha Games', 'slug' => 'maha-games', 'logo' => '/manuf-logos/MAHA.png'],
            ['code' => 'MW', 'name' => 'Mega Win', 'slug' => 'mega-win', 'logo' => '/manuf-logos/MW.png'],
            ['code' => 'MA', 'name' => 'Microgaming', 'slug' => 'microgaming', 'logo' => '/manuf-logos/MA.png'],
            ['code' => 'NE', 'name' => 'NetEnt', 'slug' => 'netent', 'logo' => '/manuf-logos/NE.png'],
            ['code' => 'NS', 'name' => 'Nextspin', 'slug' => 'nextspin', 'logo' => '/manuf-logos/NS.png'],
            ['code' => 'PG', 'name' => 'PG Soft', 'slug' => 'pg-soft', 'logo' => '/manuf-logos/PG.png'],
            ['code' => 'PP', 'name' => 'Pragmatic Play', 'slug' => 'pragmatic-play', 'logo' => '/manuf-logos/PP.png'],
            ['code' => 'RG', 'name' => 'Relax Gaming', 'slug' => 'relax-gaming', 'logo' => '/manuf-logos/RG.png'],
            ['code' => 'R88', 'name' => 'Rich88', 'slug' => 'rich88', 'logo' => '/manuf-logos/R88.png'],
            ['code' => 'RSG', 'name' => 'Royal Slot Gaming', 'slug' => 'royal-slot-gaming', 'logo' => '/manuf-logos/RSG.png'],
            ['code' => 'SG', 'name' => 'Spadegaming', 'slug' => 'spadegaming', 'logo' => '/manuf-logos/SG.png'],
            ['code' => 'WMT', 'name' => 'WMT', 'slug' => 'wmt', 'logo' => '/manuf-logos/WMT.png'],
            ['code' => 'YB', 'name' => 'Yeebet', 'slug' => 'yeebet', 'logo' => '/manuf-logos/YB.png'],
        ];
    }

    /**
     * Ensure parent Game Providers forum, child brand communities, and CMS provider cards.
     *
     * @return array{communities:int,providers:int}
     */
    public static function sync(): array
    {
        $parent = term_exists('game-providers', 'mcw_forum');
        if (!$parent) {
            $created = wp_insert_term('Game Providers', 'mcw_forum', [
                'slug' => 'game-providers',
                'description' => 'Studios and their game catalogs.',
            ]);
            if (is_wp_error($created)) {
                return ['communities' => 0, 'providers' => 0];
            }
            $parent_id = (int) $created['term_id'];
            update_term_meta($parent_id, 'mcw_order', 2);
            update_term_meta($parent_id, 'mcw_featured', 1);
        } else {
            $parent_id = (int) (is_array($parent) ? $parent['term_id'] : $parent);
        }

        $communities = 0;
        $providers = 0;
        $order = 1;

        foreach (self::catalog() as $brand) {
            $term_id = 0;
            $existing = term_exists($brand['slug'], 'mcw_forum');
            if ($existing) {
                $term_id = (int) (is_array($existing) ? $existing['term_id'] : $existing);
                wp_update_term($term_id, 'mcw_forum', [
                    'name' => $brand['name'],
                    'description' => $brand['name'] . ' titles, RTP talk, and community discussion.',
                    'parent' => $parent_id,
                ]);
            } else {
                $created = wp_insert_term($brand['name'], 'mcw_forum', [
                    'slug' => $brand['slug'],
                    'description' => $brand['name'] . ' titles, RTP talk, and community discussion.',
                    'parent' => $parent_id,
                ]);
                if (is_wp_error($created)) {
                    continue;
                }
                $term_id = (int) $created['term_id'];
            }
            update_term_meta($term_id, 'mcw_order', $order);
            update_term_meta($term_id, 'mcw_featured', 0);
            $communities++;

            $post_id = self::find_provider_post($brand['code'], $brand['name']);
            $had_home = false;
            if (!$post_id) {
                $post_id = wp_insert_post([
                    'post_type' => 'mcw_provider',
                    'post_status' => 'publish',
                    'post_title' => $brand['name'],
                ]);
                if (is_wp_error($post_id) || !$post_id) {
                    $order++;
                    continue;
                }
            } else {
                $had_home = (bool) get_post_meta($post_id, 'mcw_home_top', true);
                wp_update_post([
                    'ID' => $post_id,
                    'post_title' => $brand['name'],
                    'post_status' => 'publish',
                ]);
            }

            update_post_meta($post_id, 'mcw_brand_code', $brand['code']);
            update_post_meta($post_id, 'mcw_subtitle', 'Provider');
            update_post_meta($post_id, 'mcw_image_url', $brand['logo']);
            update_post_meta($post_id, 'mcw_url', '/communities/' . $brand['slug']);
            if (get_post_meta($post_id, 'mcw_rating', true) === '') {
                update_post_meta($post_id, 'mcw_rating', 4.5);
            }
            update_post_meta($post_id, 'mcw_order', $order);
            // Preserve existing home-top pins across sync.
            update_post_meta($post_id, 'mcw_home_top', $had_home ? 1 : 0);
            $providers++;
            $order++;
        }

        // Default home pins once: JILI, PG Soft, Pragmatic Play, Hacksaw.
        if (!get_option('mcw_providers_home_top_seeded')) {
            $defaults = ['JILI', 'PG', 'PP', 'HS'];
            $pinned = 0;
            foreach (self::catalog() as $brand) {
                if (!in_array($brand['code'], $defaults, true)) {
                    continue;
                }
                $pid = self::find_provider_post($brand['code'], $brand['name']);
                if ($pid) {
                    update_post_meta($pid, 'mcw_home_top', 1);
                    $pinned++;
                }
            }
            if ($pinned > 0) {
                update_option('mcw_providers_home_top_seeded', 1);
            }
        }

        // Keep Casino Reviews under Game Providers, after brands.
        $reviews = term_exists('casino-reviews', 'mcw_forum');
        if ($reviews) {
            $rid = (int) (is_array($reviews) ? $reviews['term_id'] : $reviews);
            wp_update_term($rid, 'mcw_forum', ['parent' => $parent_id]);
            update_term_meta($rid, 'mcw_order', 100);
        }

        // Remove legacy/duplicate CMS providers without a brand code.
        $keep_codes = array_column(self::catalog(), 'code');
        $all_providers = get_posts([
            'post_type' => 'mcw_provider',
            'post_status' => 'any',
            'numberposts' => -1,
            'fields' => 'ids',
        ]);
        $seen_codes = [];
        foreach ($all_providers as $pid) {
            $pid = (int) $pid;
            $code = (string) get_post_meta($pid, 'mcw_brand_code', true);
            if ($code === '' || !in_array($code, $keep_codes, true)) {
                wp_delete_post($pid, true);
                continue;
            }
            if (isset($seen_codes[$code])) {
                wp_delete_post($pid, true);
                continue;
            }
            $seen_codes[$code] = $pid;
        }

        delete_transient('mcw_home_extras_en');
        delete_transient('mcw_home_extras_bn');

        return ['communities' => $communities, 'providers' => count($seen_codes)];
    }

    private static function find_provider_post(string $code, string $name): int
    {
        $by_code = get_posts([
            'post_type' => 'mcw_provider',
            'post_status' => 'any',
            'numberposts' => 1,
            'fields' => 'ids',
            'meta_key' => 'mcw_brand_code',
            'meta_value' => $code,
        ]);
        if ($by_code) {
            return (int) $by_code[0];
        }

        $by_title = get_page_by_title($name, OBJECT, 'mcw_provider');
        if ($by_title) {
            return (int) $by_title->ID;
        }

        // Legacy seed titles
        $aliases = [
            'JILI' => ['JILI Games'],
            'PG Soft' => ['PG Soft'],
            'Pragmatic Play' => ['Pragmatic Play'],
        ];
        foreach ($aliases[$name] ?? [] as $alias) {
            $hit = get_page_by_title($alias, OBJECT, 'mcw_provider');
            if ($hit) {
                return (int) $hit->ID;
            }
        }

        return 0;
    }
}

<?php
/**
 * Plugin Name: MCW Casino Forum API
 * Description: Headless forum REST API for the React frontend. WPML-ready CPTs/taxonomies.
 * Version: 1.0.0
 * Author: MCW
 * Text Domain: mcw-forum
 */

if (!defined('ABSPATH')) {
    exit;
}

define('MCW_FORUM_VERSION', '1.0.0');
define('MCW_FORUM_PLUGIN_FILE', __FILE__);
define('MCW_FORUM_PLUGIN_DIR', plugin_dir_path(__FILE__));

require_once MCW_FORUM_PLUGIN_DIR . 'includes/class-install.php';
require_once MCW_FORUM_PLUGIN_DIR . 'includes/class-cpt.php';
require_once MCW_FORUM_PLUGIN_DIR . 'includes/class-cors.php';
require_once MCW_FORUM_PLUGIN_DIR . 'includes/class-auth.php';
require_once MCW_FORUM_PLUGIN_DIR . 'includes/class-serialize.php';
require_once MCW_FORUM_PLUGIN_DIR . 'includes/class-forum.php';
require_once MCW_FORUM_PLUGIN_DIR . 'includes/class-rest.php';
require_once MCW_FORUM_PLUGIN_DIR . 'includes/class-seed.php';

register_activation_hook(__FILE__, ['MCW_Forum_Install', 'activate']);

add_action('plugins_loaded', static function () {
    MCW_Forum_CPT::init();
    MCW_Forum_CORS::init();
    MCW_Forum_Auth::init();
    MCW_Forum_REST::init();
});

if (defined('WP_CLI') && WP_CLI && class_exists('WP_CLI')) {
    require_once MCW_FORUM_PLUGIN_DIR . 'cli/class-cli.php';
}

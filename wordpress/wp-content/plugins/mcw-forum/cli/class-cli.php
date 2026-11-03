<?php

if (!defined('ABSPATH')) {
    exit;
}

class MCW_Forum_CLI_Command
{
    /**
     * Seed demo forum data.
     *
     * ## OPTIONS
     *
     * [--reset]
     * : Delete existing MCW content before seeding.
     *
     * ## EXAMPLES
     *
     *     wp mcw seed
     *     wp mcw seed --reset
     *
     * @when after_wp_load
     */
    public function seed($args, $assoc_args): void
    {
        MCW_Forum_Seed::run(!empty($assoc_args['reset']));
        WP_CLI::success('MCW forum seed complete.');
    }
}

WP_CLI::add_command('mcw', 'MCW_Forum_CLI_Command');

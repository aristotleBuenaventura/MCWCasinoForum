# WordPress CLI & maintenance helpers (outside web root)

These files were moved out of `wordpress/` so they are **not** HTTP-accessible.

| Path | Purpose |
|------|---------|
| `wp-cli.phar` | WordPress CLI |
| `helpers/_*.php` | One-shot installer / WPML / provider sync scripts |

## Usage

From repo root:

```bash
# WP-CLI
php tools/wordpress/wp-cli.phar --path=wordpress <command>
npm run wp:cli -- plugin list
npm run wp:seed

# Helpers (CLI only)
php tools/wordpress/helpers/_sync_providers.php
php tools/wordpress/helpers/_wpml_setup_bn.php
```

Do **not** copy these back into `wordpress/` on production hosts.

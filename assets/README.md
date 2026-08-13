# Assets

Canonical branding for Cartographer — restrained cartographic / technical identity (not cartoon).

| File | Use |
|------|-----|
| `banner.svg` | README default (dark field, light wordmark) — optimized for GitHub light mode |
| `banner-light.svg` | Light field / dark wordmark — GitHub dark mode + light surfaces |
| `banner-dark.svg` | Darker field with subtle frame — dark UI chrome |
| `logo.svg` | Primary app / marketplace icon (128²) |
| `logo-mark.svg` | Favicon / header mark (64²) |
| `logo-light.svg` | Mark on light backgrounds |
| `logo-dark.svg` | Mark on dark backgrounds |
| `favicon.svg` | Same geometry as `logo-mark.svg` |

Regenerate banners (path wordmark, no font dependency):

```bash
node scripts/generate-brand-assets.mjs
```

PNG exports for marketplaces:

```bash
# npx --yes sharp-cli -i assets/logo.svg -o assets/marketplace-icon.png --width 512
```

SVGs are the source of truth. Wordmarks are geometric paths so GitHub README rendering stays sharp without system-font fallbacks.

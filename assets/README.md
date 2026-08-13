# Assets

Canonical branding for Cartographer (cartographic / technical — not cartoon).

| File | Use |
|------|-----|
| `banner.svg` | README / site hero |
| `logo.svg` | Primary logo |
| `logo-mark.svg` | Favicon / compact mark |
| `logo-light.svg` | Light backgrounds |
| `logo-dark.svg` | Dark backgrounds |

PNG exports (`marketplace-icon.png`, `social-preview.png`) can be generated from these SVGs when publishing to marketplaces:

```bash
# Example with a local SVG→PNG tool of your choice
# npx --yes sharp-cli -i assets/logo.svg -o assets/marketplace-icon.png --width 512
```

SVGs are the source of truth.

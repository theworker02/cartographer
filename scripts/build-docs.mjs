import { cpSync, mkdirSync, rmSync, existsSync, writeFileSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = join(root, "docs-site");
const dist = join(src, "dist");
const assets = join(root, "assets");

const PAGES = [
  { file: "index.html", route: null },
  { file: "docs.html", route: "docs" },
  { file: "install.html", route: "install" },
  { file: "languages.html", route: "languages" },
  { file: "architecture.html", route: "architecture" },
  { file: "privacy.html", route: "privacy" },
];

const ROUTE_NAMES = PAGES.map((p) => p.route).filter(Boolean);

if (existsSync(dist)) rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });

cpSync(join(src, "styles.css"), join(dist, "styles.css"));
cpSync(assets, join(dist, "assets"), { recursive: true });

// Favicons (SVG derived from brand mark)
const faviconSrc = existsSync(join(src, "favicon.svg"))
  ? join(src, "favicon.svg")
  : join(assets, "logo-mark.svg");
cpSync(faviconSrc, join(dist, "favicon.svg"));
cpSync(faviconSrc, join(dist, "assets", "favicon.svg"));

/**
 * Rewrite root-relative site paths for a nested route directory (depth 1).
 */
function nestify(html) {
  let out = html;
  out = out.replaceAll('href="styles.css"', 'href="../styles.css"');
  out = out.replaceAll('href="favicon.svg"', 'href="../favicon.svg"');
  out = out.replaceAll('href="assets/', 'href="../assets/');
  out = out.replaceAll('src="assets/', 'src="../assets/');
  out = out.replaceAll('href="./"', 'href="../"');
  for (const name of ROUTE_NAMES) {
    out = out.replaceAll(`href="./${name}/"`, `href="../${name}/"`);
    out = out.replaceAll(`href="${name}/"`, `href="../${name}/"`);
  }
  return out;
}

for (const page of PAGES) {
  const html = readFileSync(join(src, page.file), "utf8");

  if (page.route === null) {
    writeFileSync(join(dist, "index.html"), html);
    continue;
  }

  // Pretty route: /docs/, /install/, …
  const dir = join(dist, page.route);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "index.html"), nestify(html));

  // Legacy flat file → pretty route (keeps old bookmarks working)
  writeFileSync(
    join(dist, page.file),
    `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta http-equiv="refresh" content="0;url=./${page.route}/" />
  <link rel="canonical" href="./${page.route}/" />
  <title>Redirecting…</title>
</head>
<body>
  <p><a href="./${page.route}/">Continue to ${page.route}</a></p>
</body>
</html>
`,
  );
}

writeFileSync(join(dist, ".nojekyll"), "");
console.log("Docs site built → docs-site/dist");

/** Generate banner SVGs with geometric path wordmark (no font dependency). */
import { writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const assets = join(root, "assets");

/** Unit grid: cap height 32, advance 24, gap 7 — then scale the group. */
const S = 1.4;
const CAP = 32;
const ADVANCE = 24;
const GAP = 7;

const letters = {
  C: (x) =>
    `M${x + 21} 4C${x + 7} 4 ${x + 1} 12 ${x + 1} 18C${x + 1} 24 ${x + 7} 32 ${x + 21} 32`,
  A: (x) =>
    `M${x + 1} 32L${x + 12} 4L${x + 23} 32M${x + 6.5} 21H${x + 17.5}`,
  R: (x) =>
    `M${x + 2} 32V4H${x + 14}C${x + 20} 4 ${x + 21.5} 9 ${x + 21.5} 13C${x + 21.5} 17 ${x + 20} 21 ${x + 14} 21H${x + 2}M${x + 13} 21L${x + 22} 32`,
  T: (x) => `M${x + 1} 4H${x + 23}M${x + 12} 4V32`,
  O: (x) =>
    `M${x + 12} 4C${x + 3.5} 4 ${x + 1} 11 ${x + 1} 18C${x + 1} 25 ${x + 3.5} 32 ${x + 12} 32C${x + 20.5} 32 ${x + 23} 25 ${x + 23} 18C${x + 23} 11 ${x + 20.5} 4 ${x + 12} 4`,
  G: (x) =>
    `M${x + 21} 9C${x + 19} 5.5 ${x + 15.5} 4 ${x + 12} 4C${x + 3.5} 4 ${x + 1} 11 ${x + 1} 18C${x + 1} 25 ${x + 3.5} 32 ${x + 12} 32C${x + 19} 32 ${x + 22.5} 26 ${x + 22.5} 20.5H${x + 13}`,
  P: (x) =>
    `M${x + 2} 32V4H${x + 14}C${x + 20} 4 ${x + 21.5} 9 ${x + 21.5} 13.5C${x + 21.5} 18 ${x + 20} 22 ${x + 14} 22H${x + 2}`,
  H: (x) => `M${x + 2} 4V32M${x + 22} 4V32M${x + 2} 18H${x + 22}`,
  E: (x) => `M${x + 21} 4H${x + 2}V32H${x + 21}M${x + 2} 18H${x + 17}`,
};

const word = "CARTOGRAPHER";

function wordmarkPath() {
  let x = 0;
  const parts = [];
  for (const ch of word) {
    parts.push(letters[ch](x));
    x += ADVANCE + GAP;
  }
  return { d: parts.join(""), width: x - GAP };
}

const { d: wordPath, width: wordWidthUnit } = wordmarkPath();
const wordWidth = wordWidthUnit * S;
const capH = CAP * S;

function markGroup(size, stroke, fill, north, ring, ringInner) {
  const k = size / 64;
  const n = (v) => +(v * k).toFixed(2);
  return `<g>
    <rect width="${size}" height="${size}" rx="${n(14)}" fill="${fill}"/>
    <circle cx="${n(32)}" cy="${n(32)}" r="${n(23)}" stroke="${ring}" stroke-width="${Math.max(1, n(1.1))}" fill="none"/>
    <circle cx="${n(32)}" cy="${n(32)}" r="${n(15.5)}" stroke="${ringInner}" stroke-width="${Math.max(0.9, n(1))}" fill="none" opacity="0.9"/>
    <path d="M${n(46.2)} ${n(19.2)}A${n(17.2)} ${n(17.2)} 0 1 0 ${n(46.2)} ${n(44.8)}" stroke="${stroke}" stroke-width="${n(3.25)}" stroke-linecap="round" fill="none"/>
    <path d="M${n(32)} ${n(23.5)}v${n(17)}M${n(23.5)} ${n(32)}h${n(17)}" stroke="${stroke}" stroke-width="${n(1.35)}" stroke-linecap="round" fill="none" opacity="0.92"/>
    <circle cx="${n(32)}" cy="${n(32)}" r="${n(2.4)}" fill="${stroke}"/>
    <path d="M${n(32)} ${n(6.5)}l${n(2.1)} ${n(4.2)}h${n(-4.2)}L${n(32)} ${n(6.5)}z" fill="${north}"/>
  </g>`;
}

function banner({
  filename,
  bg,
  grid,
  stroke,
  north,
  ring,
  ringInner,
  markFill,
  frame,
}) {
  const padX = 40;
  const markSize = 72;
  const gap = 36;
  const wordX = padX + markSize + gap;
  const H = 128;
  const totalW = Math.ceil(wordX + wordWidth + padX);
  const wordY = (H - capH) / 2;
  const strokeW = +(2.4 * S).toFixed(2);

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalW} ${H}" fill="none" role="img" aria-label="Cartographer">
  <rect width="${totalW}" height="${H}" rx="14" fill="${bg}"/>
  ${frame ? `<rect x="1" y="1" width="${totalW - 2}" height="${H - 2}" rx="13" stroke="${frame}" stroke-width="1.5" fill="none"/>` : ""}
  <g stroke="${grid}" stroke-width="0.7" opacity="0.5">
    <path d="M0 ${H / 4}h${totalW}M0 ${H / 2}h${totalW}M0 ${(3 * H) / 4}h${totalW}"/>
  </g>
  <g transform="translate(${padX} ${(H - markSize) / 2})">
    ${markGroup(markSize, stroke, markFill, north, ring, ringInner)}
  </g>
  <g transform="translate(${wordX} ${wordY}) scale(${S})" stroke="${stroke}" stroke-width="${(strokeW / S).toFixed(2)}" stroke-linecap="round" stroke-linejoin="round" fill="none">
    <path d="${wordPath}"/>
  </g>
</svg>
`;

  writeFileSync(join(assets, filename), svg.trim() + "\n");
  console.log(`wrote ${filename} (${totalW}×${H})`);
}

banner({
  filename: "banner.svg",
  bg: "#0e1c17",
  grid: "#1a3229",
  stroke: "#e7f1eb",
  north: "#c4a574",
  ring: "#2f5c4c",
  ringInner: "#4a7d68",
  markFill: "#12261f",
  frame: null,
});

banner({
  filename: "banner-dark.svg",
  bg: "#080f0c",
  grid: "#152820",
  stroke: "#e7f1eb",
  north: "#c4a574",
  ring: "#2f5c4c",
  ringInner: "#4a7d68",
  markFill: "#0e1c17",
  frame: "#2f5c4c",
});

banner({
  filename: "banner-light.svg",
  bg: "#f3f7f5",
  grid: "#d5e4dc",
  stroke: "#0e1c17",
  north: "#a67c3d",
  ring: "#2f5c4c",
  ringInner: "#1a3229",
  markFill: "#e8f0eb",
  frame: "#c5d9cf",
});

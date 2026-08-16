// How much of each page is actually used? A break that leaves three lines
// alone on a sheet is technically "clean" and looks like a mistake.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
const dir = process.argv[2];
const mm = (pt) => (pt / 72) * 25.4;
for (const f of fs
  .readdirSync(dir)
  .filter((x) => x.endsWith(".pdf"))
  .sort()) {
  const out =
    spawnSync("pdftotext", ["-bbox", path.join(dir, f), "-"], { encoding: "utf8" }).stdout || "";
  const pages = out.split(/<page\b/).slice(1);
  if (pages.length < 2) continue;
  const fills = pages.map((p) => {
    const wm = /height="([\d.]+)"/.exec(p);
    const H = wm ? Number(wm[1]) : 841.89;
    let lo = 1e9,
      hi = -1;
    for (const m of p.matchAll(/xMin="[\d.]+" yMin="([\d.]+)" xMax="[\d.]+" yMax="([\d.]+)"/g)) {
      lo = Math.min(lo, +m[1]);
      hi = Math.max(hi, +m[2]);
    }
    return hi < 0 ? 0 : Math.round((mm(hi - lo) / mm(H)) * 100);
  });
  const thin = fills.filter((x) => x > 0 && x < 30).length;
  console.log(
    `${thin ? "!" : " "} ${f.replace(/\.pdf$/, "").padEnd(42)} ${pages.length}p  fill% ${fills.join(" · ")}`,
  );
}

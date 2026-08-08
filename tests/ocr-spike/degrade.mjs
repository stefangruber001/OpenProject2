import fs from "node:fs";
const { chromium } =
  await import("/home/user/OpenProject2/node_modules/.pnpm/playwright-core@1.61.1/node_modules/playwright-core/index.js").then(
    (m) => m.default || m,
  );
const dataUrl = "data:image/png;base64," + fs.readFileSync("scan-clean.png").toString("base64");
const b = await chromium.launch({
  executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
});
const pg = await b.newPage();
await pg.goto("about:blank");
const CFG = {
  "scan-good": { scale: 1.0, rot: 0.4, blur: 0.3, noise: 6, jpeg: 0.85, gray: true },
  "scan-poor": { scale: 0.55, rot: 1.6, blur: 0.9, noise: 18, jpeg: 0.55, gray: true },
  "photo-phone": { scale: 0.75, rot: 2.8, blur: 1.3, noise: 26, jpeg: 0.45, gray: false },
};
for (const [name, c] of Object.entries(CFG)) {
  const out = await pg.evaluate(
    async ({ src, c }) => {
      const img = new Image();
      img.src = src;
      await img.decode();
      const w = Math.round(img.width * c.scale),
        h = Math.round(img.height * c.scale);
      const cv = document.createElement("canvas");
      cv.width = w;
      cv.height = h;
      const x = cv.getContext("2d");
      x.fillStyle = "#fff";
      x.fillRect(0, 0, w, h);
      x.save();
      x.translate(w / 2, h / 2);
      x.rotate((c.rot * Math.PI) / 180);
      x.translate(-w / 2, -h / 2);
      x.filter =
        `blur(${c.blur}px)` +
        (c.gray ? " grayscale(1) contrast(0.92)" : " saturate(0.8) brightness(1.04)");
      x.drawImage(img, 0, 0, w, h);
      x.restore();
      const d = x.getImageData(0, 0, w, h);
      for (let i = 0; i < d.data.length; i += 4) {
        const n = (Math.random() - 0.5) * c.noise * 2;
        d.data[i] += n;
        d.data[i + 1] += n;
        d.data[i + 2] += n;
      }
      x.putImageData(d, 0, 0);
      return cv.toDataURL("image/jpeg", c.jpeg);
    },
    { src: dataUrl, c },
  );
  fs.writeFileSync(name + ".jpg", Buffer.from(out.split(",")[1], "base64"));
}
await b.close();

// Dev-only: derive the desktop icon from the unchanged Android launcher artwork.
const fs = require('node:fs/promises');
const path = require('node:path');
const { chromium } = require('@playwright/test');

(async () => {
  const xml = await fs.readFile(path.join(__dirname, '../android/app/src/main/res/drawable/ic_launcher_fg.xml'), 'utf8');
  const colors = await fs.readFile(path.join(__dirname, '../android/app/src/main/res/values/colors.xml'), 'utf8');
  const sea = colors.match(/name="sea">(#[A-Fa-f0-9]+)</)[1];
  const attributes = { pathData: 'd', fillColor: 'fill', strokeColor: 'stroke', strokeWidth: 'stroke-width', strokeLineCap: 'stroke-linecap' };
  const paths = [...xml.matchAll(/<path\s+([\s\S]*?)\/>/g)].map(match => {
    const attrs = [...match[1].matchAll(/android:(\w+)="([^"]*)"/g)].filter(a => attributes[a[1]])
      .map(a => `${attributes[a[1]]}="${a[2] === '#00000000' ? 'none' : a[2]}"`).join(' ');
    return `<path ${attrs}/>`;
  }).join('\n');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 108 108" width="256" height="256"><rect width="108" height="108" rx="20" fill="${sea}"/>${paths}</svg>`;
  await fs.writeFile(path.join(__dirname, 'assets/icon.svg'), svg + '\n');
  const browser = await chromium.launch();
  try {
    const sizes = [16, 24, 32, 48, 64, 128, 256];
    const images = [];
    for (const size of sizes) {
      const page = await browser.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 });
      await page.setContent(`<style>body{margin:0}svg{width:100%;height:100%;display:block}</style>${svg}`);
      images.push(await page.screenshot({ omitBackground: true }));
      await page.close();
    }
    // Modern Windows ICO: a directory followed by one PNG for each supported size.
    const header = Buffer.alloc(6 + sizes.length * 16);
    header.writeUInt16LE(1, 2); header.writeUInt16LE(sizes.length, 4);
    let offset = header.length;
    images.forEach((png, i) => {
      const entry = 6 + i * 16;
      header[entry] = header[entry + 1] = sizes[i] % 256;
      header.writeUInt16LE(1, entry + 4); header.writeUInt16LE(32, entry + 6);
      header.writeUInt32LE(png.length, entry + 8); header.writeUInt32LE(offset, entry + 12);
      offset += png.length;
    });
    await fs.writeFile(path.join(__dirname, 'assets/icon.ico'), Buffer.concat([header, ...images]));
    console.log('Generated icon.svg and multi-size icon.ico from Android artwork');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });

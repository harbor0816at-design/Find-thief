// 生成小程序头像（上传到后台用）和分享卡片封面
'use strict';
const path = require('path');
const pw = require(process.env.PLAYWRIGHT || 'playwright');
const out = path.join(__dirname, '..');
const BODY = 'M26 59C26 59 5 37.5 5 23.5a21 21 0 0 1 42 0C47 37.5 26 59 26 59z';
const pinSvg = (fill, ring, size, x, y, glyph) => `<svg x="${x}" y="${y}" width="${size}" height="${size * 62 / 52}" viewBox="0 0 52 62"><path d="${BODY}" fill="#fff" stroke="#1B1D3A" stroke-width="5" stroke-linejoin="round"/><path d="${BODY}" fill="${fill}" stroke="${ring}" stroke-width="3.2" stroke-linejoin="round"/><circle cx="26" cy="23.5" r="13" fill="#fff"/>${glyph}</svg>`;
const wallet = c => `<rect x="18.5" y="19" width="15" height="11" rx="2.4" fill="${c}"/><path d="M18.5 22.5h15" stroke="#fff" stroke-width="1.6"/><circle cx="29.5" cy="26.2" r="1.5" fill="#fff"/><path d="M22 18.5l3.5-3.5 2 2" fill="none" stroke="${c}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>`;
const bolt = c => `<path d="M28.5 13.5 19.5 25h6l-2.5 9.5 10-12.5h-6.2z" fill="${c}"/>`;
const q = c => `<text x="26" y="29.6" text-anchor="middle" font-size="17" font-weight="900" fill="${c}" font-family="Arial Black,Arial,sans-serif">?</text>`;
const logo = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#6C5CE7"/>
  <circle cx="256" cy="236" r="170" fill="#FFD43B"/>
  ${pinSvg('#E8384F', '#FFD43B', 250, 131, 80, wallet('#E8384F'))}
  <path d="M120 430h272" stroke="#1B1D3A" stroke-width="14" stroke-linecap="round" opacity=".18"/></svg>`;
const share = `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="800" viewBox="0 0 1000 800">
  <rect width="1000" height="800" fill="#F7F6FF"/>
  <g stroke="#E3E0F5" stroke-width="3">${Array.from({ length: 12 }, (_, i) => `<path d="M${i * 90} 0v800"/><path d="M0 ${i * 90}h1000"/>`).join('')}</g>
  <path d="M-20 560 C200 480 360 640 560 520 S860 420 1040 500" fill="none" stroke="#FFD43B" stroke-width="26"/>
  ${pinSvg('#E8384F', '#7B5CFF', 150, 110, 250, wallet('#E8384F'))}
  ${pinSvg('#FF7A59', '#FF9F1C', 120, 430, 360, bolt('#FF7A59'))}
  ${pinSvg('#E8384F', '#FFD43B', 135, 720, 230, q('#E8384F'))}
  <rect x="60" y="60" width="880" height="150" rx="32" fill="#fff" stroke="#1B1D3A" stroke-width="6"/>
  <text x="100" y="152" font-size="64" font-weight="900" fill="#1B1D3A" font-family="Noto Sans CJK SC,PingFang SC,sans-serif">出发前，看看哪里扒手多</text>
  <rect x="60" y="680" width="420" height="80" rx="40" fill="#FFD43B" stroke="#1B1D3A" stroke-width="5"/>
  <text x="270" y="733" text-anchor="middle" font-size="38" font-weight="900" fill="#1B1D3A" font-family="Noto Sans CJK SC,PingFang SC,sans-serif">小偷地图 · 欧洲</text></svg>`;
(async () => {
  const b = await pw.chromium.launch(process.env.CHROME ? { executablePath: process.env.CHROME } : {});
  const p = await b.newPage();
  for (const [svg, file] of [[logo, 'brand/logo-512.png'], [share, 'miniprogram/images/share.png']]) {
    await p.setContent(`<html><body style="margin:0">${svg}</body></html>`);
    await p.locator('svg').first().screenshot({ path: path.join(out, file) });
  }
  await b.close();
  console.log('ok');
})();

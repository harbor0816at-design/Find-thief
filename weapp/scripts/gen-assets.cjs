// 生成小程序图片资源（图钉 60 张、tab 图标 6 张）。需要 Playwright：
//   PLAYWRIGHT=/path/to/playwright-core node weapp/scripts/gen-assets.cjs
'use strict';
const fs = require('fs');
const path = require('path');
const pw = require(process.env.PLAYWRIGHT || 'playwright');
const out = path.join(__dirname, '..', 'miniprogram', 'images');

const STATUS = { admin: '#E8384F', traveler: '#FF7A59', doubt: '#FFAA00', appeal: '#E8384F' };
const RING = ['#D5D7E3', '#FFD43B', '#FF9F1C', '#FF4D6D', '#7B5CFF'];
const GLYPH = {
  pick: c => `<rect x="18.5" y="19" width="15" height="11" rx="2.4" fill="${c}"/><path d="M18.5 22.5h15" stroke="#fff" stroke-width="1.6"/><circle cx="29.5" cy="26.2" r="1.5" fill="#fff"/><path d="M22 18.5l3.5-3.5 2 2" fill="none" stroke="${c}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>`,
  snatch: c => `<path d="M28.5 13.5 19.5 25h6l-2.5 9.5 10-12.5h-6.2z" fill="${c}" stroke="${c}" stroke-width="1" stroke-linejoin="round"/>`,
  scam: c => `<text x="26" y="29.6" text-anchor="middle" font-size="17" font-weight="900" fill="${c}" font-family="Arial Black,Arial,sans-serif">?</text>`
};
const BODY = 'M26 59C26 59 5 37.5 5 23.5a21 21 0 0 1 42 0C47 37.5 26 59 26 59z';
function pin(type, status, ring) {
  const c = STATUS[status];
  const half = status === 'appeal' ? `<clipPath id="r"><rect x="26" y="0" width="30" height="62"/></clipPath><path d="${BODY}" fill="#3BA3FF" clip-path="url(#r)"/>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 62" width="80" height="96">
    <path d="${BODY}" fill="#fff" stroke="#fff" stroke-width="5.5" stroke-linejoin="round"/>
    <path d="${BODY}" fill="${c}" stroke="${RING[ring]}" stroke-width="3.4" stroke-linejoin="round"/>${half}
    <circle cx="26" cy="23.5" r="13" fill="#fff"/>${GLYPH[type](status === 'appeal' ? '#E8384F' : c)}</svg>`;
}
const TAB = {
  place: '<path d="M12 21s-6.5-6.2-6.5-11.2a6.5 6.5 0 0 1 13 0C18.5 14.8 12 21 12 21z"/><circle cx="12" cy="9.8" r="2.4"/>',
  appeal: '<path d="M4 5.5h16v10.5H10l-4.5 3.5v-3.5H4z"/><path d="M8 9.5h8M8 12.5h5"/>',
  me: '<circle cx="12" cy="8.2" r="3.8"/><path d="M4.5 20c.6-4 3.7-6.2 7.5-6.2s6.9 2.2 7.5 6.2"/>'
};
const tab = (k, color) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="81" height="81" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${TAB[k]}</svg>`;

(async () => {
  fs.mkdirSync(path.join(out, 'pins'), { recursive: true });
  fs.mkdirSync(path.join(out, 'tab'), { recursive: true });
  const b = await pw.chromium.launch(process.env.CHROME ? { executablePath: process.env.CHROME } : {});
  const p = await b.newPage({ deviceScaleFactor: 1 });
  async function render(svg, file) {
    await p.setContent(`<html><body style="margin:0;background:transparent">${svg}</body></html>`);
    await p.locator('svg').screenshot({ path: file, omitBackground: true });
  }
  let n = 0;
  for (const t of Object.keys(GLYPH)) for (const s of Object.keys(STATUS)) for (let r = 0; r < RING.length; r++) {
    await render(pin(t, s, r), path.join(out, 'pins', `${t}-${s}-${r}.png`)); n++;
  }
  for (const k of Object.keys(TAB)) {
    await render(tab(k, '#9AA0B4'), path.join(out, 'tab', `${k}.png`));
    await render(tab(k, '#6C5CE7'), path.join(out, 'tab', `${k}-on.png`));
  }
  await b.close();
  console.log('pins:', n, 'tabs:', Object.keys(TAB).length * 2);
})();

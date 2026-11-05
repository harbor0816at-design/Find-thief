// 把网站仓库里已核验的数据同步进小程序：城市表 → miniprogram/utils/cities.js，
// 公开快照 → cloudfunctions/api/data/。每次数据更新后运行：node weapp/scripts/build-data.cjs
'use strict';
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..', '..');
const out = path.join(__dirname, '..');

const cities = JSON.parse(fs.readFileSync(path.join(root, 'cities.json'), 'utf8')).map(c => ({
  country: c.country, name: c.name, lat: c.lat, lon: c.lon, located: c.located || {}
}));
fs.writeFileSync(path.join(out, 'miniprogram/utils/cities.js'),
  '// 自动生成：node weapp/scripts/build-data.cjs（来源 cities.json）\nmodule.exports = ' + JSON.stringify(cities) + ';\n');

const dataDir = path.join(out, 'cloudfunctions/api/data');
fs.mkdirSync(dataDir, { recursive: true });
for (const f of ['verified-events-v21.json', 'verified-uk-police-areas.json']) {
  fs.copyFileSync(path.join(root, 'data', f), path.join(dataDir, f));
}
console.log('cities:', cities.length, '· data copied to', path.relative(root, dataDir));

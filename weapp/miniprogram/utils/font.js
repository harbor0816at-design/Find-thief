// 字号设置：标准 / 大 / 特大。页面用 <page-meta root-font-size>，样式里文字一律用 rem。
const LEVELS = [
  { key: 'm', name: '标准', size: '16px' },
  { key: 'l', name: '大', size: '18px' },
  { key: 'xl', name: '特大', size: '20px' }
];
let current = 'm';
function load() {
  try { const v = wx.getStorageSync('xt.font'); if (LEVELS.some(l => l.key === v)) current = v; } catch (e) { /* 默认标准 */ }
  return current;
}
function get() { return current; }
function size() { return (LEVELS.find(l => l.key === current) || LEVELS[0]).size; }
function set(key) {
  if (!LEVELS.some(l => l.key === key)) return;
  current = key;
  try { wx.setStorageSync('xt.font', key); } catch (e) { /* 仅本次生效 */ }
}
module.exports = { LEVELS, load, get, set, size };

// 前端常量（与云函数 lib/rules.js 保持一致）
const TYPES = [
  { key: '扒窃', code: 'pick', desc: '没察觉就被掏走：口袋、包、桌上的手机' },
  { key: '抢夺', code: 'snatch', desc: '当面抢：飞车抢包、抢手机、扯项链' },
  { key: '诈骗套路', code: 'scam', desc: '签名请愿、送手环、假警察、帮买票等' }
];
const CODE = { '扒窃': 'pick', '抢夺': 'snatch', '诈骗套路': 'scam' };
const ITEMS = ['手机', '钱包/现金', '护照/证件', '银行卡', '包/背包', '相机/电脑', '首饰', '其他'];
const EVIDENCE = ['有报警回执', '有监控/视频', '当场发现', '多人遇到', '仅自述'];
const SLOTS = ['早上', '中午', '下午', '傍晚', '夜间'];
const APPEAL_REASONS = ['信息错误', '已过时', '已整改', '恶意标记', '其他'];
const STATUS_TEXT = { admin: '管理员判定', traveler: '未经警方确认', doubt: '存疑', appeal: '申诉处理中' };
const RING = [
  { range: '0 人', color: '#D5D7E3' },
  { range: '1–2 人', color: '#FFD43B' },
  { range: '3–5 人', color: '#FF9F1C' },
  { range: '6–10 人', color: '#FF4D6D' },
  { range: '11 人以上', color: '#7B5CFF' }
];
function pin(type, status, ring) {
  return '/images/pins/' + (CODE[type] || 'pick') + '-' + (status || 'traveler') + '-' + (ring || 0) + '.png';
}
// 当前开关下的主类别：已开启类别中记录最多的那个
function mainType(place, enabled) {
  let best = '', n = -1;
  TYPES.forEach(t => {
    const c = (place.typeCounts || {})[t.key] || 0;
    if (enabled[t.key] && c > n && c > 0) { best = t.key; n = c; }
  });
  return best;
}
function fmtTime(v) {
  if (!v) return '';
  const d = new Date(v);
  if (isNaN(d)) return String(v);
  const p = n => (n < 10 ? '0' : '') + n;
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
}
module.exports = { TYPES, CODE, ITEMS, EVIDENCE, SLOTS, APPEAL_REASONS, STATUS_TEXT, RING, pin, mainType, fmtTime };

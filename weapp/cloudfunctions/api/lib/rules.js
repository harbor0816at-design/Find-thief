// 小偷地图 · 共享规则：类别、图钉状态、审查人数分档、输入校验。
// 云函数与测试共用；小程序端 utils/rules.js 是同一份常量的前端副本。
'use strict';

const TYPES = ['扒窃', '抢夺', '诈骗套路'];
const ITEMS = ['手机', '钱包/现金', '护照/证件', '银行卡', '包/背包', '相机/电脑', '首饰', '其他'];
const EVIDENCE = ['有报警回执', '有监控/视频', '当场发现', '多人遇到', '仅自述'];
const SLOTS = ['早上', '中午', '下午', '傍晚', '夜间'];
const APPEAL_REASONS = ['信息错误', '已过时', '已整改', '恶意标记', '其他'];
const APPEAL_RESULTS = ['upheld', 'downgraded', 'removed', 'rejected'];
const APPEAL_TAGS = ['有警方说明', '已提供整改材料', '来源已更正', '地点位置有误', '记录已过时'];
// 证据强弱排序：列表只显示最强的两项
const EVIDENCE_ORDER = ['警方数据', '警方调查', '官方通报', '有报警回执', '有监控/视频', '当场发现', '多人遇到', '媒体报道', '仅自述'];

class UserError extends Error {}

function ringLevel(n) {
  n = Number(n) || 0;
  if (n <= 0) return 0;
  if (n <= 2) return 1;
  if (n <= 5) return 2;
  if (n <= 10) return 3;
  return 4;
}

// 把数据库里的地点文档变成地图/列表需要的精简结构
function derive(p) {
  const recs = Array.isArray(p.records) ? p.records : [];
  const typeCounts = {};
  let count = 0;
  let last = '';
  const ev = new Set();
  for (const r of recs) {
    const c = Math.max(1, Number(r.count) || 1);
    typeCounts[r.type] = (typeCounts[r.type] || 0) + c;
    count += c;
    if (r.date && String(r.date) > last) last = String(r.date);
    (Array.isArray(r.evidence) ? r.evidence : [r.evidence]).filter(Boolean).forEach(e => ev.add(e));
  }
  let status = recs.some(r => r.adminVerdict) ? 'admin' : 'traveler';
  if (p.appealState === 'pending') status = 'appeal';
  else if (p.appealState === 'downgraded') status = 'doubt';
  const reviews = (Number(p.agree) || 0) + (Number(p.disagree) || 0);
  return {
    id: p._id,
    name: p.name,
    names: p.names || [p.name],
    city: p.city,
    country: p.country || '',
    lat: p.lat,
    lon: p.lon,
    typeCounts,
    types: TYPES.filter(t => typeCounts[t]),
    status,
    reviews,
    agree: Number(p.agree) || 0,
    disagree: Number(p.disagree) || 0,
    ring: ringLevel(reviews),
    count,
    evidence: EVIDENCE_ORDER.filter(e => ev.has(e)).slice(0, 2),
    lastDate: last,
    appealState: p.appealState || ''
  };
}

function publicRecord(r) {
  return {
    date: r.date || '',
    type: r.type,
    item: r.item || '',
    evidence: Array.isArray(r.evidence) ? r.evidence : [r.evidence].filter(Boolean),
    adminVerdict: !!r.adminVerdict,
    summary: r.summary || '',
    sourceName: r.sourceName || '',
    sourceUrl: r.sourceUrl || '',
    caveat: r.caveat || '',
    count: Math.max(1, Number(r.count) || 1),
    origin: r.origin || 'official'
  };
}

function clean(v, max) {
  if (typeof v !== 'string') return '';
  return v.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max + 1);
}

const CONTACT_RE = /[\w.+-]+@[\w-]+\.[\w.-]+|(?:\+?\d[\d\s-]{8,}\d)|微信号|vx[:：]|wechat/i;

function isDate(s) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(s + 'T00:00:00Z');
  return !isNaN(d) && d.toISOString().slice(0, 10) === s;
}

function checkFiles(list) {
  if (list == null) return [];
  if (!Array.isArray(list) || list.length > 3) throw new UserError('最多上传 3 张图片');
  return list.map(f => {
    if (typeof f !== 'string' || !/^cloud:\/\/[\w.-]+\/[\w./-]+$/.test(f) || f.length > 300) throw new UserError('图片无效，请重新上传');
    return f;
  });
}

function validateReport(d, today) {
  d = d && typeof d === 'object' ? d : {};
  if (d.consent !== true) throw new UserError('请先阅读并同意《用户协议》和《隐私政策》');
  const placeName = clean(d.placeName, 60);
  if (placeName.length < 2 || placeName.length > 60) throw new UserError('请填写地点名称（2–60 字）');
  const city = clean(d.city, 30);
  if (!city || city.length > 30) throw new UserError('请选择城市');
  const lat = Number(d.lat), lon = Number(d.lon);
  if (!isFinite(lat) || !isFinite(lon) || lat < 27 || lat > 72 || lon < -32 || lon > 45) throw new UserError('请在地图上选择欧洲范围内的位置');
  if (!TYPES.includes(d.type)) throw new UserError('请选择遭遇类型');
  if (!ITEMS.includes(d.item)) throw new UserError('请选择被偷物品');
  if (!isDate(d.date) || d.date > today) throw new UserError('请选择正确的发生日期');
  const slot = d.slot ? String(d.slot) : '';
  if (slot && !SLOTS.includes(slot)) throw new UserError('时段无效');
  const evidence = Array.isArray(d.evidence) ? [...new Set(d.evidence)] : [];
  if (!evidence.length || evidence.some(e => !EVIDENCE.includes(e))) throw new UserError('请至少选择一项证据情况');
  const detail = clean(d.detail, 500);
  if (detail.length < 10 || detail.length > 500) throw new UserError('经过描述需 10–500 字');
  const placeId = d.placeId ? clean(d.placeId, 40) : '';
  return { placeId, placeName, city, lat: +lat.toFixed(5), lon: +lon.toFixed(5), type: d.type, item: d.item, date: d.date, slot, evidence, detail, images: checkFiles(d.images) };
}

function validateAppeal(d) {
  d = d && typeof d === 'object' ? d : {};
  if (d.consent !== true) throw new UserError('请先阅读并同意《隐私政策》');
  const placeId = clean(d.placeId, 40);
  if (!placeId) throw new UserError('请选择要申诉的地点');
  if (!APPEAL_REASONS.includes(d.reason)) throw new UserError('请选择申诉理由');
  const detail = clean(d.detail, 1000);
  if (detail.length < 10 || detail.length > 1000) throw new UserError('情况说明需 10–1000 字');
  const contact = clean(d.contact, 100);
  if (contact.length > 100) throw new UserError('联系方式过长');
  return { placeId, reason: d.reason, detail, contact, images: checkFiles(d.images) };
}

function validatePublicText(s, min, max, label) {
  const t = clean(s, max);
  if (t.length < min || t.length > max) throw new UserError(label + '需 ' + min + '–' + max + ' 字');
  if (CONTACT_RE.test(t)) throw new UserError(label + '含疑似联系方式，请删除后再发布');
  return t;
}

module.exports = {
  TYPES, ITEMS, EVIDENCE, SLOTS, APPEAL_REASONS, APPEAL_RESULTS, APPEAL_TAGS, EVIDENCE_ORDER,
  UserError, ringLevel, derive, publicRecord, clean, isDate, validateReport, validateAppeal, validatePublicText
};

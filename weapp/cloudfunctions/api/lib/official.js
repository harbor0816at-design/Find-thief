// 把仓库里已核验的公开数据（警方通报、媒体报道、英国警方开放数据）转成地点文档。
// 只做格式转换，不生成任何新点位。
'use strict';
const crypto = require('crypto');

function theftType(text) {
  text = String(text || '');
  if (/诈骗|骗|套路|假警察|手环|请愿|签名|scam|truffa|estafa/i.test(text)) return '诈骗套路';
  if (/抢|飞车|夺|snatch|scippo|tirón|robo con/i.test(text)) return '抢夺';
  return '扒窃';
}
const num = v => (v == null || v === '' ? NaN : Number(v));

function fromEvent(e) {
  const official = e.source_type === 'official_case' || e.confidence === 'official_record';
  return {
    city: e.city, country: e.country, spot: e.spot_name || '未命名地点', lat: num(e.lat), lon: num(e.lon),
    rec: {
      origin: 'official', type: theftType([e.short_summary, e.source_title, e.spot_name].join(' ')),
      adminVerdict: official, evidence: [e.source_type === 'official_case' ? '官方通报' : '媒体报道'],
      date: String(e.occurred_on || e.source_published_on || '').slice(0, 7), count: 1, item: e.item_category || '',
      summary: e.short_summary || '', sourceName: e.source_title || '', sourceUrl: e.source_url || '',
      caveat: e.location_precision === 'approx_area' ? '位置为约 2 公里范围的大致区域，不是精确案发点。' : ''
    }
  };
}

function fromRiskArea(a) {
  return {
    city: a.city, country: a.country, spot: a.spot_name || '警方调查区域', lat: num(a.lat), lon: num(a.lon),
    rec: {
      origin: 'official', type: theftType([a.sample_summary, a.spot_name].join(' ')), adminVerdict: true,
      evidence: ['警方调查'], date: String(a.last_incident_on || a.last_source_on || '').slice(0, 7),
      count: Math.max(1, (a.verified_event_count | 0) + (a.approved_visitor_reports | 0)),
      item: (a.common_item_categories || []).join('、'), summary: a.sample_summary || '',
      sourceName: '来源报道', sourceUrl: (a.source_urls || [])[0] || '',
      caveat: '这是一组案件的汇总，不等于逐条独立个案。'
    }
  };
}

function fromGrid(a) {
  const n = a.evidence_count | 0;
  return {
    city: a.city, country: a.country, spot: '警方公开数据网格（约 1 公里）', lat: num(a.lat), lon: num(a.lon),
    rec: {
      origin: 'official', type: '扒窃', adminVerdict: true, evidence: ['警方数据'],
      date: String(a.period_end || a.period_start || '').slice(0, 7), count: Math.max(1, n), item: '',
      summary: '统计期' + (a.period_start ? '（' + a.period_start + (a.period_end ? ' 至 ' + a.period_end : '') + '）' : '') + '内，该网格有 ' + n + ' 条「Theft from the person」英国警方公开记录。',
      sourceName: 'data.police.uk 英国警方开放数据', sourceUrl: a.source_url || 'https://data.police.uk/data/',
      caveat: '英国警方类别 Theft from the person 同时包含扒窃与抢夺；记录次数不代表遇窃概率。' + (a.license_note ? ' ' + a.license_note : '')
    }
  };
}

function placeKey(city, lat, lon) { return city + '|' + Number(lat).toFixed(3) + '|' + Number(lon).toFixed(3); }
function placeId(key) { return 'p' + crypto.createHash('sha1').update(key).digest('hex').slice(0, 20); }

function buildOfficialPlaces(events, gridAreas) {
  const ev = events && typeof events === 'object' ? events : {};
  if (ev.verified_public_snapshot !== true && !Array.isArray(ev.items)) return [];
  const all = [
    ...(ev.items || []).map(fromEvent),
    ...(ev.areas || []).map(fromRiskArea),
    ...((gridAreas && gridAreas.areas) || []).map(fromGrid)
  ].filter(x => x.city && isFinite(x.lat) && isFinite(x.lon));
  const groups = new Map();
  for (const x of all) {
    const key = placeKey(x.city, x.lat, x.lon);
    if (!groups.has(key)) groups.set(key, { _id: placeId(key), key, city: x.city, country: x.country || '', lat: +x.lat, lon: +x.lon, names: {}, records: [] });
    const g = groups.get(key);
    g.names[x.spot] = (g.names[x.spot] || 0) + 1;
    g.records.push(x.rec);
  }
  return [...groups.values()].map(g => {
    const names = Object.entries(g.names).sort((a, b) => b[1] - a[1]).map(e => e[0]);
    return { _id: g._id, key: g.key, city: g.city, country: g.country, lat: g.lat, lon: g.lon, name: names[0], names, records: g.records };
  });
}

module.exports = { theftType, fromEvent, fromRiskArea, fromGrid, placeKey, placeId, buildOfficialPlaces };

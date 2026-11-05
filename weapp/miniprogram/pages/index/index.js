const api = require('../../utils/api');
const R = require('../../utils/rules');
const font = require('../../utils/font');
const nav = require('../../utils/nav');
const CITIES = require('../../utils/cities');

const app = getApp();
function distM(a, b, c, d) {
  const k = Math.PI / 180, x = (d - b) * k * Math.cos((a + c) / 2 * k), y = (c - a) * k;
  return Math.sqrt(x * x + y * y) * 6371000;
}

Page({
  data: {
    rootFs: '16px', navTop: 88,
    cityLabels: CITIES.map(c => c.name + '（' + c.country + '）'), cityIdx: 0, cityName: '罗马',
    lat: 41.9028, lon: 12.4964, scale: 12, markers: [], showLoc: false,
    toggles: R.TYPES.map(t => ({ key: t.key, on: true, icon: R.pin(t.key, 'admin', 0) })),
    kw: '', results: [], showResults: false, searching: false,
    list: [], count: 0, loading: true, statusText: '正在读取有出处的记录…',
    guideFloat: true, guideShow: false, fontShow: false, poi: null,
    fontLevels: font.LEVELS, fontKey: 'm'
  },

  places: [],
  enabled: { '扒窃': true, '抢夺': true, '诈骗套路': true },

  onLoad(q) {
    let closed = false;
    try { closed = !!wx.getStorageSync('xt.guideClosed'); } catch (e) { /* 默认显示 */ }
    const want = q && q.city ? decodeURIComponent(q.city) : app.globalData.city;
    this.setData({ navTop: nav.top(), guideFloat: !closed });
    this.useCity(want, false);
  },
  onReady() {
    this.map = wx.createMapContext('map', this);
    if (this.map.initMarkerCluster) {
      this.map.initMarkerCluster({ enableDefaultStyle: true, zoomOnClick: true, gridSize: 56 });
    }
  },
  onShow() {
    this.setData({ rootFs: font.size(), fontKey: font.get() });
    if (this.needReload) { this.needReload = false; this.load(); }
  },
  onShareAppMessage() {
    return { title: '小偷地图｜出发前看看' + this.data.cityName + '哪里扒手多', path: '/pages/index/index?city=' + encodeURIComponent(this.data.cityName) };
  },
  onShareTimeline() {
    return { title: '小偷地图｜共建无扒之旅', query: 'city=' + encodeURIComponent(this.data.cityName) };
  },

  /* ---------- 城市与数据 ---------- */
  useCity(name, move) {
    let i = CITIES.findIndex(c => c.name === name);
    if (i < 0) i = Math.max(0, CITIES.findIndex(c => c.name === '罗马'));
    const c = CITIES[i];
    app.globalData.city = c.name;
    try { wx.setStorageSync('xt.city', c.name); } catch (e) { /* 忽略 */ }
    this.setData({ cityIdx: i, cityName: c.name, lat: c.lat, lon: c.lon, scale: 12, showResults: false });
    this.load();
  },
  onCity(e) { this.useCity(CITIES[+e.detail.value].name, true); },

  load() {
    const city = this.data.cityName;
    this.setData({ loading: true, statusText: '正在读取有出处的记录…', list: [], markers: [] });
    api.call('listPlaces', { city }).then(res => {
      if (city !== this.data.cityName) return;
      this.places = res.items || [];
      this.ready = res.ready !== false;
      this.setData({ loading: false });
      this.draw();
    }).catch(err => {
      this.places = [];
      this.setData({ loading: false, statusText: err.message + '。下拉或切换城市可重试。' });
    });
  },

  visible() {
    return this.places.map((p, i) => ({ p, i, type: R.mainType(p, this.enabled) })).filter(x => x.type);
  },

  draw() {
    const markers = this.visible().map(x => ({
      id: x.i, latitude: x.p.lat, longitude: x.p.lon,
      iconPath: R.pin(x.type, x.p.status, x.p.ring), width: 36, height: 43,
      anchor: { x: 0.5, y: 1 }, joinCluster: true
    }));
    this.setData({ markers });
    this.refreshList();
  },

  onRegion(e) { if (e.type === 'end') this.refreshList(); },

  refreshList() {
    const finish = bounds => {
      const city = this.data.cityName;
      const rows = this.visible().filter(x => {
        if (!bounds) return x.p.city === city;
        const sw = bounds.southwest, ne = bounds.northeast;
        return x.p.lat >= sw.latitude && x.p.lat <= ne.latitude && x.p.lon >= sw.longitude && x.p.lon <= ne.longitude;
      }).sort((a, b) => (b.p.status === 'admin') - (a.p.status === 'admin') || b.p.count - a.p.count).slice(0, 80);
      const list = rows.map(x => ({
        id: x.p.id, name: x.p.name, icon: R.pin(x.type, x.p.status, x.p.ring), status: x.p.status,
        statusText: R.STATUS_TEXT[x.p.status], mainType: x.type,
        addr: x.p.country + ' · ' + x.p.city + (x.p.names.length > 1 ? ' · 含附近 ' + x.p.names.length + ' 处地名' : ''),
        evText: (x.p.evidence.join(' · ') || '游客上报') + (x.p.count > 1 ? ' · ' + x.p.count + ' 条记录' : '')
      }));
      let statusText = '';
      if (!this.data.loading && !list.length) {
        if (!this.ready) statusText = '数据正在准备中，请稍后再来看看。';
        else if (!Object.keys(this.enabled).some(k => this.enabled[k])) statusText = '三个类别都已关闭，打开任意一个即可查看。';
        else if (!this.places.length) statusText = this.data.cityName + '暂时还没有已审核的标记。你遇到过小偷？点击地图上的地点即可上报。';
        else statusText = '当前区域暂无已标记地点。缩小地图可以看到更多。';
      }
      this.setData({ list, count: list.length, statusText });
    };
    if (!this.map) return finish(null);
    this.map.getRegion({ success: finish, fail: () => finish(null) });
  },

  onToggle(e) {
    const k = e.currentTarget.dataset.k;
    this.enabled[k] = !this.enabled[k];
    this.setData({ toggles: this.data.toggles.map(t => Object.assign({}, t, { on: !!this.enabled[t.key] })) });
    this.draw();
  },

  /* ---------- 打开地点 ---------- */
  onMarker(e) {
    const p = this.places[e.detail.markerId];
    if (p) wx.navigateTo({ url: '/pages/place/place?id=' + p.id });
  },
  openPlace(e) { wx.navigateTo({ url: '/pages/place/place?id=' + e.currentTarget.dataset.id }); },

  nearest(lat, lon) {
    let best = null, d = 250;
    this.places.forEach(p => { const m = distM(lat, lon, p.lat, p.lon); if (m < d) { d = m; best = p; } });
    return best;
  },
  onPoi(e) {
    const d = e.detail || {};
    if (!isFinite(d.latitude)) return;
    this.setData({ poi: { name: d.name || '地图上的位置', lat: d.latitude, lon: d.longitude, near: this.nearest(d.latitude, d.longitude) } });
  },
  onMapTap(e) {
    const d = e.detail || {};
    if (!isFinite(d.latitude) || this.data.showResults) { this.setData({ showResults: false }); return; }
    this.setData({ poi: { name: '地图上选中的位置', lat: d.latitude, lon: d.longitude, near: this.nearest(d.latitude, d.longitude) } });
  },
  closePoi() { this.setData({ poi: null }); },
  openPoiNear() { const p = this.data.poi.near; this.setData({ poi: null }); wx.navigateTo({ url: '/pages/place/place?id=' + p.id }); },
  reportPoi() {
    const p = this.data.poi;
    app.globalData.pendingPlace = { name: p.name === '地图上选中的位置' ? '' : p.name, lat: p.lat, lon: p.lon, city: this.data.cityName, placeId: p.near ? p.near.id : '' };
    this.setData({ poi: null });
    this.needReload = true;
    wx.navigateTo({ url: '/pages/report/report' });
  },
  navPoi() { const p = this.data.poi; wx.openLocation({ latitude: p.lat, longitude: p.lon, name: p.name, scale: 16 }); },

  locate() {
    wx.getLocation({
      type: 'gcj02',
      success: r => { this.setData({ lat: r.latitude, lon: r.longitude, scale: 15, showLoc: true }); },
      fail: () => api.toast('没有获取到位置，可在设置中允许使用位置信息')
    });
  },

  /* ---------- 搜索 ---------- */
  onKw(e) { this.setData({ kw: e.detail.value }); },
  onSearch() {
    const q = (this.data.kw || '').trim();
    if (!q) { this.setData({ showResults: false }); return; }
    const lq = q.toLowerCase(), out = [];
    this.places.forEach(p => { if (p.names.some(n => n.toLowerCase().indexOf(lq) >= 0)) out.push({ key: 'p' + p.id, name: p.name, sub: '已标记 · ' + p.country + p.city, lat: p.lat, lon: p.lon, city: p.city, id: p.id }); });
    CITIES.forEach(c => {
      if (c.name.indexOf(q) >= 0) out.push({ key: 'c' + c.name, name: c.name, sub: '城市 · ' + c.country, lat: c.lat, lon: c.lon, city: c.name, zoom: 12 });
      Object.keys(c.located).forEach(s => { if (s.toLowerCase().indexOf(lq) >= 0) out.push({ key: 's' + c.name + s, name: s, sub: '景点 · ' + c.country + c.name, lat: c.located[s][0], lon: c.located[s][1], city: c.name }); });
    });
    this.setData({ results: out.slice(0, 8), showResults: true, searching: out.length < 3 });
    if (out.length >= 3) return;
    api.call('search', { city: this.data.cityName, q }).then(res => {
      (res.items || []).forEach(p => { if (!out.some(o => o.id === p.id)) out.push({ key: 'r' + p.id, name: p.name, sub: '已标记 · ' + p.country + p.city, lat: p.lat, lon: p.lon, city: p.city, id: p.id }); });
    }).catch(() => {}).then(() => this.setData({ results: out.slice(0, 8), searching: false }));
  },
  pickResult(e) {
    const it = this.data.results[e.currentTarget.dataset.i];
    this.setData({ showResults: false });
    if (it.city && it.city !== this.data.cityName) {
      this.useCity(it.city, true);
    }
    this.setData({ lat: it.lat, lon: it.lon, scale: it.zoom || 16 });
    if (it.id) wx.navigateTo({ url: '/pages/place/place?id=' + it.id });
  },

  /* ---------- 说明与字号 ---------- */
  openGuide() { this.setData({ guideShow: true }); },
  closeGuide() { this.setData({ guideShow: false }); },
  closeFloat() { this.setData({ guideFloat: false }); try { wx.setStorageSync('xt.guideClosed', 1); } catch (e) { /* 忽略 */ } },
  openFont() { this.setData({ fontShow: true }); },
  closeFont() { this.setData({ fontShow: false }); },
  setFont(e) { font.set(e.currentTarget.dataset.k); this.setData({ fontKey: font.get(), rootFs: font.size() }); }
});

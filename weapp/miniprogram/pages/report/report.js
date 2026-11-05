const api = require('../../utils/api');
const R = require('../../utils/rules');
const font = require('../../utils/font');
const CITIES = require('../../utils/cities');
const app = getApp();

function ymd(d) { const p = n => (n < 10 ? '0' : '') + n; return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()); }

Page({
  data: {
    rootFs: '16px', done: false, sending: false,
    city: '', placeId: '', placeName: '', lat: 0, lon: 0, latText: '', lonText: '',
    types: R.TYPES.map(t => ({ key: t.key, desc: t.desc, icon: R.pin(t.key, 'admin', 0) })), type: '',
    items: R.ITEMS, itemSel: '', slots: R.SLOTS, slot: '',
    evOpts: R.EVIDENCE.map(k => ({ key: k, on: false })),
    date: '', today: ymd(new Date()), minDate: ymd(new Date(Date.now() - 3 * 365 * 864e5)),
    detail: '', images: [], consent: false
  },

  onLoad() {
    const p = app.globalData.pendingPlace || {};
    app.globalData.pendingPlace = null;
    this.setData({ city: p.city || app.globalData.city, placeId: p.placeId || '', placeName: p.name || '' });
    if (isFinite(p.lat) && p.lat) this.setLoc(p.lat, p.lon);
  },
  onShow() { this.setData({ rootFs: font.size() }); },

  setLoc(lat, lon) { this.setData({ lat, lon, latText: lat.toFixed(4), lonText: lon.toFixed(4) }); },
  chooseLoc() {
    const c = CITIES.find(x => x.name === this.data.city) || {};
    wx.chooseLocation({
      latitude: this.data.lat || c.lat, longitude: this.data.lon || c.lon,
      success: r => {
        this.setLoc(r.latitude, r.longitude);
        const patch = { placeId: '' };
        if (r.name && !this.data.placeName) patch.placeName = r.name;
        this.setData(patch);
      },
      fail: e => { if (!/cancel/.test(e.errMsg || '')) api.toast('无法打开选点，可回到地图点击位置后上报'); }
    });
  },
  onName(e) { this.setData({ placeName: e.detail.value }); },
  pickType(e) { this.setData({ type: e.currentTarget.dataset.v }); },
  pickItem(e) { this.setData({ itemSel: e.currentTarget.dataset.v }); },
  pickSlot(e) { const v = e.currentTarget.dataset.v; this.setData({ slot: this.data.slot === v ? '' : v }); },
  pickEv(e) {
    const i = e.currentTarget.dataset.i;
    const evOpts = this.data.evOpts.map((o, j) => {
      if (j === i) return { key: o.key, on: !o.on };
      // 「仅自述」与其他证据互斥
      if (this.data.evOpts[i].key === '仅自述' || o.key === '仅自述') return { key: o.key, on: false };
      return o;
    });
    this.setData({ evOpts });
  },
  onDate(e) { this.setData({ date: e.detail.value }); },
  onDetail(e) { this.setData({ detail: e.detail.value }); },
  addImg() {
    wx.chooseMedia({
      count: 3 - this.data.images.length, mediaType: ['image'], sizeType: ['compressed'],
      success: r => this.setData({ images: this.data.images.concat(r.tempFiles.map(f => f.tempFilePath)).slice(0, 3) })
    });
  },
  delImg(e) { const a = this.data.images.slice(); a.splice(e.currentTarget.dataset.i, 1); this.setData({ images: a }); },
  toggleConsent() { this.setData({ consent: !this.data.consent }); },
  openTerms() { wx.navigateTo({ url: '/pages/doc/doc?t=terms' }); },
  openPrivacy() { wx.navigateTo({ url: '/pages/doc/doc?t=privacy' }); },

  submit() {
    const d = this.data;
    const ev = d.evOpts.filter(o => o.on).map(o => o.key);
    const miss = !d.placeName.trim() ? '请填写地点名称' : !d.lat ? '请在地图上选择位置' : !d.type ? '请选择遇到了什么'
      : !d.itemSel ? '请选择被偷了什么' : !d.date ? '请选择日期' : !ev.length ? '请至少选择一项证据情况'
      : d.detail.trim().length < 10 ? '经过至少写 10 个字' : !d.consent ? '请先勾选确认和同意' : '';
    if (miss) return api.toast(miss);
    this.setData({ sending: true });
    const up = d.images.length ? api.upload(d.images) : Promise.resolve([]);
    up.then(images => api.call('submitReport', { data: {
      placeId: d.placeId, placeName: d.placeName.trim(), city: d.city, lat: d.lat, lon: d.lon, type: d.type,
      item: d.itemSel, date: d.date, slot: d.slot, evidence: ev, detail: d.detail.trim(), images, consent: true
    } })).then(() => {
      this.setData({ done: true, sending: false });
      wx.pageScrollTo({ scrollTop: 0, duration: 0 });
    }).catch(e => { this.setData({ sending: false }); api.toast(e.message); });
  },
  toMine() { wx.redirectTo({ url: '/pages/my-reports/my-reports' }); },
  back() { wx.navigateBack({ fail: () => wx.switchTab({ url: '/pages/index/index' }) }); }
});

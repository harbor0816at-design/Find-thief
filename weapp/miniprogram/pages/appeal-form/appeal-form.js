const api = require('../../utils/api');
const R = require('../../utils/rules');
const font = require('../../utils/font');
const CITIES = require('../../utils/cities');
const app = getApp();

Page({
  data: {
    rootFs: '16px', done: false, sending: false,
    cityNames: CITIES.map(c => c.name), cityIdx: 0, city: '',
    placeId: '', placeName: '', kw: '', found: [], finding: false, searched: false,
    reasons: R.APPEAL_REASONS, reason: '', detail: '', contact: '', images: [], consent: false
  },
  onLoad(q) {
    const city = q.city ? decodeURIComponent(q.city) : app.globalData.city;
    this.setData({ city, cityIdx: Math.max(0, CITIES.findIndex(c => c.name === city)), placeId: q.id || '', placeName: q.name ? decodeURIComponent(q.name) : '' });
  },
  onShow() { this.setData({ rootFs: font.size() }); },
  onCity(e) { this.setData({ cityIdx: +e.detail.value, city: CITIES[+e.detail.value].name, found: [], searched: false }); },
  onKw(e) { this.setData({ kw: e.detail.value }); },
  find() {
    const q = this.data.kw.trim();
    if (!q) return api.toast('请输入地点名称');
    this.setData({ finding: true });
    api.call('search', { city: this.data.city, q }).then(r => this.setData({ found: r.items, searched: true }))
      .catch(e => api.toast(e.message)).then(() => this.setData({ finding: false }));
  },
  pick(e) { const p = this.data.found[e.currentTarget.dataset.i]; this.setData({ placeId: p.id, placeName: p.name, city: p.city }); },
  clearPlace() { this.setData({ placeId: '', placeName: '' }); },
  pickReason(e) { this.setData({ reason: e.currentTarget.dataset.v }); },
  onDetail(e) { this.setData({ detail: e.detail.value }); },
  onContact(e) { this.setData({ contact: e.detail.value }); },
  addImg() {
    wx.chooseMedia({ count: 3 - this.data.images.length, mediaType: ['image'], sizeType: ['compressed'],
      success: r => this.setData({ images: this.data.images.concat(r.tempFiles.map(f => f.tempFilePath)).slice(0, 3) }) });
  },
  delImg(e) { const a = this.data.images.slice(); a.splice(e.currentTarget.dataset.i, 1); this.setData({ images: a }); },
  toggleConsent() { this.setData({ consent: !this.data.consent }); },
  openPrivacy() { wx.navigateTo({ url: '/pages/doc/doc?t=privacy' }); },
  submit() {
    const d = this.data;
    const miss = !d.placeId ? '请先选择被标记的地点' : !d.reason ? '请选择申诉理由' : d.detail.trim().length < 10 ? '情况说明至少 10 个字' : !d.consent ? '请先勾选确认' : '';
    if (miss) return api.toast(miss);
    this.setData({ sending: true });
    (d.images.length ? api.upload(d.images) : Promise.resolve([]))
      .then(images => api.call('submitAppeal', { data: { placeId: d.placeId, reason: d.reason, detail: d.detail.trim(), contact: d.contact.trim(), images, consent: true } }))
      .then(() => this.setData({ done: true, sending: false }))
      .catch(e => { this.setData({ sending: false }); api.toast(e.message); });
  },
  toList() { wx.switchTab({ url: '/pages/appeal/appeal' }); }
});

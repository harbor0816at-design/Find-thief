const font = require('./utils/font');
const cfg = require('./utils/config');

App({
  globalData: { city: '伦敦', pendingPlace: null },
  onLaunch() {
    if (!wx.cloud) {
      wx.showModal({ title: '版本过低', content: '请升级微信后再使用小偷地图', showCancel: false });
      return;
    }
    wx.cloud.init({ env: cfg.cloudEnv || undefined, traceUser: true });
    try {
      const c = wx.getStorageSync('xt.city');
      if (c) this.globalData.city = c;
    } catch (e) { /* 读取失败用默认城市 */ }
    font.load();
  }
});

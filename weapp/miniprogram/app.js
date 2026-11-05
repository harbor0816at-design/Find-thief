const font = require('./utils/font');

App({
  globalData: { city: '罗马', pendingPlace: null },
  onLaunch() {
    if (!wx.cloud) {
      wx.showModal({ title: '版本过低', content: '请升级微信后再使用小偷地图', showCancel: false });
      return;
    }
    // 使用开发者工具里选中的云开发环境，不在代码里写死环境 ID
    wx.cloud.init({ env: wx.cloud.DYNAMIC_CURRENT_ENV, traceUser: true });
    try {
      const c = wx.getStorageSync('xt.city');
      if (c) this.globalData.city = c;
    } catch (e) { /* 读取失败用默认城市 */ }
    font.load();
  }
});

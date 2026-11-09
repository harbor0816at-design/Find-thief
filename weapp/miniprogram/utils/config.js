// 上线前必填：运营者信息会显示在《隐私政策》和《用户协议》中，需与小程序后台的主体信息一致。
module.exports = {
  cloudEnv: 'cloud1-d3g0dog0f49565148', // 云开发环境 ID（不是密钥，可以公开）
  operator: '江海波',        // 运营者名称（个人主体填姓名，企业主体填公司全称）
  contactEmail: '289021604@qq.com',    // 用户联系、个人信息请求的邮箱
  updated: '2026-11-06',
  // 可选：腾讯位置服务「个性化地图」。在 lbs.qq.com 创建 Key 并绑定本小程序 AppID，
  // 编辑好样式后把 Key 填到 mapSubkey、样式编号填到 mapLayerStyle。留空则使用微信默认底图（免费、无需 Key）。
  mapSubkey: '',
  mapLayerStyle: 1
};

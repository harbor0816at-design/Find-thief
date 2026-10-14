# 小偷在哪里 Find Thief — V1.0 公共基础版

面向中国赴欧洲旅行人群的中文 PC / H5 出行安全资料工具。

**网站**：https://find-thief.vercel.app/  
**GitHub**：https://github.com/harbor0816at-design/Find-thief  
**部署**：Vercel，从 `main` 分支自动部署到生产环境。

## 已发布功能

- 18 个中国游客热门欧洲旅游国家、51 个城市、224 个景点的中文目录与交互查询。
- Leaflet + OpenStreetMap 默认地图，城市及已定位景点标记，可跳转 Google Maps。
- 可选 Google Maps JavaScript API 切换模式：需要用户自行提供受访问域名限制的 Browser API Key；**站点尚未配置运营方的 API Key**。
- 51 个欧洲及跨欧亚国家/地区的紧急电话号码、来源链接、点击拨号、中国外交部 12308 领保提示。
- 失窃经过的**本机记录**：仅保存浏览器 localStorage，不会提交后端；可查看、导出和删除。
- PC / H5 响应式布局、隐私说明 `/privacy.html`、使用条款 `/terms.html`。
- 基础安全响应头、robots.txt 和 sitemap.xml。

## 当前能力边界（必须阅读）

- **没有真实失窃案件数据库，也没有实时犯罪预警**。地图上的点均为城市或景点，不代表犯罪高发区。
- 没有批量采集小红书、微博、Instagram、Facebook、Pickpocket Alert 等来源的内容；第三方竞品只作为来源链接。
- 没有正式上线的用户账号、服务器端举报接收、审核、广告销售、付款、推送提醒。
- 需要在引入云端投稿、广告或收费之前明确运营法律主体、非公开隐私请求的联系渠道，并完成适用的隐私与广告合规流程。
- Google Maps 站内地图需合法配置 Google Cloud API Key 与计费；无需 Key 时可使用默认地图或跳转 Google Maps。

## 技术与发布

静态站点，直接部署整个仓库根目录。Vercel Framework Preset: Other；无需构建指令。Vercel 读取根目录 `index.html` 和 `vercel.json`。

生产环境不需要服务端密钥；浏览器 Key 不得采用无域名/无 API 限制的形式部署。每次向 `main` 推送，Vercel 会自动执行生产部署。

## 数据与免责

`cities.json`：目的地目录  
`emergency.json`：紧急电话号码及来源  
`emergency-51-countries.csv`：紧急电话 CSV  
`sources.json`：已登记的第三方来源及许可状态

所有紧急电话在出行前仍应对照当地政府网站复核。存在人身紧急危险时请直接拨打当地官方紧急号码，不要依赖本网站完成报警。

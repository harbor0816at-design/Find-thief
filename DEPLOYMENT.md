# Vercel 部署与 GitHub 自动更新

仓库：`harbor0816at-design/Find-thief`，生产分支：`main`。

## 从 GitHub 导入 Vercel

1. 登录 https://vercel.com/new ，选择拥有该仓库访问权限的 Vercel Team。
2. 选择 **Import Git Repository** → GitHub → `harbor0816at-design/Find-thief`。
3. 若未看到仓库，在 GitHub 的 Settings → Applications → Installed GitHub Apps → Vercel → Configure 为该仓库授权访问。
4. Framework Preset 选择 **Other**。Root Directory 为 `./`，无需 Build Command，也无需 Output Directory。
5. 点击 **Deploy**。完成后在 Vercel **Project Settings → Git** 核实 GitHub 仓库和生产分支 `main`。
6. 后续推送到 `main` 将自动触发生产部署；其他分支可触发预览部署，具体以 Vercel 项目设置为准。

## 地图与数据说明

- 未设置 Google Maps API Key 时默认使用 OpenStreetMap 底图。Google 地图模式需用户在网站端配置浏览器API Key，并在 Google Cloud 开通 Maps JavaScript API、计费及域名限制。
- `index.html` 内嵌演示数据，可独立作为静态页面部署。`cities.json`、`emergency.json`、`sources.json` 为相同数据的独立镜像。
- 项目当前不包含真实警情采集后端、自动审核/抓取服务或商业交易功能。请勿把演示页面描述成实时警情预警服务。
- 请不要向公共 GitHub 仓库提交任何 Google Maps API Key（若启用浏览器 Key 必须限制 HTTP Referer）、服务器 Token 或私密配置。

## 当前连接状态

2026-10-14：通过连接工具提交仓库成功；自动创建 Vercel Git 项目返回 403（Vercel 连接账号缺少创建项目权限），因此 Git 联动需由具备该 Vercel Team 权限的成员在网页端完成。

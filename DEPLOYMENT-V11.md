# 小偷在哪里 · V1.1 运行与发布手册

## 已提供
- PC/H5 同页长滚动（手机地图上/城市与急救内容下）。
- 51处城市通用提醒区域 + 17处来自外部公开城市安全指南的地标周边示意区域；不代表已证实案发区域。
- "丢失提醒" 要求具体地标/地址、事发日期、类型、简述，可地图选点，可本机留存。
- `/admin.html`：展示 GitHub 提交与来源元数据监控；独立数据库就绪后启用管理员登录及审核。
- `/api/health`、`/api/config`、`/api/reports`、`/api/admin` Vercel Functions；未配置后端时禁止在线投稿。
- robots 遵守的公开 HTML 元数据检查脚本 `scripts/crawl_public.py`；不会抓取未获许可的竞品事件库。

## 真正启用跨游客上报（另需独立数据库）
**切勿连接其他项目数据库或公用服务密钥。** 在 Supabase 的新独立项目 SQL Editor 中执行 `supabase/schema.sql`；检查 RLS 是否启用、匿名和普通用户均没有直读或修改 `loss_reports` 的权限。然后在 *Vercel 项目环境变量* 配置：

- `SUPABASE_URL`：新项目 URL
- `SUPABASE_SERVICE_ROLE_KEY`：服务端 secret，只能作为加密的 Server 环境变量
- `SUPABASE_PUBLISHABLE_KEY`：浏览器可用 publishable key
- `ADMIN_EMAILS`：管理员邮箱白名单，逗号分隔
- `ENABLE_PUBLIC_REPORTING=true`：仅在风控、隐私政策、滥用防护及审核人员就绪后设置

在该 Supabase 项目 Auth 控制台注册并验证该管理员邮箱。不要将服务密钥提交 GitHub，也不要把管理员邮箱白名单视为单独的认证措施。

首次上线前需要追加稳定的外部 rate limiting / CAPTCHA / 恶意内容过滤、隐私主体信息与 GDPR 合规检查。本项目内存防刷只是基础防护，无法代替生产级限流。应有敏感个人信息处置和删除流程。

## 地图供应商
- 默认 OSM 公共瓦片仅供低流量预览，遵守 OSMF 使用政策；**不建议作为广告业务高流量生产图层**。
- 正式商业推荐 Stadia Maps Starter（约 $20/月，取决于实际用量和方案）；支持从地图模式输入域名受限的 Stadia key。
- 也可继续切换 Google Maps（需启用 Maps JavaScript API 和账单），或进一步用 Protomaps PMTiles + MapLibre 自托管瓦片降低长期成本。

## 数据来源
- ICGC Crime Map 公布加泰罗尼亚警区统计，不能直接重命名成准确盗窃点。
- PickpocketMaps 的公开城市安全指南可作为独立编辑的出行提示资料线索，但不能未经授权复制平台的事件数据库。
- MineCrime 的地理编码原始犯罪数据属于商业数据服务，未经许可不采集其数据库。
- 小红书、微博、Meta/Instagram：遵守 robots、访问条款及个人信息规范；不绕过验证码、登录墙或反爬控制；未授权只保留访问入口。
- `scripts/crawl_public.py` 只监测页面 HTML 标题、HTTP 状态，不保存评论、个人信息或案件数据。`.github/workflows/source-monitor.yml` 计划每天 06:22 UTC 自动更新状态，如果 GitHub Actions 权限允许。

## 医疗报警等重要信息
51个国家/地区的综合、警察、急救、消防电话已写在 `emergency.json`，仅在验证到专线时显示专线，未验证不得编造。手机端可点拨。当地遇人身危险首先使用紧急电话。普通失窃应至警局报案，联系中国驻当地使领馆，国内领保热线 +86 10 12308 或 +86 10 65612308。

## 验收要点
1. 移动设备打开首页能向下连续滚动到所有国家应急电话。
2. 选择巴塞罗那后能看到绿色一般提示区域及黄色“外部指南地标附近”示意区，弹窗有源站链接。
3. 丢失提醒必须填写详细位置，不可仅城市；地图选点坐标需用户确认。
4. 无后台配置时，填写内容仅保存本机并明确反馈“不会进入审核队列”。
5. `/admin.html` 无管理员令牌不得暴露原始上报地址；未配置独立后端时只能查看公共工程状态。
6. 真实游客上报只有管理员人工批准后，才按约1km模糊坐标呈现为区域，不显示原始地址和个人信息。
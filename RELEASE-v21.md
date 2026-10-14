# 小偷在哪里 V2.1（2026-10-14）
本版仍使用原 GitHub 仓库、独立 Supabase 和 Vercel 项目，无新付费服务。

## 交付
- 地图：所有具备精确度足够的已审核警方网格和报告，按 **半径2000米片状缓冲圈** 渲染；**不是实际发生范围/危险半径**。全市级和国别安全资料不绘制盗窃圈。仅景区参考信息采用蓝色虚线2公里圈，明确不是案发点。
- 导航四入口：查盗窃发生地、匿名报失、丢了东西怎么办、防窃指南。
- 丢失处理：手机、银行卡钱包、证件护照、行李；欧盟112只限紧急情况。中国领保+86-10-12308/65612308，旅行证向当地驻外使领馆申请。信息链接来自官方。
- 防窃指南：地铁/公交、景区排队、餐厅、交通住宿等场景化清单。
- 好友分享：顶栏“↗分享给朋友”，手机系统分享（可选微信），微信内按右上角菜单分享，其他情况复制城市深链或指南链接。**未接入微信已签名JS-SDK，因此不能保证点击后无需用户确认直接发送给微信好友。**
- 数据：`scripts/collect_media_leads.py` 使用 GDELT 免费开放新闻检索 DOC 2.0 API，12组中文及英法西意文关键词、5重点城市、每周2次。只储存标题、URL、来源和发布时间、可能提及的失物类别及待审状态。不会读取并复制全文、绕过社交媒体反爬或把新闻发表时间当成案发时间。
- 公开媒体候选 `data/media-leads-v21.json` 只展示为**待核验新闻线索**，不能当作警方案件计数或热点风险。
- 小红书、微博及其他第三方社交来源，平台公开不自动等于商业采集与再发布许可；仅登记需授权或人工审核渠道。本版本尚未打通它们的直接自动API。
- 中国境内网络与微信浏览器的实际性能仍需现场测试；游客真实上传仍受生产开关 `ENABLE_PUBLIC_REPORTING=false` 控制。

## 官方参考
- 欧盟112：https://europa.eu/youreurope/citizens/travel/security-and-emergencies/emergency/index_en.htm
- 中国护照/旅行证：https://www.mfa.gov.cn/wjbzwfwpt/byw/hzlxz/
- 中国12308：https://cs.mfa.gov.cn/zggmcgx/lsbhyxz/12308lbrx/202607/t20260713_11981004.html
- Apple失窃后保护：https://support.apple.com/en-ie/120837
- Android设备查找保护：https://support.google.com/android/answer/6160491
- GDELT 官方 DOC 2.0：https://blog.gdeltproject.org/gdelt-doc-2-0-api-debuts/
- Reddit于2026-10-08公告其RSS将于2026-11-13停止：https://support.reddithelp.com/hc/en-us/articles/54353370049684-Changelog-October-8-2026

## 2026-10-14 production data confirmation

- Vercel Production READY; latest public site with four tabs plus WeChat/system friend-sharing entry.
- Independent Supabase `tourist_places_v21`: 51 cities, 224 named attractions, 78 with curated approximate directory coordinates; place listing is not proof of theft.
- Existing official UK police aggregated area grid: 74 cells in sampled London tourist locations.
- Public multi-country cited travel/statistical advisories: 14 entries (not individual incidents).
- `evidence_events_v2`: 8 individually sourced events in Rome and Milan. Four have explicit occurrence dates; remaining four display source publication date separately and leave occurrence unknown. Public static backup: `data/verified-events-v21.json`, used only when approved event API is unavailable. Future withdrawals must update the public snapshot as well.
- Items in anonymous loss reports expanded from 8 to **13 options** including smartwatch, headphones, laptop, suitcase and keys. No submitted visitor records are fabricated.
- Registered sources: 19 including GDELT API, Weibo, Xiaohongshu and Reddit as permission-gated source entries. Those social platforms are **not automatically crawled**.
- GDELT initial real run produced HTTP 429 and **zero eligible automated headlines**; diagnostics preserved in `data/media-leads-v21.json`. Public Euronews RSS fallback and workflow push-conflict recovery added; do not advertise news crawling as a currently stable 24/7 data feed.
- Production user reporting still disabled; China/mobile/WeChat device-level tests and external API end-to-end tests not yet completed. GDELT/RSS are discovery leads only, not crime statistics.

# 小偷在哪里 · 独立数据库、审核及线上投稿部署说明（V1.2）

**不要将本应用数据导入、合并或关联任何其他项目的数据库。**

## 当前状态

前端公开版和后端服务代码已纳入 GitHub。**专属 Supabase 项目已于2026-10-14创建成功**（项目 `find-thief-europe` / ID `smwqqiebkdaheikihbrg` / EU Frankfurt），初始迁移 `init_find_thief_reports_and_moderation` 已应用并验证，两张业务表均开启 RLS，初始零记录。`ENABLE_PUBLIC_REPORTING` 默认为关闭，用户稿件保留在浏览器，不会被误导为已经在线提交成功。

## 独立的 Supabase 项目

1. **已完成**：在 `harbor0816at@gmail.com's Org` 下创建独立数据库 `find-thief-europe`（EU Frankfurt）。
2. **已完成**：`supabase/schema.sql` 已在独立库执行，并确认 `loss_reports` / `moderation_audit` 均为 RLS 启用。严禁在其他项目重复执行。
3. 数据表 `loss_reports` 和 `moderation_audit` 开启了 RLS，已禁用匿名/普通已认证用户的直接读写；只有服务端 `service_role` 能够访问。
4. 通过 Supabase Auth > Users 单独**邀请管理员**，并启用邮箱确认；不公开管理员注册入口。配置 `ADMIN_EMAILS` 白名单，仅允许白名单中的已验证账号进行审核。建议在全部管理员完成 MFA 设置后启用 `REQUIRE_ADMIN_MFA=true`。
5. 在管理员后台检查事件审批流程：提交（pending）→ 审核、匿名摘要、模糊区域坐标 → 批准（approved）或拒绝（rejected）。数据库触发器同事务记录审核操作。

## Vercel 环境变量（Production）

**2026-10-14 状态：** `SUPABASE_URL`、`SUPABASE_PUBLISHABLE_KEY`、`ENABLE_PUBLIC_REPORTING=false`、`REPORT_RATE_SECRET`、`CRON_SECRET` 已安全配置（不在 GitHub 中保存密钥）。`SUPABASE_SERVICE_ROLE_KEY`、`ADMIN_EMAILS`、`DATA_CONTROLLER_NAME`、`DATA_CONTROLLER_EMAIL` 尚未配置，投稿继续关闭。为防止密钥泄露，必须从专用 Supabase 项目的 API Keys 页面复制服务端密钥，直接在 Vercel 项目环境变量界面设置；不要发到聊天或源码中。配置完成后重新触发 Production 部署，进行端到端测试后才可把开关改为 true。

| Key | 用途 |
| --- | --- |
| `SUPABASE_URL` | 独立项目 URL，格式 `https://<project-ref>.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | **仅服务器端** service_role 密钥（sensitive/encrypted，不允许公开） |
| `SUPABASE_PUBLISHABLE_KEY` | 仅用于管理员登录流程的公开密钥 |
| `ADMIN_EMAILS` | 允许管理员邮箱，逗号分隔，须创建并验证这些账号 |
| `REPORT_RATE_SECRET` | 至少32字节的独立随机秘密，仅服务器使用，用于防重复提交摘要 |
| `DATA_CONTROLLER_NAME` | 面向用户公开的运营责任主体名称 |
| `DATA_CONTROLLER_EMAIL` | 公开的非私人隐私请求邮箱 |
| `CRON_SECRET` | 至少32字节随机秘密，Vercel Cron 调用每日清理任务时提供 |
| `ENABLE_PUBLIC_REPORTING` | 只有迁移、审核权限、隐私告知、数据测试均通过后，才设为 `true` |
| `REQUIRE_ADMIN_MFA` | 可选。所有管理员已经绑定第二因素后设置 `true` |

- 请只在 Vercel Secret Environment Variables 中填写密钥，不要在 GitHub、网页、本地 public 文件中提交。
- Supabase 运营主体、数据处理协议、域外传输、隐私联系渠道和紧急电话维护应完成独立的运营合规评估。
- 开通可收费广告合作前，还须另行准备广告标签、商户审核、发票和税务主体。

## 数据与隐私边界

- 上报需要具体地址、发生日期、事件类别、基本经过和主动勾选同意；不接受照片、姓名、联系方式或可识别嫌疑人描述。
- 入库数据默认为 `pending`，未审核数据绝不开放到公共地图，公众接口仅选择匿名摘要、模糊化坐标及基本时间类别。
- 采用 HMAC 网络标识和每10分钟唯一键控制简单重复提交；此外上线前建议配置 Vercel WAF / Cloudflare Turnstile 防自动刷帖。
- 定时删除：被拒绝报告30天、未审核报告90天、审核通过报告365天（从创建时间计算）。Vercel Cron 每日执行 `/api/retention`，用 `CRON_SECRET` 鉴权。若 Cron 连续失败，须人工处理，不能继续宣称自动删除有效。

## 验收检查

- `GET /api/config`：`databaseConfigured=true`；管理员账户已建立后 `adminAuthenticationReady=true`；上线开关完成后 `reportSubmissionsEnabled=true`。
- 使用管理员白名单外的 token 请求 `GET /api/admin` 必须为 403；无 token 为 401。
- `POST /api/reports`：合法的用户报告返回 201 和回执 UUID；立即重复提交返回 429；未同意隐私政策返回 400。
- 未审核或已拒绝报告从 `GET /api/reports` 完全不可见。
- 审核确认后公开区域保留约 1km 的精度而非原始地址；原始地址只有管理员可以查看。
- GitHub 工作流 `backend-tests.yml` 通过，Vercel 生产部署 READY，公网与移动端进行真实提交→审核→公开→删除的端到端测试。

# E-Leave System

公司内部的请假申请 + 审批系统,手机和电脑浏览器都能用。
技术栈:Next.js 14(App Router)+ Supabase(Auth / Postgres / RLS)+ Tailwind。

## 功能

**员工(全职,有登录账号)**
- 工号 + 密码登录,可自己改密码
- 查看年假 / 病假 / 产假 / 陪产假余额、接下来的公假
- 提交请假(支持半天假 AM/PM)、取消自己"待批"的申请
- 提交时会检查:不能选过去日期、不能与已有申请重叠、余额是否足够(按申请所在的年度逐年检查,跨年的假会分别扣)

**负责人(manager)**
- `/approve` 审批(可批量),`/calendar` 团队请假月历
- `/manage` 新增/编辑员工、设年假结转、启用/停用员工(停用会同时封禁登录账号)
- `/reports` 三种报表(余额 / 个人按月 / 按假种按月),可导出 CSV
- `/holidays` 公假管理 + **工作周设定**(哪几天全天/半天/休息)
- `/work-hours` 兼职员工每月工时登记,可导出 CSV

**兼职员工没有登录账号**,只由负责人在 `/manage` 建档、在 `/work-hours` 登记工时。

## 第一次安装

1. **Supabase 建表**:SQL Editor 里把 `supabase/schema.sql` **整份**贴上执行。
   这份文件可以重复执行:全新项目和已经在用的项目都是同一个步骤,不会清空现有资料。
   (`supabase/archive/` 里是旧补丁,已合并进 schema.sql,不要再跑。)
2. **环境变量**:复制 `.env.local.example` 为 `.env.local`,填入 Supabase → Settings → API 里的三个值(Telegram 通知的变量见下面的专门章节,可以以后再填)。
   `SUPABASE_SERVICE_ROLE_KEY` 权限极大,绝对不能加 `NEXT_PUBLIC_` 前缀,也不要上传到 GitHub(`.gitignore` 已忽略 `.env.local`)。
3. **建第一个负责人账号**(之后的员工都可以在网站里加):
   - Supabase → Authentication → Users → Add user:Email 填 `工号@purewaternature.local`(如 `001@purewaternature.local`),设密码,复制这个用户的 UUID
   - Table Editor → employees → Insert row:`full_name`、`date_of_commencement`、`employment_type = full_time`、`role = manager`、`auth_user_id = 刚才的 UUID`、`employee_no = 1`
4. 运行:
   ```bash
   npm install
   npm run dev
   ```
   打开 http://localhost:3000,用工号 + 密码登录。

> 从旧版本升级的注意:登录状态改存在 cookie(为了让 middleware 能在服务器端拦截),
> 所以升级后每个人需要**重新登录一次**。

## 日常操作

- **加员工**:`/manage` → Add New Employee。全职会同时建登录账号(Staff ID 必须是纯数字,如 `003`,不能重复);兼职不建账号,Staff ID 可留空。
- **停用员工**:`/manage` 里点状态标签。停用 = 封禁登录账号 + 不再出现在报表/工时页;再点一次即恢复。不能停用自己。
- **年假结转**:`/manage` 的 Leave Carry-Fwd 栏,填的是**今年**从去年带过来的天数(只计入今年的额度)。
- **公假**:`/holidays`。新增/启用/停用/删除公假后,系统会自动重算已有的年假申请(待批 + 已批)里覆盖该日期的天数。
- **工作周**:`/holidays` 顶部。例如周六上半天班就把 Sat 设为 Half(年假每个周六算 0.5 天)。保存后会重算**还没结束**的年假,已休完的历史记录不动。
- **忘记密码**:账号用的是假邮箱,Supabase 的"寄重设信"没用。用 Admin API 直接改(在自己电脑上执行,service role key 换成你的):
  ```bash
  curl -X PUT "$NEXT_PUBLIC_SUPABASE_URL/auth/v1/admin/users/<用户的UUID>" \
    -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
    -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
    -H "Content-Type: application/json" \
    -d '{"password":"新密码"}'
  ```

## Telegram 通知

| 谁收到 | 什么时候 |
|---|---|
| 所有负责人 | 员工提交新申请;员工申请取消已批准的假 |
| 申请人 | 假被批准 / 拒绝(含理由)/ 被负责人取消;取消申请被确认 / 拒绝;负责人替他补录了假 |

没绑定 Telegram 的人会被静默跳过;发送失败不会影响提交、审批这些主要操作。

**直接在 Telegram 里审批:** 负责人收到的"新申请"和"申请取消"通知下面带按钮——
- **✅ Approve / ✅ Confirm cancel**:一键完成
- **❌ Reject / ❌ Decline**:bot 会问"请回复理由",负责人打字发送后才完成(和网页规则一样:拒绝必须有理由)
- 有人处理后(不论在网页还是 Telegram),所有负责人手上那条通知都会改成结果("✅ Approved by xxx"),按钮消失;之后再点会提示"已被处理"
- 只有"已绑定 Telegram 的负责人"点按钮才有效;所有操作照样写进审计日志(details 里有 `via: telegram`)
- 审批规则只写在 `lib/leaveDecision.ts` 一处,网页和 Telegram 共用,所以两边不会不一致

**一次性设定(负责人做):**
1. Telegram 里找 `@BotFather` → `/newbot`,取名字和用户名,得到 **bot token**
2. 在 `.env.local`(和 Vercel 的 Environment Variables)填 `TELEGRAM_BOT_TOKEN`、`TELEGRAM_BOT_USERNAME`(不含 @)、
   `TELEGRAM_WEBHOOK_SECRET`(自己编一串 16~64 字的字母/数字)、`APP_URL`(网站网址)。可参考 `.env.local.example`
3. Supabase SQL Editor 重新执行一次整份 `supabase/schema.sql`(会新增 telegram 相关栏位和表,不会动现有资料)
4. **部署到 Vercel 之后**,在本机执行(Node 20+):
   ```bash
   node --env-file=.env.local scripts/setup-telegram.mjs https://你的网站.vercel.app
   ```
   这一步告诉 Telegram"收到消息和按钮点击就送到网站的 `/api/telegram/webhook`"。换网址、或升级到有按钮的版本时要重跑。

**每位员工(含负责人)自己绑定:** 登录后点右上角头像(电脑版是左侧栏底部)→ **Telegram Notifications** → **Connect Telegram** → 在 Telegram 按 Start。
页面会自动变成"Connected"。想停的话在同一个页面按 Disconnect,或在 bot 里发 `/unlink`。

注意:
- Telegram 的 webhook 必须是公开的 https 网址,所以**本机 `npm run dev` 收不到绑定回调**。要在本机测试请用 ngrok / cloudflared 之类的隧道,或直接在 Vercel 上测。
- 一个 Telegram 帐号只能绑一位员工。bot 只处理一对一私聊,不会往群组发(通知含请假理由等隐私内容)。
- 员工必须自己先在 Telegram 里按过 Start,bot 才能主动发消息给他,这是 Telegram 的规定。
- 员工"取消自己待批的申请"目前不会通知负责人(只通知"申请取消已批准的假")。

## 假期规则

| 年资 | 年假 | 病假 |
|---|---|---|
| 不满 2 年 | 8 | 14 |
| 2 年以上、不满 5 年 | 12 | 18 |
| 5 年以上 | 16 | 22 |

产假 98 天、陪产假 7 天。

- **年资按周年日计算**:入职周年当天就升档。
- **额度按"请假所在年度"计算**:今年用今天的年资;过去的年度用该年 12/31 的年资;未来的年度用该年 1/1 的年资。
- **年假**只算工作日:按工作周设定排除休息日,并排除已启用的公假。**其他假种**(病假/无薪假/产假/陪产假)算日历天。
- 跨月、跨年的假在报表和额度里**按实际日期分摊**到各月、各年。
- 产假/陪产假法律上是按次而不是按年,系统为了简单按年度限额处理(代码里有注释)。
- 结转天数只有一个栏位,所以只计入今年;看往年报表时不含结转。

## 权限与安全

- `middleware.ts` 在页面渲染前检查:是否登录、员工资料是否存在/启用、是否全职、负责人页面是否由负责人访问。
  页面里的 `useEmployee()` 是第二道防线,并在查不到资料时显示明确错误(不会一直转圈)。
- 数据库层由 RLS 保护(见 `supabase/schema.sql`)。`app/api/employees` 是唯一使用 service role key 的地方,只在服务器端执行,并且会先验证调用者是启用中的负责人。

## 项目结构

```
app/                页面(dashboard、approve、calendar、manage、reports、holidays、work-hours…)
app/api/employees/  新增员工(POST)、启用/停用员工(PATCH)——服务器端,用 service role key
app/api/telegram/   link(产生绑定链接 / 解除绑定)、webhook(接收 Telegram 回调)
components/         ManagerShell(负责人侧边栏外壳)、ChangePasswordForm、TelegramConnect、AuthStatus
lib/leaveRules.ts   年资、额度、工作日/分月天数计算(纯函数)
lib/dateUtils.ts    日期工具(全部用本地时间,不经过 UTC)
lib/useEmployee.ts  各页面共用的"取得当前员工 + 权限检查"
lib/recalcLeave.ts  公假/工作周变动后重算年假天数
lib/settings.ts     读写公司设定(工作周)
lib/telegram.ts     Telegram 发送与消息格式(服务器端)
lib/leaveDecision.ts 批准/拒绝/取消的共用规则(网页和 Telegram 按钮都走这里)
scripts/            setup-telegram.mjs(一次性登记 webhook)
middleware.ts       服务器端路由守卫
supabase/schema.sql 完整数据库结构(可重复执行)
```

## 部署到 Vercel

1. 推到 GitHub(确认 `.env.local` 没有被提交)
2. vercel.com → New Project → 选这个 repo
3. Environment Variables 填 `.env.local` 里的值(Supabase 三个;要用 Telegram 通知的话再加那四个)
4. Deploy

## 权限与安全(重要)

- **所有审批动作(批准 / 拒绝 / 取消 / 确认或拒绝取消申请)都只走 `/api/leave-applications/decision`**,
  审批页面 `/approve` 和 Telegram 按钮共用它。所以审计日志、员工的 Telegram 通知、其他负责人手上的按钮更新,
  不论在哪边操作都一样。**不要**在页面里直接 `supabase.from('leave_applications').update(...)` 做审批。
- 员工能直接对 `leave_applications` 做的更新,只剩 4 种:取消自己待批的、申请取消、撤回取消申请、补传 MC。
  这由 `supabase/schema.sql` 末尾的触发器 `guard_employee_leave_updates` 把关
  (光靠 RLS policy 拦不住:多条 policy 的条件会各自用"或"合并,员工曾经可以绕过网站把自己待批的假改成已批准)。
  **改了请假流程、要让员工多改某些栏位时,记得同步改这个触发器。**
- 日期一律以马来西亚时间为准(`lib/dateUtils.ts` 的 `malaysiaToday()`),不依赖服务器时区。

## 已知问题 / 还没做

- 没有设定 ESLint(`npm run lint` 会进入交互设定)

- 邮件通知(目前只有 Telegram + dashboard 里的"有更新"横幅)
- 年度结转自动化;2027 年之后的公假需要手动加
- Excel 批量导入员工(目前只有一次性脚本)
- 没有自动化测试
- 没有登录防暴力破解(限流 / 锁定)和错误监控

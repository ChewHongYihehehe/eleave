// 一次性设定:告诉 Telegram"bot 收到消息时,请送到我网站的 /api/telegram/webhook"。
//
// 用法(在 eleave-app 资料夹里,需要 Node 20+):
//   node --env-file=.env.local scripts/setup-telegram.mjs https://你的网站.vercel.app
//
// 网址换了(例如换域名)要重新跑一次。可以重复执行,不会有副作用。

const siteUrl = (process.argv[2] || '').replace(/\/+$/, '')
const token = process.env.TELEGRAM_BOT_TOKEN
const secret = process.env.TELEGRAM_WEBHOOK_SECRET

if (!siteUrl.startsWith('https://')) {
  console.error('请提供 https 网址,例如:\n  node --env-file=.env.local scripts/setup-telegram.mjs https://eleave.vercel.app')
  process.exit(1)
}
if (!token || !secret) {
  console.error('.env.local 里缺少 TELEGRAM_BOT_TOKEN 或 TELEGRAM_WEBHOOK_SECRET')
  process.exit(1)
}
if (!/^[A-Za-z0-9_-]{16,256}$/.test(secret)) {
  console.error('TELEGRAM_WEBHOOK_SECRET 只能包含英文字母、数字、_ 和 -,长度 16~256。')
  process.exit(1)
}

async function call(method, body) {
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {}),
  })
  const json = await res.json()
  if (!json.ok) throw new Error(`${method} 失败:${json.description}`)
  return json.result
}

const me = await call('getMe')
console.log(`Bot:@${me.username}`)
if (process.env.TELEGRAM_BOT_USERNAME && process.env.TELEGRAM_BOT_USERNAME.replace(/^@/, '') !== me.username) {
  console.warn(`⚠️  .env.local 的 TELEGRAM_BOT_USERNAME(${process.env.TELEGRAM_BOT_USERNAME})和实际的 @${me.username} 不一致,请改正。`)
}

await call('setWebhook', {
  url: `${siteUrl}/api/telegram/webhook`,
  secret_token: secret,
  allowed_updates: ['message'],
  drop_pending_updates: true,
})
await call('setMyCommands', {
  commands: [
    { command: 'help', description: 'How this bot works' },
    { command: 'unlink', description: 'Stop E-Leave notifications' },
  ],
})

const info = await call('getWebhookInfo')
console.log(`Webhook 已设定:${info.url}`)
if (info.last_error_message) console.warn('Telegram 最近的错误:', info.last_error_message)
console.log('完成 ✅')

// Load every dashboard and storefront page as each role; print PASS/FAIL per page. Any 500 = FAIL.
// Usage: CRAWL_BASE=https://... CRAWL_LOGINS=/path/logins.json [CRAWL_OUT=/tmp/x] node scripts/r6-crawl.mjs [roles...]
// CRAWL_LOGINS: { "<role>": { "email": "...", "password": "..." } }, kept outside the repo.
import fs from 'node:fs'
import { chromium } from '/Users/junaid/Code/vibeghost/vibeghost/node_modules/playwright/index.mjs'

const BASE = process.env.CRAWL_BASE
const people = JSON.parse(fs.readFileSync(process.env.CRAWL_LOGINS, 'utf8'))
const roles = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(people)
const OUT = process.env.CRAWL_OUT

async function gql(query, cookie, variables) {
  const r = await fetch(BASE + '/api/graphql', { method: 'POST', headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) }, body: JSON.stringify({ query, variables }) })
  return r.json()
}
async function token(who) {
  const p = people[who]
  const r = await gql('mutation($e:String!,$p:String!){authenticateUserWithPassword(email:$e,password:$p){... on UserAuthenticationWithPasswordSuccess{sessionToken}}}', null, { e: p.email, p: p.password })
  return r.data?.authenticateUserWithPassword?.sessionToken
}

const own = await token(roles[0])
if (!own) { console.log('CHECK login: FAIL'); process.exit(1) }
const cookie = 'keystonejs-session=' + own
const dr = await gql(`{cateringOrders(take:1){id} inventoryItems(take:1){id} loyaltyAccounts(take:1){id} recipes(take:1){id} registerShifts(take:1){id} subscriptions(take:1){id} suppliers(take:1){id} menuItems(take:1){id} cafeOrders(take:1){id}}`, cookie)
if (!dr.data) { console.log('CHECK crawl id lookup: FAIL ' + JSON.stringify(dr.errors?.[0]?.message)); process.exit(1) }
const d = dr.data
const sections = ['coffee-operations', 'orders', 'kds', 'pos', 'register', 'menu', 'recipes', 'inventory', 'suppliers', 'subscriptions', 'catering', 'loyalty', 'reports', 'store-settings']
const detail = { catering: d.cateringOrders[0]?.id, inventory: d.inventoryItems[0]?.id, loyalty: d.loyaltyAccounts[0]?.id, recipes: d.recipes[0]?.id, register: d.registerShifts[0]?.id, subscriptions: d.subscriptions[0]?.id, suppliers: d.suppliers[0]?.id }
const staff = [...sections.map((s) => ['/dashboard/platform/' + s, 200])]
for (const [k, id] of Object.entries(detail)) {
  if (id) staff.push([`/dashboard/platform/${k}/${id}`, 200])
  staff.push([`/dashboard/platform/${k}/nope123`, 404])
}
staff.push(['/dashboard', 200], ['/dashboard/roles', 200], ['/dashboard/users', 200], ['/dashboard/cafe-orders', 200], ['/dashboard/menu-items', 200])
if (d.cafeOrders[0]) staff.push([`/dashboard/cafe-orders/${d.cafeOrders[0].id}`, 200])
staff.push(['/dashboard/cafe-orders/nope123', 404])
const front = [['/', 200], ['/checkout', 200], ['/catering', 200], ['/account', 200], ['/order-confirmed', 200], ['/menu/nope123', 404]]
if (d.menuItems[0]) front.push([`/menu/${d.menuItems[0].id}`, 200])
const paths = [...front, ...staff]
if (OUT) fs.writeFileSync(OUT + '-ids.json', JSON.stringify(detail, null, 1))

const b = await chromium.launch({ executablePath: process.env.HOME + '/Library/Caches/ms-playwright/chromium_headless_shell-1254/chrome-headless-shell-mac-arm64/chrome-headless-shell' })
const res = {}
let bad = 0
for (const role of roles) {
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, ignoreHTTPSErrors: true })
  const p = await ctx.newPage()
  await p.goto(BASE + '/dashboard/signin')
  await p.fill('input[name=email]', people[role].email)
  await p.fill('input[name=password]', people[role].password)
  await Promise.all([p.waitForURL((u) => !u.pathname.includes('signin'), { timeout: 30000 }), p.click('button[type=submit]')])
  for (const [path, want] of paths) {
    const pg = await ctx.newPage()
    const r = await pg.goto(BASE + path, { waitUntil: 'load', timeout: 60000 }).catch(() => null)
    await pg.waitForTimeout(1200).catch(() => {})
    const txt = await pg.evaluate(() => document.body.innerText).catch(() => '')
    const http = r?.status() ?? 0
    await pg.close().catch(() => {})
    const broken = /application error|something went wrong|internal server error|this page could not be loaded/i.test(txt)
    const ok = http === want && (want === 404 || !broken)
    res[`${role} ${path}`] = { http, want, broken }
    if (!ok) bad++
    console.log(`CHECK ${role} ${path}: ${ok ? 'PASS' : 'FAIL'} (${http}, want ${want})`)
  }
  await ctx.close()
}
await b.close()
if (OUT) fs.writeFileSync(OUT + '.json', JSON.stringify(res, null, 1))
console.log(`CHECK all pages: ${bad ? 'FAIL' : 'PASS'} (${Object.keys(res).length - bad}/${Object.keys(res).length})`)

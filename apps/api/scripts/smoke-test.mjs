#!/usr/bin/env node
// Standalone verification for apps/api — exercises a running instance (either
// `vercel dev` for full local/production parity, or `pnpm dev:local` for a
// fast check of the auth/business logic alone; see README.md).
// Usage:
//   AUTH_JWT_SECRET=<same as the server> BASE_URL=http://localhost:3000/api node scripts/smoke-test.mjs  (vercel dev)
//   AUTH_JWT_SECRET=<same as the server> BASE_URL=http://localhost:4001/api node scripts/smoke-test.mjs  (dev:local)
// AUTH_JWT_SECRET is needed only to mint an already-expired token for the expiry check.
import jwt from "jsonwebtoken"

const BASE_URL = process.env.BASE_URL ?? "http://localhost:4001/api"

let failures = 0

function fail(message) {
  failures += 1
  console.error(`✗ ${message}`)
}

function ok(message) {
  console.log(`✓ ${message}`)
}

async function request(method, path, { token, body } = {}) {
  const headers = { "Content-Type": "application/json" }
  if (token) headers.Authorization = `Bearer ${token}`
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })
  const json = await res.json().catch(() => null)
  return { status: res.status, json }
}

async function issueToken(ownerId) {
  const { status, json } = await request("POST", "/auth/token", { body: { ownerId } })
  if (status !== 200 || !json?.token) {
    throw new Error(`Failed to issue token for ${ownerId}: ${status} ${JSON.stringify(json)}`)
  }
  return json.token
}

async function main() {
  // 1. No Authorization header -> 401, nothing read.
  {
    const { status } = await request("GET", "/coins/balance")
    status === 401 ? ok("GET /coins/balance without a token -> 401") : fail(`expected 401, got ${status}`)
  }

  // 2. Issue a token for a fresh owner -> balance starts at zero.
  const ownerA = `owner-a-${Date.now()}`
  const tokenA = await issueToken(ownerA)
  {
    const { status, json } = await request("GET", "/coins/balance", { token: tokenA })
    status === 200 && json.amount === 0 && json.version === 0
      ? ok("fresh owner balance starts at { amount: 0, version: 0 }")
      : fail(`unexpected fresh balance: ${status} ${JSON.stringify(json)}`)
  }

  // 3. Top-up 100 -> balance 100, credit transaction recorded.
  {
    const { status, json } = await request("POST", "/coins/topup", { token: tokenA, body: { amount: 100 } })
    status === 200 && json.amount === 100
      ? ok("top-up 100 -> balance 100")
      : fail(`unexpected top-up result: ${status} ${JSON.stringify(json)}`)
  }

  // 4. Debit 40 -> balance 60.
  {
    const { status, json } = await request("POST", "/coins/debit", { token: tokenA, body: { amount: 40 } })
    status === 200 && json.amount === 60
      ? ok("debit 40 -> balance 60")
      : fail(`unexpected debit result: ${status} ${JSON.stringify(json)}`)
  }

  // 5. Debit 1000 (> balance) -> 402, balance unchanged.
  {
    const { status } = await request("POST", "/coins/debit", { token: tokenA, body: { amount: 1000 } })
    status === 402 ? ok("over-limit debit -> 402") : fail(`expected 402, got ${status}`)
    const { json: balanceAfter } = await request("GET", "/coins/balance", { token: tokenA })
    balanceAfter.amount === 60 ? ok("balance unchanged after rejected debit") : fail(`balance drifted: ${balanceAfter.amount}`)
  }

  // 6. Anti session-hijacking (SC-007): owner B's data is never touched using owner A's token.
  const ownerB = `owner-b-${Date.now()}`
  const tokenB = await issueToken(ownerB)
  await request("POST", "/coins/topup", { token: tokenB, body: { amount: 500 } })
  {
    const { json } = await request("GET", "/coins/balance", { token: tokenA })
    json.ownerId === ownerA && json.amount === 60
      ? ok("owner A's token only ever resolves to owner A's own data (SC-007)")
      : fail(`owner A's token leaked owner B's data: ${JSON.stringify(json)}`)
  }

  // 7. Tampered / expired tokens -> 401 (SC-006).
  {
    const tampered = `${tokenA.slice(0, -2)}xx`
    const { status } = await request("GET", "/coins/balance", { token: tampered })
    status === 401 ? ok("tampered token -> 401") : fail(`expected 401 for tampered token, got ${status}`)
  }
  {
    const { status } = await request("GET", "/coins/balance", { token: "not-a-jwt" })
    status === 401 ? ok("malformed token -> 401") : fail(`expected 401 for malformed token, got ${status}`)
  }
  {
    const secret = process.env.AUTH_JWT_SECRET
    if (!secret) {
      fail("AUTH_JWT_SECRET not set — cannot mint an expired token to check FR-014")
    } else {
      const nowSeconds = Math.floor(Date.now() / 1000)
      const expired = jwt.sign({ sub: ownerA, iat: nowSeconds - 3600, exp: nowSeconds - 60 }, secret, {
        algorithm: "HS256",
      })
      const { status } = await request("GET", "/coins/balance", { token: expired })
      status === 401 ? ok("expired token (validly signed) -> 401 (FR-014)") : fail(`expected 401 for expired token, got ${status}`)
    }
  }

  // 8. Concurrency (SC-003): 50 concurrent top-ups of 1 against the same balance.
  const ownerC = `owner-c-${Date.now()}`
  const tokenC = await issueToken(ownerC)
  const CONCURRENT_COUNT = 50

  async function topUpOneWithRetry() {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const { status } = await request("POST", "/coins/topup", { token: tokenC, body: { amount: 1 } })
      if (status === 200) return
      if (status !== 409) throw new Error(`unexpected top-up status during concurrency test: ${status}`)
    }
    throw new Error("exceeded retry budget on 409 conflicts")
  }

  await Promise.all(Array.from({ length: CONCURRENT_COUNT }, () => topUpOneWithRetry()))
  {
    const { json } = await request("GET", "/coins/balance", { token: tokenC })
    json.amount === CONCURRENT_COUNT
      ? ok(`${CONCURRENT_COUNT} concurrent top-ups -> balance exactly ${CONCURRENT_COUNT} (SC-003)`)
      : fail(`expected ${CONCURRENT_COUNT}, got ${json.amount} — lost update(s) detected`)
  }

  // 9. Transaction history ordering — only the 2 accepted ops (credit 100, debit 40);
  // the rejected over-limit debit (step 5) MUST NOT have created an entry.
  {
    const { json } = await request("GET", "/coins/transactions", { token: tokenA })
    json.transactions.length === 2 && json.transactions[0].direction === "debit"
      ? ok("transaction history returned, most recent first, correct count")
      : fail(`unexpected transaction history: ${JSON.stringify(json)}`)
  }

  if (failures > 0) {
    console.error(`\n${failures} check(s) failed.`)
    process.exit(1)
  }
  console.log("\nAll smoke-test checks passed.")
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

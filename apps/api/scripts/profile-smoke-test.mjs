#!/usr/bin/env node
// Standalone verification of the collector profile routes (specs/014-user-profile, contracts/profile-endpoints.md).
// Exercises a running instance: `vercel dev`, `pnpm dev:local`, or `pnpm smoke-test:profile:local` (the real Express
// app over an in-memory repository, no database).
// Usage:
//   AUTH_JWT_SECRET=<same as the server> BASE_URL=http://localhost:4001/api node scripts/profile-smoke-test.mjs
// AUTH_JWT_SECRET is needed to mint an admin token (the owner routes MUST refuse it with 403).
//
// "Another browser" (SC-001) is proven here: two tokens issued for the SAME owner read the same data, because the
// profile lives on the server, not in any client.
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

function check(condition, message, detail = "") {
  condition ? ok(message) : fail(`${message}${detail ? ` — ${detail}` : ""}`)
}

/** `body` is JSON-encoded; `rawBody` is sent as is (invalid JSON, oversized payloads). */
async function request(method, path, { token, body, rawBody } = {}) {
  const headers = { "Content-Type": "application/json" }
  if (token) headers.Authorization = `Bearer ${token}`
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: rawBody ?? (body === undefined ? undefined : JSON.stringify(body)),
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

const unique = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`

const validProfile = {
  displayName: "Ana Souza",
  bio: "Colecionadora de arte generativa.",
  ensName: "anasouza",
  ensTld: ".eth",
  walletNickname: "Principal",
}

/** The shape every profile response MUST have, whatever the owner. */
function isProfileShape(json) {
  return (
    json !== null &&
    typeof json.displayName === "string" &&
    typeof json.bio === "string" &&
    typeof json.ensName === "string" &&
    [".eth", ".xyz", ".art"].includes(json.ensTld) &&
    typeof json.walletNickname === "string" &&
    (json.avatarVersion === null || typeof json.avatarVersion === "string") &&
    (json.updatedAt === null || typeof json.updatedAt === "string")
  )
}

// --- US1: the text profile follows the account -----------------------------------------------------------------

async function textProfile() {
  // Authentication: no token, bad token, and an admin token are all refused (FR-006, contracts).
  {
    const { status } = await request("GET", "/profile")
    check(status === 401, "GET /profile without a token -> 401", `got ${status}`)
  }
  {
    const { status } = await request("GET", "/profile", { token: "not-a-jwt" })
    check(status === 401, "GET /profile with a malformed token -> 401", `got ${status}`)
  }
  {
    const secret = process.env.AUTH_JWT_SECRET
    if (!secret) {
      fail("AUTH_JWT_SECRET not set — cannot mint an admin token to check the 403")
    } else {
      const adminToken = jwt.sign({ sub: "profile-smoke-admin", role: "admin" }, secret, {
        algorithm: "HS256",
        expiresIn: 300,
      })
      for (const [method, path, body] of [
        ["GET", "/profile"],
        ["PUT", "/profile", validProfile],
      ]) {
        const { status, json } = await request(method, path, { token: adminToken, body })
        check(
          status === 403 && json?.error?.code === "wrong_token_type",
          `${method} ${path} with an admin token -> 403 wrong_token_type`,
          `got ${status} ${JSON.stringify(json)}`,
        )
      }
    }
  }

  // A fresh owner reads empty values, never a 404 (FR-008).
  const owner = `profile-owner-${unique()}`
  const token = await issueToken(owner)
  {
    const { status, json } = await request("GET", "/profile", { token })
    check(
      status === 200 &&
        isProfileShape(json) &&
        json.displayName === "" &&
        json.bio === "" &&
        json.ensName === "" &&
        json.ensTld === ".eth" &&
        json.walletNickname === "" &&
        json.avatarVersion === null &&
        json.updatedAt === null,
      "fresh owner reads empty values, ensTld .eth, avatarVersion/updatedAt null (200, not 404)",
      `got ${status} ${JSON.stringify(json)}`,
    )
  }

  // The first save creates the profile (FR-008).
  {
    const { status, json } = await request("PUT", "/profile", { token, body: validProfile })
    check(
      status === 200 &&
        isProfileShape(json) &&
        json.displayName === validProfile.displayName &&
        json.bio === validProfile.bio &&
        json.ensName === validProfile.ensName &&
        json.walletNickname === validProfile.walletNickname &&
        typeof json.updatedAt === "string",
      "PUT /profile creates the profile and answers it with an updatedAt",
      `got ${status} ${JSON.stringify(json)}`,
    )
  }

  // "Another browser" (SC-001): a SECOND token for the same owner reads the same profile.
  {
    const secondToken = await issueToken(owner)
    const { status, json } = await request("GET", "/profile", { token: secondToken })
    check(
      status === 200 && json.displayName === validProfile.displayName && json.bio === validProfile.bio,
      "a second token of the same owner reads the same profile (SC-001)",
      `got ${status} ${JSON.stringify(json)}`,
    )
  }

  // Isolation (SC-003): another owner sees nothing of the first one's profile.
  {
    const other = await issueToken(`profile-other-${unique()}`)
    const { status, json } = await request("GET", "/profile", { token: other })
    check(
      status === 200 && json.displayName === "" && json.updatedAt === null,
      "another owner reads an empty profile, never the first owner's (SC-003)",
      `got ${status} ${JSON.stringify(json)}`,
    )
  }
  // The owner comes only from the token: an `ownerId` sent in the body is ignored (FR-006).
  {
    const victim = `profile-victim-${unique()}`
    const victimToken = await issueToken(victim)
    const attackerToken = await issueToken(`profile-attacker-${unique()}`)
    await request("PUT", "/profile", { token: victimToken, body: { ...validProfile, displayName: "Vitima Original" } })
    await request("PUT", "/profile", {
      token: attackerToken,
      body: { ...validProfile, displayName: "Atacante", ownerId: victim },
    })
    const { json } = await request("GET", "/profile", { token: victimToken })
    check(
      json?.displayName === "Vitima Original",
      "an ownerId in the body never redirects a write to another owner (FR-006)",
      `victim now reads ${JSON.stringify(json)}`,
    )
  }

  // Validation: each field with its code; several invalid fields come back together; nothing is saved (SC-004).
  const invalidCases = [
    ["displayName too short", { displayName: "ab" }, { displayName: "too_short" }],
    ["displayName empty", { displayName: "   " }, { displayName: "too_short" }],
    ["displayName too long", { displayName: "a".repeat(61) }, { displayName: "too_long" }],
    ["bio too long", { bio: "b".repeat(281) }, { bio: "too_long" }],
    ["ensName uppercase", { ensName: "AnaSouza" }, { ensName: "invalid_format" }],
    ["ensName too short", { ensName: "ab" }, { ensName: "invalid_format" }],
    ["ensName with underscore", { ensName: "a_b" }, { ensName: "invalid_format" }],
    ["ensTld unknown", { ensTld: ".com" }, { ensTld: "invalid" }],
    ["walletNickname too long", { walletNickname: "n".repeat(41) }, { walletNickname: "too_long" }],
    [
      "several invalid fields at once",
      { displayName: "a", bio: "b".repeat(281), ensName: "X", walletNickname: "n".repeat(41) },
      { displayName: "too_short", bio: "too_long", ensName: "invalid_format", walletNickname: "too_long" },
    ],
  ]
  const before = (await request("GET", "/profile", { token })).json
  for (const [label, patch, expectedFields] of invalidCases) {
    const { status, json } = await request("PUT", "/profile", { token, body: { ...validProfile, ...patch } })
    const fields = json?.error?.fields ?? {}
    const sameFields = JSON.stringify(Object.entries(fields).sort()) === JSON.stringify(Object.entries(expectedFields).sort())
    check(
      status === 400 && json?.error?.code === "validation_error" && sameFields,
      `PUT /profile ${label} -> 400 validation_error ${JSON.stringify(expectedFields)}`,
      `got ${status} ${JSON.stringify(json)}`,
    )
  }
  {
    const after = (await request("GET", "/profile", { token })).json
    check(
      JSON.stringify(after) === JSON.stringify(before),
      "no invalid save changed the stored profile (SC-004)",
      `before ${JSON.stringify(before)} after ${JSON.stringify(after)}`,
    )
  }

  // Missing or mistyped fields are `invalid` per field; the account's fields are never part of the contract.
  {
    const { status, json } = await request("PUT", "/profile", { token, body: { displayName: "Ana Souza" } })
    const fields = json?.error?.fields ?? {}
    check(
      status === 400 &&
        fields.bio === "invalid" &&
        fields.ensName === "invalid" &&
        fields.ensTld === "invalid" &&
        fields.walletNickname === "invalid" &&
        fields.displayName === undefined,
      "missing fields are reported as invalid, one by one",
      `got ${status} ${JSON.stringify(json)}`,
    )
  }
  {
    const { status, json } = await request("PUT", "/profile", { token, body: { ...validProfile, bio: 42 } })
    check(
      status === 400 && json?.error?.fields?.bio === "invalid",
      "a field of the wrong type is reported as invalid",
      `got ${status} ${JSON.stringify(json)}`,
    )
  }

  // Optional fields and trimming.
  {
    const { status, json } = await request("PUT", "/profile", {
      token,
      body: { displayName: "  Ana Souza  ", bio: "  oi  ", ensName: "", ensTld: ".xyz", walletNickname: "   " },
    })
    check(
      status === 200 &&
        json.displayName === "Ana Souza" &&
        json.bio === "oi" &&
        json.ensName === "" &&
        json.ensTld === ".xyz" &&
        json.walletNickname === "",
      "empty ENS name and nickname are accepted; spaces at the ends are removed",
      `got ${status} ${JSON.stringify(json)}`,
    )
  }
  // Length counts characters (code points), so the database CHECK can never refuse what the service accepts.
  {
    const { status } = await request("PUT", "/profile", { token, body: { ...validProfile, displayName: "😀a" } })
    check(status === 400, "a 2-character name made of an emoji and a letter is too short, not a 500", `got ${status}`)
    const { status: okStatus, json } = await request("PUT", "/profile", {
      token,
      body: { ...validProfile, displayName: "😀😀😀" },
    })
    check(okStatus === 200 && json.displayName === "😀😀😀", "three emoji are three characters (accepted)", `got ${okStatus}`)
  }
}

async function main() {
  await textProfile()

  if (failures > 0) {
    console.error(`\n${failures} check(s) failed.`)
    process.exit(1)
  }
  console.log("\nAll profile smoke-test checks passed.")
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

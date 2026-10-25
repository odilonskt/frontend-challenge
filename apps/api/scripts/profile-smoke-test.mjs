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

// --- US2: the photo follows the account ------------------------------------------------------------------------

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
const JPEG_SIGNATURE = Buffer.from([0xff, 0xd8, 0xff, 0xe0])
const WEBP_HEADER = Buffer.concat([Buffer.from("RIFF"), Buffer.from([0x1a, 0x00, 0x00, 0x00]), Buffer.from("WEBPVP8 ")])

/** Real signatures, padded with zeros to `size` bytes: what the service checks is the content, not the name. */
const imageBytes = (signature, size = signature.length + 32) =>
  Buffer.concat([signature, Buffer.alloc(Math.max(0, size - signature.length))])

const dataUrl = (type, bytes) => `data:${type};base64,${bytes.toString("base64")}`

const png = () => dataUrl("image/png", imageBytes(PNG_SIGNATURE))
const jpeg = () => dataUrl("image/jpeg", imageBytes(JPEG_SIGNATURE))
const webp = () => dataUrl("image/webp", imageBytes(WEBP_HEADER))

async function avatar() {
  const owner = `avatar-owner-${unique()}`
  const token = await issueToken(owner)

  // Without a photo: 404 no_avatar, and the profile says avatarVersion null.
  {
    const { status, json } = await request("GET", "/profile/avatar", { token })
    check(status === 404 && json?.error?.code === "no_avatar", "GET /profile/avatar without a photo -> 404 no_avatar", `got ${status}`)
  }

  // PNG, JPEG and WebP are accepted; each replaces the previous one and moves the version forward.
  let lastVersion = null
  for (const [label, make, type] of [
    ["PNG", png, "image/png"],
    ["JPEG", jpeg, "image/jpeg"],
    ["WebP", webp, "image/webp"],
  ]) {
    const url = make()
    const { status, json } = await request("PUT", "/profile/avatar", { token, body: { dataUrl: url } })
    check(
      status === 200 && isProfileShape(json) && typeof json.avatarVersion === "string",
      `PUT /profile/avatar with a ${label} -> 200 with an avatarVersion`,
      `got ${status} ${JSON.stringify(json)}`,
    )
    const read = await request("GET", "/profile/avatar", { token })
    check(
      read.status === 200 && read.json.dataUrl === url && read.json.version === json?.avatarVersion,
      `GET /profile/avatar returns the ${label} just saved (${type}) and the same version as the profile`,
      `got ${read.status}`,
    )
    check(lastVersion === null || json?.avatarVersion >= lastVersion, `the ${label} did not move the version backwards`)
    lastVersion = json?.avatarVersion
  }

  // "Another browser": a second token of the same owner reads the same photo (SC-001).
  {
    const secondToken = await issueToken(owner)
    const { status, json } = await request("GET", "/profile/avatar", { token: secondToken })
    check(status === 200 && json.dataUrl === webp(), "a second token of the same owner reads the same photo (SC-001)", `got ${status}`)
  }

  // Isolation and authentication.
  {
    const other = await issueToken(`avatar-other-${unique()}`)
    const { status } = await request("GET", "/profile/avatar", { token: other })
    check(status === 404, "another owner has no photo (never the first owner's)", `got ${status}`)
    const noToken = await request("GET", "/profile/avatar")
    check(noToken.status === 401, "GET /profile/avatar without a token -> 401", `got ${noToken.status}`)
    const secret = process.env.AUTH_JWT_SECRET
    if (secret) {
      const adminToken = jwt.sign({ sub: "profile-smoke-admin", role: "admin" }, secret, { algorithm: "HS256", expiresIn: 300 })
      for (const [method, body] of [["GET"], ["PUT", { dataUrl: png() }], ["DELETE"]]) {
        const res = await request(method, "/profile/avatar", { token: adminToken, body })
        check(res.status === 403, `${method} /profile/avatar with an admin token -> 403`, `got ${res.status}`)
      }
    }
  }

  // Size: exactly 1 MiB is accepted, one byte more is refused with the photo untouched (SC-005, FR-005).
  {
    const exact = dataUrl("image/png", imageBytes(PNG_SIGNATURE, 1_048_576))
    const accepted = await request("PUT", "/profile/avatar", { token, body: { dataUrl: exact } })
    check(accepted.status === 200, "a photo of exactly 1 MiB (1048576 bytes) is accepted", `got ${accepted.status}`)

    const tooBig = dataUrl("image/png", imageBytes(PNG_SIGNATURE, 1_048_577))
    const refused = await request("PUT", "/profile/avatar", { token, body: { dataUrl: tooBig } })
    check(
      refused.status === 400 && refused.json?.error?.code === "validation_error" && refused.json.error.fields?.avatar === "too_large",
      "a photo of 1 MiB + 1 byte -> 400 validation_error avatar too_large",
      `got ${refused.status} ${JSON.stringify(refused.json)?.slice(0, 160)}`,
    )
    const still = await request("GET", "/profile/avatar", { token })
    check(still.status === 200 && still.json.dataUrl === exact, "the refused upload left the current photo untouched (SC-005)")
  }

  // Content, not names: every wrong shape is `invalid_format`, whatever the declared type.
  const text = Buffer.from("isto nao e uma imagem, apesar da extensao .png")
  const wrongShapes = [
    ["text declared as image/png", { dataUrl: dataUrl("image/png", text) }],
    ["JPEG bytes declared as image/png", { dataUrl: dataUrl("image/png", imageBytes(JPEG_SIGNATURE)) }],
    ["PNG bytes declared as image/webp", { dataUrl: dataUrl("image/webp", imageBytes(PNG_SIGNATURE)) }],
    ["an SVG", { dataUrl: dataUrl("image/svg+xml", Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'/>")) }],
    ["invalid base64", { dataUrl: "data:image/png;base64,@@@@" }],
    ["base64 with a broken length", { dataUrl: "data:image/png;base64,iVBORw0KGgoAA" }],
    ["an empty payload", { dataUrl: "data:image/png;base64," }],
    ["a plain URL", { dataUrl: "https://example.com/foto.png" }],
    ["a non-string", { dataUrl: 42 }],
    ["no dataUrl at all", {}],
  ]
  for (const [label, body] of wrongShapes) {
    const { status, json } = await request("PUT", "/profile/avatar", { token, body })
    check(
      status === 400 && json?.error?.fields?.avatar === "invalid_format",
      `PUT /profile/avatar with ${label} -> 400 avatar invalid_format`,
      `got ${status} ${JSON.stringify(json)?.slice(0, 160)}`,
    )
  }

  // Body limits: far over the route's 2 MB -> 413; not JSON -> 400 (both with the standard envelope).
  {
    const huge = `{"dataUrl":"data:image/png;base64,${"A".repeat(2_600_000)}"}`
    const { status, json } = await request("PUT", "/profile/avatar", { token, rawBody: huge })
    check(status === 413 && json?.error?.code === "payload_too_large", "a body over 2 MB -> 413 payload_too_large", `got ${status}`)
  }
  {
    const { status, json } = await request("PUT", "/profile", { token, rawBody: "{not json" })
    check(status === 400 && json?.error?.code === "invalid_json", "a body that is not JSON -> 400 invalid_json", `got ${status}`)
  }

  // The two halves of the profile are independent: text and photo never overwrite each other.
  {
    const textOwner = await issueToken(`avatar-text-${unique()}`)
    await request("PUT", "/profile/avatar", { token: textOwner, body: { dataUrl: png() } })
    const saved = await request("PUT", "/profile", { token: textOwner, body: validProfile })
    check(
      saved.status === 200 && saved.json.displayName === validProfile.displayName && typeof saved.json.avatarVersion === "string",
      "saving the text keeps the photo (the profile response still carries its version)",
      `got ${saved.status} ${JSON.stringify(saved.json)}`,
    )
    const photoAfterText = await request("GET", "/profile/avatar", { token: textOwner })
    check(photoAfterText.status === 200 && photoAfterText.json.dataUrl === png(), "the photo is intact after saving the text")

    await request("PUT", "/profile/avatar", { token: textOwner, body: { dataUrl: jpeg() } })
    const textAfterPhoto = await request("GET", "/profile", { token: textOwner })
    check(
      textAfterPhoto.json.displayName === validProfile.displayName && textAfterPhoto.json.bio === validProfile.bio,
      "saving the photo leaves the text fields untouched",
      JSON.stringify(textAfterPhoto.json),
    )
  }

  // Removal is idempotent: with and without a photo it answers 200 with no version; the photo is gone for good.
  {
    const first = await request("DELETE", "/profile/avatar", { token })
    check(first.status === 200 && isProfileShape(first.json) && first.json.avatarVersion === null, "DELETE /profile/avatar -> 200 with avatarVersion null", `got ${first.status}`)
    const second = await request("DELETE", "/profile/avatar", { token })
    check(second.status === 200 && second.json.avatarVersion === null, "a second DELETE is harmless (200, same state)", `got ${second.status}`)
    const gone = await request("GET", "/profile/avatar", { token })
    check(gone.status === 404, "after DELETE the photo is gone (404 no_avatar)", `got ${gone.status}`)
    const profile = await request("GET", "/profile", { token })
    check(profile.json?.avatarVersion === null, "the profile reports avatarVersion null after DELETE")
  }
}

// --- US3: repeated saves, two sessions, simultaneous saves -------------------------------------------------------

async function resilience() {
  const owner = `resilience-owner-${unique()}`
  const token = await issueToken(owner)

  // Five identical saves leave the same state as one (FR-009, SC-006); only updatedAt may move forward.
  {
    const results = []
    for (let i = 0; i < 5; i += 1) results.push(await request("PUT", "/profile", { token, body: validProfile }))
    const strip = ({ updatedAt: _ignored, ...rest }) => JSON.stringify(rest)
    check(results.every((r) => r.status === 200), "five identical PUT /profile all answer 200", results.map((r) => r.status).join(","))
    check(
      results.every((r) => strip(r.json) === strip(results[0].json)),
      "five identical saves leave the profile identical to one save (SC-006)",
    )
    const stamps = results.map((r) => r.json.updatedAt)
    check(stamps.every((stamp, i) => i === 0 || stamp >= stamps[i - 1]), "updatedAt only moves forward across repeated saves")
    const read = await request("GET", "/profile", { token })
    check(strip(read.json) === strip(results[0].json), "reading after five saves shows that one profile")
  }

  // Two sessions of the same account: the LAST save wins and its updatedAt is the one read back (FR-010).
  {
    const sessionA = await issueToken(owner)
    const sessionB = await issueToken(owner)
    await request("PUT", "/profile", { token: sessionA, body: { ...validProfile, displayName: "Valor da Sessao A", bio: "A" } })
    const last = await request("PUT", "/profile", { token: sessionB, body: { ...validProfile, displayName: "Valor da Sessao B", bio: "B" } })
    const read = await request("GET", "/profile", { token: sessionA })
    check(
      read.status === 200 && read.json.displayName === "Valor da Sessao B" && read.json.bio === "B",
      "two sessions saving different values: the last save wins (FR-010)",
      JSON.stringify(read.json),
    )
    check(read.json.updatedAt === last.json.updatedAt, "the updatedAt read back is the one of the last save")
  }

  // Simultaneous saves end in ONE complete profile, never a mix of both (single-statement write).
  {
    const left = { displayName: "Esquerda Esquerda", bio: "bio da esquerda", ensName: "esquerda", ensTld: ".eth", walletNickname: "E" }
    const right = { displayName: "Direita Direita", bio: "bio da direita", ensName: "direita", ensTld: ".art", walletNickname: "D" }
    const [a, b] = await Promise.all([
      request("PUT", "/profile", { token, body: left }),
      request("PUT", "/profile", { token: await issueToken(owner), body: right }),
    ])
    check(a.status === 200 && b.status === 200, "two simultaneous saves both answer 200", `${a.status},${b.status}`)
    const { json } = await request("GET", "/profile", { token })
    const pick = (value) => JSON.stringify([value.displayName, value.bio, value.ensName, value.ensTld, value.walletNickname])
    check(
      pick(json) === pick(left) || pick(json) === pick(right),
      "after simultaneous saves the stored profile is one complete version, never a mix",
      JSON.stringify(json),
    )
  }

  // The account's own data never belongs to this service (FR-012): no response carries it, and a body that sends
  // it changes nothing about the contract.
  {
    const { status, json } = await request("PUT", "/profile", {
      token,
      body: { ...validProfile, username: "intruso", email: "intruso@example.com", password: "Senha1234" },
    })
    const leaked = ["username", "email", "password", "passwordHash"].filter((key) => key in (json ?? {}))
    check(status === 200 && leaked.length === 0, "username, e-mail and password are ignored and never part of a response (FR-012)", leaked.join(","))
    const read = await request("GET", "/profile", { token })
    check(
      !JSON.stringify(read.json).includes("intruso") && !JSON.stringify(read.json).includes("Senha1234"),
      "nothing of the account's data was stored by the profile service",
    )
  }
}

async function main() {
  await textProfile()
  await avatar()
  await resilience()

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

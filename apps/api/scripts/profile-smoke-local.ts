// Runs scripts/profile-smoke-test.mjs against the REAL Express app (auth, routing, validation, error envelope) over
// an in-memory profile repository, so the profile routes can be verified without a database:
//   pnpm smoke-test:profile:local
// It proves the HTTP behaviour and the service rules. It does NOT prove the Prisma adapter or the migration; that
// needs a database (`pnpm smoke-test:profile` against `dev:local`/`vercel dev`, quickstart.md section 2).
import { spawn } from "node:child_process"
import { randomBytes } from "node:crypto"
import type { AddressInfo } from "node:net"
import { createApp } from "../src/app.js"
import { InMemoryProfileRepository } from "../src/domains/profile/inMemoryProfileRepository.js"
import { createProfileService } from "../src/domains/profile/service.js"
import { createProfileRouter } from "../src/routes/profile.js"

// The token routes read the secret at call time; a throwaway one is enough for a local run.
process.env.AUTH_JWT_SECRET ??= randomBytes(32).toString("hex")

const app = createApp(createProfileRouter(createProfileService(new InMemoryProfileRepository())))
const server = app.listen(0)
await new Promise<void>((resolve) => server.once("listening", resolve))
const { port } = server.address() as AddressInfo

const child = spawn(process.execPath, ["scripts/profile-smoke-test.mjs"], {
  stdio: "inherit",
  env: { ...process.env, BASE_URL: `http://127.0.0.1:${port}/api` },
})

child.on("exit", (code) => {
  server.close()
  process.exit(code ?? 1)
})

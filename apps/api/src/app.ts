import cors from "cors"
import express, { Router } from "express"
import { errorMiddleware, notFound } from "./lib/errors.js"
import adminRouter from "./routes/admin.js"
import authRouter from "./routes/auth.js"
import coinsRouter from "./routes/coins.js"
import docsRouter from "./routes/docs.js"
import healthRouter from "./routes/health.js"
import defaultProfileRouter from "./routes/profile.js"

/**
 * Builds the Express app. The profile router is a parameter only so `pnpm smoke-test:profile:local` can run the
 * real app over an in-memory repository; everything else (and the exported default) is wired for production.
 */
export function createApp(profileRouter: Router = defaultProfileRouter) {
  const app = express()

  app.use(cors())
  // A profile photo (<= 1 MiB) is ~1.4 MB as base64 in JSON, far over the 100 kB default of `express.json()`. Only
  // this route gets a 2 MB parser (under Vercel's 4.5 MB body limit); it MUST come first: body-parser skips a
  // body that was already read, so the global parser below leaves it alone.
  app.use("/api/profile/avatar", express.json({ limit: "2mb" }))
  app.use(express.json())

  // Vercel's rewrite (`/api/(.*)` -> `/api/index`) keeps the original request path,
  // so the function sees `/api/...`; mounting here makes `dev:local` match it too.
  const api = Router()
  api.use("/health", healthRouter)
  api.use("/auth", authRouter)
  api.use("/coins", coinsRouter)
  api.use("/profile", profileRouter)
  api.use("/admin", adminRouter)
  // Public API documentation (/api/openapi.json, /api/docs) — mounted before the
  // catch-all so unknown paths still fall through to the 404 handler below.
  api.use(docsRouter)
  app.use("/api", api)

  app.use((req, _res, next) => {
    next(notFound("route_not_found", `No route for ${req.method} ${req.path}`))
  })

  app.use(errorMiddleware)

  return app
}

const app = createApp()

export default app

import { Router } from "express"
import { internal } from "../lib/errors.js"

const router = Router()

router.get("/", (_req, res, next) => {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    next(
      internal(
        "missing_blob_token",
        "BLOB_READ_WRITE_TOKEN is not configured. Set it in apps/api/.env.local (see .env.example).",
      ),
    )
    return
  }

  res.status(200).json({ status: "ok" })
})

export default router

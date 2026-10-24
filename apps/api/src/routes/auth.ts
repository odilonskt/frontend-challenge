import { Router } from "express"
import { z } from "zod"
import { signToken } from "../lib/auth.js"
import { badRequest } from "../lib/errors.js"

const router = Router()

const tokenRequestSchema = z.object({
  ownerId: z.string().trim().min(1),
})

router.post("/token", (req, res, next) => {
  const parsed = tokenRequestSchema.safeParse(req.body)
  if (!parsed.success) {
    next(badRequest("invalid_owner_id", "ownerId is required and MUST be a non-empty string."))
    return
  }

  const { token, expiresAt } = signToken(parsed.data.ownerId)
  res.status(200).json({ token, expiresAt })
})

export default router

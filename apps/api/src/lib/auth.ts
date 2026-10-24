import type { NextFunction, Request, Response } from "express"
import jwt from "jsonwebtoken"
import { z } from "zod"
import { internal, unauthorized } from "./errors.js"

const TOKEN_TTL_SECONDS = 15 * 60

const authTokenClaimsSchema = z.object({
  sub: z.string().min(1),
})

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace -- extending Express's Request type
  namespace Express {
    interface Request {
      ownerId?: string
    }
  }
}

function getSecret(): string {
  const secret = process.env.AUTH_JWT_SECRET
  if (!secret) {
    throw internal(
      "missing_auth_secret",
      "AUTH_JWT_SECRET is not configured. Set it in apps/api/.env.local (see .env.example).",
    )
  }
  return secret
}

export function signToken(ownerId: string): { token: string; expiresAt: string } {
  const secret = getSecret()
  const token = jwt.sign({ sub: ownerId }, secret, {
    algorithm: "HS256",
    expiresIn: TOKEN_TTL_SECONDS,
  })
  const expiresAt = new Date(Date.now() + TOKEN_TTL_SECONDS * 1000).toISOString()
  return { token, expiresAt }
}

export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const header = req.header("authorization")
  const [scheme, token] = header?.split(" ") ?? []

  if (scheme !== "Bearer" || !token) {
    next(unauthorized("missing_token", "Authorization: Bearer <token> header is required."))
    return
  }

  let secret: string
  try {
    secret = getSecret()
  } catch (err) {
    next(err)
    return
  }

  let payload: unknown
  try {
    payload = jwt.verify(token, secret, { algorithms: ["HS256"] })
  } catch {
    next(unauthorized("invalid_token", "Token is expired or its signature could not be verified."))
    return
  }

  const claims = authTokenClaimsSchema.safeParse(payload)
  if (!claims.success) {
    next(unauthorized("invalid_token", "Token is missing its owner claim."))
    return
  }
  // The acting owner id comes exclusively from this verified claim (FR-013).
  req.ownerId = claims.data.sub
  next()
}

import { Router, type Request } from "express"
import { requireAuth } from "../lib/auth.js"
import { AvatarNotFoundError, ProfileValidationError } from "../domains/profile/contracts.js"
import { profileService, type ProfileService } from "../domains/profile/service.js"
import { notFound, validationError } from "../lib/errors.js"

function ownerIdOrThrow(req: Request): string {
  // Always set: this router sits behind requireAuth. The owner comes ONLY from the verified token (FR-006).
  if (!req.ownerId) {
    throw new Error("requireAuth did not populate req.ownerId")
  }
  return req.ownerId
}

/** Maps the domain errors of the profile service to their HTTP answers. */
function toApiError(err: unknown): unknown {
  if (err instanceof ProfileValidationError) return validationError(err.message, err.fields)
  if (err instanceof AvatarNotFoundError) return notFound("no_avatar", err.message)
  return err
}

// The service is injected so the same router runs over the Prisma adapter (production) or an in-memory one
// (`pnpm smoke-test:profile:local`). Express 5 forwards rejected promises from async handlers to the error
// middleware, so a database failure surfaces as a structured 500 instead of crashing the process.
export function createProfileRouter(service: ProfileService): Router {
  const router = Router()

  router.use(requireAuth)

  router.get("/", async (req, res) => {
    res.status(200).json(await service.getProfile(ownerIdOrThrow(req)))
  })

  router.put("/", async (req, res, next) => {
    try {
      res.status(200).json(await service.saveProfile(ownerIdOrThrow(req), req.body))
    } catch (err) {
      next(toApiError(err))
    }
  })

  router.get("/avatar", async (req, res, next) => {
    try {
      res.status(200).json(await service.getAvatar(ownerIdOrThrow(req)))
    } catch (err) {
      next(toApiError(err))
    }
  })

  router.put("/avatar", async (req, res, next) => {
    try {
      res.status(200).json(await service.saveAvatar(ownerIdOrThrow(req), req.body))
    } catch (err) {
      next(toApiError(err))
    }
  })

  router.delete("/avatar", async (req, res) => {
    res.status(200).json(await service.deleteAvatar(ownerIdOrThrow(req)))
  })

  return router
}

export default createProfileRouter(profileService)

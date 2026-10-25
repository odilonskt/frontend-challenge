import type { NextFunction, Request, Response } from "express"

export class ApiError extends Error {
  readonly status: number
  readonly code: string
  /** Per-field problem codes of a `validation_error`, for the client to map onto its form fields. */
  readonly fields?: Record<string, string>

  constructor(status: number, code: string, message: string, fields?: Record<string, string>) {
    super(message)
    this.status = status
    this.code = code
    this.fields = fields
  }
}

/** `400 validation_error` carrying every invalid field at once (specs/014-user-profile, contracts). */
export function validationError(message: string, fields: Record<string, string>): ApiError {
  return new ApiError(400, "validation_error", message, fields)
}

export function badRequest(code: string, message: string): ApiError {
  return new ApiError(400, code, message)
}

export function unauthorized(code: string, message: string): ApiError {
  return new ApiError(401, code, message)
}

export function forbidden(code: string, message: string): ApiError {
  return new ApiError(403, code, message)
}

export function paymentRequired(code: string, message: string): ApiError {
  return new ApiError(402, code, message)
}

export function notFound(code: string, message: string): ApiError {
  return new ApiError(404, code, message)
}

export function conflict(code: string, message: string): ApiError {
  return new ApiError(409, code, message)
}

export function internal(code: string, message: string): ApiError {
  return new ApiError(500, code, message)
}

/** The two body-parser failures a client can cause: malformed JSON and a body over the route's limit. */
function bodyParserError(err: unknown): ApiError | undefined {
  if (typeof err !== "object" || err === null || !("type" in err)) return undefined
  if (err.type === "entity.parse.failed") return badRequest("invalid_json", "Request body MUST be valid JSON.")
  if (err.type === "entity.too.large") return new ApiError(413, "payload_too_large", "Request body is too large.")
  return undefined
}

export function errorMiddleware(
  err: unknown,
  _req: Request,
  res: Response,
  // Express identifies error middleware by its 4-argument signature.
  _next: NextFunction,
): void {
  const apiError = err instanceof ApiError ? err : bodyParserError(err)
  if (apiError) {
    res.status(apiError.status).json({
      error: {
        code: apiError.code,
        message: apiError.message,
        ...(apiError.fields === undefined ? {} : { fields: apiError.fields }),
      },
    })
    return
  }

  const message = err instanceof Error ? err.message : "Unexpected error"
  res.status(500).json({ error: { code: "internal_error", message } })
}

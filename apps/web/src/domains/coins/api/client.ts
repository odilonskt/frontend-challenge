import axios from 'axios'
import { env } from '@/shared/config/env'

/**
 * A separate Axios instance, deliberately never reusing `@/shared/api/http` (which the MSW mock
 * worker intercepts and which points at `/api`) — this one talks to the real coins backend
 * (`server/`, specs/006-platform-coins).
 */
export const coinsHttp = axios.create({
  baseURL: env.coinsApiUrl,
  headers: { 'Content-Type': 'application/json' },
})

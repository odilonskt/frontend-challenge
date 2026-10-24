import { env } from '@/shared/config/env'

/**
 * Whether the platform-coins feature is available in this build. Production builds without
 * `VITE_COINS_API_URL` have no coins backend (`server/` cannot run on Vercel), so the UI hides the
 * balance section and the pay-with-coins option instead of calling a backend that does not exist.
 */
export const coinsEnabled: boolean = env.coinsEnabled

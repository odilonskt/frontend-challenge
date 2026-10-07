import type { RequestHandler, WebSocketHandler } from 'msw'

/** Each domain's handlers are registered here (catalog, auth, cart, ...). */
export const handlers: Array<RequestHandler | WebSocketHandler> = []

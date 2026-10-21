import { createStart } from '@tanstack/react-start'
import { csrfMiddleware } from '#/server/auth'

export const startInstance = createStart(() => ({
  requestMiddleware: [csrfMiddleware],
}))

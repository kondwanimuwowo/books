import { notFound } from '@tanstack/react-router'
import { ZodError } from 'zod'

const STATUS = {
  invalid: 400,
  unauthorized: 401,
  forbidden: 403,
  not_found: 404,
  conflict: 409,
  rate_limited: 429,
} as const

export type ErrorCode = keyof typeof STATUS

// A failure the person can act on. The message is shown to them as written; the code and
// status let API clients (the mobile apps) react without matching on wording. Anything
// thrown that isn't an AppError is treated as internal and never shown verbatim by the API.
export class AppError extends Error {
  readonly code: ErrorCode
  readonly status: number

  constructor(message: string, code: ErrorCode = 'invalid') {
    super(message)
    this.code = code
    this.status = STATUS[code]
  }
}

// For JSON API routes: the body and status to send for anything a handler threw.
export function errorResponse(error: unknown) {
  if (error instanceof AppError) {
    return Response.json({ error: { code: error.code, message: error.message } }, { status: error.status })
  }
  if (error instanceof ZodError) {
    const message = error.issues[0]?.message ?? 'Check the details and try again'
    return Response.json({ error: { code: 'invalid', message, issues: error.issues } }, { status: 400 })
  }
  console.error('Unhandled API error', error)
  return Response.json({ error: { code: 'internal', message: 'Something went wrong. Try again.' } }, { status: 500 })
}

// A record that's missing or isn't the caller's. Server functions turn it back into the router's
// 404 with orNotFound, which is what they threw before the logic moved out of them.
export class NotFoundError extends AppError {
  constructor(message = 'Not found') {
    super(message, 'not_found')
  }
}

export async function orNotFound<T>(work: Promise<T>) {
  try {
    return await work
  } catch (error) {
    if (error instanceof NotFoundError) throw notFound()
    throw error
  }
}

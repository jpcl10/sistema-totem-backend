import { FastifyReply, FastifyRequest } from 'fastify'

import { verifyDeviceJWT } from './verify-device-jwt.js'

export async function tryVerifyDeviceJWT(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const authHeader =
    request.headers.authorization

  if (!authHeader) {
    return
  }

  await verifyDeviceJWT(
    request,
    reply
  )
}
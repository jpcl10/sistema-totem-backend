import { FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'

import { prisma } from '../../../lib/prisma.js'

const paramsSchema = z.object({
  orderId: z.string()
})

export async function getPublicOnlineOrderPaymentStatusController(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const { orderId } = paramsSchema.parse(request.params)

  const order = await prisma.onlineOrder.findUnique({
    where: {
      id: orderId
    },
    select: {
      id: true,
      status: true,
      paymentStatus: true,
      paidAt: true
    }
  })

  if (!order) {
    return reply.status(404).send({
      message: 'Pedido nao encontrado'
    })
  }

  return reply.status(200).send({
    orderId: order.id,
    paymentStatus: order.paymentStatus,
    orderStatus: order.status,
    paidAt: order.paidAt?.toISOString() ?? null
  })
}

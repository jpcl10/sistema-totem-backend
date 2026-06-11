import 'fastify'

declare module 'fastify' {
  interface FastifyRequest {
    user: {
      sub: string
      role: string
      organizationId: string
    }
  }
}
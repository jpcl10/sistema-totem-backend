import {
  FastifyReply,
  FastifyRequest
} from 'fastify'

import { GetPublicEventCatalogMenuService } from '../services/get-public-event-catalog-menu-service.js'
import {
  AmbiguousEventSlugError,
  buildAmbiguousEventSlugResponse,
  PublicEventNotFoundError,
  resolveLegacyPublicEventSlug
} from '../services/public-event-resolver.js'

export async function getPublicEventCatalogMenuController(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const params = request.params as {
    organizationSlug?: string
    eventSlug?: string
    slug?: string
  }

  if (!params.organizationSlug || !params.eventSlug) {
    try {
      const resolved = await resolveLegacyPublicEventSlug(params.slug ?? '')

      return reply.status(200).send({
        code: 'LEGACY_EVENT_SLUG',
        message: 'Use a URL canônica da organização para acessar este evento.',
        canonicalUrl: resolved.canonicalUrl,
        canonicalPath: resolved.canonicalPath,
        organizationSlug: resolved.organizationSlug,
        eventSlug: resolved.slug
      })
    } catch (error) {
      if (error instanceof AmbiguousEventSlugError) {
        return reply.status(409).send(buildAmbiguousEventSlugResponse(error))
      }

      if (error instanceof PublicEventNotFoundError) {
        return reply.status(404).send({
          message: 'Event not found'
        })
      }

      throw error
    }
  }

  const service =
    new GetPublicEventCatalogMenuService()

  const { event } =
    await service.execute({
      organizationSlug: params.organizationSlug,
      eventSlug: params.eventSlug
    })

  return reply.send({
    event
  })
}

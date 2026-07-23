import { z } from 'zod';
import { PublicCallScreenService } from '../services/public-call-screen-service.js';
import { AmbiguousEventSlugError, buildAmbiguousEventSlugResponse, PublicEventNotFoundError } from '../../events/services/public-event-resolver.js';
const callScreenParamsSchema = z.object({
    slug: z.string().trim().min(1).optional(),
    organizationSlug: z.string().trim().min(1).optional(),
    eventSlug: z.string().trim().min(1).optional()
});
function handlePublicCallScreenError(error, reply) {
    if (error instanceof Error &&
        (error.message === 'Call screen context not found' ||
            error instanceof PublicEventNotFoundError)) {
        return reply.status(404).send({
            message: 'Call screen not found'
        });
    }
    if (error instanceof AmbiguousEventSlugError) {
        return reply.status(409).send(buildAmbiguousEventSlugResponse(error));
    }
    throw error;
}
export async function getPublicStoreCallScreenController(request, reply) {
    try {
        const { slug } = callScreenParamsSchema.parse(request.params);
        if (!slug) {
            return reply.status(404).send({
                message: 'Call screen not found'
            });
        }
        const result = await new PublicCallScreenService().getBootstrap({
            contextType: 'STORE',
            slug
        });
        return reply.status(200).send(result);
    }
    catch (error) {
        return handlePublicCallScreenError(error, reply);
    }
}
export async function getPublicEventCallScreenController(request, reply) {
    try {
        const { slug, organizationSlug, eventSlug } = callScreenParamsSchema.parse(request.params);
        const resolvedSlug = slug ?? eventSlug;
        if (!resolvedSlug) {
            return reply.status(404).send({
                message: 'Call screen not found'
            });
        }
        const result = await new PublicCallScreenService().getBootstrap({
            contextType: 'EVENT',
            slug: resolvedSlug,
            organizationSlug,
            eventSlug
        });
        return reply.status(200).send(result);
    }
    catch (error) {
        return handlePublicCallScreenError(error, reply);
    }
}
export async function listPublicStoreCallScreenOrdersController(request, reply) {
    try {
        const { slug } = callScreenParamsSchema.parse(request.params);
        if (!slug) {
            return reply.status(404).send({
                message: 'Call screen not found'
            });
        }
        const result = await new PublicCallScreenService().getOrders({
            contextType: 'STORE',
            slug
        });
        return reply.status(200).send(result);
    }
    catch (error) {
        return handlePublicCallScreenError(error, reply);
    }
}
export async function listPublicEventCallScreenOrdersController(request, reply) {
    try {
        const { slug, organizationSlug, eventSlug } = callScreenParamsSchema.parse(request.params);
        const resolvedSlug = slug ?? eventSlug;
        if (!resolvedSlug) {
            return reply.status(404).send({
                message: 'Call screen not found'
            });
        }
        const result = await new PublicCallScreenService().getOrders({
            contextType: 'EVENT',
            slug: resolvedSlug,
            organizationSlug,
            eventSlug
        });
        return reply.status(200).send(result);
    }
    catch (error) {
        return handlePublicCallScreenError(error, reply);
    }
}

import { prisma } from '../../../lib/prisma.js';
import { buildPublicUrl, getFrontendUrl } from '../../../lib/public-urls.js';
export class AmbiguousEventSlugError extends Error {
    constructor() {
        super('Este link não identifica um evento de forma única.');
        this.code = 'AMBIGUOUS_EVENT_SLUG';
        this.requiresOrganizationSlug = true;
    }
}
export class PublicEventNotFoundError extends Error {
    constructor() {
        super('Event not found');
    }
}
const publicEventSelect = {
    id: true,
    organizationId: true,
    slug: true,
    organization: {
        select: {
            slug: true
        }
    }
};
function canonicalPath(organizationSlug, eventSlug) {
    return `/e/${organizationSlug}/${eventSlug}`;
}
function mapResolved(event) {
    const path = canonicalPath(event.organization.slug, event.slug);
    return {
        id: event.id,
        organizationId: event.organizationId,
        organizationSlug: event.organization.slug,
        slug: event.slug,
        canonicalPath: path,
        canonicalUrl: buildPublicUrl(getFrontendUrl(), path)
    };
}
export async function resolveCanonicalPublicEvent({ organizationSlug, eventSlug }) {
    const event = await prisma.event.findFirst({
        where: {
            slug: eventSlug,
            active: true,
            organization: {
                slug: organizationSlug
            }
        },
        select: publicEventSelect
    });
    if (!event) {
        throw new PublicEventNotFoundError();
    }
    return mapResolved(event);
}
export async function resolveLegacyPublicEventSlug(eventSlug) {
    const events = await prisma.event.findMany({
        where: {
            slug: eventSlug,
            active: true
        },
        select: publicEventSelect,
        take: 2,
        orderBy: {
            createdAt: 'asc'
        }
    });
    if (events.length === 0) {
        throw new PublicEventNotFoundError();
    }
    if (events.length > 1) {
        throw new AmbiguousEventSlugError();
    }
    return mapResolved(events[0]);
}
export function buildAmbiguousEventSlugResponse(error) {
    return {
        code: error.code,
        message: error.message,
        requiresOrganizationSlug: error.requiresOrganizationSlug
    };
}

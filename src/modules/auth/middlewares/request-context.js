import { UserRole } from '@prisma/client';
import { prisma } from '../../../lib/prisma.js';
function sendContextError(reply, statusCode, code, message) {
    return reply.status(statusCode).send({
        code,
        message
    });
}
function readSingleValue(value) {
    if (Array.isArray(value)) {
        return typeof value[0] === 'string' && value[0].trim()
            ? value[0]
            : undefined;
    }
    return typeof value === 'string' && value.trim()
        ? value
        : undefined;
}
function getExplicitTenantId(request) {
    const headerOrganizationId = readSingleValue(request.headers['x-organization-id']);
    if (headerOrganizationId) {
        return {
            organizationId: headerOrganizationId,
            source: 'header'
        };
    }
    const query = request.query;
    const queryOrganizationId = readSingleValue(query?.organizationId);
    if (queryOrganizationId) {
        request.log.warn({ path: request.url }, 'Deprecated tenant impersonation via query.organizationId. Use x-organization-id header.');
        return {
            organizationId: queryOrganizationId,
            source: 'query'
        };
    }
    return {};
}
export async function resolveTenantContext(request, reply) {
    delete request.platformContext;
    delete request.tenantContext;
    if (!request.user) {
        return sendContextError(reply, 401, 'UNAUTHORIZED', 'Unauthorized');
    }
    const explicitTenant = getExplicitTenantId(request);
    if (request.user.role === UserRole.SUPER_ADMIN) {
        if (!explicitTenant.organizationId) {
            return sendContextError(reply, 400, 'TENANT_CONTEXT_REQUIRED', 'Tenant context is required for this operation');
        }
        const organization = await prisma.organization.findUnique({
            where: {
                id: explicitTenant.organizationId
            },
            select: {
                id: true
            }
        });
        if (!organization) {
            return sendContextError(reply, 404, 'TENANT_NOT_FOUND', 'Organization not found');
        }
        request.tenantContext = {
            mode: 'TENANT',
            organizationId: organization.id,
            actingUserId: request.user.sub,
            actingUserRole: UserRole.SUPER_ADMIN,
            impersonated: true
        };
        return;
    }
    if (!request.user.organizationId) {
        return sendContextError(reply, 403, 'TENANT_ACCESS_DENIED', 'User has no organization assigned');
    }
    if (explicitTenant.organizationId &&
        explicitTenant.organizationId !== request.user.organizationId) {
        return sendContextError(reply, 403, 'TENANT_ACCESS_DENIED', 'Authenticated user cannot select another organization');
    }
    request.tenantContext = {
        mode: 'TENANT',
        organizationId: request.user.organizationId,
        actingUserId: request.user.sub,
        actingUserRole: request.user.role,
        impersonated: false
    };
}
export async function requireTenantContext(request, reply) {
    return resolveTenantContext(request, reply);
}
export async function requirePlatformContext(request, reply) {
    delete request.platformContext;
    delete request.tenantContext;
    if (!request.user) {
        return sendContextError(reply, 401, 'UNAUTHORIZED', 'Unauthorized');
    }
    if (request.user.role !== UserRole.SUPER_ADMIN) {
        return sendContextError(reply, 403, 'SUPER_ADMIN_REQUIRED', 'Only SUPER_ADMIN can access this endpoint');
    }
    const explicitTenant = getExplicitTenantId(request);
    if (explicitTenant.organizationId) {
        return sendContextError(reply, 403, 'PLATFORM_CONTEXT_REQUIRED', 'Platform context does not accept an active organization');
    }
    request.platformContext = {
        mode: 'PLATFORM',
        actingUserId: request.user.sub,
        actingUserRole: UserRole.SUPER_ADMIN
    };
}
export function getTenantOrganizationId(request) {
    if (!request.tenantContext) {
        throw new Error('TENANT_CONTEXT_REQUIRED');
    }
    return request.tenantContext.organizationId;
}

import { prisma } from '../../../lib/prisma.js'
import { ModuleKey } from '@prisma/client'

interface UpdateOrganizationModulesRequest {
  id: string
  modules: Array<{ moduleKey: ModuleKey; enabled: boolean }>
}

export class UpdateOrganizationModulesService {
  async execute(data: UpdateOrganizationModulesRequest) {
    const org = await prisma.organization.findUnique({
      where: { id: data.id }
    })

    if (!org) {
      throw new Error('Organization not found')
    }

    // First, delete existing modules for this organization
    await prisma.organizationModule.deleteMany({
      where: { organizationId: data.id }
    })

    // Then create new ones
    if (data.modules.length > 0) {
      await prisma.organizationModule.createMany({
        data: data.modules.map(mod => ({
          organizationId: data.id,
          moduleKey: mod.moduleKey,
          enabled: mod.enabled
        }))
      })
    }

    // Refetch
    const orgWithModules = await prisma.organization.findUnique({
      where: { id: data.id },
      include: { organizationModules: true, users: true }
    })

    if (!orgWithModules) {
      throw new Error('Organization not found')
    }

    return {
      organization: {
        id: orgWithModules.id,
        name: orgWithModules.name,
        slug: orgWithModules.slug,
        city: null,
        active: true,
        createdAt: orgWithModules.createdAt,
        modules: orgWithModules.organizationModules.map(mod => ({
          moduleKey: mod.moduleKey,
          enabled: mod.enabled
        })),
        usersCount: orgWithModules.users.length
      }
    }
  }
}

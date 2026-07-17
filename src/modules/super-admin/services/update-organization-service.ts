import { prisma } from '../../../lib/prisma.js'

interface UpdateOrganizationRequest {
  id: string
  name?: string
  slug?: string
  city?: string | null
  active?: boolean
}

export class UpdateOrganizationService {
  async execute(data: UpdateOrganizationRequest) {
    const org = await prisma.organization.findUnique({
      where: { id: data.id }
    })

    if (!org) {
      throw new Error('Organization not found')
    }

    if (data.slug && data.slug !== org.slug) {
      const existingOrg = await prisma.organization.findUnique({
        where: { slug: data.slug }
      })
      if (existingOrg) {
        throw new Error('Slug already in use')
      }
    }

    const updatedOrg = await prisma.organization.update({
      where: { id: data.id },
      data: {
        name: data.name,
        slug: data.slug
      },
      include: {
        organizationModules: true,
        users: true
      }
    })

    return {
      id: updatedOrg.id,
      name: updatedOrg.name,
      slug: updatedOrg.slug,
      city: null,
      active: true,
      createdAt: updatedOrg.createdAt,
      modules: updatedOrg.organizationModules.map(mod => ({
        moduleKey: mod.moduleKey,
        enabled: mod.enabled
      })),
      modulesCount: updatedOrg.organizationModules.length,
      usersCount: updatedOrg.users.length
    }
  }
}

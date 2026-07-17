import { prisma } from '../../../lib/prisma.js'

export class ListSuperAdminUsersService {
  async execute() {
    const users = await prisma.user.findMany({
      include: {
        organization: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    return users.map(user => ({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      organizationId: user.organizationId,
      organizationName: user.organization.name,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    }))
  }
}

import { FastifyInstance } from 'fastify'
import { verifyJWT } from '../../auth/middlewares/verify-jwt.js'
import { requirePlatformContext } from '../../auth/middlewares/request-context.js'

import { listOrganizationsController } from '../controllers/list-organizations-controller.js'
import { getOrganizationController } from '../controllers/get-organization-controller.js'
import { createOrganizationController } from '../controllers/create-organization-controller.js'
import { updateOrganizationController } from '../controllers/update-organization-controller.js'
import { updateOrganizationModulesController } from '../controllers/update-organization-modules-controller.js'
import { listSuperAdminUsersController } from '../controllers/list-super-admin-users-controller.js'
import { createSuperAdminUserController } from '../controllers/create-super-admin-user-controller.js'
import { updateSuperAdminUserController } from '../controllers/update-super-admin-user-controller.js'

export async function superAdminRoutes(app: FastifyInstance) {
  // Organizations
  app.get('/super-admin/organizations',
    { preHandler: [verifyJWT, requirePlatformContext] },
    listOrganizationsController
  )

  app.get('/super-admin/organizations/:id',
    { preHandler: [verifyJWT, requirePlatformContext] },
    getOrganizationController
  )

  app.post('/super-admin/organizations',
    { preHandler: [verifyJWT, requirePlatformContext] },
    createOrganizationController
  )

  app.patch('/super-admin/organizations/:id',
    { preHandler: [verifyJWT, requirePlatformContext] },
    updateOrganizationController
  )

  app.patch('/super-admin/organizations/:id/modules',
    { preHandler: [verifyJWT, requirePlatformContext] },
    updateOrganizationModulesController
  )

  // Users
  app.get('/super-admin/users',
    { preHandler: [verifyJWT, requirePlatformContext] },
    listSuperAdminUsersController
  )

  app.post('/super-admin/users',
    { preHandler: [verifyJWT, requirePlatformContext] },
    createSuperAdminUserController
  )

  app.patch('/super-admin/users/:id',
    { preHandler: [verifyJWT, requirePlatformContext] },
    updateSuperAdminUserController
  )
}

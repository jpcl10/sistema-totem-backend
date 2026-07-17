import 'dotenv/config'
import jwt from 'jsonwebtoken'

import { app } from '../src/app.js'
import { prisma } from '../src/lib/prisma.js'

async function main() {
  const secret = process.env.JWT_SECRET

  if (!secret) {
    throw new Error('JWT_SECRET is not set')
  }

  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      role: true,
      organizationId: true
    }
  })

  const admin =
    users.find(user => user.email === 'admin@guellospizza.com.br') ??
    users.find(user => user.role === 'ADMIN')
  const superAdmin = users.find(user => user.role === 'SUPER_ADMIN')

  if (!admin || !superAdmin) {
    throw new Error('Required users not found')
  }

  const sign = (user: typeof admin) =>
    jwt.sign(
      {
        role: user.role,
        organizationId: user.organizationId
      },
      secret,
      {
        subject: user.id,
        expiresIn: '1h'
      }
    )

  const adminGuellos = await app.inject({
    method: 'GET',
    url: '/customers',
    headers: {
      authorization: `Bearer ${sign(admin)}`
    }
  })

  const superAdminNoHeader = await app.inject({
    method: 'GET',
    url: '/customers',
    headers: {
      authorization: `Bearer ${sign(superAdmin)}`
    }
  })

  const superAdminZe = await app.inject({
    method: 'GET',
    url: '/customers',
    headers: {
      authorization: `Bearer ${sign(superAdmin)}`,
      'x-organization-id': 'cmra0xvdh0000vwas3yfwzxi9'
    }
  })

  console.log(JSON.stringify({
    adminGuellos: {
      status: adminGuellos.statusCode,
      total: JSON.parse(adminGuellos.body).pagination?.total
    },
    superAdminNoHeader: {
      status: superAdminNoHeader.statusCode,
      body: JSON.parse(superAdminNoHeader.body)
    },
    superAdminZe: {
      status: superAdminZe.statusCode,
      total: JSON.parse(superAdminZe.body).pagination?.total,
      customerIds: JSON.parse(superAdminZe.body).data?.map((customer: { id: string }) => customer.id)
    }
  }, null, 2))
}

main()
  .then(async () => {
    await app.close()
    await prisma.$disconnect()
    process.exit(0)
  })
  .catch(async error => {
    console.error(error)
    await app.close()
    await prisma.$disconnect()
    process.exit(1)
  })

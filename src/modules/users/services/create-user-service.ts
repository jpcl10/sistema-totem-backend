import bcrypt from 'bcryptjs'

import { prisma } from '../../../lib/prisma.js'

interface CreateUserRequest {
  organizationId: string
  name: string
  email: string
  password: string
  role: 'SUPER_ADMIN' | 'ADMIN' | 'OPERATOR'
}

export class CreateUserService {
  async execute(data: CreateUserRequest) {
    const userAlreadyExists = await prisma.user.findUnique({
      where: {
        email: data.email
      }
    })

    if (userAlreadyExists) {
      throw new Error('User already exists.')
    }

    const passwordHash = await bcrypt.hash(
      data.password,
      6
    )

    const user = await prisma.user.create({
      data: {
        organizationId: data.organizationId,
        name: data.name,
        email: data.email,
        password: passwordHash,
        role: data.role
      }
    })

    return user
  }
}
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'

import { prisma } from '../../../lib/prisma.js'

interface AuthenticateRequest {
  email: string
  password: string
}

interface AuthenticateResponse {
  token: string
  user: {
    id: string
    organizationId: string
    name: string
    email: string
    role: 'SUPER_ADMIN' | 'ADMIN' | 'OPERATOR'
  }
}

export class AuthenticateService {
  async execute({
    email,
    password
  }: AuthenticateRequest): Promise<AuthenticateResponse> {
    const user = await prisma.user.findUnique({
      where: {
        email
      }
    })

    if (!user) {
      throw new Error('Invalid credentials.')
    }

    const passwordMatches = await bcrypt.compare(
      password,
      user.password
    )

    if (!passwordMatches) {
      throw new Error('Invalid credentials.')
    }

    const secret = process.env.JWT_SECRET

    if (!secret) {
      throw new Error('JWT_SECRET is not set.')
    }

    const token = jwt.sign(
      {
        role: user.role,
        organizationId: user.organizationId
      },
      secret,
      {
        subject: user.id,
        expiresIn: '7d'
      }
    )

    return {
      token,
      user: {
        id: user.id,
        organizationId: user.organizationId,
        name: user.name,
        email: user.email,
        role: user.role
      }
    }
  }
}

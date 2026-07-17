import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  const args = process.argv.slice(2)
  
  if (args.length < 2) {
    console.error('Usage: npx tsx prisma/reset-user-password.ts <email> <new-password>')
    process.exit(1)
  }

  const [email, newPassword] = args

  const user = await prisma.user.findUnique({
    where: { email }
  })

  if (!user) {
    console.error(`User with email "${email}" not found.`)
    process.exit(1)
  }

  const passwordHash = await bcrypt.hash(newPassword, 6)

  await prisma.user.update({
    where: { id: user.id },
    data: { password: passwordHash }
  })

  console.log(`Password for user "${email}" has been successfully reset!`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

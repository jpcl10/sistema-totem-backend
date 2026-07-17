import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('Starting seed...')

  // Create super admin organization
  const superAdminOrg = await prisma.organization.upsert({
    where: { slug: 'defumar-events' },
    update: {},
    create: {
      name: 'Defumar Events',
      slug: 'defumar-events'
    }
  })

  // Create super admin user
  const superAdminPasswordHash = await bcrypt.hash('admin123', 6)
  await prisma.user.upsert({
    where: { email: 'superadmin@defumarevents.com.br' },
    update: {},
    create: {
      organizationId: superAdminOrg.id,
      name: 'Super Admin',
      email: 'superadmin@defumarevents.com.br',
      password: superAdminPasswordHash,
      role: 'SUPER_ADMIN'
    }
  })

  console.log('Created super admin user')

  // Enable all modules for super admin org
  const modules = ['ONLINE_ORDERS', 'TOTEM', 'EVENTS', 'PAYMENTS', 'PRINTING', 'NFC_CASHLESS', 'FINANCIAL', 'DEVICES', 'REPORTS', 'DELIVERY', 'WHATSAPP', 'LOYALTY']
  for (const moduleKey of modules) {
    await prisma.organizationModule.upsert({
      where: {
        organizationId_moduleKey: {
          organizationId: superAdminOrg.id,
          moduleKey: moduleKey as any
        }
      },
      update: { enabled: true },
      create: {
        organizationId: superAdminOrg.id,
        moduleKey: moduleKey as any,
        enabled: true
      }
    })
  }

  console.log('Enabled all modules for super admin org')

  // Create organization for Guello's Pizza
  const organization = await prisma.organization.upsert({
    where: { slug: 'guellos-pizza' },
    update: {},
    create: {
      name: "Guello's Pizza",
      slug: 'guellos-pizza'
    }
  })

  console.log('Created organization:', organization.id)

  // Create admin user for Guello's Pizza
  const adminPasswordHash = await bcrypt.hash('admin123', 6)
  await prisma.user.upsert({
    where: { email: 'admin@guellospizza.com.br' },
    update: {},
    create: {
      organizationId: organization.id,
      name: 'Admin Guello',
      email: 'admin@guellospizza.com.br',
      password: adminPasswordHash,
      role: 'ADMIN'
    }
  })

  console.log('Created admin user for Guello\'s Pizza')

  // Enable ONLINE_ORDERS module
  await prisma.organizationModule.upsert({
    where: {
      organizationId_moduleKey: {
        organizationId: organization.id,
        moduleKey: 'ONLINE_ORDERS'
      }
    },
    update: { enabled: true },
    create: {
      organizationId: organization.id,
      moduleKey: 'ONLINE_ORDERS',
      enabled: true
    }
  })

  console.log('Enabled ONLINE_ORDERS module')

  // Create online store
  const store = await prisma.onlineStore.upsert({
    where: { slug: 'guellos-pizza' },
    update: {},
    create: {
      organizationId: organization.id,
      name: "Guello's Pizza",
      slug: 'guellos-pizza',
      whatsapp: '5533998161604',
      city: 'Itambacuri',
      isOpen: true,
      active: true
    }
  })

  console.log('Created store:', store.id)

  // Create categories
  const categories = await Promise.all([
    prisma.onlineCategory.upsert({
      where: { storeId_slug: { storeId: store.id, slug: 'pizzas' } },
      update: {},
      create: {
        storeId: store.id,
        name: 'Pizzas',
        slug: 'pizzas',
        sortOrder: 0,
        active: true
      }
    }),
    prisma.onlineCategory.upsert({
      where: { storeId_slug: { storeId: store.id, slug: 'bebidas' } },
      update: {},
      create: {
        storeId: store.id,
        name: 'Bebidas',
        slug: 'bebidas',
        sortOrder: 1,
        active: true
      }
    }),
    prisma.onlineCategory.upsert({
      where: { storeId_slug: { storeId: store.id, slug: 'salgados' } },
      update: {},
      create: {
        storeId: store.id,
        name: 'Salgados',
        slug: 'salgados',
        sortOrder: 2,
        active: true
      }
    }),
  ])

  console.log('Created categories')

  const pizzaCategory = categories.find(c => c.slug === 'pizzas')!
  const bebidasCategory = categories.find(c => c.slug === 'bebidas')!
  const salgadosCategory = categories.find(c => c.slug === 'salgados')!

  // Create products
  const pizzas = [
    { name: 'Portuguesa', price: 4990, description: 'Molho de tomate, mussarela, presunto, ovos, cebola, azeitonas e orégano' },
    { name: 'Calabresa', price: 4490, description: 'Molho de tomate, mussarela, calabresa, cebola e orégano' },
    { name: 'Frango com Catupiry', price: 5490, description: 'Molho de tomate, mussarela, frango desfiado, catupiry e orégano' },
    { name: 'Carne de Sol', price: 5990, description: 'Molho de tomate, mussarela, carne de sol desfiada, cebola e orégano' },
    { name: 'Marguerita', price: 4290, description: 'Molho de tomate, mussarela, tomate fresco, manjericão e orégano' },
    { name: 'Bacon', price: 4990, description: 'Molho de tomate, mussarela, bacon crocante, cebola e orégano' },
    { name: 'Quatro Queijos', price: 5490, description: 'Molho de tomate, mussarela, provolone, parmesão e gorgonzola' },
    { name: 'Atum com Catupiry', price: 5790, description: 'Molho de tomate, mussarela, atum, catupiry, cebola e orégano' },
    { name: 'Camarão', price: 6990, description: 'Molho de tomate, mussarela, camarões, catupiry e orégano' },
    { name: 'Costela Desfiada', price: 6490, description: 'Molho de tomate, mussarela, costela desfiada, cebola e orégano' },
    { name: 'Lombinho Canadense com Abacaxi', price: 5990, description: 'Molho de tomate, mussarela, lombinho canadense, abacaxi e orégano' },
    { name: 'Pepperoni', price: 5290, description: 'Molho de tomate, mussarela e pepperoni' },
    { name: 'Abacaxi com Bacon', price: 5490, description: 'Molho de tomate, mussarela, bacon, abacaxi e orégano' }
  ]

  const bebidas = [
    { name: 'Coca-Cola Lata', price: 490 },
    { name: 'Coca-Cola 2L', price: 990 },
    { name: 'Guaraná Lata', price: 490 },
    { name: 'Guaraná Antarctica 2L', price: 990 }
  ]

  const salgados = [
    { name: 'Coxinha', price: 690 },
    { name: 'Esfirra', price: 590 },
    { name: 'Kibe', price: 690 },
    { name: 'Bolinha de Queijo', price: 590 },
    { name: 'Pastel', price: 790 }
  ]

  // Create pizza products
  for (const [i, pizza] of pizzas.entries()) {
    await prisma.onlineProduct.upsert({
      where: { storeId_name: { storeId: store.id, name: pizza.name } },
      update: {},
      create: {
        storeId: store.id,
        categoryId: pizzaCategory.id,
        name: pizza.name,
        description: pizza.description,
        priceInCents: pizza.price,
        active: true,
        sortOrder: i
      }
    })
  }

  // Create beverage products
  for (const [i, bebida] of bebidas.entries()) {
    await prisma.onlineProduct.upsert({
      where: { storeId_name: { storeId: store.id, name: bebida.name } },
      update: {},
      create: {
        storeId: store.id,
        categoryId: bebidasCategory.id,
        name: bebida.name,
        priceInCents: bebida.price,
        active: true,
        sortOrder: i
      }
    })
  }

  // Create snack products
  for (const [i, salgado] of salgados.entries()) {
    await prisma.onlineProduct.upsert({
      where: { storeId_name: { storeId: store.id, name: salgado.name } },
      update: {},
      create: {
        storeId: store.id,
        categoryId: salgadosCategory.id,
        name: salgado.name,
        priceInCents: salgado.price,
        active: true,
        sortOrder: i
      }
    })
  }

  console.log('Created products')
  console.log('Seed completed successfully!')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

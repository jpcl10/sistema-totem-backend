import assert from 'node:assert/strict'

import { PrinterSector } from '@prisma/client'

import { app } from '../src/app.js'
import { prisma } from '../src/lib/prisma.js'

const suffix =
  Date.now().toString(36)

const created = {
  organizationId: '',
  eventId: '',
  categoryId: '',
  simpleProductId: '',
  optionProductId: '',
  otherProductId: '',
  eventSimpleProductId: '',
  eventOptionProductId: '',
  optionGroupId: '',
  otherOptionGroupId: '',
  validOptionId: '',
  inactiveOptionId: '',
  otherProductOptionId: '',
  printerId: ''
}

async function cleanup() {
  if (!created.organizationId) {
    return
  }

  await prisma.auditLog.deleteMany({
    where: {
      organizationId: created.organizationId
    }
  })
  await prisma.eventPrintJob.deleteMany({
    where: {
      eventId: created.eventId
    }
  })
  await prisma.orderItemOption.deleteMany({
    where: {
      orderItem: {
        order: {
          eventId: created.eventId
        }
      }
    }
  })
  await prisma.orderItem.deleteMany({
    where: {
      order: {
        eventId: created.eventId
      }
    }
  })
  await prisma.order.deleteMany({
    where: {
      eventId: created.eventId
    }
  })
  await prisma.eventPrinter.deleteMany({
    where: {
      eventId: created.eventId
    }
  })
  await prisma.eventProduct.deleteMany({
    where: {
      eventId: created.eventId
    }
  })
  await prisma.catalogProductOption.deleteMany({
    where: {
      organizationId: created.organizationId
    }
  })
  await prisma.catalogProductOptionGroup.deleteMany({
    where: {
      organizationId: created.organizationId
    }
  })
  await prisma.catalogProduct.deleteMany({
    where: {
      organizationId: created.organizationId
    }
  })
  await prisma.catalogCategory.deleteMany({
    where: {
      organizationId: created.organizationId
    }
  })
  await prisma.event.deleteMany({
    where: {
      id: created.eventId
    }
  })
  await prisma.organization.deleteMany({
    where: {
      id: created.organizationId
    }
  })
}

async function setup() {
  const organization =
    await prisma.organization.create({
      data: {
        name: `Selected Options Test ${suffix}`,
        slug: `selected-options-test-${suffix}`
      }
    })

  created.organizationId = organization.id

  const category =
    await prisma.catalogCategory.create({
      data: {
        organizationId: organization.id,
        name: 'Pizzas',
        slug: `pizzas-${suffix}`
      }
    })

  created.categoryId = category.id

  const [simpleProduct, optionProduct, otherProduct] =
    await Promise.all([
      prisma.catalogProduct.create({
        data: {
          organizationId: organization.id,
          catalogCategoryId: category.id,
          name: 'Pizza Simples',
          slug: `pizza-simples-${suffix}`,
          priceInCents: 3000
        }
      }),
      prisma.catalogProduct.create({
        data: {
          organizationId: organization.id,
          catalogCategoryId: category.id,
          name: 'Pizza Com Borda',
          slug: `pizza-com-borda-${suffix}`,
          priceInCents: 6000
        }
      }),
      prisma.catalogProduct.create({
        data: {
          organizationId: organization.id,
          catalogCategoryId: category.id,
          name: 'Produto De Outro Grupo',
          slug: `produto-outro-grupo-${suffix}`,
          priceInCents: 2000
        }
      })
    ])

  created.simpleProductId = simpleProduct.id
  created.optionProductId = optionProduct.id
  created.otherProductId = otherProduct.id

  const [optionGroup, otherOptionGroup] =
    await Promise.all([
      prisma.catalogProductOptionGroup.create({
        data: {
          organizationId: organization.id,
          productId: optionProduct.id,
          name: 'Escolha a borda',
          key: `borda-${suffix}`,
          required: true,
          minSelections: 1,
          maxSelections: 1
        }
      }),
      prisma.catalogProductOptionGroup.create({
        data: {
          organizationId: organization.id,
          productId: otherProduct.id,
          name: 'Outro grupo',
          key: `outro-${suffix}`,
          required: false,
          minSelections: 0,
          maxSelections: 1
        }
      })
    ])

  created.optionGroupId = optionGroup.id
  created.otherOptionGroupId = otherOptionGroup.id

  const [validOption, inactiveOption, otherProductOption] =
    await Promise.all([
      prisma.catalogProductOption.create({
        data: {
          organizationId: organization.id,
          optionGroupId: optionGroup.id,
          name: 'Borda Vulcao',
          key: `borda-vulcao-${suffix}`,
          priceDeltaInCents: 1500
        }
      }),
      prisma.catalogProductOption.create({
        data: {
          organizationId: organization.id,
          optionGroupId: optionGroup.id,
          name: 'Borda Inativa',
          key: `borda-inativa-${suffix}`,
          priceDeltaInCents: 900,
          active: false
        }
      }),
      prisma.catalogProductOption.create({
        data: {
          organizationId: organization.id,
          optionGroupId: otherOptionGroup.id,
          name: 'Opcao De Outro Produto',
          key: `opcao-outro-produto-${suffix}`,
          priceDeltaInCents: 700
        }
      })
    ])

  created.validOptionId = validOption.id
  created.inactiveOptionId = inactiveOption.id
  created.otherProductOptionId = otherProductOption.id

  const event =
    await prisma.event.create({
      data: {
        organizationId: organization.id,
        name: 'Evento Selected Options',
        slug: `evento-selected-options-${suffix}`,
        printingEnabled: true,
        autoPrintEnabled: true,
        printMode: 'FULL_ORDER',
        printerPaperSize: '80mm',
        active: true
      }
    })

  created.eventId = event.id

  const [eventSimpleProduct, eventOptionProduct] =
    await Promise.all([
      prisma.eventProduct.create({
        data: {
          eventId: event.id,
          catalogProductId: simpleProduct.id,
          active: true
        }
      }),
      prisma.eventProduct.create({
        data: {
          eventId: event.id,
          catalogProductId: optionProduct.id,
          active: true
        }
      })
    ])

  created.eventSimpleProductId = eventSimpleProduct.id
  created.eventOptionProductId = eventOptionProduct.id

  const printer =
    await prisma.eventPrinter.create({
      data: {
        eventId: event.id,
        name: 'Printer Test',
        sector: PrinterSector.FULL_ORDER,
        ipAddress: '127.0.0.1',
        port: 9100,
        active: true
      }
    })

  created.printerId = printer.id

  return event
}

async function postOrder(
  slug: string,
  body: unknown
) {
  return app.inject({
    method: 'POST',
    url: `/public/events/${slug}/orders`,
    payload: body
  })
}

async function assertRollback(
  slug: string,
  body: unknown,
  expectedMessage: string
) {
  const before =
    await prisma.order.count({
      where: {
        eventId: created.eventId
      }
    })

  const response =
    await postOrder(slug, body)

  assert.equal(response.statusCode, 400)
  assert.match(response.body, new RegExp(expectedMessage))

  const after =
    await prisma.order.count({
      where: {
        eventId: created.eventId
      }
    })

  assert.equal(after, before)
}

async function main() {
  const event =
    await setup()

  try {
    const simple =
      await postOrder(event.slug, {
        paymentStatus: 'PENDING',
        items: [
          {
            productId: created.eventSimpleProductId,
            quantity: 1
          }
        ]
      })

    assert.equal(simple.statusCode, 201)
    const simpleBody = JSON.parse(simple.body)
    assert.equal(simpleBody.order.totalInCents, 3000)
    assert.equal(simpleBody.order.items[0].options.length, 0)

    const withOption =
      await postOrder(event.slug, {
        paymentStatus: 'PENDING',
        items: [
          {
            productId: created.eventOptionProductId,
            quantity: 2,
            selectedOptions: [
              {
                optionGroupId: created.optionGroupId,
                optionIds: [
                  created.validOptionId
                ]
              }
            ]
          }
        ]
      })

    assert.equal(withOption.statusCode, 201)
    const withOptionBody = JSON.parse(withOption.body)
    assert.equal(withOptionBody.order.totalInCents, 15000)
    assert.equal(withOptionBody.order.items[0].unitPriceInCents, 7500)
    assert.equal(withOptionBody.order.items[0].options.length, 1)
    assert.equal(
      withOptionBody.order.items[0].options[0].priceDeltaInCents,
      1500
    )
    assert.equal(
      withOptionBody.order.items[0].options[0].optionName,
      'Borda Vulcao'
    )

    await assertRollback(
      event.slug,
      {
        items: [
          {
            productId: created.eventOptionProductId,
            quantity: 1
          }
        ]
      },
      'is required'
    )

    await assertRollback(
      event.slug,
      {
        items: [
          {
            productId: created.eventOptionProductId,
            quantity: 1,
            selectedOptions: [
              {
                optionGroupId: created.optionGroupId,
                optionIds: [
                  created.otherProductOptionId
                ]
              }
            ]
          }
        ]
      },
      'not found in group'
    )

    await assertRollback(
      event.slug,
      {
        items: [
          {
            productId: created.eventOptionProductId,
            quantity: 1,
            selectedOptions: [
              {
                optionGroupId: created.optionGroupId,
                optionIds: [
                  created.inactiveOptionId
                ]
              }
            ]
          }
        ]
      },
      'not found in group'
    )

    await assertRollback(
      event.slug,
      {
        items: [
          {
            productId: created.eventOptionProductId,
            quantity: 1,
            selectedOptions: [
              {
                optionGroupId: created.otherOptionGroupId,
                optionIds: [
                  created.otherProductOptionId
                ]
              }
            ]
          }
        ]
      },
      'is required'
    )

    await assertRollback(
      event.slug,
      {
        items: [
          {
            productId: created.eventOptionProductId,
            quantity: 1,
            selectedOptions: [
              {
                optionGroupId: created.optionGroupId,
                optionIds: [
                  created.validOptionId
                ]
              },
              {
                optionGroupId: created.otherOptionGroupId,
                optionIds: [
                  created.otherProductOptionId
                ]
              }
            ]
          }
        ]
      },
      'Unknown option groups'
    )

    const paidWithPrint =
      await postOrder(event.slug, {
        paymentStatus: 'PAID',
        items: [
          {
            productId: created.eventOptionProductId,
            quantity: 1,
            selectedOptions: [
              {
                optionGroupId: created.optionGroupId,
                optionIds: [
                  created.validOptionId
                ]
              }
            ]
          }
        ]
      })

    assert.equal(paidWithPrint.statusCode, 201)
    const paidWithPrintBody = JSON.parse(paidWithPrint.body)
    const printJob =
      await prisma.eventPrintJob.findFirst({
        where: {
          orderId: paidWithPrintBody.order.id
        }
      })

    assert.ok(printJob)
    const payload =
      printJob.payload as {
        items?: {
          options?: {
            groupName: string
            optionName: string
          }[]
        }[]
      }

    assert.equal(payload.items?.[0]?.options?.[0]?.optionName, 'Borda Vulcao')

    console.log(JSON.stringify({
      ok: true,
      route: 'POST /public/events/:slug/orders',
      selectedOptionsPreserved: true,
      totalWithQuantity2InCents: withOptionBody.order.totalInCents,
      snapshotOptions: withOptionBody.order.items[0].options,
      printPayloadOptions: payload.items?.[0]?.options
    }, null, 2))
  } finally {
    await cleanup()
    await app.close()
    await prisma.$disconnect()
  }
}

main().catch(async error => {
  await cleanup()
  await app.close()
  await prisma.$disconnect()
  console.error(error)
  process.exit(1)
})

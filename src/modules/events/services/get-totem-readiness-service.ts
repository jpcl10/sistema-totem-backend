import {
  CategorySector,
  DeviceStatus,
  DeviceType,
  PaymentContextType,
  PaymentProvider,
  SettingsChannel
} from '@prisma/client'

import { prisma } from '../../../lib/prisma.js'
import { PaymentSettingsResolver } from '../../payment-settings/payment-settings-resolver.js'
import { GetMercadoPagoStatusService } from '../../payment-settings/services/get-mercado-pago-status-service.js'
import { SettingsResolverService } from '../../settings/services/settings-resolver-service.js'

type ReadinessIssue = {
  code: string
  message: string
}

function isDeviceOnline(device: { status: DeviceStatus; lastHeartbeatAt: Date | null }) {
  if (device.status !== DeviceStatus.ACTIVE || !device.lastHeartbeatAt) return false
  return Date.now() - device.lastHeartbeatAt.getTime() <= 2 * 60 * 1000
}

export class GetTotemReadinessService {
  async execute({
    organizationId,
    eventId
  }: {
    organizationId: string
    eventId: string
  }) {
    const event = await prisma.event.findFirst({
      where: { id: eventId, organizationId },
      select: {
        id: true,
        name: true,
        slug: true,
        active: true,
        eventProducts: {
          where: { active: true },
          select: {
            id: true,
            catalogProduct: {
              select: {
                name: true,
                catalogCategory: {
                  select: {
                    sector: true,
                    active: true
                  }
                }
              }
            }
          }
        }
      }
    })

    if (!event) {
      throw new Error('Event not found')
    }

    const [mpStatus, paymentSettings, effective, devices] = await Promise.all([
      new GetMercadoPagoStatusService().execute({ organizationId }),
      new PaymentSettingsResolver().resolve({
        organizationId,
        contextType: PaymentContextType.EVENT,
        eventId
      }),
      new SettingsResolverService().execute({
        organizationId,
        eventId,
        channel: SettingsChannel.TOTEM
      }),
      prisma.device.findMany({
        where: {
          organizationId,
          OR: [
            { eventId },
            { eventId: null }
          ],
          type: {
            in: [DeviceType.TOTEM, DeviceType.PRINTER, DeviceType.SK210]
          }
        },
        select: {
          id: true,
          name: true,
          code: true,
          type: true,
          status: true,
          authStatus: true,
          eventId: true,
          lastHeartbeatAt: true,
          updatedAt: true
        }
      })
    ])

    const printing = effective.printing
    const totemDevices = devices.filter(device => device.type === DeviceType.TOTEM)
    const printerDevices = devices.filter(
      device => device.type === DeviceType.PRINTER || device.type === DeviceType.SK210
    )
    const onlineDevices = devices.filter(isDeviceOnline)
    const source = printing.sources.TOTEM
    const targetIds = new Set([
      printing.defaultPrinterDeviceId,
      printing.kitchenPrinterDeviceId,
      printing.barPrinterDeviceId
    ].filter(Boolean))

    const hasInvalidSector = event.eventProducts.some(product => {
      const sector = product.catalogProduct.catalogCategory?.sector
      return sector !== CategorySector.BAR && sector !== CategorySector.KITCHEN
    })

    const checks = {
      mercadoPagoConfigured: mpStatus.configured,
      mercadoPagoCredentialReadable: mpStatus.credentialReadable,
      pixEnabled: Boolean(paymentSettings.methods.pix && mpStatus.pixEnabled),
      webhookReady: mpStatus.webhookReady,
      publicEventValid: event.active,
      checkoutTotemEnabled: event.active,
      printingEnabled: Boolean(printing.printingEnabled && printing.autoPrintEnabled),
      totemSourceEnabled: Boolean(source.enabled && source.autoPrint),
      deviceConfigured: totemDevices.length > 0,
      deviceOnline: onlineDevices.some(device => device.type === DeviceType.TOTEM),
      printerConfigured: printerDevices.length > 0 || targetIds.size > 0,
      totemTargetConfigured: targetIds.size > 0,
      productSectorsValid: !hasInvalidSector
    }

    const blockers: ReadinessIssue[] = []
    const warnings: ReadinessIssue[] = []

    if (!checks.mercadoPagoConfigured) {
      blockers.push({
        code: 'MERCADO_PAGO_NOT_CONFIGURED',
        message: 'Credencial do Mercado Pago nao configurada.'
      })
    }
    if (!checks.mercadoPagoCredentialReadable) {
      blockers.push({
        code: 'MERCADO_PAGO_CREDENTIAL_UNREADABLE',
        message: 'Credencial do Mercado Pago nao pode ser descriptografada.'
      })
    }
    if (!checks.pixEnabled) {
      blockers.push({
        code: 'PIX_NOT_ENABLED',
        message: 'PIX automatico nao esta habilitado para este evento.'
      })
    }
    if (!checks.webhookReady) {
      blockers.push({
        code: 'MERCADO_PAGO_WEBHOOK_NOT_READY',
        message: 'Webhook do Mercado Pago nao esta configurado.'
      })
    }
    if (!checks.printingEnabled || !checks.totemSourceEnabled) {
      blockers.push({
        code: 'TOTEM_AUTO_PRINT_DISABLED',
        message: 'Impressao automatica do TOTEM nao esta habilitada.'
      })
    }
    if (!checks.deviceConfigured) {
      blockers.push({
        code: 'TOTEM_DEVICE_NOT_CONFIGURED',
        message: 'Nenhum dispositivo de totem foi vinculado ao evento.'
      })
    }
    if (!checks.printerConfigured || !checks.totemTargetConfigured) {
      blockers.push({
        code: 'TOTEM_PRINT_TARGET_NOT_CONFIGURED',
        message: 'Nenhum destino de impressao foi configurado para o TOTEM.'
      })
    }
    if (!checks.deviceOnline) {
      warnings.push({
        code: 'TOTEM_DEVICE_OFFLINE',
        message: 'Nenhum dispositivo de totem esta online agora.'
      })
    }
    if (!checks.productSectorsValid) {
      warnings.push({
        code: 'PRODUCT_SECTOR_INVALID',
        message: 'Existem produtos sem setor BAR ou KITCHEN valido.'
      })
    }

    return {
      ready: blockers.length === 0,
      checks,
      blockers,
      warnings,
      mercadoPago: mpStatus,
      printing: {
        printMode: source.printMode,
        paperSize: printing.paperSize,
        defaultPrinterDeviceId: printing.defaultPrinterDeviceId,
        kitchenPrinterDeviceId: printing.kitchenPrinterDeviceId,
        barPrinterDeviceId: printing.barPrinterDeviceId,
        sources: {
          TOTEM: source
        },
        sectors: printing.sectors
      },
      devices: devices.map(device => ({
        id: device.id,
        name: device.name,
        code: device.code,
        codePreview: `${device.code.slice(0, 4)}...${device.code.slice(-3)}`,
        type: device.type,
        status: device.status,
        authStatus: device.authStatus,
        eventId: device.eventId,
        online: isDeviceOnline(device),
        lastHeartbeatAt: device.lastHeartbeatAt,
        updatedAt: device.updatedAt
      }))
    }
  }
}

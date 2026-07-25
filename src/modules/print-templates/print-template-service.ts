import { AuditAction, Prisma } from '@prisma/client'

import { prisma } from '../../lib/prisma.js'
import { CreateAuditLogService } from '../audit-logs/services/create-audit-log-service.js'
import {
  defaultPreviewOrder,
  renderPrintTemplatePreview
} from './print-template-renderer.js'

type TemplateType = 'PRODUCTION' | 'CUSTOMER' | 'DELIVERY' | 'CASHIER' | 'TEST'
type TemplatePrintMode = 'FULL_ORDER' | 'BY_SECTOR' | 'ONE_TICKET_PER_ITEM'

type TemplateInput = {
  organizationId?: string | null
  eventId?: string | null
  printerId?: string | null
  name: string
  templateType: TemplateType
  paperWidthMm: 58 | 80
  logoUrl?: string | null
  logoEnabled?: boolean
  logoWidthPx?: number
  title?: string | null
  subtitle?: string | null
  showOrderNumber?: boolean
  showDate?: boolean
  showTime?: boolean
  showOrigin?: boolean
  showOperator?: boolean
  showCustomer?: boolean
  showSector?: boolean
  showObservations?: boolean
  itemFontSize?: number
  titleFontSize?: number
  quantityBold?: boolean
  footerText?: string | null
  copies?: number
  feedLines?: number
  autoCut?: boolean
  printMode?: TemplatePrintMode
  isDefault?: boolean
  isActive?: boolean
}

type TemplateUpdate = Partial<TemplateInput>

const defaultDefumarTemplate = {
  id: 'global-defumar-production',
  organizationId: null,
  eventId: null,
  printerId: null,
  name: 'Modelo padrao Defumar',
  templateType: 'PRODUCTION',
  paperWidthMm: 80,
  logoUrl: null,
  logoEnabled: false,
  logoWidthPx: 240,
  title: 'NOME DO EVENTO',
  subtitle: 'FICHA DE PRODUCAO',
  showOrderNumber: true,
  showDate: true,
  showTime: true,
  showOrigin: true,
  showOperator: true,
  showCustomer: false,
  showSector: true,
  showObservations: true,
  itemFontSize: 2,
  titleFontSize: 2,
  quantityBold: true,
  footerText: null,
  copies: 1,
  feedLines: 4,
  autoCut: true,
  printMode: 'FULL_ORDER',
  isDefault: true,
  isActive: true,
  createdAt: new Date(0),
  updatedAt: new Date(0)
} as const

export class PrintTemplateService {
  async list({
    organizationId,
    eventId,
    printerId,
    templateType,
    includeInactive
  }: {
    organizationId?: string
    eventId?: string
    printerId?: string
    templateType?: TemplateType
    includeInactive: boolean
  }) {
    return prisma.printTemplate.findMany({
      where: {
        ...(organizationId ? { organizationId } : {}),
        ...(eventId ? { eventId } : {}),
        ...(printerId ? { printerId } : {}),
        ...(templateType ? { templateType } : {}),
        ...(includeInactive ? {} : { isActive: true })
      },
      orderBy: [
        { isDefault: 'desc' },
        { updatedAt: 'desc' }
      ]
    })
  }

  async create(input: TemplateInput, userId?: string) {
    await this.validateScope(input)
    if (input.isDefault && input.isActive !== false) {
      await this.clearDefault(input)
    }

    const template = await prisma.printTemplate.create({
      data: this.toCreateData(input)
    })

    await this.audit({
      action: AuditAction.PRINT_TEMPLATE_CREATED,
      template,
      userId,
      description: 'Modelo de impressao criado'
    })

    return template
  }

  async update(id: string, input: TemplateUpdate, userId?: string) {
    const current = await this.findById(id)
    const merged = {
      ...current,
      ...input
    }

    await this.validateScope(merged)
    if (merged.isDefault && merged.isActive) {
      await this.clearDefault(merged, id)
    }

    const template = await prisma.printTemplate.update({
      where: { id },
      data: this.toUpdateData(input)
    })

    await this.audit({
      action: AuditAction.PRINT_TEMPLATE_UPDATED,
      template,
      userId,
      description: 'Modelo de impressao atualizado'
    })

    return template
  }

  async duplicate(id: string, userId?: string) {
    const current = await this.findById(id)
    return this.create({
      organizationId: current.organizationId,
      eventId: current.eventId,
      printerId: current.printerId,
      name: `${current.name} (copia)`,
      templateType: current.templateType as TemplateType,
      paperWidthMm: current.paperWidthMm === 58 ? 58 : 80,
      logoUrl: current.logoUrl,
      logoEnabled: current.logoEnabled,
      logoWidthPx: current.logoWidthPx,
      title: current.title,
      subtitle: current.subtitle,
      showOrderNumber: current.showOrderNumber,
      showDate: current.showDate,
      showTime: current.showTime,
      showOrigin: current.showOrigin,
      showOperator: current.showOperator,
      showCustomer: current.showCustomer,
      showSector: current.showSector,
      showObservations: current.showObservations,
      itemFontSize: current.itemFontSize,
      titleFontSize: current.titleFontSize,
      quantityBold: current.quantityBold,
      footerText: current.footerText,
      copies: current.copies,
      feedLines: current.feedLines,
      autoCut: current.autoCut,
      printMode: current.printMode as TemplatePrintMode,
      isDefault: false
    }, userId)
  }

  async remove(id: string, userId?: string) {
    const current = await this.findById(id)
    await prisma.printTemplate.delete({ where: { id } })
    await this.audit({
      action: AuditAction.PRINT_TEMPLATE_DELETED,
      template: current,
      userId,
      description: 'Modelo de impressao excluido'
    })
    return { ok: true }
  }

  async setDefault(id: string, userId?: string) {
    const current = await this.findById(id)
    await this.clearDefault(current, id)
    const template = await prisma.printTemplate.update({
      where: { id },
      data: {
        isDefault: true,
        isActive: true
      }
    })
    await this.audit({
      action: AuditAction.PRINT_TEMPLATE_DEFAULT_SET,
      template,
      userId,
      description: 'Modelo de impressao definido como padrao'
    })
    return template
  }

  async resolve({
    organizationId,
    eventId,
    printerId,
    templateType
  }: {
    organizationId?: string
    eventId?: string
    printerId?: string
    templateType: TemplateType
  }) {
    const candidates = await prisma.printTemplate.findMany({
      where: {
        templateType,
        isActive: true,
        isDefault: true,
        OR: [
          ...(printerId ? [{ printerId }] : []),
          ...(eventId ? [{ eventId, printerId: null }] : []),
          ...(organizationId ? [{ organizationId, eventId: null, printerId: null }] : []),
          { organizationId: null, eventId: null, printerId: null }
        ]
      }
    })

    return (
      candidates.find(template => printerId && template.printerId === printerId) ??
      candidates.find(template => eventId && template.eventId === eventId && !template.printerId) ??
      candidates.find(template => organizationId && template.organizationId === organizationId && !template.eventId && !template.printerId) ??
      candidates.find(template => !template.organizationId && !template.eventId && !template.printerId) ??
      defaultDefumarTemplate
    )
  }

  async preview(id: string, order?: unknown) {
    const template =
      id === defaultDefumarTemplate.id
        ? defaultDefumarTemplate
        : await this.findById(id)

    return renderPrintTemplatePreview(
      template,
      order ?? defaultPreviewOrder()
    )
  }

  previewTemplate(template: unknown, order?: unknown) {
    return renderPrintTemplatePreview(
      {
        ...defaultDefumarTemplate,
        ...(template && typeof template === 'object' ? template : {})
      },
      order ?? defaultPreviewOrder()
    )
  }

  private async findById(id: string) {
    const template = await prisma.printTemplate.findUnique({
      where: { id }
    })
    if (!template) throw new Error('Print template not found')
    return template
  }

  private async validateScope(input: {
    organizationId?: string | null
    eventId?: string | null
    printerId?: string | null
  }) {
    const filled = [
      Boolean(input.organizationId),
      Boolean(input.eventId),
      Boolean(input.printerId)
    ].filter(Boolean).length

    if (filled > 1) {
      throw new Error('Print template must target only one scope')
    }
  }

  private async clearDefault(
    input: {
      organizationId?: string | null
      eventId?: string | null
      printerId?: string | null
      templateType: string
    },
    exceptId?: string
  ) {
    await prisma.printTemplate.updateMany({
      where: {
        id: exceptId ? { not: exceptId } : undefined,
        templateType: input.templateType as TemplateType,
        isDefault: true,
        isActive: true,
        organizationId: input.organizationId ?? null,
        eventId: input.eventId ?? null,
        printerId: input.printerId ?? null
      },
      data: {
        isDefault: false
      }
    })
  }

  private toCreateData(input: TemplateInput): Prisma.PrintTemplateCreateInput {
    return {
      name: input.name,
      templateType: input.templateType,
      paperWidthMm: input.paperWidthMm,
      logoUrl: input.logoUrl ?? null,
      logoEnabled: input.logoEnabled ?? false,
      logoWidthPx: input.logoWidthPx ?? 240,
      title: input.title ?? null,
      subtitle: input.subtitle ?? null,
      showOrderNumber: input.showOrderNumber ?? true,
      showDate: input.showDate ?? true,
      showTime: input.showTime ?? true,
      showOrigin: input.showOrigin ?? true,
      showOperator: input.showOperator ?? true,
      showCustomer: input.showCustomer ?? true,
      showSector: input.showSector ?? true,
      showObservations: input.showObservations ?? true,
      itemFontSize: input.itemFontSize ?? 2,
      titleFontSize: input.titleFontSize ?? 2,
      quantityBold: input.quantityBold ?? true,
      footerText: input.footerText ?? null,
      copies: input.copies ?? 1,
      feedLines: input.feedLines ?? 4,
      autoCut: input.autoCut ?? true,
      printMode: input.printMode ?? 'FULL_ORDER',
      isDefault: input.isDefault ?? false,
      isActive: input.isActive ?? true,
      ...(input.organizationId
        ? { organization: { connect: { id: input.organizationId } } }
        : {}),
      ...(input.eventId
        ? { event: { connect: { id: input.eventId } } }
        : {}),
      ...(input.printerId
        ? { printer: { connect: { id: input.printerId } } }
        : {})
    }
  }

  private toUpdateData(input: TemplateUpdate): Prisma.PrintTemplateUpdateInput {
    const { organizationId, eventId, printerId, ...fields } = input
    const data: Prisma.PrintTemplateUpdateInput = { ...fields }

    if ('organizationId' in input) {
      data.organization = organizationId
        ? { connect: { id: organizationId } }
        : { disconnect: true }
    }
    if ('eventId' in input) {
      data.event = eventId
        ? { connect: { id: eventId } }
        : { disconnect: true }
    }
    if ('printerId' in input) {
      data.printer = printerId
        ? { connect: { id: printerId } }
        : { disconnect: true }
    }

    return data
  }

  private async audit({
    action,
    template,
    userId,
    description
  }: {
    action: AuditAction
    template: { id: string; organizationId?: string | null; eventId?: string | null; name: string; templateType: string }
    userId?: string
    description: string
  }) {
    if (!template.organizationId) return
    await new CreateAuditLogService().execute({
      organizationId: template.organizationId,
      eventId: template.eventId ?? null,
      userId,
      entity: 'PrintTemplate',
      entityId: template.id,
      action,
      description,
      metadata: {
        printTemplateId: template.id,
        name: template.name,
        templateType: template.templateType
      }
    })
  }
}

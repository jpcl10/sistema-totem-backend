type PrintTemplateLike = {
  paperWidthMm: number
  logoUrl?: string | null
  logoEnabled: boolean
  logoWidthPx: number
  title?: string | null
  subtitle?: string | null
  showOrderNumber: boolean
  showDate: boolean
  showTime: boolean
  showOrigin: boolean
  showOperator: boolean
  showCustomer: boolean
  showSector: boolean
  showObservations: boolean
  itemFontSize?: number
  titleFontSize?: number
  quantityBold?: boolean
  footerText?: string | null
  printMode: string
}

type TicketLine = {
  type: 'text' | 'separator' | 'logo' | 'blank'
  text?: string
  align?: 'left' | 'center' | 'right'
  bold?: boolean
  size?: 'normal' | 'large'
  url?: string
  widthPx?: number
}

const sourceLabels: Record<string, string> = {
  MANUAL_EVENT: 'Venda manual',
  MANUAL_STORE: 'Venda manual',
  DIGITAL_MENU: 'Cardapio digital',
  WHATSAPP: 'WhatsApp',
  ADMIN: 'Painel administrativo',
  POS: 'PDV',
  API: 'Integracao',
  EVENT: 'Evento',
  TOTEM: 'Totem',
  ONLINE_STORE: 'Loja online',
  WAITER: 'Garcom'
}

const sectorLabels: Record<string, string> = {
  FULL_ORDER: 'Pedido completo',
  KITCHEN: 'Cozinha',
  COZINHA: 'Cozinha',
  BAR: 'Bar',
  PIZZERIA: 'Pizzaria',
  DELIVERY: 'Entrega',
  GENERAL: 'Geral',
  COOK: 'Cozinha'
}

export function labelPrintValue(value: unknown): string {
  if (typeof value !== 'string') return ''
  return sourceLabels[value] ?? sectorLabels[value] ?? value
}

export function defaultPreviewOrder() {
  return {
    eventName: 'NOME DO EVENTO',
    orderNumber: '002',
    source: 'MANUAL_EVENT',
    operatorName: 'Joao',
    customerName: '',
    sector: 'KITCHEN',
    createdAt: new Date('2026-07-25T09:07:00-03:00').toISOString(),
    notes: 'Venda manual criada pelo painel.',
    items: [
      {
        quantity: 1,
        name: 'TORRESMO DE ROLO',
        options: ['250 g'],
        notes: ''
      },
      {
        quantity: 1,
        name: 'QUEIJO EXTRA',
        options: [],
        notes: ''
      }
    ]
  }
}

export function renderPrintTemplatePreview(
  template: PrintTemplateLike,
  inputOrder?: unknown
) {
  const order = normalizeOrder(inputOrder)
  const columns = template.paperWidthMm === 58 ? 32 : 48
  const createdAt = order.createdAt ? new Date(order.createdAt) : new Date()
  const lines: TicketLine[] = []

  if (template.logoEnabled && template.logoUrl) {
    lines.push({
      type: 'logo',
      url: template.logoUrl,
      widthPx: template.logoWidthPx,
      align: 'center'
    })
    lines.push({ type: 'blank' })
  }

  lines.push({
    type: 'text',
    text: template.title || order.eventName || 'DEFUMAR',
    align: 'center',
    bold: true,
    size: (template.titleFontSize ?? 1) > 1 ? 'large' : 'normal'
  })
  if (template.subtitle) {
    lines.push({
      type: 'text',
      text: template.subtitle,
      align: 'center',
      bold: true
    })
  }
  lines.push({ type: 'separator' })

  const headerLeft = template.showOrderNumber
    ? `PEDIDO #${order.orderNumber || '---'}`
    : ''
  const headerRight = template.showTime
    ? createdAt.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'America/Sao_Paulo'
    })
    : ''
  if (headerLeft || headerRight) {
    lines.push({
      type: 'text',
      text: spread(headerLeft, headerRight, columns),
      bold: true,
      size: 'large'
    })
  }
  if (template.showDate) {
    lines.push({
      type: 'text',
      text: createdAt.toLocaleDateString('pt-BR', {
        timeZone: 'America/Sao_Paulo'
      })
    })
  }
  lines.push({ type: 'separator' })

  if (template.showSector && order.sector) {
    lines.push({
      type: 'text',
      text: `SETOR: ${labelPrintValue(order.sector).toUpperCase()}`,
      bold: true,
      size: 'large'
    })
    lines.push({ type: 'blank' })
  }

  for (const item of order.items) {
    const itemText = `${item.quantity}x ${item.name}`.toUpperCase()
    lines.push({
      type: 'text',
      text: itemText,
      bold: true,
      size: 'large'
    })
    for (const detail of item.options) {
      for (const wrapped of wrapText(detail, columns - 3)) {
        lines.push({
          type: 'text',
          text: `   ${wrapped}`
        })
      }
    }
    if (item.notes) {
      for (const wrapped of wrapText(item.notes, columns - 3)) {
        lines.push({
          type: 'text',
          text: `   ${wrapped}`
        })
      }
    }
    lines.push({ type: 'blank' })
  }

  if (template.showObservations && order.notes) {
    lines.push({ type: 'separator' })
    lines.push({ type: 'text', text: 'OBSERVACAO', bold: true })
    lines.push({ type: 'blank' })
    for (const wrapped of wrapText(order.notes, columns)) {
      lines.push({ type: 'text', text: wrapped })
    }
  }

  const footerRows = []
  if (template.showOrigin && order.source) {
    footerRows.push(`Origem: ${labelPrintValue(order.source)}`)
  }
  if (template.showOperator && order.operatorName) {
    footerRows.push(`Operador: ${order.operatorName}`)
  }
  if (template.showCustomer && order.customerName) {
    footerRows.push(`Cliente: ${order.customerName}`)
  }

  if (footerRows.length > 0 || template.footerText) {
    lines.push({ type: 'separator' })
    for (const row of footerRows) {
      for (const wrapped of wrapText(row, columns)) {
        lines.push({ type: 'text', text: wrapped })
      }
    }
    if (template.footerText) {
      lines.push({ type: 'blank' })
      for (const wrapped of wrapText(template.footerText, columns)) {
        lines.push({ type: 'text', text: wrapped, align: 'center' })
      }
    }
  }

  return {
    paperWidthMm: template.paperWidthMm,
    columns,
    printMode: template.printMode,
    lines
  }
}

export function wrapText(value: string, width: number): string[] {
  const normalized = value.replace(/\s+/g, ' ').trim()
  if (!normalized) return []
  const words = normalized.split(' ')
  const lines: string[] = []
  let current = ''

  for (const word of words) {
    if (!current) {
      current = word
      continue
    }

    if (`${current} ${word}`.length <= width) {
      current = `${current} ${word}`
    } else {
      lines.push(current)
      current = word
    }
  }

  if (current) lines.push(current)
  return lines
}

function spread(left: string, right: string, width: number) {
  if (!left) return right
  if (!right) return left
  const spaces = Math.max(1, width - left.length - right.length)
  return `${left}${' '.repeat(spaces)}${right}`
}

function normalizeOrder(value: unknown) {
  const raw =
    value && typeof value === 'object'
      ? value as Record<string, unknown>
      : defaultPreviewOrder() as unknown as Record<string, unknown>

  return {
    eventName: stringValue(raw.eventName) || stringValue(raw.storeName),
    orderNumber: stringValue(raw.orderNumber),
    source: stringValue(raw.source),
    operatorName: stringValue(raw.operatorName) || stringValue(raw.operator),
    customerName: stringValue(raw.customerName) || stringValue(raw.customer),
    sector: stringValue(raw.sector) || stringValue(raw.printerSector),
    createdAt: stringValue(raw.createdAt),
    notes: stringValue(raw.notes) || stringValue(raw.observation),
    items: Array.isArray(raw.items)
      ? raw.items.map(normalizeItem)
      : defaultPreviewOrder().items
  }
}

function normalizeItem(value: unknown): {
  quantity: number
  name: string
  notes: string
  options: string[]
} {
  const item =
    value && typeof value === 'object'
      ? value as Record<string, unknown>
      : {}

  return {
    quantity: numberValue(item.quantity) || 1,
    name: stringValue(item.name) || stringValue(item.productName) || 'ITEM',
    notes: stringValue(item.notes),
    options: [
      ...stringArray(item.options),
      ...stringArray(item.additions)
    ]
  }
}

function stringValue(value: unknown) {
  if (typeof value === 'string' && value.trim()) return value.trim()
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return ''
}

function numberValue(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : 0
  }
  return 0
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value
    .map(item => stringValue(item))
    .filter(Boolean)
}

import assert from 'node:assert/strict'
import test from 'node:test'

import {
  defaultPreviewOrder,
  labelPrintValue,
  renderPrintTemplatePreview,
  wrapText
} from './print-template-renderer.js'

const template = {
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
  footerText: null,
  printMode: 'FULL_ORDER'
}

test('print template renderer translates internal labels', () => {
  assert.equal(labelPrintValue('MANUAL_EVENT'), 'Venda manual')
  assert.equal(labelPrintValue('KITCHEN'), 'Cozinha')
})

test('print template renderer wraps text without cutting words', () => {
  assert.deepEqual(wrapText('Venda manual criada pelo painel', 12), [
    'Venda manual',
    'criada pelo',
    'painel'
  ])
})

test('print template preview hides internal enums and renders production hierarchy', () => {
  const preview = renderPrintTemplatePreview(template, defaultPreviewOrder())
  const text = preview.lines
    .map(line => line.text ?? '')
    .join('\n')

  assert.equal(preview.paperWidthMm, 80)
  assert.match(text, /PEDIDO #002/)
  assert.match(text, /SETOR: COZINHA/)
  assert.match(text, /Origem: Venda manual/)
  assert.doesNotMatch(text, /MANUAL_EVENT/)
  assert.doesNotMatch(text, /KITCHEN/)
})

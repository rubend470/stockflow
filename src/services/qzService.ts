import qz from 'qz-tray'
import type { AppSettings } from '../types/settings'
import type { CartItem, SalePaymentInput, SaleResult } from '../types/sale'
import { formatDecimalColombian } from '../utils/formatMoney'

const CASH_DRAWER_PULSE = '\x1B\x70\x00\x19\xFA'
const INIT_PRINTER = '\x1B\x40'
const ALIGN_LEFT = '\x1B\x61\x00'
const ALIGN_CENTER = '\x1B\x61\x01'
const BOLD_ON = '\x1B\x45\x01'
const BOLD_OFF = '\x1B\x45\x00'
const FEED_AND_CUT = '\n\n\n\x1D\x56\x00'
const TICKET_WIDTH = 32

interface PrintSaleTicketInput {
  sale: SaleResult
  items: CartItem[]
  payments: SalePaymentInput[]
  settings: AppSettings
  cashierName: string
  baseCurrencyCode: string
}

async function ensureQzConnection() {
  if (!qz.websocket.isActive()) {
    await qz.websocket.connect()
  }
}

async function resolvePrinterName() {
  await ensureQzConnection()

  const jaltechPrinters = await qz.printers.find('Jaltech')
  if (Array.isArray(jaltechPrinters) && jaltechPrinters.length > 0) {
    return jaltechPrinters[0]
  }
  if (typeof jaltechPrinters === 'string' && jaltechPrinters.trim()) {
    return jaltechPrinters
  }

  return qz.printers.getDefault()
}

async function resolvePrinterTarget() {
  await ensureQzConnection()

  const jaltechPrinters = await qz.printers.find('Jaltech')
  if (Array.isArray(jaltechPrinters) && jaltechPrinters.length > 0) {
    return { name: jaltechPrinters[0], rawEscPos: true }
  }
  if (typeof jaltechPrinters === 'string' && jaltechPrinters.trim()) {
    return { name: jaltechPrinters, rawEscPos: true }
  }

  return { name: await qz.printers.getDefault(), rawEscPos: false }
}

function cleanText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x20-\x7E]/g, '')
}

function line(value = '') {
  return `${cleanText(value).slice(0, TICKET_WIDTH)}\n`
}

function center(value: string) {
  const text = cleanText(value).slice(0, TICKET_WIDTH)
  const left = Math.max(Math.floor((TICKET_WIDTH - text.length) / 2), 0)
  return `${' '.repeat(left)}${text}\n`
}

function money(amount: number, currencyCode: string) {
  return `${currencyCode} ${formatDecimalColombian(amount)}`
}

function twoColumns(left: string, right: string) {
  const safeRight = cleanText(right).slice(0, 14)
  const safeLeft = cleanText(left).slice(0, TICKET_WIDTH - safeRight.length - 1)
  const gap = Math.max(TICKET_WIDTH - safeLeft.length - safeRight.length, 1)
  return `${safeLeft}${' '.repeat(gap)}${safeRight}\n`
}

function buildTicket(input: PrintSaleTicketInput) {
  const { sale, items, payments, settings, cashierName, baseCurrencyCode } = input
  const businessName = settings.businessName || 'StockFlow'
  const createdAt = new Intl.DateTimeFormat('es-CO', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date())

  const rows: string[] = [
    INIT_PRINTER,
    CASH_DRAWER_PULSE,
    ALIGN_CENTER,
    BOLD_ON,
    center(businessName),
    BOLD_OFF,
  ]

  if (settings.address) rows.push(center(settings.address))
  if (settings.phone) rows.push(center(`Tel: ${settings.phone}`))

  rows.push(
    ALIGN_LEFT,
    line('-'.repeat(TICKET_WIDTH)),
    line(`Ticket: ${sale.saleNumber}`),
    line(`Fecha: ${createdAt}`),
    line(`Cajero: ${cashierName}`),
    line('-'.repeat(TICKET_WIDTH)),
  )

  items.forEach((item) => {
    rows.push(line(item.productName))
    rows.push(
      twoColumns(
        `${formatDecimalColombian(item.quantity)} ${item.unitLabel} x ${money(item.unitPrice, baseCurrencyCode)}`,
        money(item.lineRevenue, baseCurrencyCode),
      ),
    )
  })

  rows.push(line('-'.repeat(TICKET_WIDTH)))
  rows.push(BOLD_ON, twoColumns('TOTAL', money(sale.total, baseCurrencyCode)), BOLD_OFF)

  if (payments.length > 0) {
    rows.push(line('Pagos:'))
    payments.forEach((payment) => {
      rows.push(twoColumns(payment.isCredit ? 'Credito' : payment.methodName, money(payment.amountInBase, baseCurrencyCode)))
    })
  }

  rows.push(
    line('-'.repeat(TICKET_WIDTH)),
    ALIGN_CENTER,
    line('Gracias por su compra'),
    FEED_AND_CUT,
  )

  return rows.join('')
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function buildTicketHtml(input: PrintSaleTicketInput) {
  const { sale, items, payments, settings, cashierName, baseCurrencyCode } = input
  const businessName = settings.businessName || 'StockFlow'
  const createdAt = new Intl.DateTimeFormat('es-CO', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date())

  const itemRows = items
    .map(
      (item) => `
        <div class="item">
          <strong>${escapeHtml(item.productName)}</strong>
          <div>
            <span>${formatDecimalColombian(item.quantity)} ${escapeHtml(item.unitLabel)} x ${escapeHtml(money(item.unitPrice, baseCurrencyCode))}</span>
            <b>${escapeHtml(money(item.lineRevenue, baseCurrencyCode))}</b>
          </div>
        </div>
      `,
    )
    .join('')

  const paymentRows = payments
    .map(
      (payment) => `
        <div class="row">
          <span>${escapeHtml(payment.isCredit ? 'Credito' : payment.methodName)}</span>
          <b>${escapeHtml(money(payment.amountInBase, baseCurrencyCode))}</b>
        </div>
      `,
    )
    .join('')

  return `
    <html>
      <head>
        <meta charset="utf-8" />
        <style>
          * { box-sizing: border-box; }
          body {
            width: 58mm;
            margin: 0;
            padding: 4mm;
            font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
            font-size: 11px;
            color: #111827;
          }
          h1 { margin: 0 0 3px; text-align: center; font-size: 15px; }
          p { margin: 2px 0; text-align: center; }
          hr { border: 0; border-top: 1px dashed #111827; margin: 7px 0; }
          .meta { text-align: left; }
          .item { margin: 6px 0; }
          .item strong { display: block; margin-bottom: 2px; }
          .item div, .row {
            display: flex;
            justify-content: space-between;
            gap: 8px;
          }
          .total { font-size: 14px; font-weight: 800; }
          .thanks { margin-top: 10px; text-align: center; font-weight: 700; }
        </style>
      </head>
      <body>
        <h1>${escapeHtml(businessName)}</h1>
        ${settings.address ? `<p>${escapeHtml(settings.address)}</p>` : ''}
        ${settings.phone ? `<p>Tel: ${escapeHtml(settings.phone)}</p>` : ''}
        <hr />
        <div class="meta">Ticket: ${escapeHtml(sale.saleNumber)}</div>
        <div class="meta">Fecha: ${escapeHtml(createdAt)}</div>
        <div class="meta">Cajero: ${escapeHtml(cashierName)}</div>
        <hr />
        ${itemRows}
        <hr />
        <div class="row total">
          <span>TOTAL</span>
          <b>${escapeHtml(money(sale.total, baseCurrencyCode))}</b>
        </div>
        ${paymentRows ? `<hr /><strong>Pagos:</strong>${paymentRows}` : ''}
        <hr />
        <div class="thanks">Gracias por su compra</div>
      </body>
    </html>
  `
}

async function sendRawToPrinter(data: string) {
  const printerName = await resolvePrinterName()
  const config = qz.configs.create(printerName)
  await qz.print(config, [{ type: 'raw', format: 'command', flavor: 'plain', data }])
}

async function sendHtmlToPrinter(printerName: string, data: string) {
  const config = qz.configs.create(printerName)
  await qz.print(config, [{ type: 'pixel', format: 'html', flavor: 'plain', data }])
}

export async function printSaleTicket(input: PrintSaleTicketInput) {
  const printer = await resolvePrinterTarget()

  if (printer.rawEscPos) {
    const config = qz.configs.create(printer.name)
    await qz.print(config, [{ type: 'raw', format: 'command', flavor: 'plain', data: buildTicket(input) }])
    return
  }

  await sendHtmlToPrinter(printer.name, buildTicketHtml(input))
}

export async function openCashDrawer() {
  await sendRawToPrinter(`${INIT_PRINTER}${CASH_DRAWER_PULSE}`)
}

export function getQzFriendlyError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)

  if (/connect|websocket|refused|closed|unavailable/i.test(message)) {
    return 'No se pudo conectar con QZ Tray. Verifica que QZ Tray esté instalado y abierto en este equipo.'
  }

  if (/printer|default|find/i.test(message)) {
    return 'No se encontró la impresora. Verifica que la Jaltech esté instalada o configurada como impresora predeterminada.'
  }

  return `No se pudo completar la acción con QZ Tray. ${message}`
}

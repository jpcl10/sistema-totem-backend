import { EventPrinter }
  from '@prisma/client'

import { TcpPrinter }
  from './tcp-printer.js'

import { GertecSk210Printer }
  from './gertec-sk210-printer.js'

export class PrinterFactory {
  static getPrinter(
    printer: EventPrinter
  ) {
    switch (printer.connectionType) {
      case 'TCP_IP':
        return new TcpPrinter()

      case 'SK210_LOCAL':
        return new GertecSk210Printer()

      default:
        throw new Error(
          'Printer connection type not supported'
        )
    }
  }
}
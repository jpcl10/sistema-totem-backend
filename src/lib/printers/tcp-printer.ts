import net from 'node:net'

interface TcpPrinterPrintRequest {
  ipAddress: string
  port: number
  content: string
}

export class TcpPrinter {
  async print({
    ipAddress,
    port,
    content
  }: TcpPrinterPrintRequest) {
    return new Promise<void>((resolve, reject) => {
      const socket = new net.Socket()

      socket.connect(port, ipAddress, () => {
        socket.write(content)
        socket.end()
      })

      socket.on('close', () => {
        resolve()
      })

      socket.on('error', error => {
        reject(error)
      })
    })
  }
}
import net from 'node:net'

interface PrintOptions {
  ipAddress: string
  port: number
  content: string
}

export async function sendToThermalPrinter({
  ipAddress,
  port,
  content
}: PrintOptions) {
  return new Promise<void>((resolve, reject) => {
    const client = new net.Socket()

    client.connect(port, ipAddress, () => {
      const ESC = '\x1B'
      const GS = '\x1D'

      const initialize = ESC + '@'
      const cutPaper = GS + 'V' + '\x00'

      client.write(initialize)
      client.write(content)
      client.write('\n\n\n')
      client.write(cutPaper)

      client.end()

      resolve()
    })

    client.on('error', error => {
      reject(error)
    })
  })
}
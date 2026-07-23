import net from 'node:net';
export class TcpPrinter {
    async print({ ipAddress, port, content }) {
        return new Promise((resolve, reject) => {
            const socket = new net.Socket();
            socket.connect(port, ipAddress, () => {
                socket.write(content);
                socket.end();
            });
            socket.on('close', () => {
                resolve();
            });
            socket.on('error', error => {
                reject(error);
            });
        });
    }
}

import net from 'node:net';
export async function sendToThermalPrinter({ ipAddress, port, content }) {
    return new Promise((resolve, reject) => {
        const client = new net.Socket();
        client.connect(port, ipAddress, () => {
            const ESC = '\x1B';
            const GS = '\x1D';
            const initialize = ESC + '@';
            const cutPaper = GS + 'V' + '\x00';
            client.write(initialize);
            client.write(content);
            client.write('\n\n\n');
            client.write(cutPaper);
            client.end();
            resolve();
        });
        client.on('error', error => {
            reject(error);
        });
    });
}

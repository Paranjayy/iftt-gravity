import dgram from 'node:dgram';

export async function discoverWiz() {
  return new Promise((resolve) => {
    const server = dgram.createSocket('udp4');
    const bulbs: string[] = [];
    
    server.on('message', (msg, rinfo) => {
      try {
        const data = JSON.parse(msg.toString());
        if (data.method === 'getPilot') {
          console.log(`[Wiz Discovery] Found bulb at ${rinfo.address}`);
          bulbs.push(rinfo.address);
        }
      } catch (e) {
        // ignore
      }
    });

    server.bind(38899, () => {
      const message = JSON.stringify({ method: 'getPilot', params: {} });
      // Broadcast to typical subnet broadcast or 255.255.255.255
      server.setBroadcast(true);
      server.send(message, 38899, '255.255.255.255', (err) => {
        if (err) console.error('Broadcast failed', err);
      });
      
      // Wait 3 seconds for responses
      setTimeout(() => {
        server.close();
        resolve(bulbs);
      }, 3000);
    });
  });
}

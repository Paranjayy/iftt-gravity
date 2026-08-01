import dgram from "node:dgram";
import { networkInterfaces } from "node:os";

export type WizDevice = { ip?: string | null; online?: boolean };

function localAddressFor(ip: string): string | undefined {
  const subnet = ip.split(".").slice(0, 3).join(".");
  const addresses = Object.values(networkInterfaces())
    .flat()
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry && entry.family === "IPv4" && !entry.internal))
    .map((entry) => entry.address);
  return addresses.find((address) => address.startsWith(`${subnet}.`)) || addresses[0];
}

/** Send WiZ LAN UDP from Raycast's interactive process, not the background hub. */
export async function sendWizPilot(ip: string, params: Record<string, unknown>): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const socket = dgram.createSocket("udp4");
    const timer = setTimeout(() => {
      socket.close();
      reject(new Error("WiZ command timed out"));
    }, 3_000);
    socket.bind(0, localAddressFor(ip), () => {
      socket.send(Buffer.from(JSON.stringify({ method: "setPilot", params })), 38899, ip, (error) => {
        clearTimeout(timer);
        socket.close();
        if (error) reject(error);
        else resolve();
      });
    });
  });
}

/** Read the live pilot state so shortcuts never rely on stale hub telemetry. */
export async function getWizPilot(ip: string): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const socket = dgram.createSocket("udp4");
    const timer = setTimeout(() => {
      socket.close();
      reject(new Error("WiZ status timed out"));
    }, 2_000);
    socket.on("message", (message) => {
      clearTimeout(timer);
      socket.close();
      try {
        resolve((JSON.parse(message.toString())?.result || {}) as Record<string, unknown>);
      } catch {
        reject(new Error("WiZ returned invalid status"));
      }
    });
    socket.bind(0, localAddressFor(ip), () => {
      socket.send(Buffer.from(JSON.stringify({ method: "getPilot", params: {} })), 38899, ip, (error) => {
        if (error) {
          clearTimeout(timer);
          socket.close();
          reject(error);
        }
      });
    });
  });
}

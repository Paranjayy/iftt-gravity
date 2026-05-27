import { Adapter, Device, Action } from '../types';
import { fetchSmartThingsDevices, sendSmartThingsCommand } from '../house-automation';

export class SmartThingsAdapter extends Adapter {
  name = 'Samsung SmartThings';
  private apiToken: string;

  constructor(token: string) {
    super();
    this.apiToken = token;
  }

  async initialize(): Promise<void> {
    const res = await fetch(`https://api.smartthings.com/v1/devices`, {
      headers: { 'Authorization': `Bearer ${this.apiToken}` }
    });
    if (!res.ok) throw new Error('Invalid SmartThings Token');
  }

  async getDevices(): Promise<Device[]> {
    const devices = await fetchSmartThingsDevices(this.apiToken);
    return devices.map(device => ({
      id: device.id,
      name: device.name,
      type: device.type === 'other' ? 'tv' : device.type,
      status: device.online ? 'online' : 'offline',
      lastSeen: new Date(device.lastSeen),
    }));
  }

  async executeAction(action: Action): Promise<void> {
    const { deviceId, command, arguments: args } = action.payload;
    console.log(`Executing ${command} command on SmartThings device ${deviceId}`);
    await sendSmartThingsCommand(
      this.apiToken,
      deviceId,
      command.capability,
      command.name,
      args || []
    );
  }
}

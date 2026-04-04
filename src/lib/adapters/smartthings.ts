import { Adapter, Device, Action } from '../types';

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
    const res = await fetch(`https://api.smartthings.com/v1/devices`, {
      headers: { 'Authorization': `Bearer ${this.apiToken}` }
    });
    const data = await res.json();
    return data.items
      .filter((d: any) => d.deviceTypeName.toLowerCase().includes('tv'))
      .map((d: any) => ({
        id: d.deviceId,
        name: d.label || d.name,
        type: 'tv',
        status: 'online',
        lastSeen: new Date()
      }));
  }

  async executeAction(action: Action): Promise<void> {
    const { deviceId, command, arguments: args } = action.payload;
    console.log(`Executing ${command} command on SmartThings device ${deviceId}`);
    
    // API Call: https://api.smartthings.com/v1/devices/${deviceId}/commands
    await fetch(`https://api.smartthings.com/v1/devices/${deviceId}/commands`, {
      method: 'POST',
      headers: { 
        'Authorization': `Bearer ${this.apiToken}`,
        'Content-Type': 'application/json' 
      },
      body: JSON.stringify({
        commands: [{
          component: 'main',
          capability: command.capability,
          command: command.name,
          arguments: args || []
        }]
      })
    });
  }
}

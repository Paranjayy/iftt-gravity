import { Adapter, Device, Action } from '../types';

export class PCAdapter extends Adapter {
  name = 'PC Control';
  private agentPort: number;
  private pcIp: string;

  constructor(pcIp: string, port = 5000) {
    super();
    this.pcIp = pcIp;
    this.agentPort = port;
  }

  async initialize(): Promise<void> {
    // Check if the agent at agentPort is responsive
  }

  async getDevices(): Promise<Device[]> {
    return [{
      id: 'dev-pc-1',
      name: 'Development PC',
      type: 'pc',
      status: 'online',
      lastSeen: new Date()
    }];
  }

  async executeAction(action: Action): Promise<void> {
    const { command, args } = action.payload;
    // Possible commands: shutdown, restart, sleep, lock, run_script
    console.log(`Sending command ${command} to PC at ${this.pcIp}:${this.agentPort}`);
    
    // API Call to a small python/node agent running on the PC
    await fetch(`http://${this.pcIp}:${this.agentPort}/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command, args })
    });
  }
}

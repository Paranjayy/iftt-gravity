export interface Device {
  id: string;
  name: string;
  type: 'ac' | 'tv' | 'light' | 'bot' | 'pc';
  status: 'online' | 'offline' | 'active';
  lastSeen: Date;
}

export interface Automation {
  id: string;
  name: string;
  trigger: Trigger;
  action: Action;
  enabled: boolean;
}

export interface Trigger {
  type: string;
  deviceId: string;
  condition: any;
}

export interface Action {
  type: string;
  deviceId?: string;
  payload: any;
}

// Adapters
export abstract class Adapter {
  abstract name: string;
  abstract initialize(): Promise<void>;
  abstract getDevices(): Promise<Device[]>;
  abstract executeAction(action: Action): Promise<void>;
}

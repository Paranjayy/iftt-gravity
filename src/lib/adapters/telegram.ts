import { Adapter, Device, Action } from './types';

export class TelegramAdapter extends Adapter {
  name = 'Telegram';
  private botToken: string;

  constructor(token: string) {
    super();
    this.botToken = token;
  }

  async initialize(): Promise<void> {
    // Check if token works
    const res = await fetch(`https://api.telegram.org/bot${this.botToken}/getMe`);
    if (!res.ok) throw new Error('Invalid Telegram Token');
  }

  async getDevices(): Promise<Device[]> {
    return [{
      id: 'tg-bot',
      name: 'Gravity Control Bot',
      type: 'bot',
      status: 'active',
      lastSeen: new Date()
    }];
  }

  async executeAction(action: Action): Promise<void> {
    const { chatId, message } = action.payload;
    await fetch(`https://api.telegram.org/bot${this.botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: message })
    });
  }
}

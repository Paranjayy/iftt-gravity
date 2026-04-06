import { Adapter, Device, Action } from '../types';

const BASE = (token: string) => `https://api.telegram.org/bot${token}`;

export interface TelegramUpdate {
  update_id: number;
  message?: {
    message_id: number;
    from: { id: number; first_name: string; username?: string };
    chat: { id: number; type: string };
    date: number;
    text?: string;
  };
}

export interface CommandHandler {
  command: string;
  description: string;
  handler: (chatId: number, args: string[], msg: any, sendMessage: (text: string) => Promise<void>) => Promise<void>;
}

export class TelegramAdapter extends Adapter {
  name = 'Telegram Bot';
  private botToken: string;
  private offset = 0;
  private polling = false;
  private handlers: CommandHandler[] = [];
  public botInfo: { id: number; username: string; first_name: string } | null = null;

  constructor(token: string) {
    super();
    this.botToken = token;
  }

  async initialize(): Promise<void> {
    const res = await fetch(`${BASE(this.botToken)}/getMe`);
    if (!res.ok) throw new Error('Invalid Telegram Token');
    const data = await res.json();
    this.botInfo = data.result;
    console.log(`✅ Telegram bot @${this.botInfo?.username} is alive`);
  }

  registerCommand(handler: CommandHandler) {
    this.handlers.push(handler);
  }

  async sendMessage(chatId: number, text: string, parseMode: 'Markdown' | 'HTML' = 'Markdown'): Promise<void> {
    await fetch(`${BASE(this.botToken)}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: parseMode }),
    });
  }

  private async processUpdate(update: TelegramUpdate): Promise<void> {
    const msg = update.message;
    if (!msg?.text) return;

    const [rawCommand, ...args] = msg.text.trim().split(/\s+/);
    const command = rawCommand.replace(/^\//, '').replace(/@.*$/, '').toLowerCase();
    const chatId = msg.chat.id;

    if (command === 'start') {
      await this.sendMessage(chatId,
        `⚡ *Gravity Control Bot*\n\nHey ${msg.from.first_name}! I control your home.\n\n` +
        this.handlers.map(h => `/${h.command} — ${h.description}`).join('\n') +
        `\n\n_Gravity Automation Engine_`
      );
      return;
    }

    if (command === 'help') {
      await this.sendMessage(chatId,
        `*Available Commands*\n\n` + this.handlers.map(h => `\`/${h.command}\` — ${h.description}`).join('\n')
      );
      return;
    }

    const matched = this.handlers.find(h => h.command === command);
    if (matched) {
      try {
        await matched.handler(chatId, args, msg, (text) => this.sendMessage(chatId, text));
      } catch (err: any) {
        await this.sendMessage(chatId, `❌ Error: ${err.message}`);
      }
    } else {
      await this.sendMessage(chatId, `Unknown command: \`/${command}\`\n\nUse /help to see available commands.`);
    }
  }

  async startPolling(intervalMs = 1500): Promise<void> {
    if (this.polling) return;
    this.polling = true;
    console.log('🤖 Telegram polling started...');

    const poll = async () => {
      if (!this.polling) return;
      try {
        const res = await fetch(
          `${BASE(this.botToken)}/getUpdates?offset=${this.offset}&timeout=10&allowed_updates=["message"]`
        );
        const data = await res.json();
        if (data.ok && data.result.length > 0) {
          for (const update of data.result as TelegramUpdate[]) {
            this.offset = update.update_id + 1;
            await this.processUpdate(update);
          }
        }
      } catch (err) {
        console.error('Telegram poll error:', err);
      }
      setTimeout(poll, intervalMs);
    };

    poll();
  }

  stopPolling() {
    this.polling = false;
  }

  async getDevices(): Promise<Device[]> {
    return [{
      id: 'tg-bot',
      name: this.botInfo ? `@${this.botInfo.username}` : 'Gravity Bot',
      type: 'bot',
      status: 'active',
      lastSeen: new Date(),
    }];
  }

  async executeAction(action: Action): Promise<void> {
    const { chatId, message } = action.payload;
    await this.sendMessage(chatId, message);
  }
}

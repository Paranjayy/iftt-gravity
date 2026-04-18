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
  public onMessage?: (msg: any) => void;
  public onCallback?: (cb: any) => void;

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

  getHandlers() {
    return this.handlers;
  }

  private async sendRequest(method: string, body: any): Promise<any> {
    const res = await fetch(`${BASE(this.botToken)}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(`Telegram error: ${method} failed: ${errData.description || res.statusText}`);
    }
    return res.json();
  }

  async sendMessage(chatId: number, text: string, options: { parse_mode?: 'Markdown' | 'HTML', reply_markup?: any } = { parse_mode: 'Markdown' }): Promise<void> {
    await this.sendRequest('sendMessage', {
      chat_id: chatId,
      text,
      parse_mode: options.parse_mode || 'Markdown',
      reply_markup: options.reply_markup
    });
  }
  
  async answerCallbackQuery(callbackQueryId: string, text?: string): Promise<void> {
    await this.sendRequest('answerCallbackQuery', {
      callback_query_id: callbackQueryId,
      text: text
    });
  }

  private async processUpdate(update: any): Promise<void> {
    // 1. Handle Messages
    if (update.message) {
      const msg = update.message;
      if (!msg.text) return;
      if (this.onMessage) this.onMessage(msg);

      const chatId = msg.chat.id;
      const [raw, ...args] = msg.text.trim().split(/\s+/);
      const command = raw.toLowerCase().replace('/', '');

      // Special handling for the Command Center triggers
      if (command === 'start' || msg.text === '🎮 Command Center') {
        await this.sendMessage(chatId,
          `⚡ *Gravity Control Bot*\n\nHey ${msg.from.first_name}! I am your home cortex.\n\n` +
          this.handlers.map(h => `/${h.command} — ${h.description}`).join('\n') +
          `\n\n_Gravity Automation Engine_`,
          {
            reply_markup: {
              keyboard: [
                [{ text: '📊 History' }, { text: '✨ Today' }],
                [{ text: '❄️ Control' }, { text: '🏠 Scenes' }],
                [{ text: '🎮 Command Center' }]
              ],
              resize_keyboard: true,
              persistent: true
            }
          }
        );
        return;
      }

      // Bridge emoji buttons to commands
      let effectiveCommand = command;
      if (msg.text === '📊 History') effectiveCommand = 'history';
      if (msg.text === '✨ Today') effectiveCommand = 'today';
      if (msg.text.includes('Control')) effectiveCommand = 'control';
      if (msg.text.includes('Scenes')) effectiveCommand = 'scene';

      const matched = this.handlers.find(h => h.command === effectiveCommand);
      if (matched) {
        try {
          await matched.handler(chatId, args, msg, (text) => this.sendMessage(chatId, text));
        } catch (err: any) {
          await this.sendMessage(chatId, `❌ Error: ${err.message}`);
        }
      } else if (msg.text.startsWith('/')) {
        await this.sendMessage(chatId, `Unknown command: \`/${command}\`\n\nUse /help to see available commands.`);
      }
    }

    // 2. Handle Callback Queries (Interactive Buttons)
    if (update.callback_query) {
      const cb = update.callback_query;
      if (this.onCallback) this.onCallback(cb);
      
      const chatId = cb.message.chat.id;
      const data = cb.data;

      // Execute button logic by simulating a command
      const [cmd, ...args] = data.split(':');
      const matched = this.handlers.find(h => h.command === cmd);
      if (matched) {
        try {
          // IMPORTANT: Capture the actual user who clicked the button (cb.from)
          // and merge it into the message context for authorization checks.
          const msgContext = { ...cb.message, from: cb.from };
          await matched.handler(chatId, args, msgContext, (text) => this.sendMessage(chatId, text));
          // Answer the callback to remove loading state
          await this.sendRequest('answerCallbackQuery', { callback_query_id: cb.id });
        } catch (e) {}
      }
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
          `${BASE(this.botToken)}/getUpdates?offset=${this.offset}&timeout=10&allowed_updates=["message", "callback_query"]`
        );
        const data = await res.json();
        if (data.ok && data.result.length > 0) {
          for (const update of data.result) {
            this.offset = update.update_id + 1;
            await this.processUpdate(update);
          }
        }
      } catch (err) {
        // console.error('Telegram poll error:', err);
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

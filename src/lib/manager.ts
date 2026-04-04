import { TelegramAdapter } from './adapters/telegram';
import { MiraieAdapter } from './adapters/miraie';
import { SmartThingsAdapter } from './adapters/smartthings';
import { WizAdapter } from './adapters/wiz';
import { PCAdapter } from './adapters/pc';
import { Adapter } from './types';

class AdapterManager {
  private adapters: Map<string, Adapter> = new Map();

  registerAdapter(id: string, adapter: Adapter) {
    this.adapters.set(id, adapter);
  }

  getAdapter(id: string) {
    return this.adapters.get(id);
  }

  async initializeAll() {
    for (const [id, adapter] of this.adapters.entries()) {
      try {
        await adapter.initialize();
        console.log(`Adapter ${id} initialized successfully`);
      } catch (e) {
        console.error(`Failed to initialize ${id}:`, e);
      }
    }
  }

  getAllDevices() {
    return Promise.all(
      Array.from(this.adapters.values()).map(a => a.getDevices())
    ).then(res => res.flat());
  }
}

export const manager = new AdapterManager();

// Example registration (In production, these would be loaded from DB/config)
// manager.registerAdapter('tg', new TelegramAdapter(process.env.TG_TOKEN!));
// manager.registerAdapter('pan', new MiraieAdapter(process.env.MIR_TOKEN!, process.env.MIR_USER!));
// manager.registerAdapter('st', new SmartThingsAdapter(process.env.ST_TOKEN!));
// manager.registerAdapter('wiz', new WizAdapter(process.env.WIZ_KEY!, process.env.WIZ_HOME!));
// manager.registerAdapter('pc', new PCAdapter(process.env.PC_IP!));

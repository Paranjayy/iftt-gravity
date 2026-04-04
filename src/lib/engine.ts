import { manager } from './manager';
import { Action, Trigger } from './types';

export class Engine {
  async processTrigger(trigger: Trigger) {
    // 1. Evaluate if trigger condition is met
    // 2. Find associated automations
    // 3. Execute actions (see handleAction)
  }

  async handleAction(action: Action) {
    if (!action.deviceId) throw new Error('Action is missing deviceId');
    const [adapterId, nodeId] = action.deviceId.split(':');
    const adapter = manager.getAdapter(adapterId);
    if (!adapter) throw new Error(`Adapter ${adapterId} not found`);

    console.log(`Executing ${action.type} on adapter ${adapterId} for node ${nodeId}`);
    return adapter.executeAction(action);
  }
}

export const engine = new Engine();

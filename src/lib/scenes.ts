import { engine } from './engine';
import { Action } from './types';

export const SCENES = {
  'MOVIE_MODE': [
    { type: 'tv', deviceId: 'st:samsung-tv', payload: { command: { capability: 'switch', name: 'on' } } },
    { type: 'light', deviceId: 'wiz:philips-a70', payload: { state: true, brightness: 20 } },
    { type: 'ac', deviceId: 'mir:panasonic-ac', payload: { status: 'ON', temperature: 22, mode: 'COOL' } }
  ],
  'SLEEP_MODE': [
    { type: 'light', deviceId: 'wiz:philips-a70', payload: { state: false } },
    { type: 'tv', deviceId: 'st:samsung-tv', payload: { command: { capability: 'switch', name: 'off' } } },
    { type: 'ac', deviceId: 'mir:panasonic-ac', payload: { status: 'ON', temperature: 26, mode: 'DRY' } }
  ]
};

export async function activateScene(sceneName: keyof typeof SCENES) {
  const actions = SCENES[sceneName];
  console.log(`Activating scene: ${sceneName}`);
  
  for (const action of actions) {
    try {
      await engine.handleAction(action as Action);
    } catch (e) {
      console.error(`Failed to execute scene action:`, e);
    }
  }
}

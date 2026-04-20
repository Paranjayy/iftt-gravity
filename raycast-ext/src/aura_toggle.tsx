import { showHUD, Icon } from "@raycast/api";
import fetch from "node-fetch";

export default async function Command() {
  try {
    const statusResponse = await fetch("http://localhost:3030/status");
    const statusData: any = await statusResponse.json();
    const currentState = statusData?.mediaAura !== false;
    const newState = !currentState;

    await fetch(`http://localhost:3030/media_aura/${newState ? 'on' : 'off'}`);
    await showHUD(newState ? "🎵 Media Aura: ACTIVE 🪐" : "🎵 Media Aura: DISABLED 🌑");
  } catch (e) {
    await showHUD("❌ Gravity Hub Offline");
  }
}

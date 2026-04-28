# 🎮 Gravity Gaming Sentry (Windows Edition)

This folder contains the Windows-side automation scripts that link your gaming rig to the Gravity Hub (Mac).

## 🚀 1. The 1-Click Installer (AutoHotkey setup)
Simply right-click `Install-GamingSentry.ps1` and click **"Run with PowerShell"**.
This script will:
- Automatically download and install AutoHotkey v1 (via Winget).
- Setup `gravity_gaming_sentry.ahk` to run silently in the background at Windows startup.
- Prevent accidental Start Menu popping, Windows Key presses, and `Alt+Space` freezes during Valorant & CS2.
- Automatically ping your Gravity Hub (`http://192.168.29.50:3030`) when you open/close a game to change the room lighting.

---

## 🔫 2. Game State Integration (GSI) - The Deep Dive

GSI is how we read *actual* in-game events (like taking damage or getting a headshot) to dynamically change your physical room environment.

### 🟡 Counter-Strike 2 (Officially Supported & VAC-Safe)
CS2 has a native, official GSI engine built by Valve. It safely broadcasts game data locally. **You will NOT get banned for using this, and it works perfectly in Training, Deathmatch, and Comp.**

**Setup Instructions for CS2:**
1. Navigate to your CS2 config folder:
   `C:\Program Files (x86)\Steam\steamapps\common\Counter-Strike Global Offensive\game\csgo\cfg`
2. Create a new text file named `gamestate_integration_gravity.cfg`.
3. Open it in Notepad and paste the following:
```json
"Gravity Integration v1.0"
{
 "uri" "http://192.168.29.50:3030/gsi"
 "timeout" "5.0"
 "buffer"  "0.1"
 "throttle" "0.5"
 "heartbeat" "30.0"
 "data"
 {
   "provider"            "1"
   "map"                 "1"
   "round"               "1"
   "player_id"           "1"
   "player_state"        "1"
   "player_weapons"      "1"
   "player_match_stats"  "1"
 }
}
```
4. Boot up CS2. Play a bot match or deathmatch.
5. If you take heavy damage, the room will pulse red. If you get a headshot, it will flash a blinding white strobe!

### 🔴 Valorant (WARNING - NO NATIVE GSI)
Unlike CS2, Riot's Vanguard Anti-Cheat is highly aggressive. Valorant **does not** offer an official local GSI file system.
- **Do not attempt** to read Valorant memory or parse the screen for headshots/health, as Vanguard will ban you.
- To get live stats in Valorant safely, you must use authorized 3rd-party apps (like Tracker.gg or Overwolf) that use the official Riot API. 
- *Current Integration:* For Valorant, the Sentry relies on the AutoHotkey window detection to safely change the room lighting to a "Gaming Mood" when the game is open, without touching the game files.

## 💡 Future Ideas & Extensions
- **Reloading Alert:** We can add `"player_weapons"` to the GSI parser to detect when ammo hits `0` and flash the room yellow to remind you to reload.
- **Movement Tracker (CS2):** We can parse `player.state.velocity` to flash a penalty light if you shoot while moving, training your counter-strafing reflexes physically!

# ⚡ Gravity Automation & Shortcuts Roadmap (Personal IFTTT)

This document outlines the path to turning Gravity Hub into a robust, always-on automation engine that replaces IFTTT, Zapier, and standard Shortcuts with a "God Build" architecture.

## 📱 iOS & macOS Shortcuts Integration
- **Concept**: Use the Mac's "Shortcuts" app to trigger Gravity scenes.
- **Workflow**:
  - Shortcut Step: `Get Contents of URL`
  - URL: `http://localhost:3030/scene/HOME?token=YOUR_TOKEN`
  - Method: `GET`
- **Voice Control**: "Hey Siri, Cinema Mode" -> Triggers the Mac shortcut -> Gravity dims lights & starts AC.

## 🤖 Gravity "Zapier" Automations (Internal)
Expand the `GravityScheduler` to handle complex "If This Then That" logic:
- **Conditionals**:
  - `If (Temperature > 30) AND (User is Home) -> AC High Cool`
  - `If (Time is 6 PM) AND (Cloudy) -> Lights Warm 100%`
- **External Webhooks**:
  - Gravity can listen for external pings from services like GitHub (e.g., "Blink blue when I get a PR").

## ☁️ The "Always-On" Cloud Brain
To solve the "Mac is Off" problem, we will split Gravity into two parts:
1. **The Cloud Brain (Cortex)**:
   - Hosted on Railway/Vercel.
   - Always online.
   - Manages AC and Lights (Wi-Fi based).
   - Tracks your location 24/7.
2. **The Local Sentry (Eyes/Ears)**:
   - Lives on your Mac.
   - Handles `/screen`, Mac volume, and hardware-specific monitoring.
   - Pings the Cloud Brain when it wakes up.

## 🛠 Future "Goated" Features
- **Siri Intelligence**: Use Apple Script to make Gravity speak through your HomePod.
- **Presence 2.0**: Use Bluetooth low-energy to detect exactly which room you are in and follow you with the light.
- **Energy Optimization**: Automatically switch AC to "Fan Mode" when the room hits the target temperature to save cost.

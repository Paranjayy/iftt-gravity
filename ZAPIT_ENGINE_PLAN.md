# ⚡ Zapit Engine: The Local Automation Blueprint

The goal of Zapit is to become a high-fidelity, local-first alternative to n8n, Zapier, and IFTTT. It leverages the 41K+ items in your **Gravity Archive** as a "Knowledge Base" for triggers and your **Gravity Hub** for hardware/API execution.

## 🏗️ Phase 1: Semantic Triggers (The Archive Bridge)
- **Problem**: Current triggers are manual or basic pattern matching.
- **Goal**: Implement a Vector-Watch on `clips.json`. If a new clip matches a "High Intent" pattern (e.g., a Jira ticket URL, a bank transaction, or a specific git commit), trigger a Flow.

## ❄️ Phase 2: Hardware Sovereignty (The Hardware Hub)
- **Problem**: Hardware is currently in a manual grid.
- **Goal**: Predictive cooling and lighting.
    - **Adaptive Sleep Curve 2.0**: Link to your Google Calendar. If you have an early meeting, shift the cooling curve earlier.
    - **PGVCL Budget Guardian**: Automatically throttle the AC if the estimated month-to-date bill exceeds a specific ₹ limit.

## 🎮 Phase 3: The "Flow" Builder (local-n8n)
- **Goal**: A simple UI (within Raycast or a local Electron app) where you can define:
    ```json
    {
      "trigger": "if incoming_clipboard matches /github.com/PR/",
      "action": "speak 'New code review master', then trigger Scene: DEV_WORK"
    }
    ```

## 🛡️ Current Infrastructure
- **Port 3030**: Execution Brain (Hardware/Telegram/Weather)
- **Port 3031**: Memory Archive (Clipboard/Search/Sync)

---
**Status**: God Build v8.1 (Decoupled & Atomic)
**Next Objective**: Implement SQLite-VSS for semantic clipboard intent detection.

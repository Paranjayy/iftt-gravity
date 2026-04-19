# 🌉 Gravity: Cloud-Bridge Upgrade Strategy

This document outlines the "Hacker Plan" to achieve 100% feature parity between your local Mac Hub and the global Vercel Dashboard.

## 1. The Secure Tunnel (Cloudflare)
To allow Vercel to "reach into" your house without exposing your whole network:
- **Tool**: `cloudflared` (Cloudflare Tunnels).
- **Command**: `cloudflared tunnel run gravity-hub`.
- **Logic**: Maps `localhost:3030` to `gravity.yourdomain.com`.
- **Security**: Access is restricted via Cloudflare Access or a shared Secret Header that only Vercel knows.

## 2. Stateless Webhook Migration
Currently, the bot "Polls" (waits for messages). For full Vercel integration:
- **Mode**: Change `bot.startPolling()` to `bot.setWebhook()`.
- **Relay**: Vercel receives the Telegram POST request, verifies it, and forwards the command to the Mac Tunnel.
- **Benefit**: Commands are processed even if the Mac is under heavy load or momentarily offline (Vercel will retry).

## 3. Persistent Cloud Logs (Database)
- **Current**: Logs are in `house_log.md` (Local file).
- **Upgrade**: Move logs to **Supabase** or **Vercel KV**.
- **Result**: The "Habits" chart and historical usage will be visible from your phone instantly, globally, without needing to sync files.

## 4. Feature Parity Goals
- [ ] **Remote Cards**: Vercel triggers a Puppeteer instance (Serverless) to generate the status card so your Mac doesn't have to spin up a browser.
- [ ] **Global Status**: Remote `/ping` checks both the Vercel Health and the Mac Tunnel Health.
- [ ] **Multi-Hub**: Control multiple houses/rooms by deploying small "Worker" bots that all report to the same Vercel dashboard.

### 🗺️ The Paths to "God Build" (Stability vs Control)

To solve the "Mac must be on" problem, we have three distinct evolution paths for the Gravity Hub:

#### Path A: The Ghost Hub (Hybrid Cloudflare)
*   **How**: Tunnel your Mac's port to Vercel via Cloudflare.
*   **Requirement**: Mac must be **on** and **awake**.
*   **Pros**: 100% control, free, uses your existing setup. Total privacy.
*   **Cons**: If you close your laptop, the AC controller goes offline.

#### Path B: The Dedicated Core (Recommended for Stability)
*   **How**: Move the "Brain" script to an **always-on** device like an old Mac Mini, a Raspberry Pi, or even a cheap $10 Home Server.
*   **Pros**: 24/7 uptime. You can close your laptop and the house still runs.
*   **Cons**: Requires a $30-$50 hardware investment.

#### Path C: The Pure Cloud (Direct Manufacturer API)
*   **How**: Rewrite the bot to use **WiZ Cloud API** instead of local UDP packets.
*   **Pros**: No Mac needed. Vercel talks directly to the WiZ servers.
*   **Cons**: **Slower**. Local control (internal Wi-Fi) is nearly instant; cloud control has a 1-3 second delay. Also, if the WiZ internet goes down, your bot fails even if you're home.

### 🌗 Deployment Decision Matrix

| Feature | Current (Local) | Hybrid (Tunnel) | Dedicated (Pi) | Pure Cloud |
| :--- | :--- | :--- | :--- | :--- |
| **Mac Uptime Req** | Yes | Yes | **No** | **No** |
| **Remote Access** | No | **Yes** | **Yes** | **Yes** |
| **Speed** | Instant | Instant | Instant | 1-3s Lag |
| **Privacy** | Local Only | Encrypted | Local Only | Via WiZ Servers |

---
*Archived for Future Phase Integration*
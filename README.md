# 🌌 Gravity: The God Build Ecosystem
> A high-fidelity, private automation engine for cross-platform device synchronization.

Gravity is a modular IFTTT alternative designed for ultra-low latency local control and cloud-synced dashboarding. Built on a bleeding-edge stack, it unifies **SmartThings**, **WiZ 2.0**, **Miraie**, and **Telegram** into a single, premium "Spectral Hub."

![Dashboard Screenshot](https://raw.githubusercontent.com/Paranjayy/iftt-gravity/master/src/assets/screenshot.png) *(Add your own screenshot path here)*

---

## 🚀 Tech Stack
- **Framework**: Next.js 16.2.2 (Canary)
- **Styling**: Tailwind CSS 4.0 (Zero-runtime)
- **Runtime**: Bun 1.3.x
- **Engine**: Custom Adapter Pattern Logic
- **Security**: Next.js Middleware (Proxy) Auth Shield

---

## 🛠 Setup & Installation

### 1. Dependencies
Ensure you have **Bun** and **Node** shims configured:
```bash
bun install
```

### 2. Configure Environment
Gravity requires specific tokens to communicate with your hardware. Use the template provided:
```bash
cp .env.example .env.local
```
Update `.env.local` with your secret keys:
- `TELEGRAM_TOKEN`: From @BotFather
- `SMARTTHINGS_TOKEN`: From Samsung Developers Portal
- `DASHBOARD_PASSWORD`: **Mandatory** password for the UI shield.

### 3. Launching the Engine (Local)
Gravity uses a custom bypass script to avoid common shell-level intercepted commands:
```bash
chmod +x start.sh
./start.sh
```
The dashboard will be available at: **`http://localhost:3002`**

---

## 🔌 Device Connectivity & Testing

### 🟢 WiZ 2.0 (Local UDP)
Gravity controls WiZ bulbs via local UDP broadcast on port `38899`.
- **Test**: Ensure your bulbs are on the same Wi-Fi as your Mac.
- **Troubleshoot**: If bulbs aren't responding, check if a firewall is blocking port `38899`.

### 🟢 Panasonic MirAie (Python Bridge)
The MirAie adapter uses a local IP bridge.
- **Requirement**: The AC must have a static IP on your router.
- **Test**: Run the ping check from the "Activity Log" in the dashboard.

### 🟢 SmartThings (REST API)
Handles your Samsung TV and high-level IoT devices.
- **Test**: Gravity will automatically poll your TV status every 10 seconds.

---

## 🔒 Security & Deployment
### Private Shield
Every route is protected by a server-side **Next.js Proxy (Middleware)**. 
- Access the dashboard at `/login` to authorize your session.
- Tokens never leave the server; they are 100% safe from browser inspection.

### Vercel Deployment
Gravity is fully compatible with Vercel for the Dashboard UI. 
1. Connect your GitHub Repo.
2. Add your `.env.local` secrets to the Vercel Dashboard.
3. Use a **Cloudflare Tunnel** or **Tailscale** if you need the Vercel deployment to reach your local WiZ bulbs!

---

## 🧩 Modifying & Customizing
To add a new device:
1. Create a new adapter in `src/lib/adapters/`.
2. Register it in `src/lib/engine.ts`.
3. The UI will automatically detect the new service.

---
**Build something that matters today.**  
— *Gravity Core Team*

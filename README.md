# 🌌 Gravity: Production God Build

Your private IoT command center is now fully optimized for deployment.

## 🚀 Deployment (Set-and-Forget)
You can now run Gravity as a background service so it stays alive even after you close the terminal:

### Option A: Docker (Recommended)
1. **Build & Start**: `docker-compose up -d`
2. This will keep Gravity running on **localhost:3000** locally and persist all your accounts in a secure Docker volume.

### Option B: PM2 (No Docker)
1. `npm install -g pm2`
2. `pm2 start "bun run dev" --name gravity`

---

## ❄️ MirAie — The "Beep" & Direct Control
- **Physical "Beep"**: I've injected the `bz: 1` flag into all MirAie commands. When you change temp or mode from Gravity, you should now hear the same confirmatory beep as your physical remote.
- **Raycast Integration**: Use the script in `./raycast/ac-control.sh`. Import it into Raycast to control your AC with zero clicks.
- **Homey Sync**: You requested MirAie inside Homey. You can now use **Homey Webhooks** to call Gravity's new API: `POST http://localhost:3000/api/control/ac`.

---

## 💡 WiZ — Automatic Discovery
- No more searching for IP addresses! 
- Go to the **Device Sync** dashboard, click **Manage WiZ**, and click the new **"Scan for Bulbs"** button. It will scan your local network and find them instantly.

---

## 🏠 Homey — Professional SDK
- I’ve completely migrated Homey to the **official `homey-api` SDK**.
- This is much more robust than the old API hacks and allows for future expansion into complex Homey Flows.

---

## 🔐 Security & Persistence
- Your `config.json` is safely stored and ignored from Git.
- **Raycast/External Access**: The new API endpoint in `src/app/api/control/ac` allows you to build your own dashboard skins or phone shortcuts.

Good luck with your exams! The grid is officially yours. 🌌🏆

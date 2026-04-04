# Gravity | IFTTT OSS Alternative

An advanced, high-fidelity automation engine for your home and digital life. Built with Next.js, Bun, and React Flow.

## 🚀 Getting Started

1. **Install Dependencies** (if not already done):
   ```bash
   bun install
   ```

2. **Run the Dashboard**:
   ```bash
   bun dev
   ```
   *Visit [http://localhost:3000](http://localhost:3000) to see your ecosystem.*

## 🔌 Supported Integrations

- **Panasonic Miraie**: Control your Smart AC.
- **Wiz 2.0 / Homey**: Manage smart bulbs via cloud or local API.
- **Telegram Bot**: Send notifications and receive commands.
- **Samsung SmartThings**: Deep integration with Samsung TVs and appliances.
- **Local PC Agent**: Track PC status and execute local commands.

## 📁 Project Structure

- `src/app/`: Modern dashboard and workflow editor.
- `src/lib/adapters/`: Plug-and-play service connectors.
- `src/lib/manager.ts`: Central registry for active devices.
- `src/lib/engine.ts`: Core processing logic for IF-THEN triggers.

## 🛠 Next Steps

- Add your API tokens to `.env.local`.
- Use the **Flow Editor** to create visual automations.
- Deploy this to your Mac as a background service or NAS engine.

# Gravity Hub: Deployment & Evolution Strategy

This document outlines the roadmap for moving Gravity from a local process to a production environment (GitHub Actions, Docker, or Vercel) and the potential roadblocks.

## 🏁 Deployment Options

| Platform | Best For | Pros | Cons |
| :--- | :--- | :--- | :--- |
| **Local Mac (Current)** | Power Users | Full hardware access (`say`, \`pmset\`, \`ioreg\`). Low latency. | Mac must be awake. Harder to manage remotely without a static IP. |
| **Docker (Home Server)** | Stability | Self-healing, reproducible. Runs on any idle PC/Pi. | No "Ghost Sentry" (cannot detect Mac usage). No \`say\` output. |
| **Vercel (Serverless)** | Dashboard UI | Free hosting for the web panel. 24/7 uptime for API. | **Major Issues**: Polling stops when inactive. No MQTT persistence. No hardware access. |

---

## ⚡ The "Vercel / GitHub" Issue (Feature Parity)

If we move Gravity entirely to the cloud (Vercel/GitHub):

1. **Hardware Loss**:
   - \`/lock\`, \`/sleep\`, and \`/system\` will target the *server*, not your Mac. ❌
   - \`Ghost Sentry\` (detecting unauthorized Mac use) will stop working because the server can't "see" your Mac's idle time. ❌
   - \`/broadcast\` and \`/say\` will have no speakers to output to. ❌

2. **State Persistence**:
   - Vercel functions expire after 10–30 seconds. They cannot maintain a tracking loop for AC minutes or a persistent MQTT connection to MirAie. ❌

**Recommendation**: Keep the **Gravity Core** running on your Mac (or a persistent local Docker container) and use Vercel **strictly for the Dashboard UI**.

---

## 🧠 Making Habits "God Tier"

To take habit learning from "Heuristic" to "Predictive", we should add **Contextual Dimensionality**:

- **Environmental Context**: Don't just record \`AC_ON @ 10PM\`. Record \`AC_ON @ 10PM | Temp: 32°C | Humidity: 80%\`.
  - *Logic*: If it's 10 PM but only 22°C outside, Gravity should know *not* to suggest the habit.
- **Mac Context**: Gravity should notice that you trigger "Cinema Vibe" only when **Plex** or **Netflix** is the frontmost app.
- **Analog Weighting**: We should give higher "Confidence Scores" to physical remote actions, as they represent 100% human intent in the moment.

---

## 🚀 Telegram: The Next Wave

Here are the features I've just added + some "Next Level" ideas:

### ✅ Just Added
- **\`/todo\`**: A persistent list of house tasks.
- **\`/remind\`**: Contextual pings (e.g., \`/remind 5m check the oven\`).
- **\`/timer\`**: Delayed hardware actions (e.g., \`/timer 30 ac off\`).

### 💡 Blue Sky Ideas
1. **Visual Hub (Photo Mode)**: Use \`puppeteer\` to take a screenshot of your local energy graph and send it as a photo every evening.
2. **Mac Media Controller**: Commands to control your music (\`/next\`, \`/pause\`, \`/volume 50\`).
3. **Smart Scheduling**: Instead of a fixed time, \`/schedule sunset lights on\` (Gravity fetches your local sunset time).
4. **Auto-CCTV**: If Ghost Sentry triggers, take a photo with the Mac's FaceTime camera and send it to you instantly.

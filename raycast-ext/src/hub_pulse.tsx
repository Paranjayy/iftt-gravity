import { List, ActionPanel, Action, showToast, Toast, Icon, Color, Form, useNavigation } from "@raycast/api";
import { useState, useEffect } from "react";
import fetch from "node-fetch";
import QuickScene from "./quick_scene";
import MoodPresets from "./mood_presets";
import SunPosition from "./sun_position";

interface HubState {
  online: boolean;
  uptime: number;
  autoAc?: boolean;
  autoLight?: boolean;
  mediaAura?: boolean;
  ac_duration?: string;
  light_duration?: string;
  units?: string;
  estimatedPgBill?: number;
  weather?: { temp: number; humidity: number; condition: string; aqi: number; sunrise: string; sunset: string };
  stats?: {
    ac?: { status: string; lastChanged: number };
    light?: { status: string; lastChanged: number };
    acMinutes?: number;
    lightMinutes?: number;
    archiveCount?: number;
  };
  pgvcl?: { units: string; bill: string };
  smartthings?: {
    deviceCount?: number;
    locationId?: string;
    lastSyncedAt?: string;
    lastError?: string;
    devices?: Array<{ id: string; name: string; type?: string; online?: boolean }>;
  };
  solis?: { today: string; current: string; battery: string; status: string };
  battery?: { level: number; charging: boolean };
}

const HUB_URL = "http://127.0.0.1:3030";

function buildTelegramStatus(state: any, error: string | null): string {
  if (error) return "❌ *Hub Offline* — cannot reach 127.0.0.1:3030";
  const ac = state?.stats?.ac;
  const light = state?.stats?.light;
  const acOn = ac?.status === "on";
  const lightOn = light?.status === "on";
  const stCount = state?.smartthings?.deviceCount || 0;
  const stOnline = state?.smartthings?.devices?.filter((d: any) => d.online).length || 0;
  const now = new Date();
  const dateStr = now.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  const timeStr = now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
  return `🌌 *Gravity Hub* · ${dateStr} ${timeStr}

━━━━━━
❄️ *AC*: ${acOn ? "🟢 ON" : "⚫ OFF"}${state?.ac_duration ? ` (${state.ac_duration})` : ""}
   Today: ${state?.stats?.acMinutes ? `${Math.floor(state.stats.acMinutes / 60)}h ${state.stats.acMinutes % 60}m` : "0m"} · Auto: ${state?.autoAc ? "🤖" : "👤"}
💡 *Light*: ${lightOn ? "🟢 ON" : "⚫ OFF"}${state?.light_duration ? ` (${state.light_duration})` : ""}
   Today: ${state?.stats?.lightMinutes ? `${Math.floor(state.stats.lightMinutes / 60)}h ${state.stats.lightMinutes % 60}m` : "0m"} · Aura: ${state?.mediaAura !== false ? "🌈" : "🌑"}
🏠 *SmartThings*: ${stOnline}/${stCount} online
☀️ *Solar*: ${state?.solis?.today || "—"} kWh today · ${state?.solis?.current || "—"} kW now
⚡ *Energy*: ${state?.units || "0"} kWh · est ₹${state?.estimatedPgBill || 0}
🌤 *Weather*: ${state?.weather?.temp || "—"}°C · AQI ${state?.weather?.aqi || "—"}
🛡 *Hub*: 🟢 Up ${Math.floor((state?.uptime || 0) / 3600)}h ${Math.floor(((state?.uptime || 0) % 3600) / 60)}m
🔋 *Mac*: ${state?.battery ? `${state.battery.level}%` : "—"}`;
}

async function runHubAction(name: string, endpoint: string) {
  const toast = await showToast({ style: Toast.Style.Animated, title: `Pulsing: ${name}...` });
  try {
    const res = await fetch(`${HUB_URL}${endpoint}`);
    if (!res.ok) throw new Error("Failed");
    toast.style = Toast.Style.Success;
    toast.title = `Confirmed: ${name}`;
  } catch (e) {
    toast.style = Toast.Style.Failure;
    toast.title = "Action Failed";
    toast.message = "Hub Offline";
  }
}

export default function HubPulse() {
  const [state, setState] = useState<HubState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  async function refresh() {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), 4000);
    try {
      const res = await fetch(`${HUB_URL}/status`, { signal: ac.signal });
      clearTimeout(t);
      const data = await res.json();
      setState(data);
      setError(null);
      setLastRefresh(new Date());
    } catch (e) {
      setError("Hub Offline");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 3000);
    return () => clearInterval(t);
  }, []);

  const ac = state?.stats?.ac;
  const light = state?.stats?.light;
  const acOn = ac?.status === "on";
  const lightOn = light?.status === "on";
  const stCount = state?.smartthings?.deviceCount || 0;
  const stOnline = state?.smartthings?.devices?.filter((d) => d.online).length || 0;

  // Build a single "everything at a glance" detail with rich metadata
  return (
    <List isLoading={isLoading} searchBarPlaceholder="Hub Pulse — everything at a glance...">
      <List.Section title="Sovereign Pulse">
        <List.Item
          icon={error ? { source: Icon.ExclamationMark, tintColor: Color.Red } : { source: Icon.Heartbeat, tintColor: Color.Green }}
          title={error ? "Hub Offline" : "Hub Online"}
          subtitle={error ? "Cannot reach 127.0.0.1:3030" : `Uptime: ${Math.floor((state?.uptime || 0) / 3600)}h ${Math.floor(((state?.uptime || 0) % 3600) / 60)}m · Last refresh: ${lastRefresh.toLocaleTimeString()}`}
          accessories={[
            { text: state?.autoAc ? "Auto-AC ✓" : "Auto-AC ✗" },
            { text: state?.autoLight ? "Auto-Light ✓" : "Auto-Light ✗" },
            { text: state?.mediaAura !== false ? "Aura ✓" : "Aura ✗" },
          ]}
          actions={
            <ActionPanel title="Hub Controls">
              <Action icon={Icon.Repeat} title="Force Refresh" shortcut={{ modifiers: ["cmd"], key: "r" }} onAction={refresh} />
              <Action icon={Icon.Power} title="Restart All Services" onAction={() => runHubAction("HUB RESET", "/control/restart")} />
              <Action icon={Icon.Cloud} title="Sync Archive Vault" onAction={() => runHubAction("Vault Sync", "/archive/sync")} />
              <Action.CopyToClipboard
                title="Copy Status as Telegram"
                content={buildTelegramStatus(state, error)}
                shortcut={{ modifiers: ["cmd"], key: "c" }}
              />
              <Action.OpenInBrowser title="Open Dashboard" url="http://127.0.0.1:3000" />
            </ActionPanel>
          }
          detail={
            <List.Item.Detail
              metadata={
                <List.Item.Detail.Metadata>
                  <List.Item.Detail.Metadata.TagList title="Hub Status">
                    <List.Item.Detail.Metadata.TagList.Item
                      text={error ? "OFFLINE" : "ONLINE"}
                      color={error ? Color.Red : Color.Green}
                    />
                    <List.Item.Detail.Metadata.TagList.Item
                      text={`Up ${Math.floor((state?.uptime || 0) / 3600)}h ${Math.floor(((state?.uptime || 0) % 3600) / 60)}m`}
                      color={Color.Blue}
                    />
                  </List.Item.Detail.Metadata.TagList>
                  <List.Item.Detail.Metadata.Separator />

                  <List.Item.Detail.Metadata.Label title="❄️  AC" text={ac?.status?.toUpperCase() || "—"} />
                  <List.Item.Detail.Metadata.Label title="   Running" text={acOn ? (state?.ac_duration || "—") : "Off"} />
                  <List.Item.Detail.Metadata.Label title="   Today" text={state?.stats?.acMinutes ? `${Math.floor(state.stats.acMinutes / 60)}h ${state.stats.acMinutes % 60}m` : "0m"} />

                  <List.Item.Detail.Metadata.Label title="💡  Light" text={light?.status?.toUpperCase() || "—"} />
                  <List.Item.Detail.Metadata.Label title="   Running" text={lightOn ? (state?.light_duration || "—") : "Off"} />
                  <List.Item.Detail.Metadata.Label title="   Today" text={state?.stats?.lightMinutes ? `${Math.floor(state.stats.lightMinutes / 60)}h ${state.stats.lightMinutes % 60}m` : "0m"} />

                  <List.Item.Detail.Metadata.Separator />

                  <List.Item.Detail.Metadata.Label title="🏠  SmartThings" text={`${stOnline}/${stCount} online`} />
                  <List.Item.Detail.Metadata.Label title="   Location" text={state?.smartthings?.locationId || "Not linked"} />
                  {state?.smartthings?.lastError ? (
                    <List.Item.Detail.Metadata.Label title="   Last Error" text={state.smartthings.lastError} icon={Icon.ExclamationMark} />
                  ) : null}

                  <List.Item.Detail.Metadata.Label title="☀️  SolisCloud" text={`${state?.solis?.today || "—"} kWh today`} />
                  <List.Item.Detail.Metadata.Label title="   Now" text={`${state?.solis?.current || "—"} kW · Battery ${state?.solis?.battery || "—"}`} />

                  <List.Item.Detail.Metadata.Separator />

                  <List.Item.Detail.Metadata.Label title="⚡ Energy" text={`${state?.units || "0"} units`} />
                  <List.Item.Detail.Metadata.Label title="   Est Bill" text={`₹${state?.estimatedPgBill || 0}`} />

                  <List.Item.Detail.Metadata.Label title="🌤 Weather" text={`${state?.weather?.temp || "—"}°C · AQI ${state?.weather?.aqi || "—"}`} />
                  <List.Item.Detail.Metadata.Label title="   Sun" text={`🌅 ${state?.weather?.sunrise || "—"} → 🌇 ${state?.weather?.sunset || "—"}`} />

                  <List.Item.Detail.Metadata.Label title="🪫 Battery" text={state?.battery ? `${state.battery.level}% ${state.battery.charging ? "⚡" : ""}` : "—"} />
                </List.Item.Detail.Metadata>
              }
            />
          }
        />
      </List.Section>

      <List.Section title="Quick Actions">
        <List.Item
          icon={Icon.Wind}
          title="AC: Toggle Power"
          subtitle={acOn ? "Currently ON" : "Currently OFF"}
          actions={
            <ActionPanel>
              <Action icon={Icon.Power} title="Toggle AC" onAction={() => runHubAction("AC", acOn ? "/control/ac/off" : "/control/ac/on")} />
              <Action icon={Icon.Repeat} title="Refresh" onAction={refresh} />
            </ActionPanel>
          }
        />
        <List.Item
          icon={Icon.LightBulb}
          title="Bulb: Toggle Power"
          subtitle={lightOn ? "Currently ON" : "Currently OFF"}
          actions={
            <ActionPanel>
              <Action icon={Icon.Power} title="Toggle Bulb" onAction={() => runHubAction("Light", lightOn ? "/control/bulb/off" : "/control/bulb/on")} />
              <Action icon={Icon.Repeat} title="Refresh" onAction={refresh} />
            </ActionPanel>
          }
        />
        <List.Item
          icon={Icon.Video}
          title="TV Scene"
          subtitle="AC cool + dim bias light + quiet"
          actions={
            <ActionPanel>
              <Action icon={Icon.Video} title="Activate TV" onAction={() => runHubAction("TV Scene", "/scene/tv")} />
              <Action icon={Icon.Repeat} title="Refresh" onAction={refresh} />
            </ActionPanel>
          }
        />
        <List.Item
          icon={Icon.Moon}
          title="Bedtime"
          subtitle="Fade lights, AC sleep curve"
          actions={
            <ActionPanel>
              <Action icon={Icon.Moon} title="Activate Bedtime" onAction={() => runHubAction("Bedtime", "/scene/bedtime")} />
              <Action icon={Icon.Repeat} title="Refresh" onAction={refresh} />
            </ActionPanel>
          }
        />
        <List.Item
          icon={Icon.Sun}
          title="Sunrise (Wake-Up)"
          subtitle="Gradual warm light"
          actions={
            <ActionPanel>
              <Action icon={Icon.Sun} title="Activate Sunrise" onAction={() => runHubAction("Sunrise", "/scene/sunrise")} />
              <Action icon={Icon.Repeat} title="Refresh" onAction={refresh} />
            </ActionPanel>
          }
        />
        <List.Item
          icon={Icon.Eye}
          title="Focus Mode"
          subtitle="Crisp daylight white, AC quiet"
          actions={
            <ActionPanel>
              <Action icon={Icon.Eye} title="Activate Focus" onAction={() => runHubAction("Focus", "/scene/focus")} />
              <Action icon={Icon.Repeat} title="Refresh" onAction={refresh} />
            </ActionPanel>
          }
        />
        <List.Item
          icon={Icon.House}
          title="Cozy"
          subtitle="Soft warm white, reading glow"
          actions={
            <ActionPanel>
              <Action icon={Icon.House} title="Activate Cozy" onAction={() => runHubAction("Cozy", "/scene/cozy")} />
              <Action icon={Icon.Repeat} title="Refresh" onAction={refresh} />
            </ActionPanel>
          }
        />
        <List.Item
          icon={Icon.Snowflake}
          title="❄️  Max Cool + 10m Freeze Guard"
          subtitle="18°C powerful with auto-shutoff safety"
          actions={
            <ActionPanel>
              <Action
                icon={Icon.Snowflake}
                title="Activate Max Cool + Freeze Guard"
                onAction={async () => {
                  const toast = await showToast({ style: Toast.Style.Animated, title: "Max Cool + Freeze Guard..." });
                  try {
                    await fetch(`${HUB_URL}/control/ac/powerful?ps=on`);
                    await fetch(`${HUB_URL}/control/ac/timer?mins=10`);
                    toast.style = Toast.Style.Success;
                    toast.title = "Max Cool armed";
                    toast.message = "AC at 18°C, auto-off in 10 min";
                  } catch (e) {
                    toast.style = Toast.Style.Failure;
                    toast.title = "Failed";
                    toast.message = "Hub Offline";
                  }
                }}
              />
              <Action icon={Icon.Repeat} title="Refresh" onAction={refresh} />
            </ActionPanel>
          }
        />
        <List.Item
          icon={Icon.Wand}
          title="Open Quick Scene…"
          subtitle="Browse + fire any scene by name"
          actions={
            <ActionPanel>
              <Action.Push icon={Icon.Wand} title="Open Quick Scene" target={<QuickScene />} />
            </ActionPanel>
          }
        />
        <List.Item
          icon={Icon.Star}
          title="Open Mood Presets…"
          subtitle="Multi-step combos: Welcome Home, Movie, Focus, Bedtime, Gaming"
          actions={
            <ActionPanel>
              <Action.Push icon={Icon.Star} title="Open Mood Presets" target={<MoodPresets />} />
            </ActionPanel>
          }
        />
        <List.Item
          icon={Icon.Sun}
          title="Open Sun Position…"
          subtitle="Sunrise/sunset countdown + schedule suggestions"
          actions={
            <ActionPanel>
              <Action.Push icon={Icon.Sun} title="Open Sun Position" target={<SunPosition />} />
            </ActionPanel>
          }
        />
        <List.Item
          icon={Icon.Pencil}
          title="Quick Log to Today's Note…"
          subtitle="Append a timestamped entry to today's daily note"
          actions={
            <ActionPanel>
              <Action.Push icon={Icon.Pencil} title="Open Quick Log Form" target={<QuickLogNote />} />
            </ActionPanel>
          }
        />
        <List.Item
          icon={Icon.Text}
          title="Jot Quick Fragment…"
          subtitle="Quick text capture to the gravity archive (auto-tagged)"
          actions={
            <ActionPanel>
              <Action.Push icon={Icon.Text} title="Open Jot Form" target={<JotForm />} />
            </ActionPanel>
          }
        />
        <List.Item
          icon={Icon.XmarkCircle}
          title="🛑  PANIC MODE — Turn Off Everything"
          subtitle="AC off + Bulb off + Aura off (instant)"
          actions={
            <ActionPanel>
              <Action
                icon={Icon.XmarkCircle}
                title="Engage Panic Mode"
                onAction={async () => {
                  const toast = await showToast({ style: Toast.Style.Animated, title: "PANIC: shutting down…" });
                  try {
                    await Promise.all([
                      fetch(`${HUB_URL}/control/ac/off`),
                      fetch(`${HUB_URL}/control/bulb/off`),
                      fetch(`${HUB_URL}/control/aura/toggle`),
                    ]);
                    toast.style = Toast.Style.Success;
                    toast.title = "Panic complete";
                    toast.message = "AC + Bulb + Aura all OFF";
                    setTimeout(refresh, 500);
                  } catch (e) {
                    toast.style = Toast.Style.Failure;
                    toast.title = "Panic failed";
                    toast.message = "Hub Offline";
                  }
                }}
              />
              <Action icon={Icon.Repeat} title="Refresh" onAction={refresh} />
            </ActionPanel>
          }
        />
        <List.Item
          icon={Icon.Hammer}
          title="Restart Hub Backend"
          subtitle="Re-pulse all services (use if hub is sluggish)"
          actions={
            <ActionPanel>
              <Action
                icon={Icon.Hammer}
                title="Restart Hub"
                onAction={() => runHubAction("HUB RESTART", "/control/restart")}
              />
              <Action.OpenInBrowser title="Open Web Dashboard" url="http://127.0.0.1:3000" />
            </ActionPanel>
          }
        />
        <List.Item
          icon={Icon.Lock}
          title="Lock Screen Now"
          subtitle="One-tap mac screen lock (pmset displaysleepnow)"
          actions={
            <ActionPanel>
              <Action
                icon={Icon.Lock}
                title="Lock Screen"
                onAction={async () => {
                  const toast = await showToast({ style: Toast.Style.Animated, title: "Locking…" });
                  try {
                    // Use the bot's /system/lock endpoint (already exists)
                    await fetch(`${HUB_URL}/system/lock`);
                    toast.style = Toast.Style.Success;
                    toast.title = "Locked";
                  } catch (e) {
                    toast.style = Toast.Style.Failure;
                    toast.title = "Lock failed";
                    toast.message = "Hub Offline — use Ctrl+Cmd+Q instead";
                  }
                }}
              />
              <Action.OpenInBrowser title="Open macOS Focus Settings" url="x-apple.systempreferences:com.apple.preference.notifications" />
            </ActionPanel>
          }
        />
              </List.Section>
            </List>
          );
        }

        /**
         * Quick Jot — push form, calls /archive/jot on port 3031
         */
        function JotForm() {
          const { pop } = useNavigation();
          const [text, setText] = useState("");

          async function handleSubmit() {
            if (!text.trim()) {
              await showToast({ title: "Jot text cannot be empty", style: Toast.Style.Failure });
              return;
            }
            const toast = await showToast({ title: "Saving jot…", style: Toast.Style.Animated });
            try {
              const res = await fetch("http://127.0.0.1:3031/archive/jot", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ text }),
              });
              if (!res.ok) throw new Error("Failed");
              toast.style = Toast.Style.Success;
              toast.title = "Jot saved";
              toast.message = "Auto-tagged by archive engine";
              pop();
            } catch (e: any) {
              toast.style = Toast.Style.Failure;
              toast.title = "Failed to save";
              toast.message = String(e?.message || "Archive Offline");
            }
          }

          return (
            <Form
              actions={
                <ActionPanel>
                  <Action.SubmitForm title="Save Jot" icon={Icon.Text} onSubmit={handleSubmit} />
                </ActionPanel>
              }
            >
              <Form.Description text="Quick text capture. The archive engine auto-labels your jot with source, type, and labels." />
              <Form.TextArea
                id="text"
                title="Jot"
                placeholder="The next big idea, a thought, a code snippet, anything"
                value={text}
                onChange={setText}
                info="This goes to your gravity-archive vault with auto-tagging"
              />
            </Form>
          );
        }

        /**
         * Append a quick timestamped note to today's daily note.
         * Uses the archive server on port 3031 (/archive/notes/append).
         */
        function QuickLogNote() {
          const { pop } = useNavigation();
          const [text, setText] = useState("");
          const [heading, setHeading] = useState("");
          const [section, setSection] = useState("");

          async function handleSubmit() {
            if (!text.trim()) {
              await showToast({ title: "Note text cannot be empty", style: Toast.Style.Failure });
              return;
            }
            const today = `Daily Note ${new Date().toISOString().split("T")[0]}.md`;
            const fullText = heading.trim() ? `## ${heading.trim()}\n\n${text}` : text;
            const toast = await showToast({ title: "Logging to today's note…", style: Toast.Style.Animated });
            try {
              const res = await fetch("http://127.0.0.1:3031/archive/notes/append", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  name: today,
                  text: fullText,
                  section: section.trim() || undefined,
                }),
              });
              if (!res.ok) throw new Error("Failed");
              toast.style = Toast.Style.Success;
              toast.title = "Logged to today's note";
              toast.message = today;
              pop();
            } catch (e: any) {
              toast.style = Toast.Style.Failure;
              toast.title = "Failed to log";
              toast.message = String(e?.message || "Archive Offline");
            }
          }

          return (
            <Form
              actions={
                <ActionPanel>
                  <Action.SubmitForm title="Append to Today's Note" icon={Icon.Pencil} onSubmit={handleSubmit} />
                </ActionPanel>
              }
            >
              <Form.Description text="Append a quick timestamped entry to today's daily note. Optional heading and section." />
              <Form.TextArea
                id="text"
                title="Note text"
                placeholder="What just happened? What are you thinking?"
                value={text}
                onChange={setText}
                info="The text you want to log. Timestamps are added automatically."
              />
              <Form.TextField
                id="heading"
                title="Optional heading (## Markdown)"
                placeholder="Workout — Lower Body"
                value={heading}
                onChange={setHeading}
                info="Will be inserted as ## heading before the text"
              />
              <Form.TextField
                id="section"
                title="Optional section"
                placeholder="Daily Log"
                value={section}
                onChange={setSection}
                info="For notes with multiple sections (e.g. 'Workout', 'Meals', 'Reading')"
              />
            </Form>
          );
        }

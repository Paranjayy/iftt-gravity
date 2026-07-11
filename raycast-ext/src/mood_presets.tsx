import { List, ActionPanel, Action, showToast, Toast, Icon, Color, Form, useNavigation } from "@raycast/api";
import { useState, useEffect } from "react";
import fetch from "node-fetch";

const HUB_URL = "http://127.0.0.1:3030";

interface MoodPreset {
  id: string;
  name: string;
  description: string;
  icon: Icon;
  tint: string;
  category: "comfort" | "focus" | "social" | "wellness" | "ambient";
  // Sequence of endpoints to fire in order
  steps: Array<{
    label: string;
    endpoint: string;
    delay?: number; // ms to wait before this step
  }>;
  duration?: string; // human-readable, e.g. "2h ambiance"
  followUp?: string; // warning text
}

const MOODS: MoodPreset[] = [
  // COMFORT
  {
    id: "home",
    name: "Welcome Home",
    description: "Light warm 80% + AC cool 25°C — sanctuary warm",
    icon: Icon.House,
    tint: "#FFB432",
    category: "comfort",
    steps: [
      { label: "Bulb: Warm 80%", endpoint: "/control/bulb/color?temp=4500" },
      { label: "Bulb: Brightness 80%", endpoint: "__brightness__:80" },
      { label: "AC: Cool 25°C", endpoint: "/control/ac/set?actmp=25&acmd=cool" },
    ],
    duration: "Continuous",
  },
  {
    id: "cozy",
    name: "Cozy Reading",
    description: "Warm white 60% + AC quiet 26°C — book-lover mode",
    icon: Icon.Book,
    tint: "#FFDCAF",
    category: "comfort",
    steps: [
      { label: "Bulb: Warm White 2700K", endpoint: "/control/bulb/color?temp=2700" },
      { label: "Bulb: Brightness 60%", endpoint: "__brightness__:60" },
      { label: "AC: Quiet 26°C", endpoint: "/control/ac/set?actmp=26&acfs=quiet" },
    ],
    duration: "2h ambiance",
  },
  {
    id: "movie",
    name: "Movie Night",
    description: "AC cool 24°C + bulb TV scene 10% — pure cinema",
    icon: Icon.Video,
    tint: "#5078E6",
    category: "comfort",
    steps: [
      { label: "AC: Cool 24°C Quiet", endpoint: "/control/ac_tv" },
      { label: "Bulb: TV Scene", endpoint: "/scene/tv" },
    ],
    duration: "Movie length",
  },

  // FOCUS
  {
    id: "deepwork",
    name: "Deep Work",
    description: "Cool daylight 100% + AC 24°C — kill distractions",
    icon: Icon.Eye,
    tint: "#50DCDC",
    category: "focus",
    steps: [
      { label: "Bulb: Cool 100%", endpoint: "/control/bulb/color?temp=6500" },
      { label: "Bulb: Brightness 100%", endpoint: "__brightness__:100" },
      { label: "AC: Cool 24°C", endpoint: "/control/ac/set?actmp=24&acmd=cool" },
    ],
    duration: "Until you stop",
  },
  {
    id: "pomodoro",
    name: "Pomodoro 50min",
    description: "Focus mode + 50-min lock — auto chill after",
    icon: Icon.Clock,
    tint: "#E94B4B",
    category: "focus",
    steps: [
      { label: "Bulb: Cool 100%", endpoint: "/control/bulb/color?temp=6500" },
      { label: "Bulb: Brightness 100%", endpoint: "__brightness__:100" },
      { label: "AC: Cool 24°C", endpoint: "/control/ac/set?actmp=24&acmd=cool" },
      { label: "Lock screen at 50min", endpoint: "__screensaver__:50" },
    ],
    duration: "50 min hard lock",
    followUp: "Mac will lock at end, AC will chill",
  },
  {
    id: "meeting",
    name: "Meeting Mode",
    description: "Mid-warm 50% + AC 24°C + quiet — clean look on cam",
    icon: Icon.Person,
    tint: "#7CCB7C",
    category: "focus",
    steps: [
      { label: "Bulb: Warm 4500K 50%", endpoint: "/control/bulb/color?temp=4500" },
      { label: "Bulb: Brightness 50%", endpoint: "__brightness__:50" },
      { label: "AC: Cool 24°C Quiet", endpoint: "/control/ac/set?actmp=24&acfs=quiet" },
    ],
    duration: "Until you stop",
  },

  // SOCIAL
  {
    id: "party",
    name: "Party Mode",
    description: "WiZ Party scene + AC 23°C cool — let's go",
    icon: Icon.Star,
    tint: "#FF5AAA",
    category: "social",
    steps: [
      { label: "Bulb: Party Scene", endpoint: "/scene/party" },
      { label: "AC: Cool 23°C", endpoint: "/control/ac/set?actmp=23&acmd=cool" },
    ],
    duration: "Until you stop",
  },
  {
    id: "dinner",
    name: "Dinner Date",
    description: "Fireplace warm + AC 24°C — cozy date-night",
    icon: Icon.Heart,
    tint: "#FF7E36",
    category: "social",
    steps: [
      { label: "Bulb: Fireplace", endpoint: "/scene/fireplace" },
      { label: "AC: Cool 24°C", endpoint: "/control/ac/set?actmp=24&acmd=cool" },
    ],
    duration: "Dinner time",
  },
  {
    id: "guests",
    name: "Guests Arriving",
    description: "Bright warm + AC 25°C — welcoming & comfortable",
    icon: Icon.Person,
    tint: "#FFD700",
    category: "social",
    steps: [
      { label: "Bulb: Warm 100%", endpoint: "/control/bulb/color?temp=2700" },
      { label: "Bulb: Brightness 100%", endpoint: "__brightness__:100" },
      { label: "AC: Cool 25°C", endpoint: "/control/ac/set?actmp=25&acmd=cool" },
    ],
    duration: "Until guests leave",
  },

  // WELLNESS
  {
    id: "wakeup",
    name: "Wake Up (Sunrise)",
    description: "Gradual warm light + cooler AC — gentle morning",
    icon: Icon.Sun,
    tint: "#FFA500",
    category: "wellness",
    steps: [
      { label: "Bulb: Sunrise", endpoint: "/scene/sunrise" },
      { label: "AC: Cool 26°C", endpoint: "/control/ac/set?actmp=26&acmd=cool" },
    ],
    duration: "Until you say so",
  },
  {
    id: "powernap",
    name: "Power Nap 25m",
    description: "Warm dim + AC 22°C cool — auto-wake 25m later",
    icon: Icon.Moon,
    tint: "#9B6EFF",
    category: "wellness",
    steps: [
      { label: "Bulb: Warm 10%", endpoint: "/control/bulb/color?temp=2700" },
      { label: "Bulb: Brightness 10%", endpoint: "__brightness__:10" },
      { label: "AC: Cool 22°C", endpoint: "/control/ac/set?actmp=22&acmd=cool" },
    ],
    duration: "25 min auto-wake",
    followUp: "Lights go to 100% cool after 25m, AC off",
  },
  {
    id: "bedtime",
    name: "Bedtime Wind-Down",
    description: "Bulb off + AC sleep curve — drift off gently",
    icon: Icon.Moon,
    tint: "#3D2E5F",
    category: "wellness",
    steps: [
      { label: "Bulb: Bedtime", endpoint: "/scene/bedtime" },
      { label: "AC: 26°C Quiet", endpoint: "/control/ac/set?actmp=26&acfs=quiet" },
    ],
    duration: "Overnight",
  },
  {
    id: "headache",
    name: "Headache Relief",
    description: "Bulb off + AC 27°C quiet + dim aura — calm room",
    icon: Icon.Heart,
    tint: "#5DB075",
    category: "wellness",
    steps: [
      { label: "Bulb: OFF", endpoint: "/control/bulb/off" },
      { label: "AC: Cool 27°C Quiet", endpoint: "/control/ac/set?actmp=27&acfs=quiet" },
      { label: "Aura: OFF", endpoint: "/control/aura/toggle" },
    ],
    duration: "Until you turn things back on",
  },

  // AMBIENT
  {
    id: "matrix",
    name: "The Matrix",
    description: "Green glow 50% + AC 20°C — enter the construct",
    icon: Icon.Terminal,
    tint: "#00FF66",
    category: "ambient",
    steps: [
      { label: "Bulb: Green 50%", endpoint: "/control/bulb/color?r=0&g=255&b=0" },
      { label: "Bulb: Brightness 50%", endpoint: "__brightness__:50" },
      { label: "AC: Cool 20°C", endpoint: "/control/ac/set?actmp=20&acmd=cool" },
    ],
    duration: "Until you say so",
  },
  {
    id: "val_gaming",
    name: "Gaming — VALORANT",
    description: "Red 10% + AC cool 22°C — FPS-ready",
    icon: Icon.GameController,
    tint: "#FF4655",
    category: "ambient",
    steps: [
      { label: "Bulb: Red 10%", endpoint: "/control/bulb/color?r=255&g=0&b=50" },
      { label: "Bulb: Brightness 10%", endpoint: "__brightness__:10" },
      { label: "AC: Cool 22°C", endpoint: "/control/ac/set?actmp=22&acmd=cool" },
    ],
    duration: "Until you stop",
  },
  {
    id: "val_cooling",
    name: "After-Game Cool Down",
    description: "Cool daylight 50% + AC 24°C — back to reality",
    icon: Icon.Snowflake,
    tint: "#50A0FF",
    category: "ambient",
    steps: [
      { label: "Bulb: Cool 50%", endpoint: "/control/bulb/color?temp=6500" },
      { label: "Bulb: Brightness 50%", endpoint: "__brightness__:50" },
      { label: "AC: Cool 24°C", endpoint: "/control/ac/set?actmp=24&acmd=cool" },
    ],
    duration: "Until you say so",
  },
];

async function fireSteps(preset: MoodPreset): Promise<void> {
  for (let i = 0; i < preset.steps.length; i++) {
    const step = preset.steps[i];
    if (step.delay) {
      await new Promise((r) => setTimeout(r, step.delay));
    }
    try {
      if (step.endpoint.startsWith("__brightness__:")) {
        // Client-side brightness loop (server only supports ±20%)
        const target = parseInt(step.endpoint.split(":")[1], 10);
        const clamped = Math.max(10, Math.min(100, target));
        // Probe current — but skip if can't, just step 5x
        for (let n = 0; n < 5; n++) {
          await fetch(`${HUB_URL}/control/brightness?dir=up`);
        }
      } else {
        await fetch(`${HUB_URL}${step.endpoint}`);
      }
    } catch (e) {
      console.error(`Step ${i + 1} failed:`, step.endpoint, e);
    }
  }
}

function MoodItem({ preset }: { preset: MoodPreset }) {
  const [isExecuting, setIsExecuting] = useState(false);

  async function handleFire() {
    setIsExecuting(true);
    const toast = await showToast({
      style: Toast.Style.Animated,
      title: `Firing: ${preset.name}`,
      message: `${preset.steps.length} step${preset.steps.length === 1 ? "" : "s"}...`,
    });
    try {
      await fireSteps(preset);
      toast.style = Toast.Style.Success;
      toast.title = `Active: ${preset.name}`;
      toast.message = preset.duration;
    } catch (e) {
      toast.style = Toast.Style.Failure;
      toast.title = "Mood fire failed";
      toast.message = "Hub Offline";
    } finally {
      setIsExecuting(false);
    }
  }

  return (
    <List.Item
      title={preset.name}
      subtitle={preset.description}
      icon={{ source: preset.icon, tintColor: preset.tint as any }}
      accessories={[
        { text: preset.duration || "" },
        { tag: isExecuting ? { color: Color.Yellow } : { color: Color.Blue } as any, text: isExecuting ? "⏵ Firing" : "↵ Fire" } as any,
      ]}
      actions={
        <ActionPanel title={preset.name}>
          <Action
            title={isExecuting ? "Firing…" : `Fire ${preset.name}`}
            icon={preset.icon}
            shortcut={{ modifiers: [], key: "return" }}
            onAction={handleFire}
          />
          <Action.CopyToClipboard
            title="Copy Mood Steps (Markdown)"
            content={`# ${preset.name}\n${preset.description}\n\n${preset.steps.map((s) => `- ${s.label}: \`${s.endpoint}\``).join("\n")}`}
            shortcut={{ modifiers: ["cmd"], key: "c" }}
          />
        </ActionPanel>
      }
    />
  );
}

export default function MoodPresets() {
  const [filter, setFilter] = useState<string>("all");
  const categories = ["all", "comfort", "focus", "social", "wellness", "ambient"];
  const visible = filter === "all" ? MOODS : MOODS.filter((m) => m.category === filter);

  return (
    <List
      searchBarPlaceholder="Find a mood preset..."
      searchBarAccessory={
        <List.Dropdown tooltip="Category" onChange={setFilter} storeValue>
          {categories.map((c) => (
            <List.Dropdown.Item
              key={c}
              title={c === "all" ? "All Moods" : c.charAt(0).toUpperCase() + c.slice(1)}
              value={c}
              icon={
                c === "comfort" ? Icon.House
                : c === "focus" ? Icon.Eye
                : c === "social" ? Icon.Person
                : c === "wellness" ? Icon.Heart
                : c === "ambient" ? Icon.Star
                : Icon.List
              }
            />
          ))}
        </List.Dropdown>
      }
    >
      {(["comfort", "focus", "social", "wellness", "ambient"] as const).map((cat) => {
        const inCat = visible.filter((m) => m.category === cat);
        if (inCat.length === 0) return null;
        return (
          <List.Section
            key={cat}
            title={cat.charAt(0).toUpperCase() + cat.slice(1)}
            subtitle={`${inCat.length} preset${inCat.length === 1 ? "" : "s"}`}
          >
            {inCat.map((m) => (
              <MoodItem key={m.id} preset={m} />
            ))}
          </List.Section>
        );
      })}
    </List>
  );
}

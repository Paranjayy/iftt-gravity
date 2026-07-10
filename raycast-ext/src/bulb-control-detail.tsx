import { List, ActionPanel, Action, showToast, Toast, Icon, Color } from "@raycast/api";
import { useState, useEffect } from "react";
import fetch from "node-fetch";

interface HubState {
  online: boolean;
  uptime: number;
  light_duration?: string;
  stats?: {
    light?: { status: string };
    lightMinutes?: number;
  };
  wiz?: {
    ip?: string;
    reachable?: boolean;
    pilot?: {
      state?: boolean;
      dimming?: number;
      r?: number;
      g?: number;
      b?: number;
      temp?: number;
      sceneId?: number;
      rssi?: number;
    };
    lastSeen?: string;
    lastError?: string;
  } | null;
}

const PRESET_COLORS: Array<{ name: string; r: number; g: number; b: number; hex: string; icon: Icon; description: string }> = [
  { name: "Ember Red",  r: 255, g: 40,  b: 40,  hex: "#FF2828", icon: Icon.Circle, description: "Power red — alerts" },
  { name: "Sunset",     r: 255, g: 120, b: 30,  hex: "#FF781E", icon: Icon.Sun,    description: "Warm evening" },
  { name: "Amber",      r: 255, g: 180, b: 50,  hex: "#FFB432", icon: Icon.LightBulb, description: "Cozy fire" },
  { name: "Honey",      r: 255, g: 210, b: 90,  hex: "#FFD25A", icon: Icon.Circle, description: "Soft warm" },
  { name: "Warm White", r: 255, g: 220, b: 170, hex: "#FFDCAF", icon: Icon.Circle, description: "Reading glow" },
  { name: "Daylight",   r: 255, g: 250, b: 240, hex: "#FFFAF0", icon: Icon.Sun,    description: "Bright cool white" },
  { name: "Mint",       r: 80,  g: 230, b: 180, hex: "#50E6B4", icon: Icon.Leaf,   description: "Fresh & bright" },
  { name: "Cyan",       r: 60,  g: 200, b: 240, hex: "#3CC8F0", icon: Icon.Snowflake, description: "Cool focus" },
  { name: "Ocean",      r: 30,  g: 100, b: 220, hex: "#1E64DC", icon: Icon.BarChart, description: "Deep blue" },
  { name: "Violet",     r: 140, g: 70,  b: 220, hex: "#8C46DC", icon: Icon.Star,   description: "Evening calm" },
  { name: "Magenta",    r: 230, g: 60,  b: 200, hex: "#E63CC8", icon: Icon.Star,   description: "Party mode" },
  { name: "Hot Pink",   r: 255, g: 90,  b: 170, hex: "#FF5AAA", icon: Icon.Heart,  description: "Playful" },
];

const WIZ_SCENES: Array<{ name: string; key: string; description: string; icon: Icon }> = [
  { name: "Ocean",       key: "ocean",     description: "Calm blue waves",     icon: Icon.BarChart },
  { name: "Romance",     key: "romance",   description: "Dim warm red",        icon: Icon.Heart },
  { name: "Sunrise",     key: "sunrise",   description: "Gradual warm-up (maps to Wake Up)", icon: Icon.Sun },
  { name: "Party",       key: "party",     description: "Energetic RGB cycle", icon: Icon.Star },
  { name: "Fireplace",   key: "fireplace", description: "Flickering orange",   icon: Icon.LightBulb },
  { name: "Cozy",        key: "cozy",      description: "Soft warm white",     icon: Icon.Circle },
  { name: "Pastel",      key: "pastel",    description: "Multi-color soft",    icon: Icon.Circle },
  { name: "Bedtime",     key: "bedtime",   description: "Fading to dark",      icon: Icon.Moon },
  { name: "Focus",       key: "focus",     description: "Crisp daylight",      icon: Icon.Eye },
  { name: "Relax",       key: "relax",     description: "Dimmed warm",         icon: Icon.Circle },
  { name: "Warm White",  key: "warm",      description: "Cozy incandescent",   icon: Icon.Sun },
  { name: "Cool White",  key: "cool",      description: "Crisp daylight white",icon: Icon.Snowflake },
];

const BRIGHTNESS_PRESETS = [5, 25, 50, 75, 100];

const COLOR_TEMPS = [
  { name: "Candle",     k: 2200, icon: Icon.Circle },
  { name: "Warm",       k: 2700, icon: Icon.Sun },
  { name: "Soft White", k: 3000, icon: Icon.Circle },
  { name: "Bright Warm",k: 4000, icon: Icon.LightBulb },
  { name: "Daylight",   k: 5000, icon: Icon.Sun },
  { name: "Cool",       k: 6500, icon: Icon.Snowflake },
];

export default function BulbControlDetail() {
  const [state, setState] = useState<HubState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    try {
      const res = await fetch("http://127.0.0.1:3030/status");
      const data = await res.json();
      setState(data as HubState);
      setError(null);
    } catch (e) {
      setError("Hub Offline");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, 5000);
    return () => clearInterval(timer);
  }, []);

  async function runAction(name: string, endpoint: string) {
    const toast = await showToast({ style: Toast.Style.Animated, title: `Pulsing: ${name}...` });
    try {
      const res = await fetch(`http://127.0.0.1:3030${endpoint}`);
      if (!res.ok) throw new Error("Failed");
      toast.style = Toast.Style.Success;
      toast.title = `Confirmed: ${name}`;
      await refresh();
    } catch (e) {
      toast.style = Toast.Style.Failure;
      toast.title = "Action Failed";
      toast.message = "Hub Offline";
    }
  }

  /**
   * Set brightness to a target % by stepping the existing ±20% endpoint.
   * Loops at most 5 times to avoid infinite recursion. Clamps to [10, 100].
   */
  async function setBrightnessTo(target: number) {
    const clamped = Math.max(10, Math.min(100, target));
    const current = brightness || 50;
    const diff = clamped - current;
    const steps = Math.min(5, Math.max(1, Math.ceil(Math.abs(diff) / 20)));
    const dir = diff > 0 ? "up" : "down";
    const toast = await showToast({
      style: Toast.Style.Animated,
      title: `Pulsing: Brightness → ${clamped}%`,
    });
    try {
      for (let i = 0; i < steps; i++) {
        await fetch(`http://127.0.0.1:3030/control/brightness?dir=${dir}`);
      }
      toast.style = Toast.Style.Success;
      toast.title = `Confirmed: Brightness ${clamped}%`;
      await refresh();
    } catch (e) {
      toast.style = Toast.Style.Failure;
      toast.title = "Action Failed";
      toast.message = "Hub Offline";
    }
  }

  const pilot = state?.wiz?.pilot;
  const isOn = pilot?.state === true;
  const brightness = pilot?.dimming ?? 0;
  const scene = pilot?.sceneId ? WIZ_SCENES.find((s) => Number(s.id) === Number(pilot.sceneId) || (s as any).key === pilot.sceneId) : undefined;
  const isColorMode = pilot?.r !== undefined || pilot?.g !== undefined || pilot?.b !== undefined;
  const rgb = isColorMode ? `RGB(${pilot?.r}, ${pilot?.g}, ${pilot?.b})` : undefined;

  const getPowerColor = () => (isOn ? Color.Green : Color.Red);
  const getPowerStr = () => (isOn ? "ON" : "OFF");

  const getModeStr = () => {
    if (scene) return `Scene: ${scene.name}`;
    if (pilot?.temp) return `White (${pilot.temp}K)`;
    if (isColorMode) return "Color";
    if (isOn) return "Default White";
    return "Standby";
  };

  const lightMinutes = state?.stats?.lightMinutes || 0;
  // Wiz LED ~9W typical, plus PSU losses; assume 10W
  const bulbWatts = 10;
  const bulbKwh = (lightMinutes / 60) * bulbWatts / 1000;
  // Use same GERC slab as AC
  const calculateCost = (units: number) => {
    let charge = 0;
    if (units <= 50) charge = units * 3.05;
    else if (units <= 100) charge = 50 * 3.05 + (units - 50) * 3.50;
    else if (units <= 250) charge = 50 * 3.05 + 50 * 3.50 + (units - 100) * 4.10;
    else charge = 50 * 3.05 + 50 * 3.50 + 150 * 4.10 + (units - 250) * 4.60;
    const fpppa = units * 2.85;
    const subtotal = charge + fpppa;
    return subtotal * 1.15;
  };
  const bulbCost = calculateCost(bulbKwh);

  // Top-level sections
  const powerSection = {
    section: "General Controls",
    items: [
      {
        id: "power",
        title: isOn ? "Turn Light OFF" : "Turn Light ON",
        icon: Icon.Power,
        endpoint: isOn ? "/control/bulb_off" : "/control/bulb_on",
        name: isOn ? "Light Off" : "Light On",
      },
      {
        id: "bright-up",
        title: "Brightness UP (+20%)",
        icon: Icon.Plus,
        endpoint: "/control/brightness?dir=up",
        name: "Brightness Up",
      },
      {
        id: "bright-down",
        title: "Brightness DOWN (-20%)",
        icon: Icon.Minus,
        endpoint: "/control/brightness?dir=down",
        name: "Brightness Down",
      },
    ],
  };

  const brightSection = {
    section: "Brightness Presets",
    items: BRIGHTNESS_PRESETS.map((b) => ({
      id: `bright-${b}`,
      title: `Set to ${b}%`,
      subtitle: b === 100 ? "Max" : b <= 25 ? "Dim" : b === 50 ? "Half" : "Bright",
      icon: b <= 25 ? Icon.StackedBars1 : b === 50 ? Icon.StackedBars2 : b === 75 ? Icon.StackedBars3 : Icon.StackedBars4,
      endpoint: `__brightness__:${b}`, // marker - handled specially below
      name: `Brightness ${b}%`,
    })),
  };

  const colorSection = {
    section: "Color Palette",
    items: PRESET_COLORS.map((c) => ({
      id: `color-${c.name}`,
      title: c.name,
      subtitle: c.description,
      icon: { source: Icon.Circle, tintColor: c.hex as any },
      endpoint: `/control/bulb/color?r=${c.r}&g=${c.g}&b=${c.b}`,
      name: `Color: ${c.name}`,
    })),
  };

  const tempSection = {
    section: "White Color Temperature",
    items: COLOR_TEMPS.map((t) => ({
      id: `temp-${t.k}`,
      title: `${t.name} (${t.k}K)`,
      subtitle: t.k < 3000 ? "Warm" : t.k < 5000 ? "Neutral" : "Cool",
      icon: t.icon,
      endpoint: `/control/bulb/color?temp=${t.k}`,
      name: `Temp: ${t.name}`,
    })),
  };

  const sceneSection = {
    section: "Built-in WiZ Scenes",
    items: WIZ_SCENES.map((s) => ({
      id: `scene-${s.key}`,
      title: s.name,
      subtitle: s.description,
      icon: s.icon,
      endpoint: `/scene/${s.key}`,
      name: `Scene: ${s.name}`,
    })),
  };

  const presetSection = {
    section: "Lifestyle Presets",
    items: [
      { id: "tv",    title: "TV Mode (Dim Bias Light + AC Cool)",  icon: Icon.Video, endpoint: "/scene/tv",      name: "TV Mode" },
      { id: "focus", title: "Focus Mode (Daylight White)",          icon: Icon.Eye,   endpoint: "/scene/focus",   name: "Focus Mode" },
      { id: "wake",  title: "Wake Up (Sunrise Warm-Up)",            icon: Icon.Sun,   endpoint: "/scene/sunrise", name: "Wake Up" },
      { id: "sleep", title: "Bedtime (Fade to Dark)",               icon: Icon.Moon,  endpoint: "/scene/bedtime", name: "Bedtime" },
      { id: "aura",  title: "Toggle Media Aura Sync",               icon: Icon.Star,  endpoint: "/control/aura/toggle", name: "Aura Toggle" },
    ],
  };

  const allSections = [powerSection, brightSection, colorSection, tempSection, sceneSection, presetSection];

  return (
    <List
      isLoading={isLoading}
      isShowingDetail={true}
      searchBarPlaceholder="Execute Light Precision command..."
    >
      <List.Section title="Quick Toggle">
        <List.Item
          title={isOn ? "Turn Light OFF" : "Turn Light ON"}
          subtitle={
            error
              ? "Hub offline"
              : isOn
                ? `ON at ${brightness}%${scene ? ` · ${scene.name}` : pilot?.temp ? ` · ${pilot.temp}K` : ""}`
                : "Currently OFF"
          }
          icon={{ source: isOn ? Icon.LightBulb : Icon.Circle, tintColor: isOn ? "#FFB432" : "#666666" }}
          accessories={[
            { text: isOn ? "ON" : "OFF", tag: isOn ? { color: Color.Green } : { color: Color.Red } } as any,
          ]}
          actions={
            <ActionPanel title="Quick Toggle">
              <Action
                title={isOn ? "Turn Light OFF" : "Turn Light ON"}
                icon={isOn ? Icon.Circle : Icon.LightBulb}
                shortcut={{ modifiers: ["cmd"], key: "t" }}
                onAction={() => runAction(isOn ? "Light Off" : "Light On", isOn ? "/control/bulb/off" : "/control/bulb/on")}
              />
              <Action
                title="Toggle Power (Alt: bulb_on/bulb_off)"
                icon={Icon.Power}
                onAction={() => runAction(isOn ? "Light Off" : "Light On", isOn ? "/control/bulb_off" : "/control/bulb_on")}
              />
              <Action
                title="Force Refresh State"
                icon={Icon.Repeat}
                shortcut={{ modifiers: ["cmd"], key: "r" }}
                onAction={refresh}
              />
            </ActionPanel>
          }
          detail={
            <List.Item.Detail
              metadata={
                <List.Item.Detail.Metadata>
                  <List.Item.Detail.Metadata.TagList title="Device Status">
                    {error ? (
                      <List.Item.Detail.Metadata.TagList.Item text={error.toUpperCase()} color={Color.Red} />
                    ) : state?.wiz?.reachable === false ? (
                      <List.Item.Detail.Metadata.TagList.Item text="UNREACHABLE" color={Color.Red} />
                    ) : (
                      <List.Item.Detail.Metadata.TagList.Item
                        text={state?.wiz?.reachable === false ? "OFFLINE" : "ONLINE"}
                        color={state?.wiz?.reachable === false ? Color.Red : Color.Green}
                      />
                    )}
                  </List.Item.Detail.Metadata.TagList>
                  <List.Item.Detail.Metadata.TagList title="Power">
                    <List.Item.Detail.Metadata.TagList.Item text={getPowerStr()} color={getPowerColor()} />
                  </List.Item.Detail.Metadata.TagList>
                  <List.Item.Detail.Metadata.Separator />
                  <List.Item.Detail.Metadata.Label title="Brightness" text={`${brightness}%`} icon={brightness > 0 ? Icon.LightBulb : Icon.Circle} />
                  <List.Item.Detail.Metadata.Label title="Mode" text={getModeStr()} icon={scene ? scene.icon : Icon.Sun} />
                  <List.Item.Detail.Metadata.Label title="Uptime Today" text={lightMinutes > 0 ? `${Math.floor(lightMinutes / 60)}h ${lightMinutes % 60}m` : "0m"} icon={Icon.Clock} />
                </List.Item.Detail.Metadata>
              }
            />
          }
        />
      </List.Section>
      {allSections.map((group) => (
        <List.Section key={group.section} title={group.section}>
          {group.items.map((item) => (
            <List.Item
              key={item.id}
              title={item.title}
              icon={item.icon as any}
              actions={
                <ActionPanel>
                  <Action
                    title={item.title}
                    icon={item.icon as any}
                    onAction={() => {
                      if (item.endpoint.startsWith("__brightness__:")) {
                        const pct = parseInt(item.endpoint.split(":")[1], 10);
                        setBrightnessTo(pct);
                      } else {
                        runAction(item.name, item.endpoint);
                      }
                    }}
                  />
                  <Action
                    title="Force Refresh State"
                    icon={Icon.Repeat}
                    shortcut={{ modifiers: ["cmd"], key: "r" }}
                    onAction={refresh}
                  />
                </ActionPanel>
              }
              detail={
                <List.Item.Detail
                  metadata={
                    <List.Item.Detail.Metadata>
                      <List.Item.Detail.Metadata.TagList title="Device Status">
                        {error ? (
                          <List.Item.Detail.Metadata.TagList.Item text={error.toUpperCase()} color={Color.Red} />
                        ) : state?.wiz?.reachable === false ? (
                          <List.Item.Detail.Metadata.TagList.Item text="UNREACHABLE" color={Color.Red} />
                        ) : (
                          <List.Item.Detail.Metadata.TagList.Item
                            text={state?.wiz?.reachable === false ? "OFFLINE" : "ONLINE"}
                            color={state?.wiz?.reachable === false ? Color.Red : Color.Green}
                          />
                        )}
                      </List.Item.Detail.Metadata.TagList>

                      <List.Item.Detail.Metadata.TagList title="Power">
                        <List.Item.Detail.Metadata.TagList.Item
                          text={getPowerStr()}
                          color={getPowerColor()}
                        />
                      </List.Item.Detail.Metadata.TagList>

                      <List.Item.Detail.Metadata.Separator />

                      <List.Item.Detail.Metadata.Label title="Telemetry Status" />
                      <List.Item.Detail.Metadata.Label
                        title="Brightness"
                        text={`${brightness}%`}
                        icon={brightness > 0 ? Icon.LightBulb : Icon.Circle}
                      />
                      <List.Item.Detail.Metadata.Label
                        title="Mode"
                        text={getModeStr()}
                        icon={scene ? scene.icon : Icon.Sun}
                      />
                      {rgb ? (
                        <List.Item.Detail.Metadata.Label title="RGB Channel" text={rgb} />
                      ) : null}
                      <List.Item.Detail.Metadata.Label
                        title="Uptime Today"
                        text={lightMinutes > 0 ? `${Math.floor(lightMinutes / 60)}h ${lightMinutes % 60}m` : "0m"}
                        icon={Icon.Clock}
                      />

                      <List.Item.Detail.Metadata.Separator />

                      <List.Item.Detail.Metadata.Label title="GERC Slab Energy Billing" />
                      <List.Item.Detail.Metadata.Label
                        title="Bulb Draw"
                        text={`~${bulbWatts}W (LED)`}
                        icon={Icon.Bolt}
                      />
                      <List.Item.Detail.Metadata.Label
                        title="Energy Consumed"
                        text={`${bulbKwh.toFixed(3)} kWh`}
                        icon={Icon.BarChart}
                      />
                      <List.Item.Detail.Metadata.Label
                        title="Incremental Cost"
                        text={`₹${bulbCost.toFixed(2)}`}
                        icon={Icon.Coin}
                      />

                      <List.Item.Detail.Metadata.Separator />

                      <List.Item.Detail.Metadata.Label title="Hardware Properties" />
                      <List.Item.Detail.Metadata.Label title="Adapter" text="Philips WiZ" icon={Icon.LightBulb} />
                      <List.Item.Detail.Metadata.Label title="IP" text={state?.wiz?.ip || "--"} />
                      <List.Item.Detail.Metadata.Label
                        title="Signal RSSI"
                        text={pilot?.rssi ? `${pilot.rssi} dBm` : "--"}
                        icon={Icon.Wifi}
                      />
                      <List.Item.Detail.Metadata.Label
                        title="Last Sync"
                        text={state?.wiz?.lastSeen ? new Date(state.wiz.lastSeen).toLocaleString() : "--"}
                        icon={Icon.Clock}
                      />
                      {state?.wiz?.lastError ? (
                        <List.Item.Detail.Metadata.Label
                          title="Last Error"
                          text={state.wiz.lastError}
                          icon={Icon.ExclamationMark}
                        />
                      ) : null}
                    </List.Item.Detail.Metadata>
                  }
                />
              }
            />
          ))}
        </List.Section>
      ))}
    </List>
  );
}

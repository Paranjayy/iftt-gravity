import { List, ActionPanel, Action, showToast, Toast, Icon, Color, Form, useNavigation, LocalStorage } from "@raycast/api";
import { useState, useEffect } from "react";
import fetch from "node-fetch";
import { getHubUrl, hubUrl } from "./config";

interface HubState {
  online: boolean;
  uptime: number;
  light_duration?: string;
  stats?: {
    light?: { status: string };
    lightMinutes?: number;
  };
  wiz?: {
    /** Legacy single-bulb shape */
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
    /** New multi-bulb registry shape (wiz-registry) */
    source?: "registry" | "single" | null;
    summary?: string | null;
    bulbs?: Array<{
      mac: string;
      name: string;
      ip: string | null;
      online: boolean;
      state: boolean | null;
      sceneId: number | null;
      dimming: number | null;
      temp: number | null;
      rssi: number | null;
      lastSeen?: number;
      last_seen?: number;
      traits?: any;
    }>;
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

const WIZ_SCENES: Array<{ name: string; key: string; description: string; icon: Icon; category: "static" | "dynamic" | "misc" }> = [
  // Static
  { name: "Cozy", key: "cozy", description: "Soft warm white", icon: Icon.Circle, category: "static" },
  { name: "Warm White", key: "warm", description: "Cozy incandescent", icon: Icon.Sun, category: "static" },
  { name: "Daylight", key: "daylight", description: "Bright daylight white", icon: Icon.Sun, category: "static" },
  { name: "Cool White", key: "cool", description: "Crisp daylight white", icon: Icon.Snowflake, category: "static" },
  { name: "Night Light", key: "nightlight", description: "Dim warm glow", icon: Icon.Moon, category: "static" },
  { name: "Focus", key: "focus", description: "Crisp daylight", icon: Icon.Eye, category: "static" },
  { name: "Relax", key: "relax", description: "Dimmed warm", icon: Icon.Circle, category: "static" },
  { name: "True Colors", key: "truecolors", description: "Accurate color rendering", icon: Icon.Circle, category: "static" },
  { name: "TV Time", key: "tv", description: "Bias lighting for screens", icon: Icon.Video, category: "static" },
  { name: "Plantgrowth", key: "plantgrowth", description: "Growth-spectrum light", icon: Icon.Leaf, category: "static" },
  // Dynamic
  { name: "Ocean", key: "ocean", description: "Calm blue waves", icon: Icon.BarChart, category: "dynamic" },
  { name: "Romance", key: "romance", description: "Dim warm red", icon: Icon.Heart, category: "dynamic" },
  { name: "Sunset", key: "sunset", description: "Warm evening fade", icon: Icon.Sun, category: "dynamic" },
  { name: "Party", key: "party", description: "Energetic RGB cycle", icon: Icon.Star, category: "dynamic" },
  { name: "Fireplace", key: "fireplace", description: "Flickering orange", icon: Icon.LightBulb, category: "dynamic" },
  { name: "Forest", key: "forest", description: "Green woodland", icon: Icon.Leaf, category: "dynamic" },
  { name: "Pastel", key: "pastel", description: "Multi-color soft", icon: Icon.Circle, category: "dynamic" },
  { name: "Spring", key: "spring", description: "Fresh bloom colors", icon: Icon.Leaf, category: "dynamic" },
  { name: "Summer", key: "summer", description: "Warm vibrant tones", icon: Icon.Sun, category: "dynamic" },
  { name: "Fall", key: "fall", description: "Autumn warmth", icon: Icon.Leaf, category: "dynamic" },
  { name: "Deepdive", key: "deepdive", description: "Deep ocean blue", icon: Icon.BarChart, category: "dynamic" },
  { name: "Jungle", key: "jungle", description: "Tropical green", icon: Icon.Leaf, category: "dynamic" },
  { name: "Mojito", key: "mojito", description: "Minty fresh", icon: Icon.Circle, category: "dynamic" },
  { name: "Club", key: "club", description: "Nightclub vibe", icon: Icon.Star, category: "dynamic" },
  { name: "Christmas", key: "christmas", description: "Holiday red & green", icon: Icon.Star, category: "dynamic" },
  { name: "Halloween", key: "halloween", description: "Spooky orange & purple", icon: Icon.Star, category: "dynamic" },
  { name: "Candlelight", key: "candlelight", description: "Flickering warm glow", icon: Icon.LightBulb, category: "dynamic" },
  { name: "Golden White", key: "golden", description: "Rich golden hue", icon: Icon.Sun, category: "dynamic" },
  { name: "Pulse", key: "pulse", description: "Rhythmic brightness pulse", icon: Icon.Circle, category: "dynamic" },
  { name: "Steampunk", key: "steampunk", description: "Copper & bronze tones", icon: Icon.Star, category: "dynamic" },
  // Misc
  { name: "Wake Up", key: "sunrise", description: "Gradual warm-up", icon: Icon.Sun, category: "misc" },
  { name: "Bedtime", key: "bedtime", description: "Fading to dark", icon: Icon.Moon, category: "misc" },
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

  // Selected bulb (MAC). Defaults to the first known bulb from the registry
  // (or "first" if the registry isn't loaded). Persisted in LocalStorage.
  type BulbTarget = { mac: string; name: string } | { name: "first" };
  const [target, setTarget] = useState<BulbTarget>({ name: "first" });

  // Optimistic local state — the server doesn't expose WiZ pilot over HTTP,
  // so we track brightness, temp, RGB, and active scene locally. This state
  // gets updated immediately when the user fires an action, so the UI feels
  // responsive even though the hub's /status payload doesn't include it.
  const [optimistic, setOptimistic] = useState<{
    dimming: number;
    temp?: number;
    r?: number; g?: number; b?: number;
    sceneKey?: string;
  }>({ dimming: 50 });

  // Hydrate optimistic state from LocalStorage on mount, so the bulb detail
  // view doesn't reset to "0%" every time the user re-opens it. Latest write
  // wins (one entry per user).
  useEffect(() => {
    (async () => {
      const stored = await LocalStorage.getItem<string>("gravity-bulb-state");
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          if (parsed && typeof parsed === "object" && typeof parsed.dimming === "number") {
            setOptimistic(parsed);
          }
        } catch {}
      }
      // Restore the last-selected bulb
      const lastMac = await LocalStorage.getItem<string>("gravity-bulb-mac");
      if (lastMac) setTarget({ mac: lastMac, name: lastMac });
    })();
  }, []);

  // Persist on every change
  useEffect(() => {
    LocalStorage.setItem("gravity-bulb-state", JSON.stringify(optimistic));
  }, [optimistic]);

  // Persist selected bulb
  useEffect(() => {
    if ("mac" in target) LocalStorage.setItem("gravity-bulb-mac", target.mac);
  }, [target]);

  // Discover available bulbs from the registry endpoint
  const [registryBulbs, setRegistryBulbs] = useState<Array<{ mac: string; name: string; online: boolean; ip: string | null }>>([]);
  useEffect(() => {
    let cancelled = false;
    async function loadBulbs() {
      try {
        const r = await fetch(hubUrl("control/wiz/devices"));
        if (!r.ok) return;
        const data = (await r.json()) as { bulbs?: Array<any> };
        if (cancelled) return;
        const list = (data.bulbs || []).map((b: any) => ({
          mac: b.mac,
          name: b.name,
          online: !!b.online,
          ip: b.ip,
        }));
        setRegistryBulbs(list);
        // If no specific bulb selected yet, default to the first online one
        if ("name" in target && target.name === "first" && list.length > 0) {
          const online = list.find((b) => b.online) || list[0];
          setTarget({ mac: online.mac, name: online.name });
        }
      } catch {}
    }
    loadBulbs();
    const timer = setInterval(loadBulbs, 15000);
    return () => { cancelled = true; clearInterval(timer); };
  }, []);

  // Resolve current target's pilot from /status
  const currentPilot = (() => {
    if (!state?.wiz?.bulbs) return null;
    if ("mac" in target) {
      return state.wiz.bulbs.find((b: any) => b.mac === target.mac) || null;
    }
    return state.wiz.bulbs.find((b: any) => b.online) || state.wiz.bulbs[0] || null;
  })();

  // Debounce ref to prevent stale /status responses from overwriting optimistic state
  const fetchSeq = { current: 0 };

  async function refresh() {
    const seq = ++fetchSeq.current;
    try {
      // /status times out when AC adapter is offline — use AbortController
      const ac = new AbortController();
      const t = setTimeout(() => ac.abort(), 4000);
      const res = await fetch(hubUrl("status"), { signal: ac.signal });
      clearTimeout(t);
      if (seq !== fetchSeq.current) return; // stale response
      const data = await res.json();
      setState(data as HubState);
      setError(null);
    } catch (e) {
      if (seq !== fetchSeq.current) return;
      setError("Hub Offline");
    } finally {
      if (seq === fetchSeq.current) setIsLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // 2s polling is snappier without being wasteful; 5s felt laggy
    const timer = setInterval(refresh, 2000);
    return () => clearInterval(timer);
  }, []);

  async function runAction(name: string, endpoint: string) {
    const toast = await showToast({ style: Toast.Style.Animated, title: `Pulsing: ${name}...` });
    try {
      // Map legacy GET endpoints to the new /control/wiz/control POST endpoint
      // so the action targets the selected bulb (registry path).
      const mac = "mac" in target ? target.mac : null;
      const useNewApi = mac !== null;
      let url: string;
      const params: Record<string, any> = {};
      if (useNewApi) {
        params.mac = mac;
        if (endpoint === "/control/bulb/on" || endpoint === "/control/bulb_on") params.state = true;
        else if (endpoint === "/control/bulb/off" || endpoint === "/control/bulb_off") params.state = false;
        else if (endpoint === "/control/bulb_tv") { params.sceneId = 18; params.dimming = 10; params.state = true; }
        else if (endpoint.startsWith("/control/brightness?dir=up")) params.dimming = Math.min(100, (optimistic.dimming || 50) + 20);
        else if (endpoint.startsWith("/control/brightness?dir=down")) params.dimming = Math.max(10, (optimistic.dimming || 50) - 20);
        else if (endpoint.startsWith("/control/bulb/color")) {
          const u = new URL("http://x" + endpoint);
          if (u.searchParams.has("r")) {
            params.r = parseInt(u.searchParams.get("r") || "0", 10);
            params.g = parseInt(u.searchParams.get("g") || "0", 10);
            params.b = parseInt(u.searchParams.get("b") || "0", 10);
            params.state = true;
          } else {
            params.temp = parseInt(u.searchParams.get("temp") || "4500", 10);
            params.state = true;
          }
        } else {
          // Unknown endpoint — fall back to legacy
          url = hubUrl(endpoint.startsWith("/") ? endpoint.slice(1) : endpoint);
        }
        if (!url) {
          const res = await fetch(hubUrl("control/wiz/control"), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(params),
          });
          if (!res.ok) throw new Error("Failed");
        } else {
          const res = await fetch(url);
          if (!res.ok) throw new Error("Failed");
        }
      } else {
        // No registry — use legacy GET endpoint
        const res = await fetch(hubUrl(endpoint.startsWith("/") ? endpoint.slice(1) : endpoint));
        if (!res.ok) throw new Error("Failed");
      }
      toast.style = Toast.Style.Success;
      toast.title = `Confirmed: ${name}`;
      // Don't wait for /status — apply optimistic updates immediately
      applyOptimisticFromEndpoint(endpoint);
      // Then trigger a background refresh; we don't await so the UI is instant
      setTimeout(refresh, 200);
    } catch (e) {
      toast.style = Toast.Style.Failure;
      toast.title = "Action Failed";
      toast.message = "Hub Offline";
    }
  }

  /**
   * Map an outgoing endpoint to an optimistic state update. This makes the
   * UI feel instant even though the hub's /status doesn't return the WiZ pilot.
   */
  function applyOptimisticFromEndpoint(endpoint: string) {
    if (endpoint === "/control/bulb/on" || endpoint === "/control/bulb_on") {
      // We don't have a "powered" state in optimistic, but we mark brightness as active
      return;
    }
    if (endpoint === "/control/bulb/off" || endpoint === "/control/bulb_off") {
      setOptimistic((o) => ({ ...o, dimming: 0, sceneKey: undefined, r: undefined, g: undefined, b: undefined, temp: undefined }));
      return;
    }
    if (endpoint === "/control/bulb_tv") {
      setOptimistic((o) => ({ ...o, dimming: 10, sceneKey: "tv" }));
      return;
    }
    if (endpoint.startsWith("/control/brightness?dir=up")) {
      setOptimistic((o) => ({ ...o, dimming: Math.min(100, (o.dimming || 50) + 20) }));
      return;
    }
    if (endpoint.startsWith("/control/brightness?dir=down")) {
      setOptimistic((o) => ({ ...o, dimming: Math.max(10, (o.dimming || 50) - 20) }));
      return;
    }
    if (endpoint.startsWith("/control/bulb/color")) {
      const url = new URL("http://x" + endpoint);
      if (url.searchParams.has("r")) {
        setOptimistic((o) => ({
          ...o,
          r: parseInt(url.searchParams.get("r") || "0", 10),
          g: parseInt(url.searchParams.get("g") || "0", 10),
          b: parseInt(url.searchParams.get("b") || "0", 10),
          temp: undefined,
          sceneKey: undefined,
        }));
      } else if (url.searchParams.has("temp")) {
        setOptimistic((o) => ({ ...o, temp: parseInt(url.searchParams.get("temp") || "4500", 10), r: undefined, g: undefined, b: undefined, sceneKey: undefined }));
      }
      return;
    }
    if (endpoint.startsWith("/scene/")) {
      const key = endpoint.replace("/scene/", "");
      setOptimistic((o) => ({ ...o, sceneKey: key, dimming: o.dimming || 70 }));
      return;
    }
  }

  /**
   * Set brightness to a target % by stepping the existing ±20% endpoint.
   * Loops at most 5 times to avoid infinite recursion. Clamps to [10, 100].
   */
  async function setBrightnessTo(target: number) {
    const clamped = Math.max(10, Math.min(100, target));
    const current = optimistic.dimming || 50;
    const diff = clamped - current;
    const steps = Math.min(5, Math.max(1, Math.ceil(Math.abs(diff) / 20)));
    const dir = diff > 0 ? "up" : "down";
    const toast = await showToast({
      style: Toast.Style.Animated,
      title: `Pulsing: Brightness → ${clamped}%`,
    });
    try {
      for (let i = 0; i < steps; i++) {
        await fetch(hubUrl(`control/brightness?dir=${dir}`));
      }
      // Optimistic immediate update
      setOptimistic((o) => ({ ...o, dimming: clamped }));
      toast.style = Toast.Style.Success;
      toast.title = `Confirmed: Brightness ${clamped}%`;
      setTimeout(refresh, 200);
    } catch (e) {
      toast.style = Toast.Style.Failure;
      toast.title = "Action Failed";
      toast.message = "Hub Offline";
    }
  }

  // Read power state from the server-tracked stats (this is real, not optimistic)
  // The bot's updateDeviceState('light', 'on'|'off') is called on every action
  const serverPowerState = (state?.stats?.light?.status || "off").toLowerCase();
  const isOn = serverPowerState === "on" || optimistic.dimming > 0;

  // Brightness, scene, color all come from optimistic local state
  const brightness = optimistic.dimming;
  const scene = optimistic.sceneKey
    ? WIZ_SCENES.find((s) => s.key === optimistic.sceneKey)
    : undefined;
  const isColorMode = optimistic.r !== undefined && optimistic.g !== undefined && optimistic.b !== undefined;
  const rgb = isColorMode ? `RGB(${optimistic.r}, ${optimistic.g}, ${optimistic.b})` : undefined;

  const getPowerColor = () => (isOn ? Color.Green : Color.Red);
  const getPowerStr = () => (isOn ? "ON" : "OFF");

  const getModeStr = () => {
    if (scene) return `Scene: ${scene.name}`;
    if (optimistic.temp) return `White (${optimistic.temp}K)`;
    if (isColorMode) return "Color";
    if (isOn) return "Default White";
    return "Standby";
  };

  // Light minutes: prefer the live-updating `light_duration` string from the server,
  // fallback to lightMinutes calculation
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

  const dynamicScenes = WIZ_SCENES.filter((s) => s.category === 'dynamic');
  const staticScenes = WIZ_SCENES.filter((s) => s.category === 'static');
  const miscScenes = WIZ_SCENES.filter((s) => s.category === 'misc');

  const sceneSection = {
    section: "Built-in WiZ Scenes",
    items: [
      ...staticScenes.map((s) => ({
        id: `scene-${s.key}`,
        title: `◻️ ${s.name}`,
        subtitle: s.description,
        icon: s.icon,
        endpoint: `/scene/${s.key}`,
        name: `Scene: ${s.name}`,
      })),
      ...dynamicScenes.map((s) => ({
        id: `scene-${s.key}`,
        title: `🔁 ${s.name}`,
        subtitle: `${s.description} (speed adjustable)`,
        icon: s.icon,
        endpoint: `/scene/${s.key}`,
        name: `Scene: ${s.name}`,
      })),
      ...miscScenes.map((s) => ({
        id: `scene-${s.key}`,
        title: `✦ ${s.name}`,
        subtitle: s.description,
        icon: s.icon,
        endpoint: `/scene/${s.key}`,
        name: `Scene: ${s.name}`,
      })),
    ],
  };

  const presetSection = {
    section: "Lifestyle Presets",
    items: [
      { id: "tv",    title: "TV Mode (Dim Bias Light + AC Cool)",  icon: Icon.Video, endpoint: "/scene/tv",      name: "TV Mode" },
      { id: "focus", title: "Focus Mode (Daylight White)",          icon: Icon.Eye,   endpoint: "/scene/focus",   name: "Focus Mode" },
      { id: "wake",  title: "Wake Up (Sunrise Warm-Up)",            icon: Icon.Sun,   endpoint: "/scene/sunrise", name: "Wake Up" },
      { id: "sleep", title: "Bedtime (Fade to Dark)",               icon: Icon.Moon,  endpoint: "/scene/bedtime", name: "Bedtime" },
      { id: "aura",  title: "Toggle Media Aura Sync",               icon: Icon.Star,  endpoint: "/control/aura/toggle", name: "Aura Toggle" },
      { id: "autolight", title: "Toggle Auto-Pilot Lights",        icon: Icon.RotateClockwise, endpoint: "/control/auto/light", name: "Auto-Light Toggle" },
      { id: "bulb-timer", title: "Set Custom Bulb Off-Timer (Form)…", icon: Icon.Hourglass, endpoint: "__form__:bulbTimer", name: "Custom Bulb Timer" },
      { id: "statuscard", title: "Generate Status Card (PNG)",     icon: Icon.Image, endpoint: "/card",          name: "Status Card" },
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
                ? `ON · ${brightness}%${scene ? ` · ${scene.name}` : optimistic.temp ? ` · ${optimistic.temp}K` : ""}`
                : "Off"
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
              {registryBulbs.length > 1 ? (
                <ActionPanel.Submenu
                  title={`Switch Bulb (${registryBulbs.length} known)`}
                  icon={Icon.Switch}
                >
                  {registryBulbs.map((b) => {
                    const isCurrent = "mac" in target && b.mac === target.mac;
                    return (
                      <Action
                        key={b.mac}
                        title={`${isCurrent ? "✓ " : ""}${b.name}${b.online ? "" : " (offline)"}`}
                        icon={b.online ? Icon.LightBulb : Icon.Circle}
                        onAction={() => setTarget({ mac: b.mac, name: b.name })}
                      />
                    );
                  })}
                </ActionPanel.Submenu>
              ) : null}
            </ActionPanel>
          }
          detail={
            <List.Item.Detail
              metadata={
                <List.Item.Detail.Metadata>
                  <List.Item.Detail.Metadata.TagList title="Device Status">
                    {error ? (
                      <List.Item.Detail.Metadata.TagList.Item text={error.toUpperCase()} color={Color.Red} />
                    ) : (
                      <List.Item.Detail.Metadata.TagList.Item
                        text="ONLINE"
                        color={Color.Green}
                      />
                    )}
                  </List.Item.Detail.Metadata.TagList>
                  <List.Item.Detail.Metadata.TagList title="Power">
                    <List.Item.Detail.Metadata.TagList.Item text={getPowerStr()} color={getPowerColor()} />
                  </List.Item.Detail.Metadata.TagList>
                  <List.Item.Detail.Metadata.Separator />
                  <List.Item.Detail.Metadata.Label title="Brightness" text={`${brightness}%`} icon={brightness > 0 ? Icon.LightBulb : Icon.Circle} />
                  <List.Item.Detail.Metadata.Label title="Mode" text={getModeStr()} icon={scene ? scene.icon : Icon.Sun} />
                  <List.Item.Detail.Metadata.Label
                    title="Running For"
                    text={isOn ? (state?.light_duration || "Just now") : "Off"}
                    icon={Icon.Clock}
                  />
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
                  {item.endpoint === "__form__:bulbTimer" ? (
                    <Action.Push
                      title="Open Custom Bulb Timer Form"
                      icon={Icon.Pencil}
                      shortcut={{ modifiers: [], key: "return" }}
                      target={<CustomBulbTimerForm onDone={refresh} />}
                    />
                  ) : (
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
                  )}
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
                        ) : (
                          <List.Item.Detail.Metadata.TagList.Item
                            text="ONLINE"
                            color={Color.Green}
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
                        title="Running For"
                        text={isOn ? (state?.light_duration || "Just now") : "Off"}
                        icon={Icon.Clock}
                      />
                      <List.Item.Detail.Metadata.Label
                        title="Light Today"
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
                      <List.Item.Detail.Metadata.Label
                        title="Server Status"
                        text={state?.stats?.light?.status?.toUpperCase() || "UNKNOWN"}
                        icon={Icon.Clock}
                      />
                      <List.Item.Detail.Metadata.Label
                        title="Last Changed"
                        text={state?.stats?.light?.lastChanged
                          ? new Date(state.stats.light.lastChanged).toLocaleString()
                          : "--"}
                        icon={Icon.Clock}
                      />
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

/**
 * Custom off-timer for the WiZ bulb. Uses the server's new
 * /control/bulb/timer endpoint (added 2026-07-11).
 */
function CustomBulbTimerForm({ onDone }: { onDone: () => void }) {
  const { pop } = useNavigation();
  const [minutes, setMinutes] = useState("45");
  const [atTime, setAtTime] = useState("");

  async function handleSubmit() {
    let endpoint = "";
    let summary = "";
    const m = parseInt(minutes, 10);
    if (minutes.trim() && isFinite(m) && m > 0 && m <= 1440) {
      endpoint = `/control/bulb/timer?mins=${m}`;
      summary = `in ${m} minutes`;
    } else if (atTime && /^\d{1,2}:\d{2}$/.test(atTime)) {
      endpoint = `/control/bulb/timer?at=${encodeURIComponent(atTime)}`;
      summary = `at ${atTime}`;
    } else {
      await showToast({ title: "Enter minutes (1-1440) or a time (HH:MM)", style: Toast.Style.Failure });
      return;
    }
    const toast = await showToast({ title: `Bulb will turn OFF ${summary}`, style: Toast.Style.Animated });
    try {
      const res = await fetch(hubUrl(endpoint.startsWith("/") ? endpoint.slice(1) : endpoint));
      if (!res.ok) throw new Error(await res.text());
      toast.style = Toast.Style.Success;
      toast.title = "Custom bulb timer set";
      onDone();
      pop();
    } catch (e: any) {
      toast.style = Toast.Style.Failure;
      toast.title = "Failed to set timer";
      toast.message = String(e?.message || "Hub Offline");
    }
  }

  return (
    <Form
      actions={
        <ActionPanel>
          <Action.SubmitForm title="Set Custom Bulb Timer" icon={Icon.Clock} onSubmit={handleSubmit} />
        </ActionPanel>
      }
    >
      <Form.Description text="Schedule the bulb to turn OFF automatically. Either minutes from now OR a clock time (HH:MM 24h). Max 24 hours." />
      <Form.TextField
        id="minutes"
        title="Minutes from now (1-1440)"
        placeholder="45"
        value={minutes}
        onChange={setMinutes}
        info="Examples: 5, 30, 90, 360. The bulb must currently be ON for this to be useful."
      />
      <Form.Separator />
      <Form.TextField
        id="at"
        title="Or set time of day (HH:MM)"
        placeholder="23:00"
        value={atTime}
        onChange={setAtTime}
        info="24-hour format. Will fire tomorrow if already past."
      />
      <Form.Separator />
      <Form.Description text="Tip: if both fields are set, minutes wins. The timer fires once and doesn't repeat." />
    </Form>
  );
}

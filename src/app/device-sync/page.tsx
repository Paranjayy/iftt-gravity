"use client";

import { useState, useEffect } from "react";
import {
  RefreshCw, Radio, Power, Settings, ShieldCheck, Zap,
  Thermometer, Wind, CheckCircle, XCircle, Loader, Bot,
  Lightbulb, Tv, Send, Wifi, Home, ExternalLink, Sun
} from "lucide-react";
import {
  linkMiraie, linkTelegram, linkWiz, linkHomey, linkRouter, discoverWiz,
  getDashboardData, controlMiraieAC, controlWizLight, controlHomeyDevice, triggerScene,
  linkSmartThings, controlSmartThingsDevice, syncSmartThingsDevices, loadSmartThingsLocations
} from "./actions";

// ─── Types ───────────────────────────────────────────
interface DeviceCard { id: string; name: string; brand: string; icon: any; }
interface LinkResult { success?: boolean; error?: string; devices?: any[]; deviceCount?: number; username?: string; botName?: string; ip?: string; clientCount?: number; }

const CARDS: DeviceCard[] = [
  { id: "miraie", name: "Panasonic Smart AC", brand: "MIRAIE", icon: Wind },
  { id: "smartthings", name: "Samsung SmartThings", brand: "SMARTTHINGS", icon: Tv },
  { id: "wiz",    name: "Bedroom Light",       brand: "WIZ 2.0",     icon: Lightbulb },
  { id: "telegram", name: "Automation Bot",    brand: "TELEGRAM",    icon: Bot },
  { id: "homey",  name: "Homey Hub",            brand: "HOMEY",       icon: Home },
  { id: "router", name: "JioFiber Router",     brand: "JIO",         icon: Radio },
];

// ─── Main Component ───────────────────────────────────
export default function DeviceSyncPage() {
  const [syncing, setSyncing] = useState(false);
  const [selected, setSelected] = useState<DeviceCard | null>(null);
  const [config, setConfig] = useState<any>({});
  const [result, setResult] = useState<LinkResult | null>(null);
  const [loading, setLoading] = useState(false);

  // MirAie state
  const [mobile, setMobile] = useState("");
  const [password, setPassword] = useState("");
  const [acPower, setAcPower] = useState<Record<string, boolean>>({});
  const [acTemp, setAcTemp] = useState<Record<string, number>>({});

  // Telegram state
  const [tgToken, setTgToken] = useState("");
  const [tgChatId, setTgChatId] = useState("");

  // SmartThings state
  const [stToken, setStToken] = useState("");
  const [stLocationId, setStLocationId] = useState("");
  const [stDeviceId, setStDeviceId] = useState("");
  const [stLocations, setStLocations] = useState<any[]>([]);
  const [stRawCapability, setStRawCapability] = useState("switch");
  const [stRawCommand, setStRawCommand] = useState("on");
  const [stRawArgs, setStRawArgs] = useState("[]");

  // WiZ state
  const [wizIp, setWizIp] = useState("");
  const [wizName, setWizName] = useState("");
  const [wizDim, setWizDim] = useState(100);
  const [wizTemp, setWizTemp] = useState(2700);

  // Homey state
  const [homeyToken, setHomeyToken] = useState("");
  const [homeyId, setHomeyId] = useState("");

  // Router state
  const [routerPass, setRouterPass] = useState("");
  const [wizMac, setWizMac] = useState("");

  useEffect(() => {
    getDashboardData().then(setConfig);
  }, []);

  async function handleDeepSync() {
    setSyncing(true);
    const c = await getDashboardData();
    setConfig(c);
    setSyncing(false);
  }

  function getStatus(id: string): "linked" | "online" | "offline" {
    const c = config[id];
    if (!c) return "offline";
    if (id === "miraie") return c.devices?.length ? "linked" : "offline";
    if (id === "smartthings") return c.devices?.length ? "linked" : "offline";
    if (id === "telegram") return c.username ? "online" : "offline";
    if (id === "wiz") return c.ip ? "linked" : "offline";
    if (id === "homey") return c.deviceCount > 0 ? "linked" : "offline";
    if (id === "router") return c.adminPass ? "online" : "offline";
    return "offline";
  }

  async function handleLink() {
    setLoading(true);
    setResult(null);
    let res: LinkResult = { success: false };

    if (selected?.id === "miraie") res = await linkMiraie(mobile, password);
    else if (selected?.id === "smartthings") res = await linkSmartThings(stToken, stLocationId);
    else if (selected?.id === "telegram") res = await linkTelegram(tgToken, tgChatId);
    else if (selected?.id === "wiz") res = await linkWiz(wizIp, wizName, wizMac);
    else if (selected?.id === "homey") res = await linkHomey(homeyToken, homeyId);
    else if (selected?.id === "router") res = await linkRouter(routerPass);

    setResult(res);
    if (res.success) {
      const c = await getDashboardData();
      setConfig(c);
    }
    setLoading(false);
  }

  async function handleLoadSmartThingsLocations() {
    setLoading(true);
    setResult(null);
    const res = await loadSmartThingsLocations();
    if (res.success) {
      setStLocations(res.locations || []);
      setResult({ success: true, deviceCount: res.locations?.length || 0 });
      if (res.locations?.length && !stLocationId) {
        setStLocationId(res.locations[0].id);
      }
    } else {
      setResult({ success: false, error: res.error });
    }
    setLoading(false);
  }

  async function handleRawSmartThingsCommand() {
    if (!stDeviceId) return;
    setLoading(true);
    setResult(null);
    try {
      const args = stRawArgs.trim()
        ? JSON.parse(stRawArgs)
        : [];
      const normalizedArgs = Array.isArray(args) ? args : [args];
      const res = await controlSmartThingsDevice(stDeviceId, stRawCapability.trim(), stRawCommand.trim(), normalizedArgs);
      setResult(res);
      if (res.success) {
        const c = await getDashboardData();
        setConfig(c);
      }
    } catch (error: any) {
      setResult({ success: false, error: error.message || "Invalid SmartThings JSON args" });
    } finally {
      setLoading(false);
    }
  }

  async function handleTogglePower(deviceId: string) {
    const next = !acPower[deviceId];
    setAcPower(p => ({ ...p, [deviceId]: next }));
    await controlMiraieAC(deviceId, { power: next });
  }

  async function handleSetTemp(deviceId: string, temp: number) {
    setAcPower(p => ({ ...p, [deviceId]: true }));
    setAcTemp(p => ({ ...p, [deviceId]: temp }));
    await controlMiraieAC(deviceId, { temperature: temp, power: true });
  }

  async function handleMode(deviceId: string, mode: any) {
    setAcPower(p => ({ ...p, [deviceId]: true }));
    await controlMiraieAC(deviceId, { mode, power: true });
  }

  async function handleWizControl(params: any) {
    await controlWizLight(params);
  }

  async function handleHomeyControl(deviceId: string, capability: string, value: any) {
    await controlHomeyDevice(deviceId, capability, value);
    handleDeepSync(); // refresh status
  }

  function getSmartThingsActions(device: any) {
    const caps = new Set((device.capabilities || []).map((cap: string) => String(cap).toLowerCase()));
    const actions: Array<{ title: string; capability: string; command: string; args?: any[] }> = [];

    if (caps.has("switch")) {
      actions.push({ title: "On", capability: "switch", command: "on" });
      actions.push({ title: "Off", capability: "switch", command: "off" });
    }
    if (caps.has("switchlevel")) {
      actions.push({ title: "25%", capability: "switchLevel", command: "setLevel", args: [25] });
      actions.push({ title: "50%", capability: "switchLevel", command: "setLevel", args: [50] });
      actions.push({ title: "100%", capability: "switchLevel", command: "setLevel", args: [100] });
    }
    if (caps.has("colortemperature")) {
      actions.push({ title: "Warm", capability: "colorTemperature", command: "setColorTemperature", args: [2700] });
      actions.push({ title: "Daylight", capability: "colorTemperature", command: "setColorTemperature", args: [5000] });
    }
    if (caps.has("audiomute")) {
      actions.push({ title: "Mute", capability: "audioMute", command: "mute" });
      actions.push({ title: "Unmute", capability: "audioMute", command: "unmute" });
    }
    if (caps.has("mediaplayback")) {
      actions.push({ title: "Play", capability: "mediaPlayback", command: "play" });
      actions.push({ title: "Pause", capability: "mediaPlayback", command: "pause" });
    }

    if (!actions.length) {
      actions.push({ title: "On", capability: "switch", command: "on" });
    }

    return actions;
  }

  const linkedACs: any[] = config.miraie?.devices ?? [];
  const smartThingsDevices: any[] = config.smartthings?.devices ?? [];
  const wizBulb = config.wiz;
  const homeyDevices: any[] = config.homey?.devices ?? [];

  return (
    <div className="flex h-full overflow-hidden">
      {/* ── Main ── */}
      <div className="flex-1 overflow-y-auto p-8 space-y-8">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-black text-white tracking-tight">Device Sync</h1>
            <p className="text-white/40 text-sm mt-1">Connect and control your hardware from Gravity.</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => { triggerScene("TV"); }}
              className="px-5 py-2.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 font-bold text-xs flex items-center gap-2 hover:bg-amber-500/20 transition-all hover:scale-105 active:scale-95"
            >
              <Tv className="w-4 h-4" />
              TV Time
            </button>
            <button
              onClick={() => { triggerScene("END_TV"); }}
              className="px-5 py-2.5 rounded-2xl bg-white/5 border border-white/10 text-white/50 font-bold text-xs flex items-center gap-2 hover:bg-white/10 transition-all active:scale-95"
            >
              <CheckCircle className="w-4 h-4" />
              End TV
            </button>
            <button
              onClick={handleDeepSync}
              className="px-5 py-2.5 rounded-2xl bg-white/5 border border-white/10 text-white/60 font-bold text-xs flex items-center gap-2 hover:bg-white/10 transition-all active:scale-95"
            >
              <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
              Deep Sync
            </button>
          </div>
        </div>

        {/* Live AC Controls */}
        {linkedACs.length > 0 && (
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-emerald-500 mb-4 flex items-center gap-2">
              <CheckCircle className="w-3.5 h-3.5" />
              {linkedACs.length} AC device{linkedACs.length > 1 ? "s" : ""} live
            </p>
            <div className="grid gap-4 md:grid-cols-2">
              {linkedACs.map((d: any) => (
                <div key={d.id} className={`rounded-2xl border p-6 space-y-5 transition-all ${acPower[d.id] ? "bg-indigo-950/40 border-indigo-500/30" : "bg-[#0f0f1a] border-white/5"}`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-bold text-white">{d.name}</h3>
                      <p className="text-[10px] uppercase tracking-widest text-emerald-400 font-bold mt-0.5">LIVE · PANASONIC MIRAIE</p>
                    </div>
                    <button
                      onClick={() => handleTogglePower(d.id)}
                      className={`p-2.5 rounded-xl transition-all ${acPower[d.id] ? "bg-indigo-500 text-white shadow-[0_0_16px_rgba(99,102,241,0.4)]" : "bg-white/5 text-white/40 hover:bg-white/10"}`}
                    >
                      <Power className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-xs font-bold uppercase text-white/40">
                      <span className="flex items-center gap-1"><Thermometer className="w-3 h-3" /> Temp</span>
                      <span className="text-white">{acTemp[d.id] ?? 24}°C</span>
                    </div>
                    <input type="range" min={16} max={30} value={acTemp[d.id] ?? 24}
                      onChange={e => handleSetTemp(d.id, +e.target.value)}
                      className="w-full accent-indigo-500 cursor-pointer" />
                    <div className="flex justify-between text-[10px] text-white/20"><span>16°C</span><span>30°C</span></div>
                  </div>

                  <div className="flex gap-2">
                    {(["COOL", "DRY", "FAN", "AUTO"] as const).map(m => (
                      <button key={m}
                        onClick={() => handleMode(d.id, m)}
                        className="flex-1 py-1.5 text-[10px] font-black uppercase rounded-lg bg-white/5 hover:bg-white/10 text-white/50 hover:text-white transition border border-white/5"
                      >{m}</button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Live SmartThings Devices */}
        {smartThingsDevices.length > 0 && (
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-cyan-400 mb-4 flex items-center gap-2">
              <Tv className="w-3.5 h-3.5" />
              {smartThingsDevices.length} SmartThings device{smartThingsDevices.length > 1 ? "s" : ""} linked
            </p>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {smartThingsDevices.map((d: any) => (
                <div key={d.id} className="rounded-2xl border border-white/5 bg-[#0f0f1a] p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-bold text-white text-sm">{d.name}</h3>
                      <p className="text-[10px] uppercase tracking-widest text-cyan-400/60">{d.type}</p>
                    </div>
                    <div className={`w-2.5 h-2.5 rounded-full ${d.online ? "bg-emerald-400" : "bg-white/10"}`} />
                  </div>
                  <div className="grid gap-2">
                    <button
                      onClick={() => {
                        setSelected({ id: "smartthings", name: "Samsung SmartThings", brand: "SMARTTHINGS", icon: Tv });
                        setStDeviceId(d.id);
                        setStRawCapability((d.capabilities?.[0] || "switch").toString());
                        setStRawCommand((d.capabilities || []).some((cap: string) => String(cap).toLowerCase() === "switchlevel") ? "setLevel" : "on");
                      }}
                      className="w-full py-2 text-[10px] font-black uppercase rounded-xl bg-white/5 hover:bg-white/10 text-white/60 border border-white/5"
                    >
                      Manage
                    </button>
                    <div className="grid grid-cols-2 gap-2">
                      {getSmartThingsActions(d).slice(0, 4).map(action => (
                        <button
                          key={`${d.id}-${action.capability}-${action.command}-${action.title}`}
                          onClick={() => controlSmartThingsDevice(d.id, action.capability, action.command, action.args || [])}
                          className="py-2 px-3 text-[10px] font-black uppercase rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/20"
                        >
                          {action.title}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Live WiZ Controls */}
        {wizBulb?.ip && (
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-blue-400 mb-4 flex items-center gap-2">
              <Lightbulb className="w-3.5 h-3.5" />
              WiZ Smart Light Live
            </p>
            <div className="rounded-2xl border border-white/5 bg-[#0f0f1a] p-6 max-w-md">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                    <Lightbulb className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-sm">{wizBulb.name || "Bedroom Light"}</h3>
                    <p className="text-[10px] uppercase font-black tracking-widest text-blue-400/60">{wizBulb.ip}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => { handleWizControl({ state: true }); }} className="p-2.5 rounded-xl bg-blue-500 text-white shadow-[0_0_16px_rgba(59,130,246,0.4)] transition">ON</button>
                  <button onClick={() => { handleWizControl({ state: false }); }} className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/40 transition">OFF</button>
                </div>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-[10px] font-black uppercase text-white/40">
                    <span className="flex items-center gap-1.5"><Sun className="w-3 h-3" /> Brightness</span>
                    <span className="text-white">{wizDim}%</span>
                  </div>
                  <input type="range" min={10} max={100} value={wizDim}
                    onChange={e => {
                      const val = +e.target.value;
                      setWizDim(val);
                      handleWizControl({ state: true, dimming: val });
                    }}
                    className="w-full accent-blue-500 cursor-pointer" />
                </div>

                <div className="grid grid-cols-4 gap-2">
                  {[
                    { label: "Warm", temp: 2700, color: "bg-orange-500/20 text-orange-300" },
                    { label: "Daylight", temp: 4500, color: "bg-amber-500/10 text-amber-200" },
                    { label: "Cool", temp: 6500, color: "bg-blue-500/20 text-blue-300" },
                    { label: "White", temp: 5000, color: "bg-white/10 text-white" },
                  ].map(p => (
                    <button key={p.label} 
                      onClick={() => {
                        setWizTemp(p.temp);
                        handleWizControl({ state: true, temp: p.temp });
                      }}
                      className={`py-2.5 rounded-xl text-[10px] font-black uppercase transition-all hover:scale-105 active:scale-95 ${p.color}`}
                    >{p.label}</button>
                  ))}
                </div>

                <div className="grid grid-cols-4 gap-2">
                  {[
                    { label: "Red", r: 255, g: 0, b: 0, color: "bg-red-500/20 text-red-300" },
                    { label: "Blue", r: 0, g: 0, b: 255, color: "bg-indigo-500/20 text-indigo-300" },
                    { label: "Green", r: 0, g: 255, b: 0, color: "bg-emerald-500/20 text-emerald-300" },
                    { label: "Pink", r: 255, g: 20, b: 147, color: "bg-pink-500/20 text-pink-300" },
                  ].map(p => (
                    <button key={p.label} 
                      onClick={() => handleWizControl({ state: true, r: p.r, g: p.g, b: p.b })}
                      className={`py-2.5 rounded-xl text-[10px] font-black uppercase transition-all hover:scale-105 active:scale-95 ${p.color}`}
                    >{p.label}</button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Live Homey Hub Devices */}
        {homeyDevices.length > 0 && (
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-indigo-400 mb-4 flex items-center gap-2">
              <Home className="w-3.5 h-3.5" />
              {homeyDevices.length} Homey Hub Devices
            </p>
            <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
              {homeyDevices.map((d: any) => (
                <div key={d.id} className="rounded-xl border border-white/5 bg-[#0f0f1a] p-4 group hover:border-white/10 transition-colors">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[9px] font-black uppercase tracking-tighter text-white/20">{d.class}</span>
                    <div className={`w-1.5 h-1.5 rounded-full ${d.available ? "bg-emerald-500" : "bg-white/10"}`} />
                  </div>
                  <h4 className="font-bold text-white text-xs truncate mb-4">{d.name}</h4>
                  <div className="flex gap-1.5">
                    <button onClick={() => handleHomeyControl(d.id, 'onoff', true)} className="flex-1 py-1 text-[9px] font-black uppercase bg-white/5 hover:bg-emerald-500/20 hover:text-emerald-400 rounded transition border border-white/5">On</button>
                    <button onClick={() => handleHomeyControl(d.id, 'onoff', false)} className="flex-1 py-1 text-[9px] font-black uppercase bg-white/5 hover:bg-red-500/20 hover:text-red-400 rounded transition border border-white/5">Off</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Device cards grid */}
        <div className="grid gap-4 md:grid-cols-2">
          {CARDS.map(device => {
            const status = getStatus(device.id);
            const Icon = device.icon;
            return (
              <div key={device.id} className="group rounded-2xl border border-white/8 bg-[#0f0f1a] p-6 hover:border-white/15 transition-all">
                <div className="flex items-start justify-between mb-5">
                  <div className="w-11 h-11 rounded-xl bg-white/5 border border-white/5 flex items-center justify-center text-white/40 group-hover:text-white/70 transition-colors">
                    <Icon className="w-5 h-5" />
                  </div>
                  <span className={`text-[10px] font-black uppercase px-2 py-1 rounded-full ${
                    status === "linked" ? "bg-emerald-500/10 text-emerald-400" :
                    status === "online" ? "bg-blue-500/10 text-blue-400" :
                    "bg-white/5 text-white/25"
                  }`}>{status}</span>
                </div>
                <h3 className="font-bold text-white mb-0.5">{device.name}</h3>
                <p className="text-[10px] uppercase tracking-widest text-white/25 mb-5">{device.brand}</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => { setSelected(device); setResult(null); }}
                    className="flex-1 rounded-xl bg-white/5 py-2 text-xs font-bold text-white hover:bg-white/10 border border-white/5 transition"
                  >{status === "offline" ? "Configure" : "Manage"}</button>
                  <button
                    onClick={() => { setSelected(device); setResult(null); }}
                    className="rounded-xl bg-white/5 p-2 text-white/50 hover:bg-white/10 hover:text-white border border-white/5 transition"
                  ><Settings className="h-4 w-4" /></button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Config Drawer ── */}
      {selected && (
        <div className="w-96 border-l border-white/8 bg-[#090910] p-8 flex flex-col overflow-y-auto shrink-0">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-lg font-black text-white tracking-tight">{selected.name}</h2>
            <button onClick={() => { setSelected(null); setResult(null); }} className="text-white/30 hover:text-white text-lg">✕</button>
          </div>

          {/* ── MirAie ── */}
          {selected.id === "miraie" && (
            <div className="space-y-5 flex-1">
              <p className="text-xs text-white/40 leading-relaxed">
                Same credentials as the <strong className="text-white">Panasonic MirAie app</strong>. Use your registered mobile number.
              </p>
              <Field label="Mobile Number" type="tel" placeholder="1234567890" value={mobile} onChange={setMobile} />
              <Field label="Password" type="password" placeholder="••••••••" value={password} onChange={setPassword} />
              {result && <ResultBanner result={result} successMsg={`Linked! Found ${result.deviceCount} device(s).`} />}
              <LinkButton onClick={handleLink} loading={loading} disabled={!mobile || !password} label="Link MirAie Account" />
              {config.miraie?.linkedAt && (
                <p className="text-[10px] text-white/25">Last linked: {new Date(config.miraie.linkedAt).toLocaleString()}</p>
              )}
            </div>
          )}

          {/* ── Telegram ── */}
          {selected.id === "telegram" && (
            <div className="space-y-5 flex-1">
              <div className="rounded-xl bg-white/3 border border-white/8 p-4 text-xs text-white/50 space-y-2">
                <p>1. Open <strong className="text-white">@BotFather</strong> on Telegram</p>
                <p>2. Send <code className="bg-white/10 px-1 rounded">/newbot</code> and follow steps</p>
                <p>3. Copy the bot token and paste below</p>
                <p>4. For Chat ID: message <strong className="text-white">@userinfobot</strong></p>
              </div>
              <Field label="Bot Token" type="password" placeholder="110201543:AAHdqTcvCH..." value={tgToken} onChange={setTgToken} />
              <Field label="Your Chat ID" type="text" placeholder="123456789" value={tgChatId} onChange={setTgChatId} hint="Optional — needed to receive alerts" />
              {result && <ResultBanner result={result} successMsg={`Bot @${result.username} linked! Check Telegram — we sent a test message.`} />}
              <LinkButton onClick={handleLink} loading={loading} disabled={!tgToken} label="Link Telegram Bot" />
              {config.telegram?.username && (
                <p className="text-[10px] text-white/25">Bot: @{config.telegram.username}</p>
              )}
            </div>
          )}

          {/* ── WiZ ── */}
          {selected.id === "wiz" && (
            <div className="space-y-5 flex-1">
              <div className="rounded-xl bg-white/3 border border-white/8 p-4 text-xs text-white/50 space-y-2">
                <p>WiZ uses <strong className="text-white">local UDP</strong> — no cloud needed.</p>
                <p>Find the bulb IP or click scan. Add MAC address to enable <strong className="text-white">Router Sync</strong>.</p>
              </div>
              <Field label="Bulb IP Address" type="text" placeholder="192.168.1.105" value={wizIp} onChange={setWizIp} />
              <button 
                onClick={async () => {
                  setLoading(true);
                  const res = await discoverWiz();
                  if (res.success && res.devices?.length) {
                    setWizIp(res.devices[0].ip);
                    setWizMac(res.devices[0].id);
                  }
                  setLoading(false);
                }}
                className="text-[10px] font-black uppercase text-indigo-400 hover:text-indigo-300 transition-colors flex items-center gap-1.5"
              >
                <Wifi className="w-3 h-3" />
                Scan for Bulbs on LAN
              </button>
              <Field label="Bulb MAC Address" type="text" placeholder="D8:A0:11:..." value={wizMac} onChange={setWizMac} hint="Used for Router-based auto-reconnect" />
              <Field label="Friendly Name" type="text" placeholder="Bedroom Light" value={wizName} onChange={setWizName} hint="Optional" />
              {result && <ResultBanner result={result} successMsg={`WiZ bulb saved at ${result.ip}. Commands fire on your LAN.`} />}
              <LinkButton onClick={handleLink} loading={loading} disabled={!wizIp} label="Save WiZ Bulb" />
            </div>
          )}

          {/* ── Jio Router ── */}
          {selected.id === "router" && (
            <div className="space-y-5 flex-1">
              <div className="rounded-xl bg-white/3 border border-white/8 p-4 text-xs text-white/50 space-y-2">
                <p>Gravity logs in to your <strong className="text-white">Jio Router (192.168.29.1)</strong> locally to find device IPs.</p>
                <p>This fixes the "wrong IP" issue when your router restarts! 🔌</p>
              </div>
              <Field label="Router Admin Password" type="password" placeholder="••••••••" value={routerPass} onChange={setRouterPass} />
              {result && <ResultBanner result={result} successMsg={`Synced! Found ${result.clientCount} network clients.`} />}
              <LinkButton onClick={handleLink} loading={loading} disabled={!routerPass} label="Link Router Sync" />
            </div>
          )}

          {/* ── SmartThings ── */}
          {selected.id === "smartthings" && (
            <div className="space-y-5 flex-1">
              <div className="rounded-xl bg-white/3 border border-white/8 p-4 text-xs text-white/50 space-y-2">
                <p>Link your Samsung SmartThings account to pull in TVs, monitors, switches, and lights.</p>
                <p>We normalize the device list so Raycast and the dashboard can use the same controls.</p>
              </div>
              <Field label="SmartThings Personal Token" type="password" placeholder="pat-..." value={stToken} onChange={setStToken} />
              <Field label="SmartThings Location ID" type="text" placeholder="UUID from SmartThings" value={stLocationId} onChange={setStLocationId} hint="Optional for Gravity, required by the official Raycast connector." />
              <button
                onClick={handleLoadSmartThingsLocations}
                className="text-[10px] font-black uppercase text-cyan-400 hover:text-cyan-300 transition-colors flex items-center gap-1.5"
              >
                <ShieldCheck className="w-3 h-3" />
                Load Locations from PAT
              </button>
              {result && <ResultBanner result={result} successMsg={`SmartThings linked! Found ${result.deviceCount} device(s).`} />}
              <div className="flex gap-2">
                <LinkButton onClick={handleLink} loading={loading} disabled={!stToken} label="Link SmartThings" />
                <button
                  onClick={async () => {
                    setLoading(true);
                    setResult(null);
                    const res = await syncSmartThingsDevices();
                    setResult(res);
                    if (res.success) {
                      const c = await getDashboardData();
                      setConfig(c);
                    }
                    setLoading(false);
                  }}
                  className="px-4 rounded-xl bg-white/5 hover:bg-white/10 text-white/60 border border-white/5 text-xs font-bold uppercase"
                >
                  Sync
                </button>
              </div>
              {config.smartthings?.deviceCount && (
                <p className="text-[10px] text-white/25">{config.smartthings.deviceCount} SmartThings device(s) indexed</p>
              )}
              {config.smartthings?.locationId && (
                <p className="text-[10px] text-white/25">Location ID saved: {config.smartthings.locationId}</p>
              )}
              {config.smartthings?.lastSyncedAt && (
                <p className="text-[10px] text-white/25">Last sync: {new Date(config.smartthings.lastSyncedAt).toLocaleString()}</p>
              )}
              {config.smartthings?.lastError && (
                <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-[10px] text-red-200">
                  <p className="font-black uppercase tracking-widest text-red-300/80">Last SmartThings Error</p>
                  <p className="mt-1 break-words">{config.smartthings.lastError}</p>
                  {config.smartthings.lastErrorAt && (
                    <p className="mt-1 text-red-200/60">{new Date(config.smartthings.lastErrorAt).toLocaleString()}</p>
                  )}
                </div>
              )}
              {stLocations.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[10px] uppercase font-black tracking-widest text-cyan-400/70">Locations</p>
                  {stLocations.map((location: any) => (
                    <button
                      key={location.id}
                      onClick={() => setStLocationId(location.id)}
                      className={`w-full text-left rounded-xl border px-3 py-2 text-xs transition ${stLocationId === location.id ? "border-cyan-400/50 bg-cyan-500/10 text-cyan-200" : "border-white/5 bg-white/5 text-white/60 hover:bg-white/10"}`}
                    >
                      <div className="font-bold">{location.name}</div>
                      <div className="text-[10px] text-white/30 break-all">{location.id}</div>
                    </button>
                  ))}
                </div>
              )}
              {stDeviceId && (
                <p className="text-[10px] text-white/25">Selected device: {stDeviceId}</p>
              )}
              {stDeviceId && (
                <div className="space-y-3 rounded-2xl border border-white/5 bg-[#0f0f1a] p-4">
                  <div className="text-[10px] uppercase font-black tracking-widest text-cyan-400/70">Raw SmartThings Command</div>
                  <Field label="Capability" type="text" placeholder="switch / mediaPlayback / KeypadInput" value={stRawCapability} onChange={setStRawCapability} />
                  <Field label="Command" type="text" placeholder="on / setLevel / sendKey" value={stRawCommand} onChange={setStRawCommand} />
                  <Field label="Arguments JSON" type="text" placeholder='[] or [50] or ["KEY_HOME"]' value={stRawArgs} onChange={setStRawArgs} hint="Optional. Leave [] for commands without args." />
                  <button
                    onClick={handleRawSmartThingsCommand}
                    className="w-full rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-200 border border-cyan-500/20 text-xs font-black uppercase py-2.5"
                  >
                    Run Raw Command
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ── Homey ── */}
          {selected.id === "homey" && (
            <div className="space-y-5 flex-1">
              <div className="rounded-xl bg-white/3 border border-white/8 p-4 text-xs text-white/50 space-y-2">
                <p>1. Go to <strong className="text-white">tools.developer.homey.app</strong>.</p>
                <p>2. <strong className="text-emerald-400 font-bold underline">CLICK YOUR HOMEY NAME</strong> first (Don't use Account ID!).</p>
                <p>3. Copy the <strong className="text-white">Homey ID</strong> from the info page.</p>
                <p>4. Paste your <strong className="text-white">Personal Access Token</strong> (starts with pat-apps-).</p>
                <a href="https://tools.developer.homey.app" target="_blank" rel="noopener"
                  className="flex items-center gap-1 text-indigo-400 hover:text-indigo-300 transition">
                  Open Developer Tools <ExternalLink className="w-3 h-3" />
                </a>
              </div>
              <Field label="Homey ID" type="text" placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" value={homeyId} onChange={setHomeyId} />
              <Field label="Personal Access Token" type="password" placeholder="eyJ..." value={homeyToken} onChange={setHomeyToken} />
              {result && <ResultBanner result={result} successMsg={`Homey linked! Found ${result.deviceCount} device(s).`} />}
              <LinkButton onClick={handleLink} loading={loading} disabled={!homeyToken || !homeyId} label="Link Homey" />
              {config.homey?.deviceCount && (
                <p className="text-[10px] text-white/25">{config.homey.deviceCount} devices on this Homey</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Small helpers ──────────────────────────────────
function Field({ label, type, placeholder, value, onChange, hint }: {
  label: string; type: string; placeholder: string; value: string; onChange: (v: string) => void; hint?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-[10px] uppercase font-black text-white/40 tracking-widest">{label}</label>
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-indigo-500/70 focus:bg-white/8 transition placeholder-white/20"
      />
      {hint && <p className="text-[10px] text-white/25">{hint}</p>}
    </div>
  );
}

function ResultBanner({ result, successMsg }: { result: LinkResult; successMsg: string }) {
  return (
    <div className={`flex items-start gap-2.5 rounded-xl px-4 py-3 text-xs border ${
      result.success
        ? "bg-emerald-500/8 text-emerald-400 border-emerald-500/20"
        : "bg-red-500/8 text-red-400 border-red-500/20"
    }`}>
      {result.success
        ? <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" />
        : <XCircle className="w-4 h-4 shrink-0 mt-0.5" />}
      <span>{result.success ? successMsg : result.error}</span>
    </div>
  );
}

function LinkButton({ onClick, loading, disabled, label }: {
  onClick: () => void; loading: boolean; disabled: boolean; label: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={loading || disabled}
      className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold py-2.5 rounded-xl transition flex items-center justify-center gap-2 text-sm"
    >
      {loading ? <><Loader className="w-4 h-4 animate-spin" />Connecting...</> : label}
    </button>
  );
}

"use client";

import { useState, useEffect } from "react";
import {
  RefreshCw, Radio, Power, Settings, ShieldCheck, Zap,
  Thermometer, Wind, CheckCircle, XCircle, Loader, Bot,
  Lightbulb, Tv, Send, Wifi, Home, ExternalLink
} from "lucide-react";
import {
  linkMiraie, linkTelegram, linkWiz, linkHomey,
  getDashboardData, controlMiraieAC
} from "./actions";

// ─── Types ───────────────────────────────────────────
interface DeviceCard { id: string; name: string; brand: string; icon: any; }
interface LinkResult { success?: boolean; error?: string; devices?: any[]; deviceCount?: number; username?: string; botName?: string; ip?: string; }

const CARDS: DeviceCard[] = [
  { id: "miraie", name: "Panasonic Smart AC", brand: "MIRAIE", icon: Wind },
  { id: "wiz",    name: "Bedroom Light",       brand: "WIZ 2.0",     icon: Lightbulb },
  { id: "telegram", name: "Automation Bot",    brand: "TELEGRAM",    icon: Bot },
  { id: "homey",  name: "Homey Hub",            brand: "HOMEY",       icon: Home },
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

  // WiZ state
  const [wizIp, setWizIp] = useState("");
  const [wizName, setWizName] = useState("");

  // Homey state
  const [homeyToken, setHomeyToken] = useState("");
  const [homeyId, setHomeyId] = useState("");

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
    if (id === "telegram") return c.username ? "online" : "offline";
    if (id === "wiz") return c.ip ? "linked" : "offline";
    if (id === "homey") return c.deviceCount > 0 ? "linked" : "offline";
    return "offline";
  }

  async function handleLink() {
    setLoading(true);
    setResult(null);
    let res: LinkResult = { success: false };

    if (selected?.id === "miraie") res = await linkMiraie(mobile, password);
    else if (selected?.id === "telegram") res = await linkTelegram(tgToken, tgChatId);
    else if (selected?.id === "wiz") res = await linkWiz(wizIp, wizName);
    else if (selected?.id === "homey") res = await linkHomey(homeyToken, homeyId);

    setResult(res);
    if (res.success) {
      const c = await getDashboardData();
      setConfig(c);
    }
    setLoading(false);
  }

  async function handleTogglePower(deviceId: string) {
    const next = !acPower[deviceId];
    setAcPower(p => ({ ...p, [deviceId]: next }));
    await controlMiraieAC(deviceId, { power: next });
  }

  async function handleSetTemp(deviceId: string, temp: number) {
    setAcTemp(p => ({ ...p, [deviceId]: temp }));
    await controlMiraieAC(deviceId, { temperature: temp });
  }

  const linkedACs: any[] = config.miraie?.devices ?? [];

  return (
    <div className="flex h-full overflow-hidden">
      {/* ── Main ── */}
      <div className="flex-1 overflow-y-auto p-8 space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-white">Device Sync</h1>
            <p className="text-slate-500 text-sm mt-1">Connect and control your hardware from Gravity.</p>
          </div>
          <button
            onClick={handleDeepSync}
            className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-5 py-2 text-sm text-white hover:bg-white/10 transition"
          >
            <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
            Deep Sync
          </button>
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
                        onClick={() => controlMiraieAC(d.id, { mode: m })}
                        className="flex-1 py-1.5 text-[10px] font-black uppercase rounded-lg bg-white/5 hover:bg-white/10 text-white/50 hover:text-white transition"
                      >{m}</button>
                    ))}
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
                <p>Find the bulb IP in your <strong className="text-white">router's DHCP list</strong> or the WiZ app under device info.</p>
              </div>
              <Field label="Bulb IP Address" type="text" placeholder="192.168.1.105" value={wizIp} onChange={setWizIp} />
              <Field label="Friendly Name" type="text" placeholder="Bedroom Light" value={wizName} onChange={setWizName} hint="Optional" />
              {result && <ResultBanner result={result} successMsg={`WiZ bulb saved at ${result.ip}. Commands fire on your LAN.`} />}
              <LinkButton onClick={handleLink} loading={loading} disabled={!wizIp} label="Save WiZ Bulb" />
            </div>
          )}

          {/* ── Homey ── */}
          {selected.id === "homey" && (
            <div className="space-y-5 flex-1">
              <div className="rounded-xl bg-white/3 border border-white/8 p-4 text-xs text-white/50 space-y-2">
                <p>1. Go to <strong className="text-white">tools.developer.homey.app</strong></p>
                <p>2. Log in → click your Homey → copy the <strong className="text-white">Homey ID</strong></p>
                <p>3. Create a Personal Access Token under your account</p>
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

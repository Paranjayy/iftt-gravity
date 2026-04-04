"use client";

import { useState } from "react";
import { Activity, RefreshCw, Radio, Power, Settings, ShieldCheck, Zap, Thermometer, Wind, CheckCircle, XCircle, Loader } from "lucide-react";
import { linkMiraie, getDashboardData, controlMiraieAC } from "./actions";

const DEVICE_ICONS: Record<string, any> = {
  AC: Radio, Bulb: Power, TV: Activity, Bot: ShieldCheck,
};

export default function DeviceSyncPage() {
  const [syncing, setSyncing] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ success?: boolean; error?: string; devices?: any[] } | null>(null);
  const [mobile, setMobile] = useState("");
  const [password, setPassword] = useState("");
  const [linkedDevices, setLinkedDevices] = useState<any[]>([]);
  const [acPower, setAcPower] = useState<Record<string, boolean>>({});
  const [acTemp, setAcTemp] = useState<Record<string, number>>({});

  const staticCards = [
    { id: "miraie", name: "Panasonic Smart AC", brand: "MIRAIE", type: "AC" },
    { id: "wiz", name: "Bedroom Light", brand: "WIZ 2.0", type: "Bulb" },
    { id: "smartthings", name: "Samsung Smart TV", brand: "SMARTTHINGS", type: "TV" },
    { id: "telegram", name: "Automation Bot", brand: "TELEGRAM", type: "Bot" },
  ];

  async function handleDeepSync() {
    setSyncing(true);
    const config = await getDashboardData();
    if (config.miraie?.devices) setLinkedDevices(config.miraie.devices);
    setTimeout(() => setSyncing(false), 1000);
  }

  async function handleLink() {
    setLoading(true);
    setResult(null);
    const res = await linkMiraie(mobile, password);
    setResult(res);
    if (res.success && res.devices) setLinkedDevices(res.devices);
    setLoading(false);
  }

  async function handleTogglePower(deviceId: string) {
    const newState = !acPower[deviceId];
    setAcPower(prev => ({ ...prev, [deviceId]: newState }));
    await controlMiraieAC(deviceId, { power: newState });
  }

  async function handleSetTemp(deviceId: string, temp: number) {
    setAcTemp(prev => ({ ...prev, [deviceId]: temp }));
    await controlMiraieAC(deviceId, { temperature: temp });
  }

  const getStatus = (id: string) => {
    if (id === "miraie" && linkedDevices.length > 0) return "linked";
    return id === "telegram" ? "online" : "offline";
  };

  return (
    <div className="flex flex-1 h-full overflow-hidden">
      {/* Main list */}
      <div className="flex-1 overflow-y-auto p-8 space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-black tracking-tighter text-white uppercase">Device Sync</h1>
            <p className="text-white/40 text-sm mt-1">Connect and control your hardware from Gravity.</p>
          </div>
          <button
            onClick={handleDeepSync}
            className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-6 py-2 text-sm text-white hover:bg-white/10 transition"
          >
            <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
            Deep Sync
          </button>
        </div>

        {/* Real linked AC devices */}
        {linkedDevices.length > 0 && (
          <div>
            <p className="text-xs uppercase tracking-widest text-emerald-500 font-bold mb-4 flex items-center gap-2">
              <CheckCircle className="w-4 h-4" /> {linkedDevices.length} DEVICE{linkedDevices.length > 1 ? "S" : ""} LINKED
            </p>
            <div className="grid gap-4 md:grid-cols-2">
              {linkedDevices.map((d: any) => (
                <div key={d.id} className="rounded-2xl bg-emerald-900/10 border border-emerald-500/20 p-6 space-y-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-bold text-white">{d.name}</h3>
                      <p className="text-[10px] uppercase tracking-widest text-emerald-400 font-bold">LIVE · PANASONIC MIRAIE</p>
                    </div>
                    <button
                      onClick={() => handleTogglePower(d.id)}
                      className={`p-3 rounded-xl transition-all ${acPower[d.id] ? "bg-emerald-500 text-white shadow-[0_0_20px_rgba(16,185,129,0.4)]" : "bg-white/5 text-white/40 hover:bg-white/10"}`}
                    >
                      <Power className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs text-white/40 font-bold uppercase">
                      <span className="flex items-center gap-1"><Thermometer className="w-3 h-3" /> Temperature</span>
                      <span className="text-white">{acTemp[d.id] || 24}°C</span>
                    </div>
                    <input
                      type="range"
                      min={16}
                      max={30}
                      value={acTemp[d.id] || 24}
                      onChange={e => handleSetTemp(d.id, Number(e.target.value))}
                      className="w-full accent-emerald-500 cursor-pointer"
                    />
                    <div className="flex justify-between text-[10px] text-white/20">
                      <span>16°C</span><span>30°C</span>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    {(["COOL", "DRY", "FAN", "AUTO"] as const).map(m => (
                      <button
                        key={m}
                        onClick={() => controlMiraieAC(d.id, { mode: m })}
                        className="flex-1 py-1.5 text-[10px] font-bold uppercase rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition"
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Static device cards */}
        <div className="grid gap-4 md:grid-cols-2">
          {staticCards.map((device) => {
            const Icon = DEVICE_ICONS[device.type] || Zap;
            const status = getStatus(device.id);
            return (
              <div key={device.id} className="group rounded-2xl border border-white/10 bg-[#121216] p-6 hover:border-white/20 transition-all">
                <div className="flex items-start justify-between mb-6">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/5 border border-white/5 text-white/50 group-hover:text-white transition-colors">
                    <Icon className="h-6 w-6" />
                  </div>
                  <span className={`inline-flex items-center rounded-full px-2 py-1 text-[10px] font-bold uppercase ${
                    status === "linked" ? "bg-emerald-500/10 text-emerald-400" :
                    status === "online" ? "bg-blue-500/10 text-blue-400" :
                    "bg-white/5 text-white/30"
                  }`}>
                    {status}
                  </span>
                </div>
                <h3 className="font-bold text-white mb-1">{device.name}</h3>
                <p className="text-[10px] uppercase tracking-widest text-white/30 mb-6">{device.brand}</p>

                <div className="flex gap-2">
                  <button
                    onClick={() => setSelectedDevice(device)}
                    className="flex-1 rounded-lg bg-white/5 py-2 text-xs font-bold text-white hover:bg-white/10 border border-white/5 transition"
                  >
                    {status === "linked" ? "Manage" : "Configure"}
                  </button>
                  <button
                    onClick={() => setSelectedDevice(device)}
                    className="rounded-lg bg-white/5 p-2 text-white hover:bg-white/10 border border-white/5 transition"
                  >
                    <Settings className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Settings Drawer */}
      {selectedDevice && (
        <div className="w-96 border-l border-white/10 bg-[#0a0a0c] p-8 flex flex-col overflow-y-auto">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-xl font-black text-white uppercase tracking-tight">{selectedDevice.name}</h2>
            <button onClick={() => { setSelectedDevice(null); setResult(null); }} className="text-white/30 hover:text-white text-xl">✕</button>
          </div>

          {selectedDevice.id === "miraie" ? (
            <div className="space-y-6">
              <p className="text-xs text-white/40 leading-relaxed">
                Login with your <strong className="text-white">Panasonic MirAie account</strong> (same credentials as the MirAie mobile app). 
                Your mobile number is used as the username.
              </p>

              <div className="space-y-2">
                <label className="text-[10px] uppercase font-bold text-white/40 tracking-widest">Mobile Number</label>
                <input
                  type="tel"
                  placeholder="+91 8160810976"
                  value={mobile}
                  onChange={e => setMobile(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-indigo-500 transition text-sm"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] uppercase font-bold text-white/40 tracking-widest">Password</label>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-indigo-500 transition text-sm"
                />
              </div>

              {result && (
                <div className={`flex items-start gap-3 rounded-xl px-4 py-3 text-sm ${result.success ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-red-500/10 text-red-400 border border-red-500/20"}`}>
                  {result.success ? <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" /> : <XCircle className="w-4 h-4 shrink-0 mt-0.5" />}
                  <span>
                    {result.success
                      ? `Linked! Found ${result.devices?.length} device(s). Reload to see them.`
                      : result.error}
                  </span>
                </div>
              )}

              <button
                onClick={handleLink}
                disabled={loading || !mobile || !password}
                className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl transition flex items-center justify-center gap-2"
              >
                {loading ? <><Loader className="w-4 h-4 animate-spin" /> Linking...</> : "Link MirAie Account"}
              </button>
            </div>
          ) : (
            <div className="text-white/30 text-sm mt-4">
              Configuration for <strong className="text-white">{selectedDevice.brand}</strong> coming soon.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

'use client';

import { useState, useEffect, useCallback } from 'react';
import { 
  Zap, LayoutDashboard, Boxes, Activity, History, Settings,
  Wind, Lightbulb, Tv, Send, Plus, Power, Thermometer,
  ChevronUp, ChevronDown, RefreshCw, Bot, Wifi, WifiOff,
  Moon, Sun, Fan, Droplets, Volume2
} from 'lucide-react';
import { getDashboardData, controlMiraieAC } from './device-sync/actions';
import DeviceSyncPage from './device-sync/page';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer 
} from 'recharts';

// ─────────────────── Types ───────────────────
interface ACState {
  power: boolean;
  temp: number;
  mode: 'COOL' | 'DRY' | 'FAN' | 'AUTO';
  fan: 'LOW' | 'MED' | 'HIGH' | 'AUTO';
}

const MODE_ICONS = { COOL: Wind, DRY: Droplets, FAN: Fan, AUTO: Zap };
const MODE_COLORS = { COOL: 'text-cyan-400', DRY: 'text-blue-400', FAN: 'text-slate-400', AUTO: 'text-violet-400' };

const automations = [
  { id: 'a1', name: 'Sleep Mode', trigger: 'After 11 PM', action: 'AC 26°C + Dim lights', active: true },
  { id: 'a2', name: 'Movie Mode', trigger: 'TV on after 7 PM', action: 'Dim lights to 20%', active: true },
  { id: 'a3', name: 'Good Morning', trigger: 'Daily at 7 AM', action: 'Lights warm → AC off', active: false },
  { id: 'a4', name: 'Away Mode', trigger: 'Phone leaves home WiFi', action: 'All devices off', active: false },
];

// ─────────────────── Main Dashboard ───────────────────
export default function Dashboard() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [miraieLinked, setMiraieLinked] = useState(false);
  const [linkedDevices, setLinkedDevices] = useState<any[]>([]);
  const [ac, setAc] = useState<ACState>({ power: false, temp: 24, mode: 'COOL', fan: 'AUTO' });
  const [sending, setSending] = useState(false);

  useEffect(() => {
    getDashboardData().then(cfg => {
      if (cfg.miraie?.devices?.length) {
        setMiraieLinked(true);
        setLinkedDevices(cfg.miraie.devices);
      }
    });
  }, []);

  const sendACCommand = useCallback(async (cmd: Partial<typeof ac> & { deviceId?: string }) => {
    if (!linkedDevices[0]) return;
    setSending(true);
    const newAc = { ...ac, ...cmd };
    setAc(newAc);
    await controlMiraieAC(linkedDevices[0].id, {
      power: newAc.power,
      temperature: newAc.temp,
      mode: newAc.mode,
    });
    setSending(false);
  }, [ac, linkedDevices]);

  return (
    <div className="flex h-screen bg-[#080810] text-white overflow-hidden font-sans">
      {/* ── Sidebar ── */}
      <aside className="w-60 border-r border-white/5 bg-[#0a0a14] flex flex-col py-8 px-4 shrink-0">
        {/* Logo */}
        <div className="flex items-center gap-2.5 px-3 mb-10">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg">
            <Zap className="w-4 h-4 text-white" />
          </div>
          <span className="text-lg font-black tracking-widest uppercase text-white">GRAVITY</span>
        </div>

        {/* Nav */}
        <nav className="space-y-1 flex-grow">
          {[
            { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard' },
            { id: 'automations', icon: Boxes, label: 'Automations' },
            { id: 'devices', icon: Activity, label: 'Device Sync' },
            { id: 'history', icon: History, label: 'Activity Log' },
          ].map(({ id, icon: Icon, label }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ${
                activeTab === id
                  ? 'bg-indigo-500/15 text-indigo-300 border border-indigo-500/20'
                  : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
              {id === 'devices' && miraieLinked && (
                <span className="ml-auto w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]" />
              )}
            </button>
          ))}
        </nav>

        <div className="border-t border-white/5 pt-4">
          <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-slate-500 hover:text-slate-300 hover:bg-white/5 transition-all">
            <Settings className="w-4 h-4" />
            Settings
          </button>
        </div>
      </aside>

      {/* ── Main ── */}
      <main className="flex-1 overflow-y-auto">
        {activeTab === 'dashboard' && (
          <DashboardView
            miraieLinked={miraieLinked}
            linkedDevices={linkedDevices}
            ac={ac}
            sending={sending}
            onAcCommand={sendACCommand}
            onGoToDevices={() => setActiveTab('devices')}
          />
        )}
        {activeTab === 'automations' && <AutomationsView />}
        {activeTab === 'devices' && <DeviceSyncPage />}
        {activeTab === 'history' && <ActivityLogView />}
      </main>
    </div>
  );
}

// ─────────────────── Dashboard View ───────────────────
function DashboardView({ miraieLinked, linkedDevices, ac, sending, onAcCommand, onGoToDevices }: any) {
  const ModeIcon = MODE_ICONS[ac.mode as keyof typeof MODE_ICONS];

  return (
    <div className="p-8 space-y-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-white">Command Center</h1>
          <p className="text-slate-500 text-sm mt-1">
            {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
            {' · '}
            {miraieLinked ? `${linkedDevices.length} device(s) live` : 'No devices linked'}
            {' · '}
            <span className="text-indigo-400 font-bold">God Mode v3.9.5</span>
          </p>
        </div>
        <button className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2.5 rounded-xl text-sm font-bold transition-all shadow-lg shadow-indigo-900/30">
          <Plus className="w-4 h-4" />
          New Automation
        </button>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* ── AC Controller (big card) ── */}
        <div className="col-span-2">
          {miraieLinked && linkedDevices[0] ? (
            <div className={`relative rounded-3xl p-8 overflow-hidden border transition-all duration-500 ${
              ac.power
                ? 'bg-gradient-to-br from-indigo-950 to-slate-950 border-indigo-500/30 shadow-[0_0_60px_rgba(99,102,241,0.15)]'
                : 'bg-[#0f0f1a] border-white/5'
            }`}>
              {/* Glow orb when on */}
              {ac.power && (
                <div className="absolute top-0 right-0 w-72 h-72 bg-indigo-600/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
              )}

              <div className="relative z-10">
                <div className="flex items-start justify-between mb-8">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-500 mb-1">Panasonic Smart AC</p>
                    <h2 className="text-xl font-black text-white">{linkedDevices[0].name}</h2>
                  </div>
                  <button
                    onClick={() => onAcCommand({ power: !ac.power })}
                    className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-300 ${
                      ac.power
                        ? 'bg-indigo-500 text-white shadow-[0_0_20px_rgba(99,102,241,0.5)]'
                        : 'bg-white/5 text-white/30 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    <Power className="w-5 h-5" />
                  </button>
                </div>

                {/* Temperature Display */}
                <div className="flex items-center justify-between mb-8">
                  <div className="flex items-end gap-2">
                    <span className={`text-8xl font-black tracking-tighter leading-none transition-colors ${ac.power ? 'text-white' : 'text-white/20'}`}>
                      {ac.temp}
                    </span>
                    <span className={`text-3xl font-bold mb-3 transition-colors ${ac.power ? 'text-slate-400' : 'text-white/10'}`}>°C</span>
                  </div>

                  {/* Temp controls */}
                  <div className="flex flex-col gap-2">
                    <button
                      onClick={() => onAcCommand({ temp: Math.min(30, ac.temp + 1) })}
                      disabled={!ac.power || sending}
                      className="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center disabled:opacity-30 transition"
                    >
                      <ChevronUp className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => onAcCommand({ temp: Math.max(16, ac.temp - 1) })}
                      disabled={!ac.power || sending}
                      className="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center disabled:opacity-30 transition"
                    >
                      <ChevronDown className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                {/* Mode selector */}
                <div className="grid grid-cols-4 gap-2">
                  {(['COOL', 'DRY', 'FAN', 'AUTO'] as const).map(m => {
                    const Icon = MODE_ICONS[m];
                    const isActive = ac.mode === m && ac.power;
                    return (
                      <button
                        key={m}
                        onClick={() => onAcCommand({ mode: m })}
                        disabled={!ac.power || sending}
                        className={`flex flex-col items-center gap-2 py-3 rounded-2xl text-[10px] font-black uppercase tracking-wider transition-all disabled:opacity-30 ${
                          isActive
                            ? `bg-white/10 ${MODE_COLORS[m]} border border-white/20`
                            : 'bg-white/3 text-slate-600 hover:bg-white/8 hover:text-slate-400 border border-transparent'
                        }`}
                      >
                        <Icon className="w-5 h-5" />
                        {m}
                      </button>
                    );
                  })}
                </div>

                {sending && (
                  <div className="mt-4 flex items-center gap-2 text-xs text-indigo-400">
                    <RefreshCw className="w-3 h-3 animate-spin" />
                    Sending command...
                  </div>
                )}
              </div>
            </div>
          ) : (
            // Not linked CTA
            <div className="rounded-3xl bg-[#0f0f1a] border border-white/5 p-8 flex flex-col items-center justify-center text-center min-h-[300px] gap-4">
              <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 flex items-center justify-center">
                <Wind className="w-8 h-8 text-indigo-400" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white mb-2">MirAie AC Not Connected</h3>
                <p className="text-slate-500 text-sm">Link your Panasonic account to control your AC from here.</p>
              </div>
              <button
                onClick={onGoToDevices}
                className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2.5 rounded-xl text-sm font-bold transition"
              >
                Connect AC →
              </button>
            </div>
          )}
        </div>

        {/* ── Right Column ── */}
        <div className="space-y-4">
          {/* System stats */}
          <div className="rounded-3xl bg-gradient-to-br from-violet-600 to-indigo-700 p-6 text-white relative overflow-hidden">
            <div className="absolute bottom-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl" />
            <Activity className="w-5 h-5 opacity-60 mb-4" />
            <div className="text-5xl font-black mb-1">12</div>
            <div className="text-xs font-bold uppercase tracking-widest text-indigo-200">Active automations</div>
          </div>

          {/* Family Presence Map */}
          <div className="rounded-3xl bg-[#0f0f1a] border border-white/5 p-5 space-y-4">
            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Live Presence Map</h4>
            <div className="space-y-3">
              <PresenceRow name="Paranjay (iPhone 16)" ip="192.168.29.50" status="online" />
              <PresenceRow name="Mom (OnePlus)" ip="192.168.29.52" status="offline" />
              <PresenceRow name="Dad (Samsung)" ip="192.168.29.53" status="online" />
            </div>
          </div>

          {/* Quick devices */}
          <div className="rounded-3xl bg-[#0f0f1a] border border-white/5 p-5 space-y-3">
            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Device Pool</h4>
            <DeviceRow icon={Wind} name="Panasonic AC" sub="MirAie" status={miraieLinked ? 'linked' : 'offline'} />
            <DeviceRow icon={Lightbulb} name="Bedroom Light" sub="WiZ 2.0" status="offline" />
            <DeviceRow icon={Tv} name="Smart TV" sub="SmartThings" status="offline" />
            <DeviceRow icon={Bot} name="Telegram Bot" sub="Gravity Bot" status="online" />
          </div>
        </div>
      </div>

      {/* ── Usage Analytics ── */}
      <div className="grid grid-cols-2 gap-6">
        <div className="rounded-3xl bg-[#0f0f1a] border border-white/5 p-6 h-[300px] flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-black text-white uppercase tracking-widest">Energy Usage (7 Days)</h2>
            <div className="flex gap-4 text-[10px] font-bold">
              <span className="flex items-center gap-1.5 text-indigo-400"><span className="w-2 h-2 rounded-full bg-indigo-500" /> AC</span>
              <span className="flex items-center gap-1.5 text-amber-400"><span className="w-2 h-2 rounded-full bg-amber-500" /> Lights</span>
            </div>
          </div>
          <div className="flex-1 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={[
                { date: 'Mon', ac: 4.2, light: 5.1 },
                { date: 'Tue', ac: 3.8, light: 4.8 },
                { date: 'Wed', ac: 5.5, light: 6.2 },
                { date: 'Thu', ac: 4.7, light: 5.9 },
                { date: 'Fri', ac: 6.1, light: 7.4 },
                { date: 'Sat', ac: 8.2, light: 9.1 },
                { date: 'Sun', ac: 2.1, light: 3.2 },
              ]}>
                <defs>
                  <linearGradient id="colorAc" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fill: '#475569', fontSize: 10}} dy={10} />
                <YAxis hide />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0f0f1a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', fontSize: '10px' }}
                  itemStyle={{ color: '#fff' }}
                />
                <Area type="monotone" dataKey="ac" stroke="#6366f1" strokeWidth={2} fillOpacity={1} fill="url(#colorAc)" />
                <Area type="monotone" dataKey="light" stroke="#f59e0b" strokeWidth={2} fillOpacity={0} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

      {/* ── Automations strip ── */}
        <div className="rounded-3xl bg-[#0f0f1a] border border-white/5 p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-sm font-black text-white uppercase tracking-widest">Automated Flows</h2>
            <span className="text-[10px] uppercase tracking-widest text-emerald-400 font-bold flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block animate-pulse" />
              Engine Active
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {automations.map(a => (
              <AutomationRow key={a.id} automation={a} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function PresenceRow({ name, ip, status }: any) {
  return (
    <div className="flex items-center justify-between p-3 rounded-2xl bg-white/3 border border-white/5">
      <div className="flex items-center gap-3">
        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${status === 'online' ? 'bg-indigo-500/10' : 'bg-slate-800'}`}>
          <Bot className={`w-4 h-4 ${status === 'online' ? 'text-indigo-400' : 'text-slate-600'}`} />
        </div>
        <div>
          <div className="text-xs font-bold text-white">{name}</div>
          <div className="text-[9px] text-slate-600 font-mono tracking-tighter">{ip}</div>
        </div>
      </div>
      <div className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest ${
        status === 'online' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-700/50 text-slate-500'
      }`}>
        {status}
      </div>
    </div>
  );
}

function DeviceRow({ icon: Icon, name, sub, status }: any) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center">
        <Icon className="w-4 h-4 text-slate-400" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-white truncate">{name}</div>
        <div className="text-[10px] text-slate-600 uppercase tracking-wider">{sub}</div>
      </div>
      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
        status === 'linked' || status === 'online' 
          ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]'
          : 'bg-slate-700'
      }`} />
    </div>
  );
}

function AutomationRow({ automation }: { automation: typeof automations[0] }) {
  const [active, setActive] = useState(automation.active);
  return (
    <div className="flex items-center justify-between p-4 rounded-2xl bg-white/3 hover:bg-white/5 border border-white/5 transition-all">
      <div className="flex items-center gap-3 min-w-0">
        <div className={`w-2 h-2 rounded-full flex-shrink-0 transition-all ${
          active ? 'bg-indigo-400 shadow-[0_0_8px_rgba(129,140,248,0.7)]' : 'bg-slate-700'
        }`} />
        <div className="min-w-0">
          <div className="text-sm font-bold text-white truncate">{automation.name}</div>
          <div className="text-[10px] text-slate-600 truncate">{automation.trigger} → {automation.action}</div>
        </div>
      </div>
      <button
        onClick={() => setActive(!active)}
        className={`w-10 h-5 rounded-full relative transition-colors flex-shrink-0 ml-3 ${active ? 'bg-indigo-600' : 'bg-slate-800'}`}
      >
        <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${active ? 'right-0.5' : 'left-0.5'}`} />
      </button>
    </div>
  );
}

// ─────────────────── Automations View ───────────────────
function AutomationsView() {
  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-black tracking-tight">Automations</h1>
        <button className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2.5 rounded-xl text-sm font-bold transition">
          <Plus className="w-4 h-4" />
          New Flow
        </button>
      </div>
      <div className="space-y-3">
        {automations.map(a => (
          <div key={a.id} className="rounded-2xl bg-[#0f0f1a] border border-white/5 p-5 flex items-center gap-5 hover:border-white/10 transition">
            <div className={`w-3 h-3 rounded-full transition-all ${a.active ? 'bg-indigo-400 shadow-[0_0_10px_rgba(129,140,248,0.7)]' : 'bg-slate-700'}`} />
            <div className="flex-1">
              <div className="font-bold text-white">{a.name}</div>
              <div className="text-xs text-slate-500 mt-0.5">{a.trigger} <span className="text-slate-700">→</span> {a.action}</div>
            </div>
            <div className={`w-10 h-5 rounded-full relative cursor-pointer transition-colors ${a.active ? 'bg-indigo-600' : 'bg-slate-800'}`}>
              <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${a.active ? 'right-0.5' : 'left-0.5'}`} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────── Activity Log View ───────────────────
function ActivityLogView() {
  const events = [
    { time: '14:22', icon: Wind, text: 'AC turned ON — COOL 24°C', color: 'text-cyan-400' },
    { time: '14:18', icon: Bot, text: 'Telegram: /ac 24 executed', color: 'text-blue-400' },
    { time: '13:50', icon: Lightbulb, text: 'Movie Mode activated', color: 'text-amber-400' },
    { time: '11:00', icon: Zap, text: 'Gravity Engine started', color: 'text-violet-400' },
  ];
  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-black tracking-tight mb-8">Activity Log</h1>
      <div className="space-y-2">
        {events.map((e, i) => (
          <div key={i} className="flex items-center gap-4 p-4 rounded-2xl bg-[#0f0f1a] border border-white/5">
            <span className="text-xs text-slate-600 font-mono w-10 shrink-0">{e.time}</span>
            <e.icon className={`w-4 h-4 ${e.color} shrink-0`} />
            <span className="text-sm text-slate-300">{e.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

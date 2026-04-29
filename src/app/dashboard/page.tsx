'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Zap, 
  Wind, 
  Lightbulb, 
  Tv, 
  Moon, 
  Target, 
  Activity, 
  Clock,
  ShieldCheck,
  AlertCircle,
  Cloud,
  Music
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts';

interface DashboardData {
  online: boolean;
  stats: {
    acMinutes: number;
    lightMinutes: number;
    pgvcl: { amount: string; units: string; date: string };
    history: { time: string; ac: number; lights: number }[];
    dailyLog: { date: string; ac: string; light: string }[];
  };
  units: string;
  estimatedPgBill: number;
  ac_duration: string;
  light_duration: string;
  uptime: number;
  weather: any;
  solis: { today: string; current: string; battery: string; status: string };
  spotify: any;
  jitter: any;
  battery: any;
  autoAc: boolean;
  autoLight: boolean;
  mediaAura: boolean;
  habitStats: { stretches: number; hydration: number; lastNudge: number };
  logs: string[];
  ipl?: {
    matchId: string;
    matchName: string;
    status: string;
    score: string;
    crr: string;
    rrr: string;
    target: string;
    projected: string;
    batters: string;
    bowler: string;
    winProb: string;
    summary: { inn1: string; inn2: string; result: string; topScorers: string; topBowlers: string };
    currentOverBalls: { run: string; isWicket: boolean }[];
    latestBall: { commentary: string; over: string; run: string; isWicket: boolean };
  } | null;
}

export default function GravityDashboard() {
  const [data, setData] = useState<GravityStatus | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'daily' | 'weekly' | 'monthly'>('daily');

  const fetchData = async () => {
    try {
      const res = await fetch('/api/gravity/status');
      const json = await res.json();
      setData(json);
      
      // Process historical data for BarChart
      if (json.stats?.dailyLog) {
        setHistory(json.stats.dailyLog.map((log: any) => ({
          ...log,
          // Convert hours to units
          acUnits: (parseFloat(log.ac) * 1.65).toFixed(1),
          lightUnits: (parseFloat(log.light) * 0.012).toFixed(2),
          totalUnits: (parseFloat(log.ac) * 1.65 + parseFloat(log.light) * 0.012).toFixed(1)
        })));
      } else {
        // Fallback or seed history
        const now = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false });
        setHistory(prev => {
          const next = [...prev, { date: now, acUnits: json.stats.acMinutes, lightUnits: json.stats.lightMinutes, totalUnits: json.stats.acMinutes + json.stats.lightMinutes }];
          return next.slice(-24);
        });
      }
      
      setLoading(false);
    } catch (e) {
      console.error("Dashboard fetch failed", e);
    }
  };

  useEffect(() => {
    fetchData();
    const timer = setInterval(fetchData, 10000); // Poll every 10s
    return () => clearInterval(timer);
  }, []);

  const triggerScene = async (scene: string) => {
    try {
      await fetch(`/api/gravity/scene/${scene.toUpperCase()}`);
      setTimeout(fetchData, 1000); 
    } catch (e) {
      console.error("Scene trigger failed", e);
    }
  };

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#060608]">
        <motion.div 
          animate={{ opacity: [0.3, 1, 0.3] }} 
          transition={{ repeat: Infinity, duration: 1.5 }}
  if (!mounted) return null;

  const triggerScene = async (name: string) => {
    try {
      await fetch(`/api/gravity/scene/${name}`);
      setTimeout(async () => {
        const res = await fetch('/api/gravity/status');
        setData(await res.json());
      }, 1000);
    } catch (e) { console.error("Scene trigger failed", e); }
  };

  const uptimeHrs = Math.floor((data?.uptime || 0) / 3600);
  const uptimeMins = Math.floor(((data?.uptime || 0) % 3600) / 60);

  const history = (data?.stats.dailyLog || []).map(d => ({
    date: d.date,
    ac: parseFloat(d.ac),
    light: parseFloat(d.light),
    totalUnits: parseFloat(d.ac) + parseFloat(d.light)
  }));

  return (
    <div className="min-h-screen bg-[#050508] text-slate-200 selection:bg-purple-500/30 overflow-x-hidden">
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-purple-900/10 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-900/10 rounded-full blur-[120px]" />
      </div>

      <div className="relative z-10 max-w-[1440px] mx-auto px-6 py-12 lg:px-12">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-8 mb-16">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <span className="px-2 py-0.5 rounded text-[8px] font-black bg-purple-500 text-white tracking-widest uppercase">Elite Alpha</span>
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.3em]">System.v4.9.8</span>
            </div>
            <h1 className="text-4xl font-black text-white tracking-tighter leading-none">GRAVITY <span className="text-purple-500">HUB</span></h1>
          </div>
          <div className="flex items-center gap-6">
            <div className="flex flex-col items-end">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Uptime</span>
              <span className="text-sm font-mono text-purple-400">{uptimeHrs}h {uptimeMins}m</span>
            </div>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-3 space-y-6">
            <motion.div className="glass p-6 rounded-[2.5rem] border border-white/5 shadow-2xl">
              <div className="space-y-6">
                <StatItem icon={<Wind />} color="blue" label="AC Runtime" value={data?.ac_duration || '0h'} subtext="Usage Today" />
                <StatItem icon={<Lightbulb />} color="amber" label="Lights" value={data?.light_duration || '0h'} subtext="Active Hours" />
                <StatItem icon={<Zap />} color="purple" label="Power Draw" value={`${data?.units || 0} U`} subtext="Est. ₹${data?.estimatedPgBill || 0}" />
              </div>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
              className="glass p-6 rounded-[2.5rem] border border-white/5"
            >
              {data?.spotify?.isPlaying ? (
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center relative overflow-hidden group">
                    <Music className="w-5 h-5 text-purple-400 relative z-10" />
                    <div className="absolute inset-0 bg-purple-500/10 animate-ping opacity-20" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[8px] font-bold text-purple-400 uppercase tracking-widest mb-0.5">Now Playing</div>
                    <div className="text-xs font-bold text-white truncate">{data.spotify.title}</div>
                    <div className="text-[10px] text-slate-500 truncate">{data.spotify.artist}</div>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Climate</div>
                    <div className="text-2xl font-black text-white">{data?.weather?.temp || '--'}°C</div>
                    <div className="text-[10px] text-slate-400 font-medium uppercase tracking-tighter">{data?.weather?.condition || 'Syncing...'}</div>
                  </div>
                  <Cloud className="w-8 h-8 text-blue-400 opacity-20" />
                </div>
              )}
            </motion.div>
          </div>

          <div className="lg:col-span-6 space-y-6">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
              className="glass p-8 rounded-[3rem] border border-white/5 flex flex-col h-[500px]"
            >
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-[0.3em] mb-1">Energy Intelligence</h3>
                  <div className="text-2xl font-black text-white tracking-tighter">Usage Analytics</div>
                </div>
                <div className="flex bg-white/5 p-1 rounded-xl">
                  {['daily', 'weekly', 'monthly'].map((v) => (
                    <button 
                      key={v}
                      onClick={() => setView(v as any)}
                      className={`px-4 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all ${view === v ? 'bg-white text-black' : 'text-slate-400'}`}
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex-1 min-h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={history}>
                    <defs>
                      <linearGradient id="colorUnits" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#ffffff05" />
                    <XAxis dataKey="date" hide />
                    <YAxis hide />
                    <Tooltip contentStyle={{ background: '#0a0a0c', border: '1px solid #ffffff10', borderRadius: '16px' }} />
                    <Area type="monotone" dataKey="totalUnits" stroke="#8b5cf6" strokeWidth={3} fill="url(#colorUnits)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </motion.div>

            {data?.ipl && (
              <motion.div 
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                className="glass p-8 rounded-[3rem] border border-white/5 bg-gradient-to-br from-[#0a0a0c] via-[#0a0a0c] to-blue-900/10"
              >
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                      <span className="text-[10px] font-black text-red-500 uppercase tracking-widest">Live IPL 2026</span>
                    </div>
                    <h3 className="text-lg font-black text-white tracking-tight">{data.ipl.matchName}</h3>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-black text-blue-400">{data.ipl.score || '0/0 (0)'}</div>
                    <div className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter">CRR: {data.ipl.crr} • RRR: {data.ipl.rrr}</div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                    <div className="text-[8px] font-bold text-slate-500 uppercase tracking-widest mb-2">Batting</div>
                    <div className="text-xs font-bold text-white leading-relaxed">{data.ipl.batters}</div>
                  </div>
                  <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                    <div className="text-[8px] font-bold text-slate-500 uppercase tracking-widest mb-2">Bowling</div>
                    <div className="text-xs font-bold text-white leading-relaxed">{data.ipl.bowler}</div>
                  </div>
                </div>

                {data.ipl.latestBall && (
                  <div className="p-4 bg-blue-500/5 rounded-2xl border border-blue-500/10 mb-4">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="px-2 py-0.5 rounded-lg bg-blue-500 text-[10px] font-black text-white">{data.ipl.latestBall.over}</div>
                      <div className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">Latest Ball</div>
                    </div>
                    <div className="text-xs text-slate-300 italic line-clamp-1">"{data.ipl.latestBall.commentary}"</div>
                  </div>
                )}

                <div className="flex items-center justify-between text-[10px]">
                  <div className="flex gap-1.5">
                    {data.ipl.currentOverBalls?.map((b, i) => (
                      <span key={i} className={`w-5 h-5 flex items-center justify-center rounded-full font-black ${b.isWicket ? 'bg-red-500 text-white' : b.run === '6' || b.run === '4' ? 'bg-blue-500 text-white' : 'bg-white/10 text-slate-400'}`}>
                        {b.isWicket ? 'W' : b.run}
                      </span>
                    ))}
                  </div>
                  <div className="font-bold text-slate-400 uppercase tracking-tighter">{data.ipl.winProb}</div>
                </div>
              </motion.div>
            )}
          </div>

          <div className="lg:col-span-3 space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <SmallSceneCard icon={<Tv />} label="TV" onClick={() => triggerScene('TV')} />
              <SmallSceneCard icon={<Moon />} label="SLEEP" onClick={() => triggerScene('SLEEP')} />
              <SmallSceneCard icon={<Target />} label="FOCUS" onClick={() => triggerScene('FOCUS')} />
              <SmallSceneCard icon={<Wind />} label="COOL" onClick={() => triggerScene('COOL')} />
            </div>

            <div className="glass p-6 rounded-[2.5rem] border border-white/5 flex flex-col flex-1 min-h-[250px]">
              <div className="flex items-center gap-3 mb-6">
                <Activity className="w-4 h-4 text-purple-400" />
                <h3 className="text-xs font-bold text-white uppercase tracking-[0.2em]">Live Pulse</h3>
              </div>
              <div className="space-y-4 overflow-y-auto max-h-[300px] pr-2 scrollbar-hide">
                {data?.logs.slice(0, 15).map((log, i) => (
                  <div key={i} className="text-[10px] leading-snug">
                    <span className="text-slate-500 font-mono text-[8px] block mb-0.5 opacity-50">
                      {log.split('] ')[0]?.replace('[', '') || 'Just now'}
                    </span>
                    <span className="text-slate-300 font-medium">
                      {log.split('] ')[1] || log}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Solis Solar Intelligence */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
              className="glass p-6 rounded-[2.5rem] border border-white/5 bg-gradient-to-br from-amber-500/5 to-transparent"
            >
              <div className="flex justify-between items-center mb-4">
                <div className="text-[10px] font-bold text-amber-500 uppercase tracking-widest">Solis Solar Hub</div>
                <div className="px-2 py-0.5 rounded-[4px] bg-amber-500/20 text-[8px] font-black text-amber-400 uppercase">{data?.solis.status}</div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <div className="text-2xl font-black text-white">{data?.solis.today || '0'}<span className="text-[10px] text-slate-500 ml-1">kWh</span></div>
                  <div className="text-[8px] text-slate-500 font-bold uppercase tracking-tighter">Yield Today</div>
                </div>
                <div className="space-y-1 text-right">
                  <div className="text-2xl font-black text-white">{data?.solis.battery || '0%'}</div>
                  <div className="text-[8px] text-slate-500 font-bold uppercase tracking-tighter">ESS Battery</div>
                </div>
              </div>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
              className="glass p-6 rounded-[2.5rem] border border-white/5 bg-gradient-to-br from-green-500/5 to-transparent"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Wellness Guardian</div>
                <ShieldCheck className="w-3 h-3 text-green-500" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <div className="text-xl font-black text-white">{data?.habitStats.hydration || 0}<span className="text-[10px] text-slate-500 ml-1">Glasses</span></div>
                  <div className="text-[8px] text-green-500 font-bold uppercase tracking-tighter">Hydration</div>
                </div>
                <div className="space-y-1 text-right">
                  <div className="text-xl font-black text-white">{data?.habitStats.stretches || 0}<span className="text-[10px] text-slate-500 ml-1">Sets</span></div>
                  <div className="text-[8px] text-blue-500 font-bold uppercase tracking-tighter">Stretches</div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatItem({ icon, color, label, value, subtext }: any) {
  const colors: any = {
    blue: "text-blue-400 bg-blue-500/10",
    purple: "text-purple-400 bg-purple-500/10",
    amber: "text-amber-400 bg-amber-500/10",
    green: "text-green-400 bg-green-500/10"
  };

  return (
    <div className="flex items-center gap-4 group">
      <div className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-all group-hover:scale-110 ${colors[color] || colors.purple}`}>
        {React.cloneElement(icon, { size: 18 })}
      </div>
      <div>
        <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest leading-none mb-1">{label}</div>
        <div className="text-lg font-black text-white tracking-tight leading-none">{value}</div>
        <div className="text-[9px] text-slate-600 font-medium">{subtext}</div>
      </div>
    </div>
  );
}

function SmallSceneCard({ icon, label, onClick }: any) {
  return (
    <button 
      onClick={onClick}
      className="glass p-4 rounded-3xl border border-white/5 flex flex-col items-center justify-center gap-2 hover:bg-white/5 hover:scale-[1.02] active:scale-95 transition-all group"
    >
      <div className="text-slate-400 group-hover:text-purple-400 transition-colors">
        {React.cloneElement(icon, { size: 18 })}
      </div>
      <span className="text-[9px] font-black text-slate-500 group-hover:text-white uppercase tracking-widest">{label}</span>
    </button>
  );
}

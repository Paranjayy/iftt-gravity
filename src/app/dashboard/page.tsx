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
  AlertCircle
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

interface GravityStatus {
  online: boolean;
  stats: {
    acMinutes: number;
    lightMinutes: number;
    lastReset: string;
    pgvcl?: {
      amount: string;
      units: string;
      scannedAt: string;
    };
  };
  uptime: number;
  estimatedPgBill?: string;
  logs: string[];
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
          className="text-purple-500 font-bold tracking-[0.3em] text-sm uppercase"
        >
          INITIALIZING GRAVITY CORE...
        </motion.div>
      </div>
    );
  }

  const uptimeHrs = data ? Math.floor(data.uptime / 3600) : 0;
  const uptimeMins = data ? Math.floor((data.uptime % 3600) / 60) : 0;

  return (
    <div className="min-h-screen bg-[#060608] text-slate-100 p-4 md:p-8 selection:bg-purple-500/30 font-sans">
      
      {/* Dynamic Background */}
      <div className="fixed inset-0 pointer-events-none opacity-20">
        <div className="absolute -top-[20%] -left-[10%] w-[60%] h-[60%] bg-purple-900/40 blur-[160px] rounded-full animate-pulse-slow" />
        <div className="absolute -bottom-[20%] -right-[10%] w-[50%] h-[50%] bg-blue-900/30 blur-[140px] rounded-full" />
      </div>

      <div className="max-w-7xl mx-auto relative z-10 space-y-8">
        
        {/* Header */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-ping" />
              <span className="text-[10px] font-bold tracking-[0.2em] text-slate-500 uppercase">System Operational</span>
            </div>
            <h1 className="text-4xl font-black text-white tracking-tighter leading-none">GRAVITY <span className="text-purple-500">HUB</span></h1>
          </div>
          <div className="flex items-center gap-6">
            <div className="flex flex-col items-end">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Uptime</span>
              <span className="text-sm font-mono text-purple-400">{uptimeHrs}h {uptimeMins}m</span>
            </div>
            <div className="h-8 w-px bg-white/10" />
            <div className="flex flex-col items-end">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Build</span>
              <span className="text-sm font-mono text-blue-400">v4.9.8-GOLD</span>
            </div>
          </div>
        </header>

        {/* Intelligence Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Left Column: Stats & Bills */}
          <div className="lg:col-span-3 space-y-6">
            <motion.div 
              initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
              className="glass p-6 rounded-[2.5rem] border border-white/5 shadow-2xl"
            >
              <div className="flex justify-between items-center mb-8">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Environment</span>
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                  <span className="text-[10px] font-bold text-green-400">HOME</span>
                </div>
              </div>

              <div className="space-y-6">
                <StatItem icon={<Wind />} color="blue" label="AC Runtime" value={`${((data?.stats.acMinutes || 0) / 60).toFixed(1)}h`} subtext="Usage Today" />
                <StatItem icon={<Lightbulb />} color="amber" label="Bulb State" value={`${((data?.stats.lightMinutes || 0) / 60).toFixed(1)}h`} subtext="Active Hours" />
                <StatItem icon={<Zap />} color="purple" label="Power Draw" value="~1.8kW" subtext="Live Estimation" />
              </div>

              <div className="mt-8 pt-8 border-t border-white/5 space-y-4">
                <div className="p-5 bg-gradient-to-br from-blue-600/10 to-purple-600/10 rounded-3xl border border-white/5">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Utility Pulse</span>
                    <Activity className="w-3 h-3 text-blue-400" />
                  </div>
                  <div className="text-2xl font-black text-white">₹{data?.stats.pgvcl?.amount || '0'}</div>
                  <div className="text-[10px] text-slate-500 font-bold mb-3 uppercase tracking-tighter">Live Scrape · {data?.stats.pgvcl?.units || '0'} Units</div>
                  
                  {data?.estimatedPgBill && (
                    <div className="pt-3 border-t border-white/5">
                      <div className="text-[10px] uppercase tracking-[0.1em] text-blue-400 font-bold mb-1">Gravity AI Estimate</div>
                      <div className="text-xl font-bold">₹{data.estimatedPgBill}</div>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </div>

          {/* Center Column: Energy Analytics */}
          <div className="lg:col-span-6 space-y-6">
            <motion.div 
              initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }}
              className="glass p-8 rounded-[2.5rem] border border-white/5 flex flex-col h-full"
            >
              <div className="flex justify-between items-center mb-10">
                <div>
                  <h3 className="text-lg font-bold text-white tracking-tight">Energy Consumption</h3>
                  <p className="text-xs text-slate-500 uppercase tracking-widest font-medium">Power Insights Engine</p>
                </div>
                <div className="flex bg-white/5 p-1 rounded-xl">
                  {['daily', 'weekly', 'monthly'].map((v) => (
                    <button 
                      key={v}
                      onClick={() => setView(v as any)}
                      className={`px-4 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all ${view === v ? 'bg-white text-black shadow-lg' : 'text-slate-400 hover:text-white'}`}
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex-1 min-h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={history.slice(-14)}>
                    <defs>
                      <linearGradient id="colorUnits" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.4}/>
                        <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#ffffff05" />
                    <XAxis 
                      dataKey="date" 
                      stroke="#ffffff20" 
                      fontSize={10} 
                      axisLine={false} 
                      tickLine={false} 
                      tickFormatter={(v) => v.split('/')[0]}
                    />
                    <YAxis hide />
                    <Tooltip 
                      contentStyle={{ background: '#0a0a0c', border: '1px solid #ffffff10', borderRadius: '20px', padding: '15px' }}
                      itemStyle={{ fontSize: '12px', fontWeight: 'bold' }}
                      labelStyle={{ fontSize: '10px', color: '#64748b', marginBottom: '8px', textTransform: 'uppercase' }}
                      cursor={{ stroke: '#ffffff10', strokeWidth: 2 }}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="totalUnits" 
                      name="Units"
                      stroke="#8b5cf6" 
                      strokeWidth={4} 
                      fillOpacity={1} 
                      fill="url(#colorUnits)" 
                      animationDuration={1500}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              <div className="mt-8 grid grid-cols-3 gap-4">
                <div className="text-center">
                  <div className="text-[10px] text-slate-500 font-bold uppercase mb-1">Peak Day</div>
                  <div className="text-lg font-bold">18.4 <span className="text-[10px] text-slate-400">kWh</span></div>
                </div>
                <div className="text-center border-x border-white/5">
                  <div className="text-[10px] text-slate-500 font-bold uppercase mb-1">Avg Usage</div>
                  <div className="text-lg font-bold">12.2 <span className="text-[10px] text-slate-400">kWh</span></div>
                </div>
                <div className="text-center">
                  <div className="text-[10px] text-slate-500 font-bold uppercase mb-1">Savings</div>
                  <div className="text-lg font-bold text-green-400">12% <span className="text-[10px] text-green-500/50">vs last wk</span></div>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Right Column: Scenes & Logs */}
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
                {data?.logs.slice(-10).reverse().map((log, i) => (
                  <div key={i} className="text-[10px] leading-snug">
                    <span className="text-slate-500 font-mono text-[8px] block mb-0.5 opacity-50">
                      {log.split('] ')[0].replace('[', '')}
                    </span>
                    <span className="text-slate-300 font-medium">
                      {log.split('] ')[1]}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}

function StatItem({ icon, color, label, value, subtext }: any) {
  const colors: any = {
    blue: "text-blue-400 bg-blue-500/10",
    amber: "text-amber-400 bg-amber-500/10",
    purple: "text-purple-400 bg-purple-500/10",
  };
  return (
    <div className="flex items-center gap-4 group cursor-default">
      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all group-hover:scale-110 ${colors[color]}`}>
        {React.cloneElement(icon, { size: 20 })}
      </div>
      <div>
        <div className="text-[10px] text-slate-500 uppercase tracking-widest font-black">{label}</div>
        <div className="text-xl font-black text-white leading-tight">{value}</div>
        <div className="text-[9px] text-slate-400 font-bold uppercase opacity-60 tracking-tighter">{subtext}</div>
      </div>
    </div>
  );
}

function SmallSceneCard({ icon, label, onClick }: any) {
  return (
    <motion.button 
      whileHover={{ y: -4, backgroundColor: 'rgba(255,255,255,0.05)' }} whileTap={{ scale: 0.95 }}
      onClick={onClick}
      className="glass p-5 rounded-3xl border border-white/5 flex flex-col items-center justify-center gap-2 group"
    >
      <div className="text-slate-400 group-hover:text-purple-400 transition-colors">
        {React.cloneElement(icon, { size: 20 })}
      </div>
      <span className="text-[10px] font-black text-slate-500 group-hover:text-white uppercase tracking-widest">{label}</span>
    </motion.button>
  );
}

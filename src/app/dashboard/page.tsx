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
  };
  uptime: number;
  logs: string[];
}

export default function GravityDashboard() {
  const [data, setData] = useState<GravityStatus | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      const res = await fetch('/api/gravity/status');
      const json = await res.json();
      setData(json);
      
      // Use real history from the Hub API if available
      if (json.stats?.history && json.stats.history.length > 0) {
        setHistory(json.stats.history);
      } else {
        // Fallback or seed history
        const now = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false });
        setHistory(prev => {
          const next = [...prev, { time: now, ac: json.stats.acMinutes, lights: json.stats.lightMinutes }];
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
      // Use internal Next.js bridge to avoid CORS
      await fetch(`/api/gravity/scene/${scene.toUpperCase()}`);
      setTimeout(fetchData, 1000); // Refresh after a second to see effect
    } catch (e) {
      console.error("Scene trigger failed", e);
    }
  };

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#0a0a0c]">
        <motion.div 
          animate={{ scale: [1, 1.1, 1] }} 
          transition={{ repeat: Infinity, duration: 2 }}
          className="text-purple-500 font-medium tracking-widest text-lg"
        >
          GRAVITY INITIALIZING...
        </motion.div>
      </div>
    );
  }

  const uptimeHrs = data ? Math.floor(data.uptime / 3600) : 0;
  const uptimeMins = data ? Math.floor((data.uptime % 3600) / 60) : 0;

  return (
    <div className="min-h-screen bg-[#0a0a0c] text-slate-100 p-4 md:p-8 selection:bg-purple-500/30">
      
      {/* Background Ambience */}
      <div className="fixed inset-0 pointer-events-none opacity-20 overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-purple-600 blur-[120px] rounded-full animate-pulse-slow" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[30%] h-[30%] bg-blue-600 blur-[100px] rounded-full opacity-50" />
      </div>

      <div className="max-w-7xl mx-auto relative z-10 space-y-8">
        
        {/* Header */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-4xl font-bold gradient-text tracking-tighter">GRAVITY MISSION CONTROL</h1>
            <p className="text-slate-400 text-sm flex items-center gap-2 mt-1 uppercase tracking-widest font-medium opacity-80">
              <Activity className="w-3 h-3 text-green-400" /> System Live · v1.4.0
            </p>
          </div>
          <div className="flex items-center gap-3 glass p-2 px-4 rounded-2xl">
            <Clock className="w-4 h-4 text-purple-400" />
            <span className="text-sm font-mono tracking-wider">{uptimeHrs}h {uptimeMins}m Uptime</span>
          </div>
        </header>

        {/* Hero Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          
          {/* Status Panel */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            className="md:col-span-1 glass p-6 rounded-3xl flex flex-col justify-between border-l-4 border-l-purple-500 shadow-xl shadow-purple-900/10"
          >
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <span className="text-sm font-bold text-slate-400 uppercase tracking-widest">Presence</span>
                <span className={`flex items-center gap-2 text-xs font-bold px-2 py-1 rounded-full ${data?.online ? 'bg-green-500/10 text-green-400' : 'bg-orange-500/10 text-orange-400'}`}>
                   {data?.online ? <ShieldCheck className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                   {data?.online ? 'HOME' : 'AWAY'}
                </span>
              </div>
              
              <div className="space-y-4">
                <div className="flex items-center gap-4 group">
                  <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-400 group-hover:scale-110 transition-transform">
                    <Wind className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-xs text-slate-500 uppercase tracking-tighter">Air Conditioning</div>
                    <div className="text-lg font-bold">{data?.stats.acMinutes}m <span className="text-xs text-slate-500 font-normal">today</span></div>
                  </div>
                </div>
                
                <div className="flex items-center gap-4 group">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-400 group-hover:scale-110 transition-transform">
                    <Lightbulb className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-xs text-slate-500 uppercase tracking-tighter">House Lighting</div>
                    <div className="text-lg font-bold">{data?.stats.lightMinutes}m <span className="text-xs text-slate-500 font-normal">today</span></div>
                  </div>
                </div>
              </div>
            </div>
            
            <button className="mt-8 w-full py-3 rounded-2xl bg-slate-100 text-[#0a0a0c] font-bold text-sm tracking-widest hover:bg-white transition-colors active:scale-[0.98]">
              SYNC HUB
            </button>
          </motion.div>

          {/* Energy Graph */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            className="md:col-span-3 glass p-6 rounded-3xl min-h-[300px] border-b border-white/5"
          >
            <div className="flex justify-between items-center mb-8">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-500/10 rounded-lg text-purple-400"><Zap className="w-4 h-4" /></div>
                <h3 className="font-bold tracking-tight text-lg">Daily Energy Pulse</h3>
              </div>
              <div className="flex gap-4 text-[10px] font-bold tracking-widest uppercase">
                <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-blue-400" /> AC Efficiency</div>
                <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-orange-400" /> Light Usage</div>
              </div>
            </div>
            
            <div className="h-[250px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={history}>
                  <defs>
                    <linearGradient id="colorAc" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#60a5fa" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#60a5fa" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorLights" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#fbbf24" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#fbbf24" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#ffffff05" />
                  <XAxis dataKey="time" stroke="#ffffff20" fontSize={10} axisLine={false} tickLine={false} />
                  <YAxis hide />
                  <Tooltip 
                    contentStyle={{ background: '#121216', border: '1px solid #ffffff10', borderRadius: '12px' }}
                    itemStyle={{ fontSize: '10px', fontWeight: 'bold' }}
                    labelStyle={{ fontSize: '10px', color: '#64748b' }}
                  />
                  <Area type="monotone" dataKey="ac" stroke="#60a5fa" strokeWidth={3} fillOpacity={1} fill="url(#colorAc)" />
                  <Area type="monotone" dataKey="lights" stroke="#fbbf24" strokeWidth={3} fillOpacity={1} fill="url(#colorLights)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </motion.div>
        </div>

        {/* Interactive Controls */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          
          <div className="md:col-span-3 grid grid-cols-2 lg:grid-cols-4 gap-4">
            <SceneCard icon={<Tv />} label="Cinema" scene="TV" color="blue" onClick={() => triggerScene('TV')} />
            <SceneCard icon={<Target />} label="Deep Work" scene="FOCUS" color="purple" onClick={() => triggerScene('FOCUS')} />
            <SceneCard icon={<Moon />} label="Night Wrap" scene="SLEEP" color="orange" onClick={() => triggerScene('SLEEP')} />
            <SceneCard icon={<ShieldCheck />} label="Away Mode" scene="AWAY" color="slate" onClick={() => triggerScene('AWAY')} />
          </div>

          {/* Activity Logs */}
          <div className="md:col-span-1 glass p-6 rounded-3xl overflow-hidden flex flex-col border border-white/5">
             <div className="flex items-center gap-3 mb-6">
                <Activity className="w-4 h-4 text-purple-400" />
                <h3 className="font-bold tracking-tight text-sm uppercase tracking-widest">Chronicle</h3>
              </div>
              <div className="flex-1 overflow-y-auto space-y-4 max-h-[300px] scrollbar-hide">
                {data?.logs.map((log, i) => (
                  <motion.div 
                    initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                    key={i} className="text-[11px] leading-relaxed group"
                  >
                    <span className="text-slate-500 font-mono text-[9px] mr-2 block mb-1">
                      {log.split('] ')[0].replace('[', '')}
                    </span>
                    <span className="text-slate-200 group-hover:text-purple-300 transition-colors">
                      {log.split('] ')[1]}
                    </span>
                  </motion.div>
                ))}
              </div>
          </div>

        </div>

      </div>
    </div>
  );
}

function SceneCard({ icon, label, scene, color, onClick }: any) {
  const colors: any = {
    blue: "hover:bg-blue-500/10 border-blue-500/20 text-blue-400",
    purple: "hover:bg-purple-500/10 border-purple-500/20 text-purple-400",
    orange: "hover:bg-orange-500/10 border-orange-500/20 text-orange-400",
    slate: "hover:bg-slate-500/10 border-slate-500/20 text-slate-400",
  };

  return (
    <motion.button 
      whileHover={{ y: -5 }} whileTap={{ scale: 0.95 }}
      onClick={onClick}
      className={`glass p-6 rounded-3xl border ${colors[color]} flex flex-col items-center justify-center gap-4 transition-all group`}
    >
      <div className="p-4 bg-white/5 rounded-2xl group-hover:scale-110 transition-transform">
        {React.cloneElement(icon, { size: 24 })}
      </div>
      <div className="text-center">
        <div className="font-bold tracking-tight text-sm">{label}</div>
        <div className="text-[10px] opacity-40 font-mono tracking-widest mt-1 uppercase">trigger {scene}</div>
      </div>
    </motion.button>
  );
}

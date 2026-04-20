'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Zap, 
  Wind, 
  Shield, 
  Activity, 
  History, 
  Settings,
  X,
  Maximize2,
  Minus,
  Search,
  Bot,
  Battery,
  Wifi,
  Clock,
  Tv,
  Lightbulb,
  MousePointer2
} from 'lucide-react';

// ── Components ──

interface WindowProps {
  title: string;
  id: string;
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  width?: string;
  icon?: React.ReactNode;
}

const DesktopWindow = ({ title, id, isOpen, onClose, children, width = "w-[400px]", icon }: WindowProps) => {
  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9, y: 20 }}
      className={`absolute z-30 ${width} bg-[#0a0a0f]/60 backdrop-blur-3xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden`}
      style={{ left: id === 'cortex' ? '40px' : id === 'sentry' ? '460px' : '960px', top: '80px' }}
    >
      <div className="flex items-center justify-between px-4 py-3 bg-white/5 border-b border-white/5 cursor-move">
        <div className="flex items-center gap-3">
          <div className="flex gap-1.5">
            <button onClick={onClose} className="w-3 h-3 rounded-full bg-red-500/80 hover:bg-red-500 transition-colors" />
            <div className="w-3 h-3 rounded-full bg-amber-500/80" />
            <div className="w-3 h-3 rounded-full bg-emerald-500/80" />
          </div>
          <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/40 flex items-center gap-2">
            {icon}
            {title}
          </span>
        </div>
      </div>
      <div className="p-6">
        {children}
      </div>
    </motion.div>
  );
};

// ── Main Page ──

export default function GravityOS() {
  const [windows, setWindows] = useState({
    cortex: true,
    sentry: true,
    energy: true,
    palette: false
  });

  const [time, setTime] = useState('');

  useEffect(() => {
    const updateTime = () => {
      setTime(new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);

    const handleKeys = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setWindows(prev => ({ ...prev, palette: !prev.palette }));
      }
      if (e.key === 'Escape') setWindows(prev => ({ ...prev, palette: false }));
    };
    window.addEventListener('keydown', handleKeys);

    return () => {
      clearInterval(interval);
      window.removeEventListener('keydown', handleKeys);
    };
  }, []);

  const toggleWindow = (id: string) => {
    setWindows(prev => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="relative h-screen w-full bg-[#050505] overflow-hidden font-sans select-none">
      {/* ── Desktop Wallpaper ── */}
      <div 
        className="absolute inset-0 bg-cover bg-center transition-all duration-1000"
        style={{ backgroundImage: "url('/gravity_desktop_bg_1776719726770.png')" }}
      >
        <div className="absolute inset-0 bg-black/20 backdrop-blur-[2px]" />
      </div>

      {/* ── OS Layer ── */}
      <div className="relative z-10 flex flex-col h-full">
        
        {/* Menu Bar */}
        <header className="h-8 bg-black/30 backdrop-blur-md border-b border-white/5 flex items-center justify-between px-4 text-[12px] font-semibold text-white/80">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <Zap className="w-3.5 h-3.5 text-white" />
              <span className="font-extrabold tracking-tighter">GRAVITY OS</span>
            </div>
            <div className="flex gap-4 opacity-60">
                <span>Hub</span>
                <span>Mission</span>
                <span>Telemetry</span>
                <span>Window</span>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2 text-emerald-400">
               <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
               <span className="text-[10px] font-black uppercase tracking-widest">Active</span>
            </div>
            <div className="flex items-center gap-4 opacity-80">
               <Wifi className="w-3.5 h-3.5" />
               <Battery className="w-3.5 h-3.5" />
               <span className="font-mono text-[11px]">{time}</span>
            </div>
          </div>
        </header>

        {/* Desktop Content */}
        <main className="flex-1 relative p-10">
          <AnimatePresence>
            {/* Cortex Monitor */}
            <DesktopWindow 
              id="cortex" 
              title="Cortex Core v5.2" 
              isOpen={windows.cortex} 
              onClose={() => toggleWindow('cortex')}
              icon={<Activity className="w-3 h-3" />}
            >
              <div className="space-y-6">
                <div className="flex items-end justify-between">
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-widest opacity-40 mb-1">Environmental Temp</div>
                    <div className="text-6xl font-black tracking-tighter">24.5°</div>
                  </div>
                  <div className="text-right">
                    <div className="px-2 py-1 rounded bg-cyan-500/10 text-cyan-400 text-[10px] font-black border border-cyan-500/20 mb-2">DRY MODE</div>
                    <div className="text-[11px] opacity-40 font-mono">Humidity: 62%</div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 mt-8">
                  <div className="p-4 rounded-2xl bg-white/5 border border-white/5 group hover:border-white/20 transition-all cursor-pointer">
                    <Wind className="w-4 h-4 text-blue-400 mb-2" />
                    <div className="text-sm font-bold">Panasonic AC</div>
                    <div className="text-[10px] opacity-40 uppercase font-black">Running · 24°C</div>
                  </div>
                  <div className="p-4 rounded-2xl bg-white/5 border border-white/5 group hover:border-white/20 transition-all cursor-pointer">
                    <Lightbulb className="w-4 h-4 text-amber-400 mb-2" />
                    <div className="text-sm font-bold">Bedroom Light</div>
                    <div className="text-[10px] opacity-40 uppercase font-black">OFF · 0%</div>
                  </div>
                </div>
                
                <button className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm transition-all shadow-lg shadow-indigo-900/40">
                  OPTIMIZE CORTEX
                </button>
              </div>
            </DesktopWindow>

            {/* Sentry Feed */}
            <DesktopWindow 
              id="sentry" 
              title="Ghost Sentry: Live Feed" 
              isOpen={windows.sentry} 
              onClose={() => toggleWindow('sentry')} 
              width="w-[500px]"
              icon={<Shield className="w-3 h-3" />}
            >
              <div className="space-y-4">
                <div className="relative rounded-xl overflow-hidden border border-white/10 group">
                  <img src="/sentry_feed_mockup_1776719774092.png" alt="Sentry" className="w-full grayscale group-hover:grayscale-0 transition-all duration-700" />
                  <div className="absolute top-3 left-3 flex gap-2">
                    <div className="px-2 py-0.5 bg-red-600 text-[9px] font-black text-white rounded-sm animate-pulse">REC</div>
                    <div className="px-2 py-0.5 bg-black/60 text-[9px] font-black text-white rounded-sm backdrop-blur">1080P | 24FPS</div>
                  </div>
                  <div className="absolute bottom-3 right-3 text-[9px] font-mono text-white/40 tracking-tighter">CAM_ID: MBP_01_SEC_HUB</div>
                </div>
                <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/5">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center">
                       <Bot className="w-4 h-4 text-emerald-400" />
                    </div>
                    <div>
                      <div className="text-[11px] font-bold">IDENTITY VERIFIED</div>
                      <div className="text-[9px] opacity-40 uppercase font-black">User: Master · 98% Match</div>
                    </div>
                  </div>
                  <button className="text-[10px] font-bold opacity-30 hover:opacity-100 transition-opacity">ARCHIVE →</button>
                </div>
              </div>
            </DesktopWindow>

            {/* Slab Guardian */}
            <DesktopWindow 
              id="energy" 
              title="Slab Guardian" 
              isOpen={windows.energy} 
              onClose={() => toggleWindow('energy')}
              width="w-[300px]"
              icon={<Zap className="w-3 h-3" />}
            >
              <div className="space-y-6">
                <div>
                   <div className="text-[10px] font-black uppercase tracking-widest opacity-40 mb-1">Est. Current Bill</div>
                   <div className="text-4xl font-black tracking-tighter">₹ 1,248.50</div>
                   <div className="text-[11px] text-amber-500 font-bold mt-1 tracking-tight">Slab threshold warning</div>
                </div>

                <div className="space-y-3">
                   <div className="flex justify-between text-[11px] font-bold">
                      <span className="opacity-40">Monthly Units</span>
                      <span>162 kWh</span>
                   </div>
                   <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }} animate={{ width: '68%' }}
                        className="h-full bg-indigo-500 shadow-[0_0_12px_rgba(99,102,241,0.6)]" 
                      />
                   </div>
                </div>

                <p className="text-[10px] leading-relaxed opacity-40 italic">
                  "Your energy usage is 12% higher than last Tuesday. Recommended: Set AC to 26°C for next 2 hours."
                </p>
                
                <button className="w-full py-2.5 rounded-xl border border-white/10 hover:bg-white/5 text-[11px] font-bold transition-all uppercase tracking-widest">
                  View Analytics
                </button>
              </div>
            </DesktopWindow>
          </AnimatePresence>

          {/* Command Palette Layer */}
          <AnimatePresence>
            {windows.palette && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="absolute inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
              >
                <div className="w-full max-w-[600px] bg-[#12121e] border border-white/10 rounded-2xl shadow-[0_40px_120px_rgba(0,0,0,0.8)] overflow-hidden">
                  <div className="px-6 py-5 border-b border-white/5 flex items-center gap-4">
                     <Search className="w-6 h-6 text-indigo-400" />
                     <input 
                       autoFocus
                       type="text" 
                       placeholder="Launch a mission or device command..."
                       className="w-full bg-transparent border-none outline-none text-xl font-medium placeholder:text-white/10"
                     />
                  </div>
                  <div className="max-h-[300px] overflow-y-auto p-2">
                    <CommandItem icon={<Wind />} title="Turn AC On" sub="Panasonic Master Unit" shortcut="⌘⇧A" />
                    <CommandItem icon={<Lightbulb />} title="Midnight Scene" sub="Dim lights to 5%" shortcut="⌘⇧N" />
                    <CommandItem icon={<Tv />} title="System Sleep" sub="Lock Mac & Turn off Hub" shortcut="⌘⇧L" />
                  </div>
                  <div className="px-4 py-2 bg-black/40 border-t border-white/5 flex justify-between items-center text-[10px] font-black uppercase text-white/20 tracking-widest">
                     <div className="flex gap-4">
                        <span>↑↓ Navigate</span>
                        <span>↵ Select</span>
                     </div>
                     <span>Gravity Omni Palette</span>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </main>

        {/* Dock */}
        <footer className="h-16 mb-4 flex items-center justify-center">
          <div className="px-4 py-3 bg-white/5 backdrop-blur-2xl border border-white/10 rounded-2xl flex items-center gap-4 shadow-2xl">
            <DockItem icon={<Zap className="w-6 h-6" />} active onClick={() => {}} />
            <DockItem icon={<Activity className="w-6 h-6" />} onClick={() => toggleWindow('cortex')} />
            <DockItem icon={<Shield className="w-6 h-6" />} onClick={() => toggleWindow('sentry')} />
            <DockItem icon={<History className="w-6 h-6" />} onClick={() => {}} />
            <div className="w-[1px] h-6 bg-white/10 mx-1" />
            <DockItem icon={<Settings className="w-6 h-6" />} onClick={() => {}} />
          </div>
        </footer>

      </div>
    </div>
  );
}

function CommandItem({ icon, title, sub, shortcut }: any) {
  return (
    <div className="w-full px-4 py-3 rounded-xl hover:bg-white/5 flex items-center justify-between group cursor-pointer transition-all">
      <div className="flex items-center gap-4">
        <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center group-hover:bg-indigo-500/20 group-hover:text-indigo-400 transition-all">
          {React.cloneElement(icon, { size: 18 })}
        </div>
        <div className="text-left">
          <div className="text-sm font-bold text-white group-hover:text-indigo-300 transition-colors">{title}</div>
          <div className="text-[10px] opacity-40 uppercase font-black">{sub}</div>
        </div>
      </div>
      <div className="px-2 py-1 bg-white/5 rounded text-[10px] font-mono text-white/20 group-hover:text-white/60 transition-colors uppercase">
        {shortcut}
      </div>
    </div>
  );
}

function DockItem({ icon, active, onClick }: any) {
  return (
    <button 
      onClick={onClick}
      className={`relative w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-300 hover:scale-125 hover:-translate-y-2 ${active ? 'bg-indigo-600/20 text-indigo-400' : 'bg-white/5 text-white/40 hover:bg-white/10 hover:text-white'}`}
    >
      {icon}
      {active && <div className="absolute -bottom-1.5 w-1 h-1 rounded-full bg-indigo-400 shadow-[0_0_8px_rgba(129,140,248,0.8)]" />}
    </button>
  );
}

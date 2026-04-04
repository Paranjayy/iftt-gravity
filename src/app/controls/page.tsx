'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Tv, Lightbulb, Wind, Send, Laptop, Monitor,
  Power, Thermometer, Sun, Moon, Film, Briefcase,
  Globe, Wifi, WifiOff, ChevronRight, Zap, Clock
} from 'lucide-react';

// --- Scenes ---
const scenes = [
  {
    id: 'movie',
    name: 'Movie Mode',
    icon: Film,
    color: 'from-purple-600 to-indigo-700',
    glow: 'shadow-purple-500/20',
    actions: ['TV on', 'Lights dim 15%', 'AC set 23°C'],
  },
  {
    id: 'work',
    name: 'Work Mode',
    icon: Briefcase,
    color: 'from-blue-600 to-cyan-700',
    glow: 'shadow-blue-500/20',
    actions: ['Lights 100%', 'AC 22°C', 'PC Wake'],
  },
  {
    id: 'sleep',
    name: 'Sleep Mode',
    icon: Moon,
    color: 'from-slate-700 to-slate-900',
    glow: 'shadow-slate-500/20',
    actions: ['Lights off', 'AC 26°C fan-only', 'TV off'],
  },
  {
    id: 'away',
    name: 'Away Mode',
    icon: Globe,
    color: 'from-rose-600 to-pink-700',
    glow: 'shadow-rose-500/20',
    actions: ['All lights off', 'AC off', 'PC sleep'],
  },
];

// --- Quick Controls ---
const quickControls = [
  { id: 'bulb', name: 'Main Bulb', icon: Lightbulb, type: 'toggle', state: true, color: 'text-amber-400', bg: 'bg-amber-400/10 border-amber-400/20' },
  { id: 'ac', name: 'Panasonic AC', icon: Wind, type: 'toggle', state: true, color: 'text-emerald-400', bg: 'bg-emerald-400/10 border-emerald-400/20' },
  { id: 'tv', name: 'Samsung TV', icon: Tv, type: 'toggle', state: false, color: 'text-blue-400', bg: 'bg-blue-400/10 border-blue-400/20' },
  { id: 'monitor', name: 'Smart Monitor', icon: Monitor, type: 'toggle', state: false, color: 'text-violet-400', bg: 'bg-violet-400/10 border-violet-400/20' },
];

export default function QuickControls() {
  const [controls, setControls] = useState(quickControls);
  const [activeScene, setActiveScene] = useState<string | null>(null);
  const [acTemp, setAcTemp] = useState(23);
  const [brightness, setBrightness] = useState(60);
  const [isOnline, setIsOnline] = useState(true);

  const toggle = (id: string) => {
    setControls(c => c.map(ctrl => ctrl.id === id ? { ...ctrl, state: !ctrl.state } : ctrl));
  };

  const activateScene = (sceneId: string) => {
    setActiveScene(sceneId === activeScene ? null : sceneId);
    // In Phase 2: this will call /api/scenes/activate with the scene ID
  };

  return (
    <div className="min-h-screen bg-[#0a0a0c] text-slate-200 p-6 md:p-10">
      {/* Header */}
      <div className="flex items-center justify-between mb-10">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs text-slate-500 uppercase tracking-widest">
              {isOnline ? 'Remote Access Active' : 'Local Only'}
            </span>
          </div>
          <h1 className="text-2xl font-bold text-white">Quick Controls</h1>
        </div>
        <button
          onClick={() => setIsOnline(!isOnline)}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-medium transition-all ${
            isOnline
              ? 'bg-emerald-400/10 border-emerald-400/20 text-emerald-400'
              : 'bg-slate-800/50 border-slate-700/50 text-slate-500'
          }`}
        >
          {isOnline ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
          {isOnline ? 'Remote' : 'Local'}
        </button>
      </div>

      {/* Scenes */}
      <section className="mb-8">
        <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">Scenes</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {scenes.map((scene) => (
            <motion.button
              key={scene.id}
              whileTap={{ scale: 0.97 }}
              onClick={() => activateScene(scene.id)}
              className={`relative overflow-hidden p-4 rounded-2xl border text-left transition-all ${
                activeScene === scene.id
                  ? `bg-gradient-to-br ${scene.color} border-transparent shadow-xl ${scene.glow}`
                  : 'bg-[#121218] border-slate-800/50 hover:border-slate-700/50'
              }`}
            >
              <scene.icon className={`w-5 h-5 mb-3 ${activeScene === scene.id ? 'text-white' : 'text-slate-400'}`} />
              <div className={`font-semibold text-sm mb-1 ${activeScene === scene.id ? 'text-white' : 'text-slate-300'}`}>
                {scene.name}
              </div>
              <div className={`text-[10px] ${activeScene === scene.id ? 'text-white/60' : 'text-slate-600'}`}>
                {scene.actions.length} actions
              </div>
              {activeScene === scene.id && (
                <motion.div
                  layoutId="scene-indicator"
                  className="absolute top-3 right-3 w-2 h-2 rounded-full bg-white"
                />
              )}
            </motion.button>
          ))}
        </div>
      </section>

      {/* Quick Toggles */}
      <section className="mb-8">
        <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">Devices</h2>
        <div className="grid grid-cols-2 gap-3">
          {controls.map((ctrl) => (
            <motion.button
              key={ctrl.id}
              whileTap={{ scale: 0.97 }}
              onClick={() => toggle(ctrl.id)}
              className={`flex items-center gap-4 p-4 rounded-2xl border transition-all ${
                ctrl.state
                  ? `${ctrl.bg} ${ctrl.color}`
                  : 'bg-[#121218] border-slate-800/50 text-slate-600'
              }`}
            >
              <ctrl.icon className="w-5 h-5 shrink-0" />
              <div className="text-left">
                <div className="text-sm font-medium">{ctrl.name}</div>
                <div className="text-[10px] opacity-60">{ctrl.state ? 'On' : 'Off'}</div>
              </div>
              <div className={`ml-auto w-9 h-5 rounded-full relative transition-colors shrink-0 ${ctrl.state ? 'bg-current/40' : 'bg-slate-800'}`}>
                <div className={`absolute top-1 w-3 h-3 rounded-full bg-current transition-all ${ctrl.state ? 'right-1' : 'left-1 bg-slate-600'}`} />
              </div>
            </motion.button>
          ))}
        </div>
      </section>

      {/* AC Temp Slider */}
      <section className="mb-8">
        <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">AC Temperature</h2>
        <div className="p-5 rounded-2xl bg-[#121218] border border-slate-800/50">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Wind className="w-5 h-5 text-emerald-400" />
              <span className="font-medium text-white">Panasonic Miraie</span>
            </div>
            <span className="text-2xl font-black text-emerald-400">{acTemp}°C</span>
          </div>
          <input
            type="range" min={16} max={30} value={acTemp}
            onChange={e => setAcTemp(Number(e.target.value))}
            className="w-full h-2 bg-slate-800 rounded-full appearance-none cursor-pointer accent-emerald-500"
          />
          <div className="flex justify-between text-xs text-slate-600 mt-2">
            <span>16°C</span><span>30°C</span>
          </div>
        </div>
      </section>

      {/* Bulb Brightness */}
      <section className="mb-8">
        <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">Light Brightness</h2>
        <div className="p-5 rounded-2xl bg-[#121218] border border-slate-800/50">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Lightbulb className="w-5 h-5 text-amber-400" />
              <span className="font-medium text-white">Philips WiZ A70</span>
            </div>
            <span className="text-2xl font-black text-amber-400">{brightness}%</span>
          </div>
          <input
            type="range" min={10} max={100} value={brightness}
            onChange={e => setBrightness(Number(e.target.value))}
            className="w-full h-2 bg-slate-800 rounded-full appearance-none cursor-pointer accent-amber-500"
          />
          <div className="flex justify-between text-xs text-slate-600 mt-2">
            <span>Dim</span><span>Full</span>
          </div>
        </div>
      </section>

      {/* Remote Access Banner */}
      <section>
        <div className="p-5 rounded-2xl bg-gradient-to-r from-indigo-900/40 to-violet-900/40 border border-indigo-500/20">
          <div className="flex items-start gap-4">
            <Globe className="w-5 h-5 text-indigo-400 mt-0.5 shrink-0" />
            <div>
              <div className="font-semibold text-white mb-1">Remote Access</div>
              <div className="text-xs text-slate-400 mb-3">
                Control your home from anywhere. Run <code className="bg-slate-800 px-1.5 py-0.5 rounded text-indigo-300">./tunnel.sh</code> on your Mac to get a public HTTPS URL.
              </div>
              <div className="text-[10px] text-indigo-400/60 flex items-center gap-1.5">
                <Zap className="w-3 h-3" /> Powered by Cloudflare Tunnel — free, no port forwarding needed
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Tv, 
  Lightbulb, 
  Wind, 
  Send, 
  Laptop, 
  Plus, 
  Activity, 
  Settings, 
  Zap,
  LayoutDashboard,
  Boxes,
  History
} from 'lucide-react';

const devices = [
  { id: '1', name: 'Samsung Smart TV', icon: Tv, provider: 'SmartThings', status: 'Online', color: 'text-blue-400' },
  { id: '2', name: 'Panasonic Smart AC', icon: Wind, provider: 'Miraie', status: 'Active', color: 'text-emerald-400' },
  { id: '3', name: 'Bedroom Light', icon: Lightbulb, provider: 'Wiz 2.0', status: 'Off', color: 'text-amber-400' },
  { id: '4', name: 'Main Telegram Bot', icon: Send, provider: 'Telegram', status: 'Active', color: 'text-sky-400' },
  { id: '5', name: 'Development PC', icon: Laptop, provider: 'Local Agent', status: 'Standby', color: 'text-indigo-400' },
];

const automations = [
  { id: 'a1', name: 'Movie Mode', trigger: 'TV Turned On', action: 'Dim Bedroom Light', active: true },
  { id: 'a2', name: 'AC Automation', trigger: 'Temp > 28°C', action: 'Set AC to 24°C', active: true },
  { id: 'a3', name: 'Telegram Alerts', trigger: 'Device Offline', action: 'Send Telegram Message', active: false },
];

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState('dashboard');

  return (
    <div className="flex h-screen bg-[#0a0a0c] text-slate-200 overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 border-r border-slate-800/50 bg-[#0d0d12] flex flex-col p-6">
        <div className="flex items-center gap-3 mb-10 px-2">
          <div className="w-8 h-8 rounded-lg bg-indigo-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <Zap className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-bold tracking-tight text-white">Gravity</span>
        </div>

        <nav className="space-y-2 flex-grow">
          <NavItem active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} icon={LayoutDashboard} label="Dashboard" />
          <NavItem active={activeTab === 'automations'} onClick={() => setActiveTab('automations')} icon={Boxes} label="Automations" />
          <NavItem active={activeTab === 'devices'} onClick={() => setActiveTab('devices')} icon={Activity} label="Device Sync" />
          <NavItem active={activeTab === 'history'} onClick={() => setActiveTab('history')} icon={History} label="Activity Log" />
        </nav>

        <div className="mt-auto pt-6 border-t border-slate-800/50">
          <NavItem active={false} icon={Settings} label="Settings" />
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto relative">
        {/* Background glow */}
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-indigo-600/5 blur-[120px] rounded-full -translate-y-1/2 translate-x-1/2" />
        
        <header className="p-8 pb-0 flex justify-between items-center relative z-10">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">My Ecosystem</h1>
            <p className="text-slate-400 text-sm">Managing {devices.length} connected services</p>
          </div>
          <button className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2.5 rounded-xl transition-all shadow-lg shadow-indigo-600/20 font-medium">
            <Plus className="w-4 h-4" />
            New Automation
          </button>
        </header>

        <section className="p-8 grid grid-cols-1 lg:grid-cols-3 gap-6 relative z-10">
          {/* Active Devices */}
          <div className="lg:col-span-2 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {devices.map((device) => (
                <div key={device.id} className="p-4 rounded-2xl bg-[#121218] border border-slate-800/50 hover:border-slate-700/50 transition-all group">
                  <div className="flex items-start justify-between mb-4">
                    <div className={`p-3 rounded-xl bg-slate-900 border border-slate-800 ${device.color} shadow-inner`}>
                      <device.icon className="w-5 h-5" />
                    </div>
                    <span className={`text-[10px] px-2 py-1 rounded-full bg-slate-900 border border-slate-800 font-medium ${device.status === 'Online' || device.status === 'Active' ? 'text-emerald-400' : 'text-slate-500'}`}>
                      {device.status}
                    </span>
                  </div>
                  <h3 className="font-semibold text-white mb-1 group-hover:text-indigo-400 transition-colors">{device.name}</h3>
                  <p className="text-xs text-slate-500 uppercase tracking-widest">{device.provider}</p>
                </div>
              ))}
            </div>

            <div className="p-6 rounded-2xl bg-[#121218] border border-slate-800/50">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-bold text-white">Quick Flow Runner</h2>
                <div className="text-xs text-slate-500 flex items-center gap-2">
                  <Activity className="w-3 h-3 text-emerald-500" />
                  System Health: Stable
                </div>
              </div>
              <div className="space-y-3">
                {automations.map((automation) => (
                  <div key={automation.id} className="flex items-center justify-between p-4 rounded-xl bg-slate-900/50 border border-slate-800/30">
                    <div className="flex items-center gap-4">
                      <div className={`w-2 h-2 rounded-full ${automation.active ? 'bg-indigo-500 shadow-lg shadow-indigo-500/50' : 'bg-slate-700'}`} />
                      <div>
                        <div className="text-sm font-medium text-white">{automation.name}</div>
                        <div className="text-xs text-slate-500">{automation.trigger} → {automation.action}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-5 rounded-full relative transition-colors cursor-pointer ${automation.active ? 'bg-indigo-600' : 'bg-slate-800'}`}>
                        <div className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-all ${automation.active ? 'right-1' : 'left-1'}`} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Stats & Integrations */}
          <div className="space-y-6">
            <div className="p-6 rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-700 shadow-xl shadow-indigo-900/10 text-white relative overflow-hidden group">
              <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_50%_120%,rgba(255,255,255,0.2),transparent)] opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />
              <div className="relative z-10">
                <h3 className="text-sm font-medium text-indigo-100 mb-4 flex items-center gap-2">
                  <Activity className="w-4 h-4" /> Usage Stats
                </h3>
                <div className="text-4xl font-black mb-1">1,204</div>
                <div className="text-xs text-indigo-200 mb-6 uppercase tracking-wider">Triggers fired this month</div>
                <div className="h-2 w-full bg-indigo-900/40 rounded-full overflow-hidden">
                  <div className="h-full bg-white w-2/3 rounded-full" />
                </div>
              </div>
            </div>

            <div className="p-6 rounded-2xl bg-[#121218] border border-slate-800/50">
              <h3 className="text-sm font-bold text-white mb-4">Pending Setup</h3>
              <div className="space-y-4">
                <IntegrationRequest name="Jio Setup Box" provider="Google Home" />
                <IntegrationRequest name="Mi Smart TV" provider="Chromecast" />
                <IntegrationRequest name="Miraie Cloud" provider="Panasonic Account" />
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

function NavItem({ icon: Icon, label, active, onClick }: { icon: any, label: string, active: boolean, onClick?: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-300 font-medium text-sm group ${
        active 
          ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' 
          : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 border border-transparent'
      }`}
    >
      <Icon className={`w-4 h-4 transition-transform group-hover:scale-110 ${active ? 'text-indigo-400' : 'text-slate-500 group-hover:text-slate-300'}`} />
      {label}
    </button>
  );
}

function IntegrationRequest({ name, provider }: { name: string, provider: string }) {
  return (
    <div className="flex items-center justify-between group cursor-pointer">
      <div>
        <div className="text-sm font-medium text-slate-300 group-hover:text-indigo-400 transition-colors">{name}</div>
        <div className="text-[10px] text-slate-500 uppercase tracking-wider">{provider}</div>
      </div>
      <Plus className="w-4 h-4 text-slate-600 group-hover:text-slate-300" />
    </div>
  );
}

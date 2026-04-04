'use client';

import { useState, useCallback } from 'react';
import { 
  ReactFlow, 
  Background, 
  Controls, 
  useNodesState, 
  useEdgesState, 
  addEdge,
  Connection,
  Edge,
  MarkerType
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

const initialNodes = [
  { 
    id: 'trigger-1', 
    type: 'input',
    data: { label: 'Samsung TV: Power On' }, 
    position: { x: 250, y: 5 },
    className: 'bg-[#1e1e24] text-white border-blue-500 rounded-xl p-4 shadow-lg w-64'
  },
  { 
    id: 'action-1', 
    data: { label: 'Bedroom Light: Dim to 20%' }, 
    position: { x: 250, y: 150 },
    className: 'bg-[#1e1e24] text-white border-amber-500 rounded-xl p-4 shadow-lg w-64'
  },
  { 
    id: 'action-2', 
    type: 'output',
    data: { label: 'Telegram: Send Notification' }, 
    position: { x: 250, y: 300 },
    className: 'bg-[#1e1e24] text-white border-sky-500 rounded-xl p-4 shadow-lg w-64'
  },
];

const initialEdges = [
  { id: 'e1-2', source: 'trigger-1', target: 'action-1', animated: true, markerEnd: { type: MarkerType.ArrowClosed, color: '#6366f1' }, style: { stroke: '#6366f1' } },
  { id: 'e2-3', source: 'action-1', target: 'action-2', animated: true, markerEnd: { type: MarkerType.ArrowClosed, color: '#6366f1' }, style: { stroke: '#6366f1' } },
];

export default function FlowEditor() {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes as any);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges as any);

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  return (
    <div className="h-screen w-full bg-[#0a0a0c] relative">
      <div className="absolute top-6 left-6 z-10 flex items-center gap-4">
        <button className="bg-slate-900 border border-slate-800 text-slate-400 p-2 rounded-xl hover:text-white transition-colors"
          onClick={() => window.history.back()}
        >
          Back
        </button>
        <span className="text-xl font-bold text-white tracking-tight">Ecosystem Flow: Movie Mode</span>
      </div>

      <div className="absolute top-6 right-6 z-10">
        <button className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2 rounded-xl shadow-lg transition-all font-medium">
          Deploy Automation
        </button>
      </div>

      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        fitView
      >
        <Background color="#1e1e24" gap={16} />
        <Controls showInteractive={false} className="bg-slate-900 border border-slate-800 fill-white !p-2 !rounded-xl !shadow-2xl" />
      </ReactFlow>

      {/* Node Catalog Sidebar */}
      <div className="absolute top-24 left-6 bottom-6 w-72 bg-[#121218]/80 backdrop-blur-xl border border-slate-800/50 rounded-2xl p-6 z-10 shadow-2xl">
        <h3 className="text-sm font-bold text-white mb-6 uppercase tracking-widest text-slate-400">Node Catalog</h3>
        <div className="space-y-6">
          <NodeGroup title="Triggers" items={[
            { name: 'TV Turned On', provider: 'SmartThings', color: 'bg-blue-500' },
            { name: 'Time of Day', provider: 'System', color: 'bg-slate-500' },
            { name: 'Device Offline', provider: 'Watchdog', color: 'bg-rose-500' }
          ]} />
          
          <NodeGroup title="Panasonic Miraie" items={[
            { name: 'AC Power On', provider: 'Miraie', color: 'bg-emerald-500' },
            { name: 'Set Temperature', provider: 'Miraie', color: 'bg-emerald-500' }
          ]} />

          <NodeGroup title="Notifications" items={[
            { name: 'Send TG Message', provider: 'Telegram', color: 'bg-sky-500' },
            { name: 'Push Notification', provider: 'App', color: 'bg-indigo-500' }
          ]} />
        </div>
      </div>
    </div>
  );
}

function NodeGroup({ title, items }: { title: string, items: any[] }) {
  return (
    <div>
      <h4 className="text-[10px] font-black text-slate-600 uppercase mb-3 tracking-wider">{title}</h4>
      <div className="space-y-2">
        {items.map((item, i) => (
          <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-slate-900/50 border border-slate-800/30 hover:border-slate-700/50 cursor-grab active:cursor-grabbing transition-all group">
            <div className={`w-2 h-2 rounded-full ${item.color}`} />
            <div className="text-xs font-medium text-slate-300 group-hover:text-white transition-colors">{item.name}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

'use client';

import { useState } from 'react';
import {
  Brain,
  Cpu,
  GitCompare,
  Target,
  Layers,
  Activity,
  Database,
  Radio,
  Wifi,
  BarChart3,
  Shield,
  Zap,
  ChevronRight,
} from 'lucide-react';
import { AlgorithmFlow } from '@/components/engine/algorithm-flow';
import { IngestorPanel } from '@/components/ingestors/ingestor-panel';
import { AlgorithmModules } from '@/components/algorithms/algorithm-modules';

const BP = {
  bg: '#1C2127',
  bgAlt: '#252A31',
  border: '#2F343C',
  text: '#F6F7F9',
  textMuted: '#8F99A8',
  textDim: '#5F6B7C',
  blue: '#2D72D2',
  green: '#238551',
  orange: '#C87619',
  red: '#CD4246',
  purple: '#7C3AED',
  cyan: '#0EA5E9',
};

type TabId = 'pipeline' | 'algorithms' | 'ingestors';

const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: 'pipeline', label: 'Pipeline', icon: <Cpu className="w-3.5 h-3.5" /> },
  { id: 'algorithms', label: 'Algorithms', icon: <Brain className="w-3.5 h-3.5" /> },
  { id: 'ingestors', label: 'Ingestors', icon: <Database className="w-3.5 h-3.5" /> },
];

export default function Home() {
  const [activeTab, setActiveTab] = useState<TabId>('pipeline');

  return (
    <div className="h-screen bg-[#1C2127] text-[#F6F7F9] overflow-hidden flex flex-col">
      {/* Header */}
      <header className="flex-shrink-0 h-12 flex items-center justify-between px-5 bg-[#252A31] border-b border-[#2F343C]">
        <div className="flex items-center gap-3">
          <Shield className="w-5 h-5" style={{ color: BP.blue }} />
          <div>
            <h1 className="text-sm font-semibold text-[#F6F7F9]">
              BigDunc Engine
            </h1>
          </div>
          <span className="text-[10px] text-[#5F6B7C] border border-[#2F343C] rounded px-1.5 py-0.5">
            Algorithm Platform
          </span>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
            <span className="text-[10px] text-[#8F99A8]">6 algorithms active</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 bg-blue-500 rounded-full" />
            <span className="text-[10px] text-[#8F99A8]">4 ingestors connected</span>
          </div>
        </div>
      </header>

      {/* Tab Navigation */}
      <div className="flex-shrink-0 h-10 flex items-center gap-1 px-5 bg-[#1C2127] border-b border-[#2F343C]">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-md text-xs font-medium transition-colors ${
              activeTab === tab.id
                ? 'bg-[#2F343C] text-[#F6F7F9]'
                : 'text-[#8F99A8] hover:text-[#F6F7F9] hover:bg-[#252A31]'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'pipeline' && <AlgorithmFlow />}
        {activeTab === 'algorithms' && <AlgorithmModules />}
        {activeTab === 'ingestors' && <IngestorPanel />}
      </div>
    </div>
  );
}

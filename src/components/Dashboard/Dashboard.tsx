'use client';

import { useState } from 'react';
import type { AuditResult } from '@/lib/types';
import ExportButton from './ExportButton';
import { 
  SummaryTab, 
  StructureTab, 
  ContentArchitectureTab, 
  ReusabilityTab, 
  PerformanceTab,
  RoadmapTab,
  InsightsTab
} from './tabs';

interface DashboardProps {
  result: AuditResult;
  onDisconnect: () => void;
}

type TabType = 'summary' | 'structure' | 'architecture' | 'reusability' | 'performance' | 'insights' | 'roadmap';

const tabs = [
  { id: 'summary' as TabType, label: 'Summary', icon: '📊' },
  { id: 'structure' as TabType, label: 'Structure', icon: '🏗️' },
  { id: 'architecture' as TabType, label: 'Content', icon: '📁' },
  { id: 'reusability' as TabType, label: 'Reusability', icon: '♻️' },
  { id: 'performance' as TabType, label: 'Performance', icon: '⚡' },
  { id: 'insights' as TabType, label: 'Insights', icon: '💡' },
  { id: 'roadmap' as TabType, label: 'Roadmap', icon: '🗺️' },
];

export default function Dashboard({ result, onDisconnect }: DashboardProps) {
  const [activeTab, setActiveTab] = useState<TabType>('summary');
  
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-2 rounded-lg bg-gradient-to-br from-purple-500 to-cyan-500">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <div>
                <h1 className="font-bold text-lg">Content Strategy Audit</h1>
                <p className="text-xs text-muted-foreground truncate max-w-md">
                  {result.connectionInfo.endpoint}
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <ExportButton result={result} />
              <button
                onClick={onDisconnect}
                className="btn-secondary text-sm py-2 px-4"
              >
                New Audit
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      <nav className="border-b border-border bg-card/30">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex gap-1 overflow-x-auto">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-3 text-sm font-medium transition-colors border-b-2 whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'border-purple-500 text-purple-400'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                <span className="mr-2">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-6 py-8">
          <div className="animate-fade-in">
          {activeTab === 'summary' && <SummaryTab result={result} />}
          {activeTab === 'structure' && <StructureTab result={result} />}
          {activeTab === 'architecture' && <ContentArchitectureTab result={result} />}
          {activeTab === 'reusability' && <ReusabilityTab result={result} />}
          {activeTab === 'performance' && <PerformanceTab result={result} />}
          {activeTab === 'insights' && <InsightsTab result={result} />}
          {activeTab === 'roadmap' && <RoadmapTab result={result} />}
          </div>
      </main>
      
      {/* Footer */}
      <footer className="border-t border-border py-4 mt-8">
        <div className="max-w-6xl mx-auto px-6 text-center text-xs text-muted-foreground">
          Audit completed {result.connectionInfo.connectedAt.toLocaleString()}
        </div>
      </footer>
    </div>
  );
}

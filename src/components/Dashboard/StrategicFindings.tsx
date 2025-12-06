'use client';

import type { StrategicFinding } from '@/lib/types';

interface StrategicFindingsProps {
  findings: StrategicFinding[];
}

const categoryStyles: Record<string, { bg: string; border: string; icon: string }> = {
  editorial: { bg: 'bg-purple-500/10', border: 'border-purple-500/30', icon: '✏️' },
  reusability: { bg: 'bg-cyan-500/10', border: 'border-cyan-500/30', icon: '🔄' },
  performance: { bg: 'bg-amber-500/10', border: 'border-amber-500/30', icon: '⚡' },
  governance: { bg: 'bg-blue-500/10', border: 'border-blue-500/30', icon: '📋' },
  architecture: { bg: 'bg-rose-500/10', border: 'border-rose-500/30', icon: '🏗️' },
  naming: { bg: 'bg-indigo-500/10', border: 'border-indigo-500/30', icon: '🏷️' },
  validation: { bg: 'bg-teal-500/10', border: 'border-teal-500/30', icon: '✓' },
};

const effortLabels = {
  low: { label: 'Low Effort', class: 'bg-green-500/20 text-green-400' },
  medium: { label: 'Medium Effort', class: 'bg-yellow-500/20 text-yellow-400' },
  high: { label: 'High Effort', class: 'bg-red-500/20 text-red-400' },
};

const valueLabels = {
  low: { label: 'Low Impact', class: 'text-muted-foreground' },
  medium: { label: 'Medium Impact', class: 'text-yellow-400' },
  high: { label: 'High Impact', class: 'text-green-400' },
};

export default function StrategicFindings({ findings }: StrategicFindingsProps) {
  if (findings.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p>No strategic findings to display. Your schema is well-optimized!</p>
      </div>
    );
  }
  
  return (
    <div className="space-y-4">
      {findings.map((finding) => {
        const catStyle = categoryStyles[finding.category];
        const effort = effortLabels[finding.effort];
        const value = valueLabels[finding.businessValue];
        
        return (
          <div 
            key={finding.id} 
            className={`rounded-xl border ${catStyle.border} ${catStyle.bg} p-5 transition-all hover:shadow-lg`}
          >
            {/* Header */}
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{catStyle.icon}</span>
                <div>
                  <h3 className="font-semibold text-lg">{finding.headline}</h3>
                  <span className="text-xs text-muted-foreground capitalize">{finding.category}</span>
                </div>
              </div>
              <div className="flex gap-2">
                <span className={`px-2 py-0.5 rounded text-xs ${effort.class}`}>
                  {effort.label}
                </span>
                <span className={`px-2 py-0.5 rounded text-xs bg-card ${value.class}`}>
                  {value.label}
                </span>
              </div>
            </div>
            
            {/* Situation */}
            <div className="mb-4">
              <p className="text-sm text-muted-foreground leading-relaxed">
                {finding.situation}
              </p>
            </div>
            
            {/* Impact & Recommendation */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-card/50 rounded-lg p-3">
                <div className="text-xs font-medium text-amber-400 mb-1">Impact</div>
                <p className="text-sm text-muted-foreground">{finding.impact}</p>
              </div>
              <div className="bg-card/50 rounded-lg p-3">
                <div className="text-xs font-medium text-green-400 mb-1">Recommendation</div>
                <p className="text-sm text-muted-foreground">{finding.recommendation}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}


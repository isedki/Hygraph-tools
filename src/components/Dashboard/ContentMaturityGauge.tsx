'use client';

import { useState } from 'react';
import type { ContentMaturityAssessment, DimensionScore, ScoreContribution } from '@/lib/types';

interface ContentMaturityGaugeProps {
  assessment: ContentMaturityAssessment;
}

const LEVELS: { value: ContentMaturityAssessment['level']; label: ContentMaturityAssessment['label']; color: string }[] = [
  { value: 1, label: 'Chaotic', color: 'bg-rose-500' },
  { value: 2, label: 'Reactive', color: 'bg-amber-500' },
  { value: 3, label: 'Defined', color: 'bg-blue-500' },
  { value: 4, label: 'Managed', color: 'bg-emerald-500' },
  { value: 5, label: 'Optimized', color: 'bg-purple-500' },
];

const DIMENSION_LABELS: Record<string, { label: string; icon: string; tooltip: string }> = {
  structure: { 
    label: 'Structure', 
    icon: '🏗️',
    tooltip: 'Model organization, nesting depth, and duplication'
  },
  reuse: { 
    label: 'Reuse', 
    icon: '♻️',
    tooltip: 'Component utilization and pattern consistency'
  },
  governance: { 
    label: 'Editorial Clarity', 
    icon: '✏️',
    tooltip: 'Content/design separation, field intuitiveness, and documentation'
  },
  scalability: { 
    label: 'Scalability', 
    icon: '📈',
    tooltip: 'Growth readiness and complexity management'
  },
};

function ContributionBadge({ contribution }: { contribution: ScoreContribution }) {
  const isPositive = contribution.value > 0;
  const isNeutral = contribution.value === 0;
  
  return (
    <div className={`flex items-start gap-2 py-1.5 px-2 rounded text-xs ${
      isPositive ? 'bg-green-500/10' : isNeutral ? 'bg-gray-500/10' : 'bg-rose-500/10'
    }`}>
      <span className={`font-mono font-medium min-w-[3rem] ${
        isPositive ? 'text-green-400' : isNeutral ? 'text-gray-400' : 'text-rose-400'
      }`}>
        {isPositive ? '+' : ''}{contribution.value}
      </span>
      <div className="flex-1">
        <span className="text-foreground">{contribution.reason}</span>
        {contribution.details && (
          <p className="text-muted-foreground mt-0.5 text-[11px]">{contribution.details}</p>
        )}
      </div>
    </div>
  );
}

function DimensionCard({ 
  dimension, 
  summary, 
  expanded, 
  onToggle 
}: { 
  dimension: string; 
  summary: DimensionScore; 
  expanded: boolean;
  onToggle: () => void;
}) {
  const dimInfo = DIMENSION_LABELS[dimension] || { label: dimension, icon: '📊', tooltip: '' };
  const scoreColor = summary.score >= 70 ? 'text-green-400' : summary.score >= 50 ? 'text-amber-400' : 'text-rose-400';
  
  const bonuses = summary.breakdown.filter(c => c.value > 0);
  const penalties = summary.breakdown.filter(c => c.value < 0);
  const neutrals = summary.breakdown.filter(c => c.value === 0);

  return (
    <div className="rounded-lg border border-border/60 bg-background/60 overflow-hidden">
      <button 
        className="w-full p-4 flex items-center justify-between hover:bg-card/50 transition-colors"
        onClick={onToggle}
      >
        <div className="flex items-center gap-2">
          <span className="text-lg">{dimInfo.icon}</span>
          <h4 className="text-sm font-medium" title={dimInfo.tooltip}>{dimInfo.label}</h4>
        </div>
        <div className="flex items-center gap-3">
          <div className={`text-lg font-semibold ${scoreColor}`}>{summary.score}</div>
          <svg 
            className={`w-4 h-4 text-muted-foreground transition-transform ${expanded ? 'rotate-180' : ''}`}
            fill="none" 
            viewBox="0 0 24 24" 
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>
      
      <div className={`border-t border-border/40 ${expanded ? 'block' : 'hidden'}`}>
        <div className="p-4 space-y-3">
          <p className="text-sm text-muted-foreground">{summary.assessment}</p>
          
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="font-medium">Score Breakdown</span>
              <span className="text-[10px]">(starts at 100)</span>
            </div>
            
            {penalties.length > 0 && (
              <div className="space-y-1">
                {penalties.map((c, i) => (
                  <ContributionBadge key={`penalty-${i}`} contribution={c} />
                ))}
              </div>
            )}
            
            {bonuses.length > 0 && (
              <div className="space-y-1">
                {bonuses.map((c, i) => (
                  <ContributionBadge key={`bonus-${i}`} contribution={c} />
                ))}
              </div>
            )}
            
            {neutrals.length > 0 && penalties.length === 0 && bonuses.length === 0 && (
              <div className="space-y-1">
                {neutrals.map((c, i) => (
                  <ContributionBadge key={`neutral-${i}`} contribution={c} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ContentMaturityGauge({ assessment }: ContentMaturityGaugeProps) {
  const [expandedDimension, setExpandedDimension] = useState<string | null>(null);
  const [showFormula, setShowFormula] = useState(false);

  const toggleDimension = (dim: string) => {
    setExpandedDimension(expandedDimension === dim ? null : dim);
  };

  return (
    <section className="rounded-xl border border-border bg-card flex flex-col overflow-hidden">
      <header className="p-6 border-b border-border bg-gradient-to-r from-blue-500/5 to-purple-500/5">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Content Maturity</p>
            <h3 className="text-2xl font-semibold">{assessment.label}</h3>
            <p className="text-sm text-muted-foreground mt-1">{assessment.narrative}</p>
          </div>
          <div className="flex items-end gap-2">
            <span className="text-4xl font-bold text-primary">{assessment.level}</span>
            <span className="text-sm text-muted-foreground">/5</span>
          </div>
        </div>
        <div className="mt-6 flex items-center gap-2">
          {LEVELS.map(level => (
            <div key={level.value} className="flex-1 flex flex-col items-center gap-1">
              <div
                className={`w-full h-2 rounded-full ${assessment.level >= level.value ? level.color : 'bg-border'}`}
              />
              <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                {level.label}
              </span>
            </div>
          ))}
        </div>
        
        {/* Formula disclosure */}
        <button 
          className="mt-4 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          onClick={() => setShowFormula(!showFormula)}
        >
          <svg className={`w-3 h-3 transition-transform ${showFormula ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          How is this score calculated?
        </button>
        
        {showFormula && assessment.overallBreakdown && (
          <div className="mt-3 p-3 rounded-lg bg-background/60 border border-border/60 text-xs">
            <p className="font-mono text-muted-foreground mb-2">
              {assessment.overallBreakdown.formula}
            </p>
            <p className="text-muted-foreground text-[11px]">
              Each dimension starts at 100 and adjusts based on detected issues (penalties) and best practices (bonuses).
              Click on any dimension below to see its breakdown.
            </p>
          </div>
        )}
      </header>

      <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
        {Object.entries(assessment.dimensions).map(([dimension, summary]) => (
          <DimensionCard
            key={dimension}
            dimension={dimension}
            summary={summary}
            expanded={expandedDimension === dimension}
            onToggle={() => toggleDimension(dimension)}
          />
        ))}
      </div>

      {assessment.nextLevelActions.length > 0 && (
        <div className="px-6 pb-6">
          <div className="rounded-lg border border-dashed border-border/80 p-4">
            <h5 className="text-sm font-semibold text-muted-foreground mb-2">Next-level actions</h5>
            <ul className="space-y-1.5 text-sm text-muted-foreground">
              {assessment.nextLevelActions.map((action, index) => (
                <li key={index} className="flex items-start gap-2">
                  <span className="text-primary mt-1">•</span>
                  <span>{action}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </section>
  );
}

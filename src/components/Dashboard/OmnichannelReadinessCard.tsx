'use client';

import { useState } from 'react';
import type { OmnichannelReadiness, OmnichannelIndicator, ScoreContribution } from '@/lib/types';

interface OmnichannelReadinessCardProps {
  readiness: OmnichannelReadiness;
}

const channelIcons: Record<keyof OmnichannelReadiness['channels'], string> = {
  web: '🖥️',
  mobile: '📱',
  email: '✉️',
  headless: '🧠',
};

const indicatorLabels: Record<string, string> = {
  presentationFreeContent: 'Presentation-Free Content',
  semanticStructure: 'Semantic Structure',
  assetFlexibility: 'Asset Flexibility',
  apiDesign: 'API Design',
};

function ContributionBadge({ contribution }: { contribution: ScoreContribution }) {
  const isPositive = contribution.value > 0;
  const isNeutral = contribution.value === 0;
  
  return (
    <div className={`flex items-start gap-2 py-1 px-2 rounded text-[11px] ${
      isPositive ? 'bg-green-500/10' : isNeutral ? 'bg-gray-500/10' : 'bg-rose-500/10'
    }`}>
      <span className={`font-mono font-medium min-w-[2.5rem] ${
        isPositive ? 'text-green-400' : isNeutral ? 'text-gray-400' : 'text-rose-400'
      }`}>
        {isPositive ? '+' : ''}{contribution.value}
      </span>
      <div className="flex-1">
        <span className="text-foreground">{contribution.reason}</span>
        {contribution.details && (
          <p className="text-muted-foreground mt-0.5 text-[10px]">{contribution.details}</p>
        )}
      </div>
    </div>
  );
}

function IndicatorCard({ 
  name, 
  indicator, 
  expanded,
  onToggle
}: { 
  name: string; 
  indicator: OmnichannelIndicator;
  expanded: boolean;
  onToggle: () => void;
}) {
  const label = indicatorLabels[name] || formatIndicatorName(name);
  const scoreColor = indicator.score >= 70 ? 'text-green-400' : indicator.score >= 50 ? 'text-amber-400' : 'text-rose-400';

  return (
    <div className="rounded-lg border border-border/70 bg-background/80 overflow-hidden">
      <button 
        className="w-full p-3 flex items-center justify-between hover:bg-card/50 transition-colors"
        onClick={onToggle}
      >
        <span className="text-sm font-medium">{label}</span>
        <div className="flex items-center gap-2">
          <span className={`text-base font-semibold ${scoreColor}`}>{indicator.score}</span>
          <svg 
            className={`w-3 h-3 text-muted-foreground transition-transform ${expanded ? 'rotate-180' : ''}`}
            fill="none" 
            viewBox="0 0 24 24" 
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>
      
      {expanded && (
        <div className="border-t border-border/40 p-3 space-y-2">
          {/* Score Breakdown */}
          {indicator.breakdown && indicator.breakdown.length > 0 && (
            <div className="space-y-1">
              <p className="text-[10px] text-muted-foreground font-medium">Score Breakdown (starts at 100)</p>
              {indicator.breakdown.map((c, i) => (
                <ContributionBadge key={i} contribution={c} />
              ))}
            </div>
          )}
          
          {/* Additional details */}
          {indicator.examples && indicator.examples.length > 0 && (
            <div className="mt-2">
              <p className="text-[10px] text-muted-foreground font-medium mb-1">Examples</p>
              <ul className="text-[11px] text-muted-foreground space-y-0.5">
                {indicator.examples.slice(0, 3).map((ex, i) => (
                  <li key={i} className="truncate">• {ex}</li>
                ))}
              </ul>
            </div>
          )}
          
          {indicator.issues && indicator.issues.length > 0 && (
            <div className="mt-2">
              <p className="text-[10px] text-amber-400 font-medium mb-1">Issues</p>
              <ul className="text-[11px] text-muted-foreground space-y-0.5">
                {indicator.issues.map((issue, i) => (
                  <li key={i}>• {issue}</li>
                ))}
              </ul>
            </div>
          )}
          
          {indicator.recommendations && indicator.recommendations.length > 0 && (
            <div className="mt-2">
              <p className="text-[10px] text-blue-400 font-medium mb-1">Recommendations</p>
              <ul className="text-[11px] text-muted-foreground space-y-0.5">
                {indicator.recommendations.map((rec, i) => (
                  <li key={i}>• {rec}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function OmnichannelReadinessCard({ readiness }: OmnichannelReadinessCardProps) {
  const [expandedIndicator, setExpandedIndicator] = useState<string | null>(null);
  const [showFormula, setShowFormula] = useState(false);
  
  const indicatorEntries = Object.entries(readiness.indicators);

  const toggleIndicator = (name: string) => {
    setExpandedIndicator(expandedIndicator === name ? null : name);
  };

  return (
    <section className="rounded-xl border border-border bg-card overflow-hidden flex flex-col">
      <header className="p-6 border-b border-border bg-gradient-to-r from-amber-500/5 to-rose-500/5">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Omnichannel Readiness</p>
            <h3 className="text-xl font-semibold">{readiness.readinessLabel}</h3>
            <p className="text-sm text-muted-foreground mt-1">{readiness.narrative}</p>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-4xl font-bold text-primary">{readiness.score}</span>
            <span className="text-muted-foreground text-sm">/100</span>
          </div>
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
        
        {showFormula && readiness.scoreBreakdown && (
          <div className="mt-3 p-3 rounded-lg bg-background/60 border border-border/60 text-xs">
            <p className="font-mono text-muted-foreground mb-2">
              {readiness.scoreBreakdown.formula}
            </p>
            <p className="text-muted-foreground text-[11px]">
              Each indicator starts at 100 and adjusts based on detected issues (penalties) and best practices (bonuses).
              Click on any indicator below to see its breakdown.
            </p>
          </div>
        )}
      </header>

      <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Channel coverage</h4>
          <ul className="space-y-3">
            {Object.entries(readiness.channels).map(([channel, info]) => (
              <li
                key={channel}
                className={`flex items-start gap-3 p-3 rounded-lg border ${
                  info.ready ? 'border-emerald-500/40 bg-emerald-500/5' : 'border-border/60 bg-background/60'
                }`}
              >
                <span className="text-xl">{channelIcons[channel as keyof typeof channelIcons]}</span>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium capitalize">{channel}</span>
                    <span className={`text-xs font-semibold ${info.ready ? 'text-emerald-500' : 'text-amber-500'}`}>
                      {info.ready ? 'Ready' : 'Not Ready'}
                    </span>
                  </div>
                  {info.gaps.length > 0 && (
                    <p className="text-xs text-muted-foreground mt-1">{info.gaps[0]}</p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Key indicators</h4>
          <div className="space-y-2">
            {indicatorEntries.map(([name, indicator]) => (
              <IndicatorCard
                key={name}
                name={name}
                indicator={indicator}
                expanded={expandedIndicator === name}
                onToggle={() => toggleIndicator(name)}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function formatIndicatorName(name: string) {
  return name.replace(/([A-Z])/g, ' $1').replace(/^\w/, (c) => c.toUpperCase());
}

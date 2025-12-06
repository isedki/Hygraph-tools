'use client';

import { useState } from 'react';
import type { EditorialVelocityEstimate, ModelVelocityBreakdown } from '@/lib/types';

interface EditorialVelocityPanelProps {
  velocity: EditorialVelocityEstimate;
}

function ModelVelocityCard({ 
  model, 
  expanded,
  onToggle 
}: { 
  model: ModelVelocityBreakdown;
  expanded: boolean;
  onToggle: () => void;
}) {
  const timeColor = model.estimatedMinutes <= 8 
    ? 'text-green-400' 
    : model.estimatedMinutes <= 14 
      ? 'text-amber-400' 
      : 'text-rose-400';

  return (
    <div className="rounded-lg border border-border/60 bg-background/70 overflow-hidden">
      <button 
        className="w-full p-3 flex items-center justify-between hover:bg-card/50 transition-colors"
        onClick={onToggle}
      >
        <span className="text-sm font-medium">{model.model}</span>
        <div className="flex items-center gap-2">
          <span className={`text-base font-semibold ${timeColor}`}>
            {model.estimatedMinutes}m
          </span>
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
        <div className="border-t border-border/40 p-3 space-y-3">
          {/* Formula Summary */}
          <div className="p-2 rounded bg-card/50 border border-border/50">
            <p className="font-mono text-xs text-muted-foreground">
              {model.formulaSummary}
            </p>
          </div>
          
          {/* Detailed Calculation */}
          <div className="space-y-1.5">
            <p className="text-[10px] text-muted-foreground font-medium">Calculation Breakdown</p>
            {model.calculation.map((calc, i) => (
              <div 
                key={i} 
                className="flex items-start justify-between gap-2 py-1 px-2 rounded text-[11px] bg-background/60"
              >
                <span className="text-foreground">{calc.component}</span>
                <div className="text-right">
                  <span className="font-mono text-muted-foreground">+{calc.contribution} min</span>
                  <p className="text-[10px] text-muted-foreground/70">{calc.formula}</p>
                </div>
              </div>
            ))}
          </div>
          
          {/* Factors */}
          {model.factors.length > 0 && model.factors[0] !== 'Simple model structure' && (
            <div>
              <p className="text-[10px] text-amber-400 font-medium mb-1">Contributing Factors</p>
              <ul className="text-[11px] text-muted-foreground space-y-0.5">
                {model.factors.map((factor, i) => (
                  <li key={i}>• {factor}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function EditorialVelocityPanel({ velocity }: EditorialVelocityPanelProps) {
  const [expandedModel, setExpandedModel] = useState<string | null>(null);
  const [showFormula, setShowFormula] = useState(false);

  const toggleModel = (modelName: string) => {
    setExpandedModel(expandedModel === modelName ? null : modelName);
  };

  return (
    <section className="rounded-xl border border-border bg-card overflow-hidden flex flex-col">
      <header className="p-6 border-b border-border bg-gradient-to-r from-emerald-500/5 to-cyan-500/5">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Editorial Velocity</p>
            <h3 className="text-2xl font-semibold">{velocity.averageTimeToPublish}</h3>
            <p className="text-sm text-muted-foreground mt-1">{velocity.narrative}</p>
          </div>
          <div className="flex flex-col items-end text-right">
            <span className="text-xs uppercase tracking-wide text-muted-foreground">Focus areas</span>
            <span className="text-xl font-semibold text-primary">{velocity.bottlenecks.length}</span>
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
          How are time estimates calculated?
        </button>
        
        {showFormula && (
          <div className="mt-3 p-3 rounded-lg bg-background/60 border border-border/60 text-xs space-y-2">
            <div className="font-mono text-muted-foreground whitespace-pre-line">
              {velocity.formulaExplanation.split('\n').map((line, i) => {
                // Handle bold markdown
                const formattedLine = line.replace(/\*\*(.+?)\*\*/g, '<strong class="text-foreground">$1</strong>');
                // Handle inline code
                const codeFormatted = formattedLine.replace(/`(.+?)`/g, '<code class="bg-card px-1 rounded">$1</code>');
                return (
                  <p 
                    key={i} 
                    dangerouslySetInnerHTML={{ __html: codeFormatted }}
                    className={line.startsWith('-') ? 'ml-4' : line.startsWith('*') ? 'text-[10px] italic' : ''}
                  />
                );
              })}
            </div>
            <p className="text-muted-foreground text-[11px] pt-2 border-t border-border/50">
              Click on any model below to see its specific calculation.
            </p>
          </div>
        )}
      </header>

      <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div>
          <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
            Time per model
          </h4>
          <div className="space-y-2">
            {velocity.modelComplexityBreakdown.map(model => (
              <ModelVelocityCard
                key={model.model}
                model={model}
                expanded={expandedModel === model.model}
                onToggle={() => toggleModel(model.model)}
              />
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              Bottlenecks
            </h4>
            <ul className="space-y-2">
              {velocity.bottlenecks.map(bottleneck => (
                <li key={bottleneck.model} className="p-3 rounded-lg border border-border/60 bg-card/40">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{bottleneck.model}</span>
                    <span className="text-xs font-semibold text-rose-500">{bottleneck.timeCost}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{bottleneck.issue}</p>
                </li>
              ))}
              {velocity.bottlenecks.length === 0 && (
                <li className="text-sm text-muted-foreground">No major bottlenecks detected.</li>
              )}
            </ul>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              Velocity tips
            </h4>
            <ul className="space-y-1.5 text-sm text-muted-foreground">
              {velocity.velocityTips.map((tip, index) => (
                <li key={index} className="flex items-start gap-2">
                  <span className="text-primary mt-1">•</span>
                  <span>{tip}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

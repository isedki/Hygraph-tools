'use client';

import { useState } from 'react';
import type { ImplementationRoadmap as RoadmapType, RoadmapTask } from '@/lib/types';

interface ImplementationRoadmapProps {
  roadmap: RoadmapType;
}

const effortColors = {
  low: { bg: 'bg-green-500/20', text: 'text-green-400', label: 'Low Effort' },
  medium: { bg: 'bg-amber-500/20', text: 'text-amber-400', label: 'Medium Effort' },
  high: { bg: 'bg-red-500/20', text: 'text-red-400', label: 'High Effort' },
};

const phaseColors = [
  { bg: 'from-green-500/20 to-emerald-500/10', border: 'border-green-500/30', icon: '🚀' },
  { bg: 'from-blue-500/20 to-cyan-500/10', border: 'border-blue-500/30', icon: '🔧' },
  { bg: 'from-purple-500/20 to-indigo-500/10', border: 'border-purple-500/30', icon: '🏗️' },
  { bg: 'from-amber-500/20 to-orange-500/10', border: 'border-amber-500/30', icon: '🔄' },
];

export default function ImplementationRoadmapComponent({ roadmap }: ImplementationRoadmapProps) {
  const [expandedPhase, setExpandedPhase] = useState<number | null>(0);

  return (
    <section className="rounded-xl border border-border bg-card overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-border">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-lg">Implementation Roadmap</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Phased approach to improving your schema
            </p>
          </div>
          <div className="text-right">
            <div className="text-sm text-muted-foreground">Estimated Total</div>
            <div className="font-semibold text-foreground">{roadmap.totalEstimatedEffort}</div>
          </div>
        </div>
      </div>

      {/* Phases */}
      <div className="p-6">
        <div className="space-y-4">
          {roadmap.phases.map((phase, index) => {
            const colors = phaseColors[index] || phaseColors[3];
            const isExpanded = expandedPhase === index;
            
            return (
              <div 
                key={phase.phase}
                className={`rounded-xl border ${colors.border} overflow-hidden transition-all`}
              >
                {/* Phase Header */}
                <button
                  onClick={() => setExpandedPhase(isExpanded ? null : index)}
                  className={`w-full p-4 bg-gradient-to-r ${colors.bg} flex items-center justify-between hover:opacity-90 transition-opacity`}
                >
                  <div className="flex items-center gap-4">
                    <span className="text-2xl">{colors.icon}</span>
                    <div className="text-left">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-foreground">
                          Phase {phase.phase}: {phase.name}
                        </span>
                        <span className="px-2 py-0.5 text-xs rounded bg-card/50 text-muted-foreground">
                          {phase.duration}
                        </span>
                      </div>
                      <div className="text-sm text-muted-foreground mt-0.5">
                        {phase.description}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <div className="text-sm font-medium text-foreground">
                        {phase.tasks.length} task{phase.tasks.length !== 1 ? 's' : ''}
                      </div>
                    </div>
                    <svg 
                      className={`w-5 h-5 text-muted-foreground transition-transform ${isExpanded ? 'rotate-180' : ''}`} 
                      fill="none" 
                      stroke="currentColor" 
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </button>

                {/* Phase Tasks */}
                {isExpanded && (
                  <div className="p-4 bg-card/30 space-y-3">
                    {phase.tasks.map((task) => (
                      <TaskCard key={task.id} task={task} />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Quick Wins Highlight */}
        {roadmap.quickWins.length > 0 && (
          <div className="mt-6 p-4 rounded-xl border border-green-500/30 bg-green-500/5">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xl">⚡</span>
              <h4 className="font-semibold text-green-400">Quick Wins</h4>
              <span className="text-xs text-muted-foreground">Start here for immediate impact</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {roadmap.quickWins.map((task) => (
                <div 
                  key={task.id}
                  className="flex items-start gap-2 p-2 rounded bg-card/50"
                >
                  <input type="checkbox" className="mt-1 rounded border-green-500" disabled />
                  <span className="text-sm text-muted-foreground">{task.task}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Progress Tracking Suggestion */}
        <div className="mt-6 p-4 rounded-lg bg-card/50 border border-border">
          <h4 className="text-sm font-medium text-muted-foreground mb-2">
            💡 Tracking Progress
          </h4>
          <p className="text-sm text-muted-foreground">
            Export this roadmap and use it as a checklist. Consider scheduling quarterly schema reviews 
            to maintain quality and address new issues before they accumulate.
          </p>
        </div>
      </div>
    </section>
  );
}

function TaskCard({ task }: { task: RoadmapTask }) {
  const effort = effortColors[task.effort];
  
  return (
    <div className="p-3 rounded-lg bg-card border border-border">
      <div className="flex items-start gap-3">
        <input 
          type="checkbox" 
          className="mt-1 rounded border-border" 
          disabled 
        />
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-medium text-sm text-foreground">{task.task}</span>
            <span className={`text-xs px-1.5 py-0.5 rounded ${effort.bg} ${effort.text}`}>
              {effort.label}
            </span>
          </div>
          <p className="text-sm text-muted-foreground">{task.description}</p>
          
          {task.affectedItems.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {task.affectedItems.slice(0, 4).map((item) => (
                <span 
                  key={item} 
                  className="px-1.5 py-0.5 text-xs bg-card rounded border border-border text-muted-foreground"
                >
                  {item}
                </span>
              ))}
              {task.affectedItems.length > 4 && (
                <span className="text-xs text-muted-foreground">
                  +{task.affectedItems.length - 4} more
                </span>
              )}
            </div>
          )}
          
          <div className="mt-2 text-xs text-muted-foreground">
            <span className="text-green-400">Impact:</span> {task.impact}
          </div>
        </div>
      </div>
    </div>
  );
}





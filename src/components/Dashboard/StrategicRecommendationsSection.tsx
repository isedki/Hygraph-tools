'use client';

import type { StrategicRecommendation } from '@/lib/types';

interface StrategicRecommendationsSectionProps {
  recommendations: StrategicRecommendation[];
}

const categoryStyles = {
  'editor-experience': { bg: 'bg-purple-500/10', border: 'border-purple-500/30', icon: '✏️', label: 'Editor Experience' },
  'scalability': { bg: 'bg-amber-500/10', border: 'border-amber-500/30', icon: '📈', label: 'Scalability' },
  'content-strategy': { bg: 'bg-cyan-500/10', border: 'border-cyan-500/30', icon: '🎯', label: 'Content Strategy' },
  'governance': { bg: 'bg-blue-500/10', border: 'border-blue-500/30', icon: '📋', label: 'Governance' },
};

const priorityStyles = {
  high: { bg: 'bg-red-500/20', text: 'text-red-400', label: 'High Priority' },
  medium: { bg: 'bg-amber-500/20', text: 'text-amber-400', label: 'Medium Priority' },
  low: { bg: 'bg-green-500/20', text: 'text-green-400', label: 'Low Priority' },
};

const effortStyles = {
  low: { text: 'text-green-400', label: 'Low Effort' },
  medium: { text: 'text-amber-400', label: 'Medium Effort' },
  high: { text: 'text-red-400', label: 'High Effort' },
};

export default function StrategicRecommendationsSection({ recommendations }: StrategicRecommendationsSectionProps) {
  if (recommendations.length === 0) {
    return (
      <section className="rounded-xl border border-border bg-card p-6">
        <h3 className="font-semibold text-lg mb-4">Strategic Recommendations</h3>
        <p className="text-muted-foreground text-center py-4">
          No strategic recommendations - your schema is well-optimized!
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-border bg-card overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-border bg-gradient-to-r from-purple-500/5 to-cyan-500/5">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-purple-500/20">
            <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
            </svg>
          </div>
          <div>
            <h2 className="font-semibold text-lg">Strategic Recommendations</h2>
            <p className="text-sm text-muted-foreground">
              Data-driven insights with measurable impact
            </p>
          </div>
        </div>
      </div>

      {/* Recommendations List */}
      <div className="p-6 space-y-4">
        {recommendations.map((rec) => {
          const category = categoryStyles[rec.category];
          const priority = priorityStyles[rec.priority];
          const effort = effortStyles[rec.effort];
          
          return (
            <div 
              key={rec.id} 
              className={`rounded-xl border ${category.border} ${category.bg} p-5 transition-all hover:shadow-lg`}
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{category.icon}</span>
                  <div>
                    <h3 className="font-semibold text-lg">{rec.title}</h3>
                    <span className="text-xs text-muted-foreground">{category.label}</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <span className={`px-2 py-0.5 rounded text-xs ${priority.bg} ${priority.text}`}>
                    {priority.label}
                  </span>
                  <span className={`px-2 py-0.5 rounded text-xs bg-card ${effort.text}`}>
                    {effort.label}
                  </span>
                </div>
              </div>

              {/* Finding - with bold numbers */}
              <div className="mb-4 p-3 rounded-lg bg-card/50 border border-border/50">
                <div className="text-xs font-medium text-muted-foreground mb-1">Finding</div>
                <p 
                  className="text-sm text-foreground"
                  dangerouslySetInnerHTML={{ 
                    __html: rec.finding.replace(/\*\*([^*]+)\*\*/g, '<strong class="text-foreground font-semibold">$1</strong>') 
                  }}
                />
              </div>

              {/* Metrics Grid */}
              {rec.metrics.length > 0 && (
                <div className="grid grid-cols-3 gap-3 mb-4">
                  {rec.metrics.map((metric, i) => (
                    <div key={i} className="text-center p-2 rounded-lg bg-card/30 border border-border/30">
                      <div className="text-xl font-bold text-foreground">{metric.value}</div>
                      <div className="text-xs text-muted-foreground">{metric.label}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* Recommendation & Impact */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-card/50 rounded-lg p-3">
                  <div className="text-xs font-medium text-cyan-400 mb-1">Recommendation</div>
                  <p className="text-sm text-muted-foreground">{rec.recommendation}</p>
                </div>
                <div className="bg-card/50 rounded-lg p-3">
                  <div className="text-xs font-medium text-green-400 mb-1">Impact</div>
                  <p className="text-sm text-muted-foreground">{rec.impact}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}




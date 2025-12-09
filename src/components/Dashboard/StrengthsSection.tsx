'use client';

import type { StrengthsAnalysis, SchemaStrength } from '@/lib/types';

interface StrengthsSectionProps {
  strengths: StrengthsAnalysis;
}

const categoryIcons: Record<SchemaStrength['category'], string> = {
  architecture: '🏗️',
  components: '🧩',
  taxonomy: '🏷️',
  forms: '📝',
  seo: '🔍',
  workflow: '⚡',
  scalability: '📈',
};

const categoryColors: Record<SchemaStrength['category'], { bg: string; border: string; text: string }> = {
  architecture: { bg: 'bg-blue-500/10', border: 'border-blue-500/30', text: 'text-blue-400' },
  components: { bg: 'bg-purple-500/10', border: 'border-purple-500/30', text: 'text-purple-400' },
  taxonomy: { bg: 'bg-green-500/10', border: 'border-green-500/30', text: 'text-green-400' },
  forms: { bg: 'bg-amber-500/10', border: 'border-amber-500/30', text: 'text-amber-400' },
  seo: { bg: 'bg-cyan-500/10', border: 'border-cyan-500/30', text: 'text-cyan-400' },
  workflow: { bg: 'bg-rose-500/10', border: 'border-rose-500/30', text: 'text-rose-400' },
  scalability: { bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', text: 'text-emerald-400' },
};

export default function StrengthsSection({ strengths }: StrengthsSectionProps) {
  if (strengths.strengths.length === 0) {
    return null;
  }

  return (
    <section className="rounded-xl border border-border bg-card overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-border bg-gradient-to-r from-emerald-500/5 to-green-500/5">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-emerald-500/20">
            <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <h2 className="font-semibold text-lg">What&apos;s Working Well</h2>
            <p className="text-sm text-muted-foreground">
              {strengths.strengths.length} strength{strengths.strengths.length !== 1 ? 's' : ''} identified in your schema
            </p>
          </div>
        </div>
      </div>

      {/* Strengths Grid */}
      <div className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {strengths.strengths.map((strength) => (
            <StrengthCard key={strength.id} strength={strength} />
          ))}
        </div>

        {/* Highlights Summary */}
        {(strengths.architectureHighlights.length > 0 || 
          strengths.componentHighlights.length > 0 || 
          strengths.taxonomyHighlights.length > 0) && (
          <div className="mt-6 pt-6 border-t border-border">
            <h4 className="text-sm font-medium text-muted-foreground mb-4">Highlights</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {strengths.architectureHighlights.length > 0 && (
                <HighlightGroup 
                  title="Architecture" 
                  icon="🏗️" 
                  highlights={strengths.architectureHighlights} 
                />
              )}
              {strengths.componentHighlights.length > 0 && (
                <HighlightGroup 
                  title="Components" 
                  icon="🧩" 
                  highlights={strengths.componentHighlights} 
                />
              )}
              {strengths.taxonomyHighlights.length > 0 && (
                <HighlightGroup 
                  title="Taxonomy" 
                  icon="🏷️" 
                  highlights={strengths.taxonomyHighlights} 
                />
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function StrengthCard({ strength }: { strength: SchemaStrength }) {
  const colors = categoryColors[strength.category];
  const icon = categoryIcons[strength.category];

  return (
    <div className={`p-4 rounded-lg border ${colors.border} ${colors.bg}`}>
      <div className="flex items-start gap-3">
        <span className="text-2xl">{icon}</span>
        <div className="flex-1">
          <h3 className={`font-semibold ${colors.text}`}>{strength.title}</h3>
          <p className="text-sm text-muted-foreground mt-1">{strength.description}</p>
          
          <div className="mt-3 pt-3 border-t border-border/50">
            <div className="text-xs text-green-400 font-medium mb-1">Impact</div>
            <p className="text-sm text-muted-foreground">{strength.impact}</p>
          </div>

          {strength.examples && strength.examples.length > 0 && (
            <div className="mt-3">
              <div className="text-xs text-muted-foreground font-medium mb-1.5">Examples</div>
              <div className="flex flex-wrap gap-1.5">
                {strength.examples.slice(0, 3).map((example, i) => (
                  <span 
                    key={i} 
                    className="px-2 py-0.5 text-xs bg-card rounded border border-border text-foreground"
                  >
                    {example}
                  </span>
                ))}
                {strength.examples.length > 3 && (
                  <span className="px-2 py-0.5 text-xs text-muted-foreground">
                    +{strength.examples.length - 3} more
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function HighlightGroup({ 
  title, 
  icon, 
  highlights 
}: { 
  title: string; 
  icon: string; 
  highlights: string[];
}) {
  return (
    <div className="p-3 rounded-lg bg-card/50 border border-border/50">
      <div className="flex items-center gap-2 mb-2">
        <span>{icon}</span>
        <span className="text-sm font-medium">{title}</span>
      </div>
      <ul className="space-y-1">
        {highlights.map((highlight, i) => (
          <li key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
            <span className="text-emerald-400 mt-0.5">✓</span>
            <span>{highlight}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}




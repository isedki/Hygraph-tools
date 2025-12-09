'use client';

import { useState } from 'react';
import type { EnumOverviewAnalysis, EnumPurpose } from '@/lib/types';

interface EnumOverviewProps {
  enumOverview: EnumOverviewAnalysis;
}

const categoryLabels: Record<EnumPurpose['category'], { label: string; icon: string; color: string }> = {
  styling: { label: 'Styling & Appearance', icon: '🎨', color: 'text-pink-400' },
  layout: { label: 'Layout & Position', icon: '📐', color: 'text-cyan-400' },
  'content-type': { label: 'Content Types', icon: '📄', color: 'text-blue-400' },
  'business-logic': { label: 'Business Logic', icon: '⚙️', color: 'text-amber-400' },
  tenancy: { label: 'Multi-Site/Brand', icon: '🏢', color: 'text-red-400' },
  status: { label: 'Status & Workflow', icon: '📊', color: 'text-green-400' },
  other: { label: 'Other', icon: '📋', color: 'text-slate-400' },
};

const healthBadges = {
  healthy: { bg: 'bg-green-500/20', text: 'text-green-400', label: 'Healthy' },
  warning: { bg: 'bg-amber-500/20', text: 'text-amber-400', label: 'Warning' },
  critical: { bg: 'bg-red-500/20', text: 'text-red-400', label: 'Critical' },
};

export default function EnumOverview({ enumOverview }: EnumOverviewProps) {
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);

  if (enumOverview.totalEnums === 0) {
    return (
      <section className="rounded-xl border border-border bg-card p-6">
        <h3 className="font-semibold text-lg mb-2">Enumeration Overview</h3>
        <p className="text-muted-foreground">No enumerations defined in this schema.</p>
      </section>
    );
  }

  // Get non-empty categories
  const categories = Object.entries(enumOverview.enumsByCategory)
    .filter(([, enums]) => enums.length > 0) as [keyof typeof enumOverview.enumsByCategory, EnumPurpose[]][];

  return (
    <section className="rounded-xl border border-border bg-card overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-border">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-lg">Enumeration Overview</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Understanding WHY each enum exists and its purpose
            </p>
          </div>
          
          {/* Health Summary */}
          <div className="flex gap-3">
            {enumOverview.healthSummary.healthy > 0 && (
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-green-500"></div>
                <span className="text-sm text-muted-foreground">{enumOverview.healthSummary.healthy} healthy</span>
              </div>
            )}
            {enumOverview.healthSummary.warning > 0 && (
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-amber-500"></div>
                <span className="text-sm text-muted-foreground">{enumOverview.healthSummary.warning} warnings</span>
              </div>
            )}
            {enumOverview.healthSummary.critical > 0 && (
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-red-500"></div>
                <span className="text-sm text-muted-foreground">{enumOverview.healthSummary.critical} critical</span>
              </div>
            )}
          </div>
        </div>
        
        {/* Overall Assessment */}
        <div className="mt-4 p-3 rounded-lg bg-card/50 border border-border/50">
          <p className="text-sm text-muted-foreground" 
             dangerouslySetInnerHTML={{ __html: enumOverview.overallAssessment.replace(/\*\*([^*]+)\*\*/g, '<strong class="text-foreground">$1</strong>') }} 
          />
        </div>
      </div>

      {/* Categories Grid */}
      <div className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {categories.map(([categoryKey, enums]) => {
            const category = categoryLabels[categoryKey as keyof typeof categoryLabels] || categoryLabels.other;
            const isExpanded = expandedCategory === categoryKey;
            
            return (
              <div 
                key={categoryKey}
                className="rounded-lg border border-border bg-card/50 overflow-hidden"
              >
                <button
                  onClick={() => setExpandedCategory(isExpanded ? null : categoryKey)}
                  className="w-full p-4 flex items-center justify-between hover:bg-card/80 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{category.icon}</span>
                    <div className="text-left">
                      <div className={`font-medium ${category.color}`}>{category.label}</div>
                      <div className="text-xs text-muted-foreground">{enums.length} enum{enums.length !== 1 ? 's' : ''}</div>
                    </div>
                  </div>
                  <svg 
                    className={`w-4 h-4 text-muted-foreground transition-transform ${isExpanded ? 'rotate-180' : ''}`} 
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                
                {isExpanded && (
                  <div className="border-t border-border p-4 space-y-3">
                    {enums.map((enumDef) => (
                      <EnumCard key={enumDef.name} enumDef={enumDef} />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Architectural Concerns */}
        {enumOverview.architecturalEnums.filter(e => e.healthStatus === 'critical').length > 0 && (
          <div className="mt-6 p-4 rounded-lg border border-red-500/30 bg-red-500/5">
            <h4 className="font-medium text-red-400 flex items-center gap-2 mb-3">
              <span>⚠️</span> Architectural Concerns
            </h4>
            <p className="text-sm text-muted-foreground mb-4">
              These enums are being used for multi-brand/site/tenant segmentation, which has scalability limitations:
            </p>
            <div className="space-y-3">
              {enumOverview.architecturalEnums
                .filter(e => e.healthStatus === 'critical')
                .map((enumDef) => (
                  <div key={enumDef.name} className="p-3 rounded bg-card border border-border">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium">{enumDef.name}</span>
                      <span className="text-xs px-2 py-0.5 rounded bg-red-500/20 text-red-400">Critical</span>
                    </div>
                    <p className="text-sm text-muted-foreground">{enumDef.purpose}</p>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {enumDef.values.slice(0, 5).map((v) => (
                        <span key={v} className="px-2 py-0.5 text-xs bg-card rounded border border-border">
                          {v}
                        </span>
                      ))}
                      {enumDef.values.length > 5 && (
                        <span className="px-2 py-0.5 text-xs text-muted-foreground">
                          +{enumDef.values.length - 5} more
                        </span>
                      )}
                    </div>
                    {enumDef.recommendations.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-border">
                        <div className="text-xs text-green-400 font-medium mb-1">Recommendation</div>
                        <p className="text-xs text-muted-foreground">{enumDef.recommendations[0]}</p>
                      </div>
                    )}
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function EnumCard({ enumDef }: { enumDef: EnumPurpose }) {
  const health = healthBadges[enumDef.healthStatus];
  
  return (
    <div className="p-3 rounded-lg border border-border bg-card">
      <div className="flex items-center justify-between mb-2">
        <span className="font-medium text-sm">{enumDef.name}</span>
        <span className={`text-xs px-2 py-0.5 rounded ${health.bg} ${health.text}`}>
          {health.label}
        </span>
      </div>
      
      <p className="text-xs text-muted-foreground mb-2">{enumDef.purpose}</p>
      
      <div className="flex flex-wrap gap-1 mb-2">
        {enumDef.values.slice(0, 4).map((v) => (
          <span key={v} className="px-1.5 py-0.5 text-xs bg-card/80 rounded border border-border/50">
            {v}
          </span>
        ))}
        {enumDef.values.length > 4 && (
          <span className="px-1.5 py-0.5 text-xs text-muted-foreground">
            +{enumDef.values.length - 4}
          </span>
        )}
      </div>
      
      {enumDef.usedInModels.length > 0 && (
        <div className="text-xs text-muted-foreground">
          Used in: {enumDef.usedInModels.slice(0, 3).join(', ')}
          {enumDef.usedInModels.length > 3 && ` +${enumDef.usedInModels.length - 3}`}
        </div>
      )}
      
      {enumDef.issues.length > 0 && enumDef.healthStatus !== 'healthy' && (
        <div className="mt-2 pt-2 border-t border-border/50">
          <p className="text-xs text-amber-400">{enumDef.issues[0]}</p>
        </div>
      )}
    </div>
  );
}




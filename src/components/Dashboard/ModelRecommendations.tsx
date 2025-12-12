'use client';

import { useState } from 'react';
import type { ModelDeepDiveAnalysis, ModelDeepDive } from '@/lib/types';

interface ModelRecommendationsProps {
  modelAnalysis: ModelDeepDiveAnalysis;
}

const priorityBadges = {
  high: { bg: 'bg-red-500/20', text: 'text-red-400', label: 'High Priority' },
  medium: { bg: 'bg-amber-500/20', text: 'text-amber-400', label: 'Medium' },
  low: { bg: 'bg-green-500/20', text: 'text-green-400', label: 'Low' },
};

export default function ModelRecommendations({ modelAnalysis }: ModelRecommendationsProps) {
  const [expandedModel, setExpandedModel] = useState<string | null>(null);

  const hasContent = modelAnalysis.criticalModels.length > 0 || 
                     modelAnalysis.supportingModels.length > 0;

  if (!hasContent) {
    return null;
  }

  return (
    <section className="rounded-xl border border-border bg-card overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-border">
        <h3 className="font-semibold text-lg">Specific Model Recommendations</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Deep analysis of key content models with actionable improvements
        </p>
      </div>

      {/* Critical Models */}
      {modelAnalysis.criticalModels.length > 0 && (
        <div className="p-6 border-b border-border">
          <div className="flex items-center gap-2 mb-4">
            <span className="px-2 py-1 text-xs font-medium rounded bg-blue-500/20 text-blue-400">
              Critical Models
            </span>
            <span className="text-xs text-muted-foreground">
              High-impact content types requiring attention
            </span>
          </div>
          
          <div className="space-y-3">
            {modelAnalysis.criticalModels.map((model) => (
              <ModelCard 
                key={model.modelName} 
                model={model}
                isExpanded={expandedModel === model.modelName}
                onToggle={() => setExpandedModel(
                  expandedModel === model.modelName ? null : model.modelName
                )}
              />
            ))}
          </div>
        </div>
      )}

      {/* Supporting Models */}
      {modelAnalysis.supportingModels.length > 0 && (
        <div className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="px-2 py-1 text-xs font-medium rounded bg-purple-500/20 text-purple-400">
              Supporting Models
            </span>
            <span className="text-xs text-muted-foreground">
              Taxonomy, config, and auxiliary content types
            </span>
          </div>
          
          <div className="space-y-3">
            {modelAnalysis.supportingModels.map((model) => (
              <ModelCard 
                key={model.modelName} 
                model={model}
                isExpanded={expandedModel === model.modelName}
                onToggle={() => setExpandedModel(
                  expandedModel === model.modelName ? null : model.modelName
                )}
              />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function ModelCard({ 
  model, 
  isExpanded, 
  onToggle 
}: { 
  model: ModelDeepDive;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const hasIssues = model.recommendations.length > 0 || 
                    model.requiredFieldsSuggestions.length > 0 ||
                    model.validationSuggestions.length > 0;

  return (
    <div className={`rounded-lg border ${hasIssues ? 'border-amber-500/30' : 'border-border'} overflow-hidden`}>
      {/* Model Header */}
      <button
        onClick={onToggle}
        className="w-full p-4 flex items-center justify-between hover:bg-card/80 transition-colors"
      >
        <div className="flex items-center gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-foreground">{model.modelName}</span>
              {hasIssues && (
                <span className="w-2 h-2 rounded-full bg-amber-500"></span>
              )}
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">{model.purpose}</div>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="text-right text-sm">
            <div className="text-muted-foreground">
              {model.entryCount.toLocaleString()} entries • {model.fieldCount} fields
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

      {/* Expanded Content */}
      {isExpanded && (
        <div className="border-t border-border p-4 bg-card/50 space-y-4">
          {/* Strengths */}
          {model.strengths.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-green-400 mb-2 flex items-center gap-1.5">
                <span>✓</span> Strengths
              </h4>
              <ul className="space-y-1">
                {model.strengths.map((strength, i) => (
                  <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                    <span className="text-green-400 mt-1">•</span>
                    <span>{strength}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Required Fields Suggestions */}
          {model.requiredFieldsSuggestions.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-amber-400 mb-2">
                Mark as Required
              </h4>
              <div className="flex flex-wrap gap-2">
                {model.requiredFieldsSuggestions.map((field) => (
                  <span 
                    key={field} 
                    className="px-2 py-1 text-sm bg-amber-500/10 border border-amber-500/30 rounded text-amber-400"
                  >
                    {field}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Validation Suggestions */}
          {model.validationSuggestions.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-cyan-400 mb-2">
                Add Validation
              </h4>
              <div className="space-y-2">
                {model.validationSuggestions.slice(0, 4).map((suggestion, i) => (
                  <div key={i} className="text-sm flex items-start gap-2">
                    <span className="font-mono text-cyan-400 text-xs bg-cyan-500/10 px-1.5 py-0.5 rounded">
                      {suggestion.field}
                    </span>
                    <span className="text-muted-foreground">{suggestion.validation}</span>
                  </div>
                ))}
                {model.validationSuggestions.length > 4 && (
                  <p className="text-xs text-muted-foreground">
                    +{model.validationSuggestions.length - 4} more suggestions
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Other Recommendations */}
          {model.recommendations.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-foreground mb-2">
                Recommendations
              </h4>
              <div className="space-y-2">
                {model.recommendations.map((rec, i) => (
                  <div key={i} className="p-3 rounded-lg bg-card border border-border">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-mono text-xs text-muted-foreground">
                            {rec.field}
                          </span>
                          <span className={`text-xs px-1.5 py-0.5 rounded ${priorityBadges[rec.priority].bg} ${priorityBadges[rec.priority].text}`}>
                            {priorityBadges[rec.priority].label}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground">{rec.recommendation}</p>
                        {rec.currentState && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Current: <span className="text-foreground">{rec.currentState}</span>
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Relationship Notes */}
          {model.relationshipNotes.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-purple-400 mb-2">
                Relationship Considerations
              </h4>
              <ul className="space-y-1">
                {model.relationshipNotes.map((note, i) => (
                  <li key={i} className="text-sm text-muted-foreground">
                    {note}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* No issues state */}
          {!hasIssues && model.strengths.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-2">
              ✓ No specific recommendations for this model
            </p>
          )}
        </div>
      )}
    </div>
  );
}





'use client';

import { useState, useMemo } from 'react';
import type { AuditResult } from '@/lib/types';
import { CheckpointCard } from '../CheckpointCard';
import { SubTabs } from '../SubTabs';

interface ContentArchitectureTabProps {
  result: AuditResult;
  showAll?: boolean;
}

type ArchitectureSubTab = 'taxonomy' | 'distribution' | 'navigation';

export function ContentArchitectureTab({ result, showAll = false }: ContentArchitectureTabProps) {
  const [activeSubTab, setActiveSubTab] = useState<ArchitectureSubTab>('taxonomy');
  const { contentArchitecture } = result.comprehensiveAssessment;

  // Calculate status
  const getTaxonomyStatus = (): 'good' | 'warning' | 'issue' => {
    if (contentArchitecture.taxonomySummary.status === 'issue') return 'issue';
    if (contentArchitecture.taxonomySummary.status === 'warning' || contentArchitecture.hierarchySummary.status === 'warning') return 'warning';
    return 'good';
  };

  const getDistributionStatus = (): 'good' | 'warning' | 'issue' => {
    const emptyModels = contentArchitecture.contentDistribution.filter(d => d.total === 0).length;
    if (emptyModels > 5) return 'warning';
    return 'good';
  };

  const getNavigationStatus = (): 'good' | 'warning' | 'issue' => {
    if (contentArchitecture.navigationReadiness.status === 'issue') return 'issue';
    if (contentArchitecture.navigationReadiness.status === 'warning' || contentArchitecture.facetedFiltering.score < 50) return 'warning';
    return 'good';
  };

  const subTabs = [
    {
      id: 'taxonomy' as ArchitectureSubTab,
      label: 'Taxonomy & Hierarchy',
      description: 'Categories, tags, content organization',
      status: getTaxonomyStatus(),
    },
    {
      id: 'distribution' as ArchitectureSubTab,
      label: 'Content Distribution',
      description: 'Entry counts per model, draft/published',
      status: getDistributionStatus(),
      count: contentArchitecture.contentDistribution.length,
    },
    {
      id: 'navigation' as ArchitectureSubTab,
      label: 'Navigation & Filtering',
      description: 'Faceted search, navigation patterns',
      status: getNavigationStatus(),
    },
  ];

  const renderContent = () => {
    switch (activeSubTab) {
      case 'taxonomy':
        return <TaxonomySection result={result} showAll={showAll} />;
      case 'distribution':
        return <DistributionSection result={result} />;
      case 'navigation':
        return <NavigationSection result={result} showAll={showAll} />;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      <SubTabs
        tabs={subTabs}
        activeTab={activeSubTab}
        onChange={(id) => setActiveSubTab(id as ArchitectureSubTab)}
      />
      {renderContent()}
    </div>
  );
}

// Taxonomy & Hierarchy Section
function TaxonomySection({ result, showAll }: { result: AuditResult; showAll: boolean }) {
  const { contentArchitecture } = result.comprehensiveAssessment;
  
  const checkpoints = [
    contentArchitecture.taxonomySummary,
    contentArchitecture.hierarchySummary,
  ];

  const issues = checkpoints.filter(c => c.status === 'issue' || c.status === 'warning');
  const goodItems = checkpoints.filter(c => c.status === 'good');
  const [showGood, setShowGood] = useState(showAll);

  return (
    <div className="space-y-6">
      {/* Info Card */}
      <div className="bg-blue-50 rounded-lg border border-blue-200 p-4">
        <h4 className="text-sm font-medium text-blue-700 mb-2">💡 About Taxonomy & Hierarchy</h4>
        <p className="text-sm text-blue-900">
          Good content architecture uses <strong>taxonomies</strong> (categories, tags) for classification and 
          <strong> hierarchies</strong> (parent-child relationships) for navigation. This enables discovery, 
          filtering, and logical content grouping.
        </p>
      </div>

      {/* Issues first */}
      <div className="space-y-4">
        {issues.map((checkpoint, i) => (
          <CheckpointCard key={`issue-${i}`} checkpoint={checkpoint} collapsible={false} />
        ))}
      </div>

      {/* Good items */}
      {goodItems.length > 0 && (
        <>
          {!showAll && !showGood ? (
            <button
              onClick={() => setShowGood(true)}
              className="w-full py-3 px-4 bg-green-50 hover:bg-green-100 border border-green-200 rounded-lg text-sm text-green-700 font-medium transition-colors flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{goodItems.length} passing check{goodItems.length !== 1 ? 's' : ''}</span>
            </button>
          ) : (
            <div className="space-y-4">
              {goodItems.map((checkpoint, i) => (
                <CheckpointCard key={`good-${i}`} checkpoint={checkpoint} />
              ))}
              {!showAll && (
                <button onClick={() => setShowGood(false)} className="w-full py-2 text-sm text-gray-500 hover:text-gray-700">
                  Hide passing checks
                </button>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// Content Distribution Section
function DistributionSection({ result }: { result: AuditResult }) {
  const { contentArchitecture } = result.comprehensiveAssessment;
  const [showAll, setShowAll] = useState(false);
  const [sortBy, setSortBy] = useState<'total' | 'model' | 'published'>('total');

  const sortedDistribution = [...contentArchitecture.contentDistribution].sort((a, b) => {
    if (sortBy === 'total') return b.total - a.total;
    if (sortBy === 'published') return b.published - a.published;
    return a.model.localeCompare(b.model);
  });

  const displayedModels = showAll ? sortedDistribution : sortedDistribution.slice(0, 12);
  const totalEntries = contentArchitecture.contentDistribution.reduce((sum, d) => sum + d.total, 0);
  const totalPublished = contentArchitecture.contentDistribution.reduce((sum, d) => sum + d.published, 0);
  const emptyModels = contentArchitecture.contentDistribution.filter(d => d.total === 0);

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-blue-50 rounded-lg p-4 text-center border border-blue-100">
          <div className="text-2xl font-bold text-blue-600">{contentArchitecture.contentDistribution.length}</div>
          <div className="text-xs text-blue-700">Models</div>
        </div>
        <div className="bg-gray-50 rounded-lg p-4 text-center border border-gray-200">
          <div className="text-2xl font-bold text-gray-600">{totalEntries.toLocaleString()}</div>
          <div className="text-xs text-gray-700">Total Entries</div>
        </div>
        <div className="bg-green-50 rounded-lg p-4 text-center border border-green-100">
          <div className="text-2xl font-bold text-green-600">{totalPublished.toLocaleString()}</div>
          <div className="text-xs text-green-700">Published</div>
        </div>
        <div className={`rounded-lg p-4 text-center border ${emptyModels.length > 0 ? 'bg-orange-50 border-orange-100' : 'bg-green-50 border-green-100'}`}>
          <div className={`text-2xl font-bold ${emptyModels.length > 0 ? 'text-orange-600' : 'text-green-600'}`}>
            {emptyModels.length}
          </div>
          <div className={`text-xs ${emptyModels.length > 0 ? 'text-orange-700' : 'text-green-700'}`}>Empty Models</div>
        </div>
      </div>

      {/* Distribution Table */}
      <div className="bg-white rounded-lg border overflow-hidden">
        <div className="px-4 py-3 border-b bg-gray-50 flex items-center justify-between">
          <h3 className="font-semibold text-gray-900">Content by Model</h3>
          <div className="flex gap-2">
            <button 
              onClick={() => setSortBy('total')}
              className={`text-xs px-2 py-1 rounded ${sortBy === 'total' ? 'bg-blue-100 text-blue-700' : 'text-gray-500 hover:bg-gray-100'}`}
            >
              By Total
            </button>
            <button 
              onClick={() => setSortBy('published')}
              className={`text-xs px-2 py-1 rounded ${sortBy === 'published' ? 'bg-blue-100 text-blue-700' : 'text-gray-500 hover:bg-gray-100'}`}
            >
              By Published
            </button>
            <button 
              onClick={() => setSortBy('model')}
              className={`text-xs px-2 py-1 rounded ${sortBy === 'model' ? 'bg-blue-100 text-blue-700' : 'text-gray-500 hover:bg-gray-100'}`}
            >
              A-Z
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-2 text-left font-medium text-gray-600">Model</th>
                <th className="px-4 py-2 text-right font-medium text-gray-600">Total</th>
                <th className="px-4 py-2 text-right font-medium text-gray-600">Published</th>
                <th className="px-4 py-2 text-right font-medium text-gray-600">Draft</th>
                <th className="px-4 py-2 text-center font-medium text-gray-600">Distribution</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {displayedModels.map((entry, i) => {
                const publishedPct = entry.total > 0 ? Math.round((entry.published / entry.total) * 100) : 0;
                const draftPct = 100 - publishedPct;
                
                return (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="px-4 py-2 font-medium text-gray-900">{entry.model}</td>
                    <td className="px-4 py-2 text-right font-medium text-gray-900">{entry.total.toLocaleString()}</td>
                    <td className="px-4 py-2 text-right text-green-600">{entry.published.toLocaleString()}</td>
                    <td className="px-4 py-2 text-right text-yellow-600">{entry.draft > 0 ? entry.draft.toLocaleString() : '-'}</td>
                    <td className="px-4 py-2">
                      {entry.total > 0 ? (
                        <div className="flex h-2 rounded overflow-hidden bg-gray-200 min-w-[60px]">
                          <div className="bg-green-500" style={{ width: `${publishedPct}%` }} />
                          {draftPct > 0 && <div className="bg-yellow-400" style={{ width: `${draftPct}%` }} />}
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400">No content</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {contentArchitecture.contentDistribution.length > 12 && (
          <div className="px-4 py-3 border-t bg-gray-50">
            <button
              onClick={() => setShowAll(!showAll)}
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              {showAll ? 'Show less' : `Show all ${contentArchitecture.contentDistribution.length} models`}
            </button>
          </div>
        )}
      </div>

      {/* Empty Models Alert */}
      {emptyModels.length > 0 && (
        <div className="bg-orange-50 rounded-lg border border-orange-200 p-4">
          <h4 className="text-sm font-medium text-orange-700 mb-2">⚠️ Empty Models ({emptyModels.length})</h4>
          <div className="flex flex-wrap gap-2">
            {emptyModels.slice(0, 10).map((m, i) => (
              <span key={i} className="text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded">
                {m.model}
              </span>
            ))}
            {emptyModels.length > 10 && (
              <span className="text-xs text-orange-600">+{emptyModels.length - 10} more</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Navigation & Filtering Section
function NavigationSection({ result, showAll }: { result: AuditResult; showAll: boolean }) {
  const { contentArchitecture } = result.comprehensiveAssessment;
  const { facetedFiltering, navigationReadiness } = contentArchitecture;
  const [showGood, setShowGood] = useState(showAll);
  const [expandedType, setExpandedType] = useState<'enum' | 'reference' | 'boolean' | null>(null);
  const [showAllModels, setShowAllModels] = useState(false);

  const byType = {
    enum: facetedFiltering.filterableFields.filter(f => f.type === 'enum'),
    reference: facetedFiltering.filterableFields.filter(f => f.type === 'reference'),
    boolean: facetedFiltering.filterableFields.filter(f => f.type === 'boolean'),
  };

  // Model-by-model breakdown
  const modelBreakdown = useMemo(() => {
    const byModel: Record<string, { enums: string[]; refs: string[]; bools: string[] }> = {};
    facetedFiltering.filterableFields.forEach(f => {
      if (!byModel[f.model]) byModel[f.model] = { enums: [], refs: [], bools: [] };
      if (f.type === 'enum') byModel[f.model].enums.push(f.field);
      if (f.type === 'reference') byModel[f.model].refs.push(f.field);
      if (f.type === 'boolean') byModel[f.model].bools.push(f.field);
    });
    
    return Object.entries(byModel)
      .map(([model, fields]) => ({
        model,
        enums: fields.enums,
        refs: fields.refs,
        bools: fields.bools,
        total: fields.enums.length + fields.refs.length + fields.bools.length,
        score: fields.enums.length + fields.refs.length + fields.bools.length >= 3 ? 'good' as const :
               fields.enums.length + fields.refs.length + fields.bools.length >= 1 ? 'fair' as const : 'poor' as const,
      }))
      .sort((a, b) => b.total - a.total);
  }, [facetedFiltering.filterableFields]);

  const displayedModels = showAllModels ? modelBreakdown : modelBreakdown.slice(0, 8);
  const navStatus = navigationReadiness.status;

  return (
    <div className="space-y-6">
      {/* Faceted Filtering Score */}
      <div className="card p-4 flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-white">Faceted Filtering Readiness</h3>
          <p className="text-sm text-muted-foreground">{facetedFiltering.filterableFields.length} filterable field(s) detected</p>
        </div>
        <div className={`px-4 py-2 rounded-full text-lg font-bold ${
          facetedFiltering.score >= 70 ? 'text-green-400 bg-green-500/20' :
          facetedFiltering.score >= 40 ? 'text-yellow-400 bg-yellow-500/20' : 'text-red-400 bg-red-500/20'
        }`}>
          {facetedFiltering.score}%
        </div>
      </div>

      {/* Filterable Fields Summary - Expandable */}
      {facetedFiltering.filterableFields.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          {/* Enum Fields */}
          <div 
            className="card p-4 border-purple-500/30 bg-purple-500/10 cursor-pointer hover:bg-purple-500/20 transition-colors"
            onClick={() => setExpandedType(expandedType === 'enum' ? null : 'enum')}
          >
            <div className="text-2xl font-bold text-purple-400">{byType.enum.length}</div>
            <div className="text-xs text-purple-300 font-medium mb-2">Enum Fields</div>
            {expandedType === 'enum' ? (
              <div className="text-xs text-purple-300 max-h-32 overflow-y-auto space-y-1">
                {byType.enum.map((f, i) => (
                  <div key={i} className="flex items-center gap-1">
                    <span className="text-purple-400">{f.model}</span>
                    <span className="text-purple-500">.</span>
                    <span>{f.field}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-xs text-purple-300/70">
                {byType.enum.length > 0 ? 'Click to expand' : 'None'}
              </div>
            )}
          </div>

          {/* Reference Fields */}
          <div 
            className="card p-4 border-blue-500/30 bg-blue-500/10 cursor-pointer hover:bg-blue-500/20 transition-colors"
            onClick={() => setExpandedType(expandedType === 'reference' ? null : 'reference')}
          >
            <div className="text-2xl font-bold text-blue-400">{byType.reference.length}</div>
            <div className="text-xs text-blue-300 font-medium mb-2">Reference Fields</div>
            {expandedType === 'reference' ? (
              <div className="text-xs text-blue-300 max-h-32 overflow-y-auto space-y-1">
                {byType.reference.map((f, i) => (
                  <div key={i} className="flex items-center gap-1">
                    <span className="text-blue-400">{f.model}</span>
                    <span className="text-blue-500">.</span>
                    <span>{f.field}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-xs text-blue-300/70">
                {byType.reference.length > 0 ? 'Click to expand' : 'None'}
              </div>
            )}
          </div>

          {/* Boolean Fields */}
          <div 
            className="card p-4 border-slate-500/30 bg-slate-500/10 cursor-pointer hover:bg-slate-500/20 transition-colors"
            onClick={() => setExpandedType(expandedType === 'boolean' ? null : 'boolean')}
          >
            <div className="text-2xl font-bold text-slate-300">{byType.boolean.length}</div>
            <div className="text-xs text-slate-400 font-medium mb-2">Boolean Fields</div>
            {expandedType === 'boolean' ? (
              <div className="text-xs text-slate-300 max-h-32 overflow-y-auto space-y-1">
                {byType.boolean.map((f, i) => (
                  <div key={i} className="flex items-center gap-1">
                    <span className="text-slate-400">{f.model}</span>
                    <span className="text-slate-500">.</span>
                    <span>{f.field}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-xs text-slate-400/70">
                {byType.boolean.length > 0 ? 'Click to expand' : 'None'}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Model-by-Model Breakdown */}
      {modelBreakdown.length > 0 && (
        <div className="card overflow-hidden">
          <div className="p-4 border-b border-border">
            <h4 className="font-medium text-white">Filtering Capability by Model</h4>
            <p className="text-xs text-muted-foreground mt-1">How well each model supports faceted filtering</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-slate-800/50">
                  <th className="text-left py-2 px-4 font-medium text-muted-foreground">Model</th>
                  <th className="text-center py-2 px-4 font-medium text-purple-400">Enums</th>
                  <th className="text-center py-2 px-4 font-medium text-blue-400">Refs</th>
                  <th className="text-center py-2 px-4 font-medium text-slate-400">Bools</th>
                  <th className="text-center py-2 px-4 font-medium text-muted-foreground">Score</th>
                </tr>
              </thead>
              <tbody>
                {displayedModels.map((m, i) => (
                  <tr key={i} className="border-b border-border hover:bg-slate-800/30">
                    <td className="py-2 px-4 font-medium text-white">{m.model}</td>
                    <td className="py-2 px-4 text-center">
                      {m.enums.length > 0 ? (
                        <span className="text-purple-400" title={m.enums.join(', ')}>{m.enums.length}</span>
                      ) : (
                        <span className="text-slate-600">0</span>
                      )}
                    </td>
                    <td className="py-2 px-4 text-center">
                      {m.refs.length > 0 ? (
                        <span className="text-blue-400" title={m.refs.join(', ')}>{m.refs.length}</span>
                      ) : (
                        <span className="text-slate-600">0</span>
                      )}
                    </td>
                    <td className="py-2 px-4 text-center">
                      {m.bools.length > 0 ? (
                        <span className="text-slate-300" title={m.bools.join(', ')}>{m.bools.length}</span>
                      ) : (
                        <span className="text-slate-600">0</span>
                      )}
                    </td>
                    <td className="py-2 px-4 text-center">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                        m.score === 'good' ? 'bg-green-500/20 text-green-400' :
                        m.score === 'fair' ? 'bg-yellow-500/20 text-yellow-400' :
                        'bg-red-500/20 text-red-400'
                      }`}>
                        {m.score === 'good' ? 'Good' : m.score === 'fair' ? 'Fair' : 'Poor'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {modelBreakdown.length > 8 && (
            <div className="p-3 border-t border-border">
              <button
                onClick={() => setShowAllModels(!showAllModels)}
                className="text-sm text-purple-400 hover:text-purple-300"
              >
                {showAllModels ? 'Show less' : `Show all ${modelBreakdown.length} models`}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Actionable Recommendations */}
      {facetedFiltering.recommendations && facetedFiltering.recommendations.length > 0 && (
        <div className="card p-4 border-purple-500/30 bg-purple-500/10">
          <h4 className="text-sm font-medium text-purple-400 mb-3 flex items-center gap-2">
            <span>💡</span>
            Recommendations to Improve Filtering
          </h4>
          <ul className="space-y-2">
            {facetedFiltering.recommendations.map((rec, i) => (
              <li key={i} className="text-sm text-slate-300 flex items-start gap-2">
                <span className="text-purple-400 mt-0.5">→</span>
                <span>{rec}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Filtering Gaps */}
      {facetedFiltering.gaps.length > 0 && (
        <div className="card p-4 border-yellow-500/30 bg-yellow-500/10">
          <h4 className="text-sm font-medium text-yellow-400 mb-3 flex items-center gap-2">
            <span>⚠️</span>
            Filtering Gaps ({facetedFiltering.gaps.length})
          </h4>
          <ul className="space-y-2">
            {facetedFiltering.gaps.map((gap, i) => (
              <li key={i} className="text-sm text-slate-300 flex items-start gap-2">
                <span className="text-yellow-400">•</span>
                <span>{gap}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Navigation Readiness */}
      {navStatus !== 'good' ? (
        <CheckpointCard checkpoint={navigationReadiness} collapsible={false} />
      ) : (
        <>
          {!showAll && !showGood ? (
            <button
              onClick={() => setShowGood(true)}
              className="w-full py-3 px-4 bg-green-500/20 hover:bg-green-500/30 border border-green-500/30 rounded-lg text-sm text-green-400 font-medium transition-colors flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>Navigation readiness: Passing</span>
            </button>
          ) : (
            <div className="space-y-4">
              <CheckpointCard checkpoint={navigationReadiness} />
              {!showAll && (
                <button onClick={() => setShowGood(false)} className="w-full py-2 text-sm text-muted-foreground hover:text-white">
                  Hide passing check
                </button>
              )}
            </div>
          )}
        </>
      )}

      {/* Score Explanation */}
      <div className="card p-4 bg-slate-800/50">
        <h4 className="text-sm font-medium text-muted-foreground mb-2">📊 How Filtering Score is Calculated</h4>
        <p className="text-xs text-slate-400">
          Score = average filterable fields per content model × 25, capped at 100. Models with enum fields, 
          reference fields, and boolean flags contribute to filtering capability.
        </p>
      </div>
    </div>
  );
}

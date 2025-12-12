'use client';

import { useState } from 'react';
import type { AuditResult } from '@/lib/types';
import { CheckpointCard } from '../CheckpointCard';
import { SubTabs } from '../SubTabs';

interface PerformanceTabProps {
  result: AuditResult;
  showAll?: boolean;
}

type PerformanceSubTab = 'query-complexity' | 'schema-size' | 'caching' | 'type-suggestions';

export function PerformanceTab({ result, showAll = false }: PerformanceTabProps) {
  const [activeSubTab, setActiveSubTab] = useState<PerformanceSubTab>('query-complexity');
  const { performance, relationships } = result.comprehensiveAssessment;
  const caching = result.insights.enhancedPerformance?.cachingReadiness;
  const enumTaxonomyRecs = result.insights.enhancedPerformance?.enumTaxonomyRecommendations || [];

  // Status calculation helpers
  const getQueryComplexityStatus = (): 'good' | 'warning' | 'issue' => {
    const deepPaths = performance.deepQueryPaths.status;
    const recursive = performance.recursiveChains.status;
    const nested = performance.nestedComponents.items.length > 0;
    if (deepPaths === 'issue' || recursive === 'issue') return 'issue';
    if (deepPaths === 'warning' || recursive === 'warning' || nested) return 'warning';
    return 'good';
  };

  const getSchemaSizeStatus = (): 'good' | 'warning' | 'issue' => {
    if (performance.hugeModels.items.length > 3) return 'issue';
    if (performance.hugeModels.items.length > 0) return 'warning';
    return 'good';
  };

  const getCachingStatus = (): 'good' | 'warning' | 'issue' => {
    if (!caching) return 'good';
    if (caching.overallScore < 50) return 'issue';
    if (caching.overallScore < 80) return 'warning';
    return 'good';
  };

  const getTypeSuggestionsStatus = (): 'good' | 'warning' | 'issue' => {
    if (enumTaxonomyRecs.length > 5) return 'warning';
    if (enumTaxonomyRecs.length > 0) return 'warning';
    return 'good';
  };

  const subTabs = [
    {
      id: 'query-complexity' as PerformanceSubTab,
      label: 'Query Complexity',
      description: 'Nesting depth, recursive patterns, deep paths',
      status: getQueryComplexityStatus(),
      count: performance.nestedComponents.items.length + (performance.recursiveChains.status !== 'good' ? 1 : 0),
    },
    {
      id: 'schema-size' as PerformanceSubTab,
      label: 'Model Size',
      description: 'Large models, field counts',
      status: getSchemaSizeStatus(),
      count: performance.hugeModels.items.length,
    },
    {
      id: 'caching' as PerformanceSubTab,
      label: 'Cache Support',
      description: 'Unique IDs for cache keys',
      status: getCachingStatus(),
      count: caching?.modelsWithoutUniqueId.length || 0,
    },
    {
      id: 'type-suggestions' as PerformanceSubTab,
      label: 'Type Optimization',
      description: 'String fields to convert to Enum/Taxonomy',
      status: getTypeSuggestionsStatus(),
      count: enumTaxonomyRecs.length,
    },
  ];

  const renderContent = () => {
    switch (activeSubTab) {
      case 'query-complexity':
        return <QueryComplexitySection result={result} showAll={showAll} />;
      case 'schema-size':
        return <SchemaSizeSection result={result} />;
      case 'caching':
        return <CachingReadinessSection result={result} />;
      case 'type-suggestions':
        return <EnumTaxonomyRecommendationsSection result={result} />;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Performance Score */}
      <div className="bg-white rounded-lg border p-4 flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-gray-900">Performance Score</h3>
          <p className="text-sm text-gray-500">Query efficiency and schema optimization</p>
        </div>
        <div className={`px-4 py-2 rounded-full text-lg font-bold ${
          performance.overallScore >= 80 ? 'text-green-600 bg-green-50' :
          performance.overallScore >= 60 ? 'text-yellow-600 bg-yellow-50' : 'text-red-600 bg-red-50'
        }`}>
          {performance.overallScore}%
        </div>
      </div>

      <SubTabs
        tabs={subTabs}
        activeTab={activeSubTab}
        onChange={(id) => setActiveSubTab(id as PerformanceSubTab)}
      />
      
      {renderContent()}
    </div>
  );
}

// Query Complexity Section
function QueryComplexitySection({ result, showAll }: { result: AuditResult; showAll: boolean }) {
  const { performance, relationships } = result.comprehensiveAssessment;
  const [expandedNesting, setExpandedNesting] = useState(false);

  const checkpoints = [
    performance.deepQueryPaths,
    performance.recursiveChains,
    relationships.queryCost,
    relationships.circularReferences,
  ];

  const issues = checkpoints.filter(c => c.status === 'issue' || c.status === 'warning');
  const goodItems = checkpoints.filter(c => c.status === 'good');
  const [showGood, setShowGood] = useState(showAll);

  return (
    <div className="space-y-6">
      {/* Nested Components - Always show if any exist */}
      {performance.nestedComponents.items.length > 0 && (
        <div className="bg-white rounded-lg border border-yellow-200 p-4">
          <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <span className="text-yellow-500">📦</span>
            Nested Components ({performance.nestedComponents.items.length})
          </h3>
          <p className="text-sm text-gray-600 mb-3">Deeply nested components increase query complexity.</p>
          <div className="space-y-2">
            {(expandedNesting ? performance.nestedComponents.items : performance.nestedComponents.items.slice(0, 3)).map((item, i) => (
              <div key={i} className="text-sm p-2 bg-yellow-50 rounded border border-yellow-200">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-gray-900">{item.component}</span>
                  <span className="text-yellow-600 text-xs">Depth: {item.depth}</span>
                </div>
                <div className="text-xs text-gray-500 mt-1 truncate">
                  {item.path.join(' → ')}
                </div>
              </div>
            ))}
          </div>
          {performance.nestedComponents.items.length > 3 && (
            <button
              onClick={() => setExpandedNesting(!expandedNesting)}
              className="mt-2 text-sm text-blue-600 hover:text-blue-800"
            >
              {expandedNesting ? 'Show less' : `Show all ${performance.nestedComponents.items.length}`}
            </button>
          )}
        </div>
      )}

      {performance.nestedComponents.items.length === 0 && (
        <div className="bg-green-50 rounded-lg border border-green-200 p-4 flex items-center gap-3">
          <span className="text-green-500">✓</span>
          <span className="text-sm text-green-700">No deeply nested components detected</span>
        </div>
      )}

      {/* Issue checkpoints first */}
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

// Schema Size Section
function SchemaSizeSection({ result }: { result: AuditResult }) {
  const { performance } = result.comprehensiveAssessment;
  const { payloadEfficiency } = result.insights;
  const [showAllModels, setShowAllModels] = useState(false);

  const displayedModels = showAllModels ? performance.hugeModels.items : performance.hugeModels.items.slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className={`rounded-lg p-4 text-center border ${
          performance.hugeModels.items.length > 0 ? 'bg-red-50 border-red-100' : 'bg-green-50 border-green-100'
        }`}>
          <div className={`text-2xl font-bold ${performance.hugeModels.items.length > 0 ? 'text-red-600' : 'text-green-600'}`}>
            {performance.hugeModels.items.length}
          </div>
          <div className={`text-xs ${performance.hugeModels.items.length > 0 ? 'text-red-700' : 'text-green-700'}`}>
            Large Models
          </div>
        </div>
        <div className="bg-blue-50 rounded-lg p-4 text-center border border-blue-100">
          <div className="text-2xl font-bold text-blue-600">{payloadEfficiency.avgPayloadKB}</div>
          <div className="text-xs text-blue-700">Avg KB/Model</div>
        </div>
        <div className={`rounded-lg p-4 text-center border ${
          payloadEfficiency.heavyModels.length > 0 ? 'bg-orange-50 border-orange-100' : 'bg-green-50 border-green-100'
        }`}>
          <div className={`text-2xl font-bold ${payloadEfficiency.heavyModels.length > 0 ? 'text-orange-600' : 'text-green-600'}`}>
            {payloadEfficiency.heavyModels.length}
          </div>
          <div className={`text-xs ${payloadEfficiency.heavyModels.length > 0 ? 'text-orange-700' : 'text-green-700'}`}>
            Heavy Payloads
          </div>
        </div>
      </div>

      {/* Large Models */}
      {performance.hugeModels.items.length > 0 && (
        <div className="bg-white rounded-lg border border-red-200 p-4">
          <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <span className="text-red-500">⚠️</span>
            Large Models ({performance.hugeModels.items.length})
          </h3>
          <p className="text-sm text-gray-600 mb-3">
            Models with many fields increase payload size. Consider splitting into components.
          </p>
          <div className="space-y-2">
            {displayedModels.map((item, i) => (
              <div key={i} className="flex items-center justify-between text-sm p-3 bg-red-50 rounded border border-red-200">
                <span className="font-medium text-gray-900">{item.model}</span>
                <div className="flex items-center gap-2">
                  <span className="text-red-600 font-medium">{item.fieldCount} fields</span>
                  {item.fieldCount > 30 && (
                    <span className="text-xs bg-red-200 text-red-700 px-2 py-0.5 rounded">Critical</span>
                  )}
                </div>
              </div>
            ))}
          </div>
          {performance.hugeModels.items.length > 5 && (
            <button
              onClick={() => setShowAllModels(!showAllModels)}
              className="mt-2 text-sm text-blue-600 hover:text-blue-800"
            >
              {showAllModels ? 'Show less' : `Show all ${performance.hugeModels.items.length}`}
            </button>
          )}
        </div>
      )}

      {performance.hugeModels.items.length === 0 && (
        <div className="bg-green-50 rounded-lg border border-green-200 p-4 flex items-center gap-3">
          <span className="text-green-500">✓</span>
          <span className="text-sm text-green-700">All models have reasonable field counts</span>
        </div>
      )}

      {/* Heavy Payload Models */}
      {payloadEfficiency.heavyModels.length > 0 && (
        <div className="bg-white rounded-lg border border-orange-200 p-4">
          <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <span className="text-orange-500">📦</span>
            Heavy Payload Models ({payloadEfficiency.heavyModels.length})
          </h3>
          <div className="space-y-2">
            {payloadEfficiency.heavyModels.slice(0, 5).map((model, i) => (
              <div key={i} className="flex items-center justify-between text-sm p-2 bg-orange-50 rounded border border-orange-200">
                <div>
                  <span className="font-medium text-gray-900">{model.model}</span>
                  <span className="text-gray-500 ml-2 text-xs">{model.reason}</span>
                </div>
                <span className="text-orange-600 font-medium">{model.kb} KB</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Caching Readiness Section
function CachingReadinessSection({ result }: { result: AuditResult }) {
  const caching = result.insights.enhancedPerformance?.cachingReadiness;
  const [showAllModels, setShowAllModels] = useState(false);
  
  if (!caching) {
    return (
      <div className="bg-white rounded-lg border p-6 text-center text-gray-500">
        No caching analysis available.
      </div>
    );
  }
  
  const displayedWithout = showAllModels 
    ? caching.modelsWithoutUniqueId 
    : caching.modelsWithoutUniqueId.slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Score Card */}
      <div className="bg-white rounded-lg border p-4 flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-gray-900">Caching Readiness</h3>
          <p className="text-sm text-gray-500">Models with unique identifiers for cache keys</p>
        </div>
        <div className={`px-4 py-2 rounded-full text-lg font-bold ${
          caching.overallScore >= 80 ? 'text-green-600 bg-green-50' :
          caching.overallScore >= 60 ? 'text-yellow-600 bg-yellow-50' : 'text-red-600 bg-red-50'
        }`}>
          {caching.overallScore}%
        </div>
      </div>
      
      {/* Stats */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-green-50 rounded-lg p-4 text-center border border-green-100">
          <div className="text-2xl font-bold text-green-600">{caching.modelsWithUniqueId.length}</div>
          <div className="text-xs text-green-700">With Cache Key</div>
        </div>
        <div className={`rounded-lg p-4 text-center border ${caching.modelsWithoutUniqueId.length > 0 ? 'bg-orange-50 border-orange-100' : 'bg-green-50 border-green-100'}`}>
          <div className={`text-2xl font-bold ${caching.modelsWithoutUniqueId.length > 0 ? 'text-orange-600' : 'text-green-600'}`}>
            {caching.modelsWithoutUniqueId.length}
          </div>
          <div className={`text-xs ${caching.modelsWithoutUniqueId.length > 0 ? 'text-orange-700' : 'text-green-700'}`}>Without Cache Key</div>
        </div>
      </div>
      
      {/* Models with unique IDs */}
      {caching.modelsWithUniqueId.length > 0 && (
        <div className="bg-white rounded-lg border p-4">
          <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
            <span className="text-green-500">✓</span>
            Models with Cache Keys ({caching.modelsWithUniqueId.length})
          </h4>
          <div className="flex flex-wrap gap-2">
            {caching.modelsWithUniqueId.slice(0, 12).map((m, i) => (
              <span key={i} className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">
                {m.model} <span className="text-green-500">({m.field})</span>
              </span>
            ))}
            {caching.modelsWithUniqueId.length > 12 && (
              <span className="text-xs text-gray-500">+{caching.modelsWithUniqueId.length - 12} more</span>
            )}
          </div>
        </div>
      )}
      
      {/* Models without unique IDs */}
      {caching.modelsWithoutUniqueId.length > 0 && (
        <div className="bg-white rounded-lg border border-orange-200 p-4">
          <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
            <span className="text-orange-500">⚠️</span>
            Models Missing Unique Identifiers ({caching.modelsWithoutUniqueId.length})
          </h4>
          <div className="space-y-2">
            {displayedWithout.map((model, i) => {
              const rec = caching.cacheKeyRecommendations.find(r => r.model === model);
              return (
                <div key={i} className="text-sm p-3 bg-orange-50 rounded border border-orange-200">
                  <div className="font-medium text-gray-900">{model}</div>
                  {rec && <div className="text-xs text-gray-500 mt-1">{rec.suggestion}</div>}
                </div>
              );
            })}
          </div>
          {caching.modelsWithoutUniqueId.length > 5 && (
            <button
              onClick={() => setShowAllModels(!showAllModels)}
              className="mt-2 text-sm text-blue-600 hover:text-blue-800"
            >
              {showAllModels ? 'Show less' : `Show all ${caching.modelsWithoutUniqueId.length}`}
            </button>
          )}
        </div>
      )}
      
      <div className="bg-blue-50 rounded-lg border border-blue-200 p-4">
        <h4 className="text-sm font-medium text-blue-700 mb-2">💡 Why Cache Keys Matter</h4>
        <p className="text-sm text-blue-900">
          Unique identifiers (slug, code, externalId) enable efficient URL-based caching and API lookups,
          reducing database queries and improving response times.
        </p>
      </div>
    </div>
  );
}

// Enum/Taxonomy Recommendations Section
function EnumTaxonomyRecommendationsSection({ result }: { result: AuditResult }) {
  const recommendations = result.insights.enhancedPerformance?.enumTaxonomyRecommendations;
  const [showAll, setShowAll] = useState(false);
  
  if (!recommendations || recommendations.length === 0) {
    return (
      <div className="bg-green-50 rounded-lg border border-green-200 p-6 text-center">
        <span className="text-green-500 text-2xl">✓</span>
        <p className="text-sm text-green-700 mt-2">No String fields identified for type conversion.</p>
        <p className="text-xs text-green-600 mt-1">Your field types appear well-optimized.</p>
      </div>
    );
  }
  
  const enumRecs = recommendations.filter(r => r.recommendation === 'enum');
  const taxonomyRecs = recommendations.filter(r => r.recommendation === 'taxonomy');
  
  const displayedEnumRecs = showAll ? enumRecs : enumRecs.slice(0, 5);
  const displayedTaxonomyRecs = showAll ? taxonomyRecs : taxonomyRecs.slice(0, 3);

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="bg-white rounded-lg border p-4 flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-gray-900">Type Optimization Suggestions</h3>
          <p className="text-sm text-gray-500">{recommendations.length} String field(s) could be converted</p>
        </div>
        <div className="flex gap-2">
          <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded">
            {enumRecs.length} → Enum
          </span>
          <span className="text-xs bg-teal-100 text-teal-700 px-2 py-1 rounded">
            {taxonomyRecs.length} → Taxonomy
          </span>
        </div>
      </div>
      
      <p className="text-sm text-gray-600">
        These String fields have limited distinct values and could be converted to Enums or Taxonomies for better validation, UI selection, and query filtering.
      </p>
      
      {/* Enum Recommendations */}
      {enumRecs.length > 0 && (
        <div className="bg-white rounded-lg border border-purple-200 p-4">
          <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
            <span className="w-2 h-2 bg-purple-500 rounded-full"></span>
            Convert to Enum ({enumRecs.length})
          </h4>
          <p className="text-xs text-gray-500 mb-3">For fixed sets of values that rarely change.</p>
          <div className="space-y-3">
            {displayedEnumRecs.map((rec, i) => (
              <div key={i} className="text-sm p-3 bg-purple-50 rounded border border-purple-200">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-gray-900">{rec.model}.{rec.field}</span>
                  <span className="text-xs text-purple-600 font-medium">{rec.distinctValues.length} values</span>
                </div>
                <div className="text-xs text-gray-600 mb-2">{rec.reason}</div>
                <div className="flex flex-wrap gap-1">
                  {rec.distinctValues.slice(0, 8).map((v, j) => (
                    <span key={j} className="text-xs bg-white px-1.5 py-0.5 rounded border border-purple-200 text-purple-700">
                      {v}
                    </span>
                  ))}
                  {rec.distinctValues.length > 8 && (
                    <span className="text-xs text-gray-500">+{rec.distinctValues.length - 8} more</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Taxonomy Recommendations */}
      {taxonomyRecs.length > 0 && (
        <div className="bg-white rounded-lg border border-teal-200 p-4">
          <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
            <span className="w-2 h-2 bg-teal-500 rounded-full"></span>
            Convert to Taxonomy ({taxonomyRecs.length})
          </h4>
          <p className="text-xs text-gray-500 mb-3">For dynamic hierarchical values managed by editors.</p>
          <div className="space-y-3">
            {displayedTaxonomyRecs.map((rec, i) => (
              <div key={i} className="text-sm p-3 bg-teal-50 rounded border border-teal-200">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium text-gray-900">{rec.model}.{rec.field}</span>
                  <span className="text-xs text-teal-600 font-medium">{rec.distinctValues.length} values</span>
                </div>
                <div className="text-xs text-gray-600">{rec.reason}</div>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {(enumRecs.length > 5 || taxonomyRecs.length > 3) && (
        <button
          onClick={() => setShowAll(!showAll)}
          className="text-sm text-blue-600 hover:text-blue-800"
        >
          {showAll ? 'Show less' : `Show all ${recommendations.length} recommendations`}
        </button>
      )}
    </div>
  );
}

'use client';

import { useState } from 'react';
import type { AuditResult } from '@/lib/types';
import { CheckpointCard } from '../CheckpointCard';

interface PerformanceTabProps {
  result: AuditResult;
}

function CachingReadinessSection({ result }: { result: AuditResult }) {
  const caching = result.insights.enhancedPerformance?.cachingReadiness;
  const [showAllModels, setShowAllModels] = useState(false);
  
  if (!caching) {
    return null;
  }
  
  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600 bg-green-50 border-green-200';
    if (score >= 60) return 'text-yellow-600 bg-yellow-50 border-yellow-200';
    return 'text-red-600 bg-red-50 border-red-200';
  };
  
  const displayedWithout = showAllModels 
    ? caching.modelsWithoutUniqueId 
    : caching.modelsWithoutUniqueId.slice(0, 5);

  return (
    <div className="bg-white rounded-xl border p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-900">Caching Readiness</h3>
        <div className={`px-3 py-1 rounded-full text-sm font-medium border ${getScoreColor(caching.overallScore)}`}>
          {caching.overallScore}% Ready
        </div>
      </div>
      
      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="bg-green-50 rounded-lg p-3 text-center border border-green-100">
          <div className="text-2xl font-bold text-green-600">{caching.modelsWithUniqueId.length}</div>
          <div className="text-xs text-green-700">With Unique ID</div>
        </div>
        <div className={`rounded-lg p-3 text-center border ${caching.modelsWithoutUniqueId.length > 0 ? 'bg-orange-50 border-orange-100' : 'bg-green-50 border-green-100'}`}>
          <div className={`text-2xl font-bold ${caching.modelsWithoutUniqueId.length > 0 ? 'text-orange-600' : 'text-green-600'}`}>
            {caching.modelsWithoutUniqueId.length}
          </div>
          <div className={`text-xs ${caching.modelsWithoutUniqueId.length > 0 ? 'text-orange-700' : 'text-green-700'}`}>Without Unique ID</div>
        </div>
      </div>
      
      {/* Models with unique IDs */}
      {caching.modelsWithUniqueId.length > 0 && (
        <div className="mb-4">
          <h4 className="text-sm font-medium text-gray-700 mb-2">✓ Models with Cache Keys</h4>
          <div className="flex flex-wrap gap-2">
            {caching.modelsWithUniqueId.slice(0, 10).map((m, i) => (
              <span key={i} className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">
                {m.model} <span className="text-green-500">({m.field})</span>
              </span>
            ))}
            {caching.modelsWithUniqueId.length > 10 && (
              <span className="text-xs text-gray-500">+{caching.modelsWithUniqueId.length - 10} more</span>
            )}
          </div>
        </div>
      )}
      
      {/* Models without unique IDs */}
      {caching.modelsWithoutUniqueId.length > 0 && (
        <div className="mb-4">
          <h4 className="text-sm font-medium text-gray-700 mb-2">⚠️ Models Missing Unique Identifiers</h4>
          <div className="space-y-2">
            {displayedWithout.map((model, i) => {
              const rec = caching.cacheKeyRecommendations.find(r => r.model === model);
              return (
                <div key={i} className="text-sm p-2 bg-orange-50 rounded border border-orange-200">
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
      
      <p className="text-xs text-gray-500 mt-2">
        Unique identifiers (slug, code, externalId) enable efficient URL-based caching and API lookups.
      </p>
    </div>
  );
}

function EnumTaxonomyRecommendationsSection({ result }: { result: AuditResult }) {
  const recommendations = result.insights.enhancedPerformance?.enumTaxonomyRecommendations;
  const [showAll, setShowAll] = useState(false);
  
  if (!recommendations || recommendations.length === 0) {
    return null;
  }
  
  const enumRecs = recommendations.filter(r => r.recommendation === 'enum');
  const taxonomyRecs = recommendations.filter(r => r.recommendation === 'taxonomy');
  
  const displayedEnumRecs = showAll ? enumRecs : enumRecs.slice(0, 5);
  const displayedTaxonomyRecs = showAll ? taxonomyRecs : taxonomyRecs.slice(0, 3);

  return (
    <div className="bg-white rounded-xl border p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-900">Field Type Recommendations</h3>
        <span className="text-sm text-gray-500">{recommendations.length} suggestion(s)</span>
      </div>
      
      <p className="text-sm text-gray-600 mb-4">
        These String fields have limited distinct values and could be converted to Enums or Taxonomies for better validation and UX.
      </p>
      
      {/* Enum Recommendations */}
      {enumRecs.length > 0 && (
        <div className="mb-4">
          <h4 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
            <span className="w-2 h-2 bg-purple-500 rounded-full"></span>
            Convert to Enum ({enumRecs.length})
          </h4>
          <div className="space-y-2">
            {displayedEnumRecs.map((rec, i) => (
              <div key={i} className="text-sm p-3 bg-purple-50 rounded border border-purple-200">
                <div className="flex items-center justify-between mb-1">
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
        <div className="mb-4">
          <h4 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
            <span className="w-2 h-2 bg-teal-500 rounded-full"></span>
            Convert to Taxonomy ({taxonomyRecs.length})
          </h4>
          <div className="space-y-2">
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

export function PerformanceTab({ result }: PerformanceTabProps) {
  const { performance, relationships } = result.comprehensiveAssessment;

  return (
    <div className="space-y-6">
      {/* Performance Score */}
      <div className="bg-white rounded-xl border p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Performance Score</h2>
          <div className={`text-3xl font-bold ${
            performance.overallScore >= 80 ? 'text-green-600' :
            performance.overallScore >= 60 ? 'text-yellow-600' : 'text-red-600'
          }`}>
            {performance.overallScore}%
          </div>
        </div>
      </div>

      {/* Caching Readiness - NEW */}
      <CachingReadinessSection result={result} />
      
      {/* Enum/Taxonomy Recommendations - NEW */}
      <EnumTaxonomyRecommendationsSection result={result} />

      {/* Nested Components */}
      <div className="bg-white rounded-xl border p-4">
        <h3 className="font-semibold text-gray-900 mb-3">Nested Components</h3>
        {performance.nestedComponents.items.length === 0 ? (
          <p className="text-sm text-green-600">✓ No deeply nested components detected</p>
        ) : (
          <div className="space-y-2">
            {performance.nestedComponents.items.slice(0, 5).map((item, i) => (
              <div key={i} className="text-sm p-2 bg-yellow-50 rounded border border-yellow-200">
                <div className="font-medium text-gray-900">{item.component}</div>
                <div className="text-xs text-gray-500">
                  Depth: {item.depth} | Path: {item.path.join(' → ')}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Huge Models */}
      {performance.hugeModels.items.length > 0 && (
        <div className="bg-white rounded-xl border p-4">
          <h3 className="font-semibold text-gray-900 mb-3">Large Models</h3>
          <div className="space-y-2">
            {performance.hugeModels.items.map((item, i) => (
              <div key={i} className="flex items-center justify-between text-sm p-2 bg-red-50 rounded border border-red-200">
                <span className="font-medium text-gray-900">{item.model}</span>
                <span className="text-red-600">{item.fieldCount} fields</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Query Paths */}
      <CheckpointCard checkpoint={performance.deepQueryPaths} />
      <CheckpointCard checkpoint={performance.recursiveChains} />

      {/* Relationships */}
      <CheckpointCard checkpoint={relationships.queryCost} />
      <CheckpointCard checkpoint={relationships.circularReferences} />
    </div>
  );
}

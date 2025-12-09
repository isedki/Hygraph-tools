'use client';

import type { AuditResult } from '@/lib/types';
import { CheckpointCard } from '../CheckpointCard';

interface PerformanceTabProps {
  result: AuditResult;
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

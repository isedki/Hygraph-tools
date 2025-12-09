'use client';

import type { AuditResult } from '@/lib/types';
import { CheckpointGrid } from '../CheckpointCard';

interface ContentArchitectureTabProps {
  result: AuditResult;
}

export function ContentArchitectureTab({ result }: ContentArchitectureTabProps) {
  const { contentArchitecture } = result.comprehensiveAssessment;

  const checkpoints = [
    contentArchitecture.taxonomySummary,
    contentArchitecture.hierarchySummary,
    contentArchitecture.navigationReadiness,
  ];

  return (
    <div className="space-y-8">
      <CheckpointGrid checkpoints={checkpoints} title="Information Architecture" />

      {/* Content Distribution Table */}
      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="px-4 py-3 border-b bg-gray-50">
          <h3 className="font-semibold text-gray-900">Content Distribution</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-2 text-left font-medium text-gray-600">Model</th>
                <th className="px-4 py-2 text-right font-medium text-gray-600">Total</th>
                <th className="px-4 py-2 text-right font-medium text-gray-600">Published</th>
                <th className="px-4 py-2 text-right font-medium text-gray-600">Draft Only</th>
                <th className="px-4 py-2 text-right font-medium text-gray-600">%</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {contentArchitecture.contentDistribution.slice(0, 15).map((entry, i) => (
                <tr key={i} className="hover:bg-gray-50">
                  <td className="px-4 py-2 font-medium text-gray-900">{entry.model}</td>
                  <td className="px-4 py-2 text-right font-medium text-gray-900">{entry.total.toLocaleString()}</td>
                  <td className="px-4 py-2 text-right text-green-600">{entry.published.toLocaleString()}</td>
                  <td className="px-4 py-2 text-right text-yellow-600">{entry.draft > 0 ? entry.draft.toLocaleString() : '-'}</td>
                  <td className="px-4 py-2 text-right text-gray-500">{entry.percentage}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Faceted Filtering */}
      <div className="bg-white rounded-xl border p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900">Faceted Filtering Readiness</h3>
          <span className={`text-2xl font-bold ${
            contentArchitecture.facetedFiltering.score >= 70 ? 'text-green-600' :
            contentArchitecture.facetedFiltering.score >= 40 ? 'text-yellow-600' : 'text-red-600'
          }`}>
            {contentArchitecture.facetedFiltering.score}%
          </span>
        </div>
        
        {/* Filterable Fields Breakdown */}
        {contentArchitecture.facetedFiltering.filterableFields.length > 0 && (
          <div className="mb-4">
            <div className="text-sm font-medium text-gray-700 mb-2">
              {contentArchitecture.facetedFiltering.filterableFields.length} filterable field(s) found:
            </div>
            <div className="grid grid-cols-3 gap-2 text-xs">
              {(() => {
                const byType = {
                  enum: contentArchitecture.facetedFiltering.filterableFields.filter(f => f.type === 'enum'),
                  reference: contentArchitecture.facetedFiltering.filterableFields.filter(f => f.type === 'reference'),
                  boolean: contentArchitecture.facetedFiltering.filterableFields.filter(f => f.type === 'boolean'),
                };
                return (
                  <>
                    <div className="bg-purple-50 rounded p-2">
                      <div className="font-medium text-purple-800">{byType.enum.length} Enum</div>
                      <div className="text-purple-600 mt-1">
                        {byType.enum.slice(0, 3).map(f => f.field).join(', ')}
                        {byType.enum.length > 3 && '...'}
                      </div>
                    </div>
                    <div className="bg-blue-50 rounded p-2">
                      <div className="font-medium text-blue-800">{byType.reference.length} Reference</div>
                      <div className="text-blue-600 mt-1">
                        {byType.reference.slice(0, 3).map(f => f.field).join(', ')}
                        {byType.reference.length > 3 && '...'}
                      </div>
                    </div>
                    <div className="bg-gray-50 rounded p-2">
                      <div className="font-medium text-gray-800">{byType.boolean.length} Boolean</div>
                      <div className="text-gray-600 mt-1">
                        {byType.boolean.slice(0, 3).map(f => f.field).join(', ')}
                        {byType.boolean.length > 3 && '...'}
                      </div>
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        )}

        {/* Gaps */}
        {contentArchitecture.facetedFiltering.gaps.length > 0 && (
          <div>
            <div className="text-sm font-medium text-yellow-700 mb-2">Gaps:</div>
            <ul className="text-sm text-gray-600 space-y-1">
              {contentArchitecture.facetedFiltering.gaps.slice(0, 3).map((gap, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="text-yellow-500">⚠</span>
                  <span>{gap}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Score Explanation */}
        <div className="mt-3 text-xs text-gray-500 border-t pt-3">
          Score = avg filterable fields per content model × 25 (capped at 100)
        </div>
      </div>
    </div>
  );
}

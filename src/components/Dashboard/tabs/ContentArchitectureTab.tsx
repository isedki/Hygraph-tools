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
                <th className="px-4 py-2 text-right font-medium text-gray-600">Draft</th>
                <th className="px-4 py-2 text-right font-medium text-gray-600">Published</th>
                <th className="px-4 py-2 text-right font-medium text-gray-600">Total</th>
                <th className="px-4 py-2 text-right font-medium text-gray-600">%</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {contentArchitecture.contentDistribution.slice(0, 15).map((entry, i) => (
                <tr key={i} className="hover:bg-gray-50">
                  <td className="px-4 py-2 font-medium text-gray-900">{entry.model}</td>
                  <td className="px-4 py-2 text-right text-gray-600">{entry.draft}</td>
                  <td className="px-4 py-2 text-right text-gray-600">{entry.published}</td>
                  <td className="px-4 py-2 text-right font-medium text-gray-900">{entry.total}</td>
                  <td className="px-4 py-2 text-right text-gray-500">{entry.percentage}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Faceted Filtering */}
      <div className="bg-white rounded-xl border p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-gray-900">Faceted Filtering Readiness</h3>
          <span className={`text-2xl font-bold ${
            contentArchitecture.facetedFiltering.score >= 70 ? 'text-green-600' :
            contentArchitecture.facetedFiltering.score >= 40 ? 'text-yellow-600' : 'text-red-600'
          }`}>
            {contentArchitecture.facetedFiltering.score}%
          </span>
        </div>
        {contentArchitecture.facetedFiltering.gaps.length > 0 && (
          <ul className="text-sm text-gray-600 space-y-1">
            {contentArchitecture.facetedFiltering.gaps.slice(0, 3).map((gap, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="text-yellow-500">⚠</span>
                <span>{gap}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

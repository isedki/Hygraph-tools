'use client';

import type { AuditResult } from '@/lib/types';
import { CheckpointGrid } from '../CheckpointCard';

interface ReusabilityTabProps {
  result: AuditResult;
}

export function ReusabilityTab({ result }: ReusabilityTabProps) {
  const { reusability, duplicates } = result.comprehensiveAssessment;

  const checkpoints = [
    reusability.sharedContent,
    reusability.sharedComponents,
    reusability.layoutFlexibility,
  ];

  return (
    <div className="space-y-8">
      {/* Reuse Score */}
      <div className="bg-white rounded-xl border p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Reuse Score</h2>
          <div className={`text-3xl font-bold ${
            reusability.reuseScore >= 70 ? 'text-green-600' :
            reusability.reuseScore >= 50 ? 'text-yellow-600' : 'text-red-600'
          }`}>
            {reusability.reuseScore}%
          </div>
        </div>
        <div className="space-y-2">
          {reusability.reuseScoreBreakdown.map((item, i) => (
            <div key={i} className="flex items-center justify-between text-sm">
              <span className="text-gray-600">{item.reason}</span>
              <span className={item.value >= 0 ? 'text-green-600' : 'text-red-600'}>
                {item.value > 0 ? '+' : ''}{item.value}
              </span>
            </div>
          ))}
        </div>
      </div>

      <CheckpointGrid checkpoints={checkpoints} title="Reusability Checkpoints" />

      {/* Content vs Presentation */}
      {reusability.contentVsPresentation.leakyModels.length > 0 && (
        <div className="bg-white rounded-xl border overflow-hidden">
          <div className="px-4 py-3 border-b bg-gray-50 flex items-center justify-between">
            <h3 className="font-semibold text-gray-900">Content vs Presentation Analysis</h3>
            <span className="text-sm text-gray-500">
              Separation Score: {reusability.contentVsPresentation.overallLeakageScore}%
            </span>
          </div>
          <div className="p-4 space-y-3">
            {reusability.contentVsPresentation.leakyModels.slice(0, 5).map((model, i) => (
              <div key={i} className="text-sm">
                <div className="font-medium text-gray-900 mb-1">{model.model}</div>
                <div className="flex gap-4 text-xs">
                  <span className="text-green-600">{model.contentCount} content</span>
                  <span className="text-yellow-600">{model.configCount} config</span>
                  <span className="text-red-600">{model.presentationCount} presentation</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Duplicates Summary */}
      {(duplicates.enums.groups.length > 0 || duplicates.components.groups.length > 0 || duplicates.models.groups.length > 0) && (
        <div className="bg-yellow-50 rounded-xl border border-yellow-200 p-4">
          <h3 className="font-semibold text-yellow-900 mb-3">Potential Duplicates</h3>
          <div className="space-y-2 text-sm">
            {duplicates.enums.groups.length > 0 && (
              <div className="text-yellow-700">
                • {duplicates.enums.groups.length} duplicate enum group(s)
              </div>
            )}
            {duplicates.components.groups.length > 0 && (
              <div className="text-yellow-700">
                • {duplicates.components.groups.length} similar component group(s)
              </div>
            )}
            {duplicates.models.groups.length > 0 && (
              <div className="text-yellow-700">
                • {duplicates.models.groups.length} overlapping model group(s)
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

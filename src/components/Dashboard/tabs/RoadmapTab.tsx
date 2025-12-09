'use client';

import type { AuditResult } from '@/lib/types';

interface RoadmapTabProps {
  result: AuditResult;
}

export function RoadmapTab({ result }: RoadmapTabProps) {
  const { comprehensiveAssessment } = result;
  
  // Collect all action items from assessments
  const actionItems: { action: string; priority: 'high' | 'medium' | 'low'; category: string }[] = [];

  // Issues (high priority)
  const issueCheckpoints = [
    { checkpoint: comprehensiveAssessment.structure.redundantModels, category: 'Structure' },
    { checkpoint: comprehensiveAssessment.structure.enumAnalysis.singleValueEnums, category: 'Enums' },
    { checkpoint: comprehensiveAssessment.performance.deepQueryPaths, category: 'Performance' },
    { checkpoint: comprehensiveAssessment.relationships.circularReferences, category: 'Relationships' },
  ];

  for (const { checkpoint, category } of issueCheckpoints) {
    if (checkpoint.status === 'issue') {
      checkpoint.actionItems.forEach(action => {
        actionItems.push({ action, priority: 'high', category });
      });
    }
  }

  // Warnings (medium priority)
  const warningCheckpoints = [
    { checkpoint: comprehensiveAssessment.structure.componentUsage, category: 'Components' },
    { checkpoint: comprehensiveAssessment.reusability.sharedContent, category: 'Reusability' },
    { checkpoint: comprehensiveAssessment.contentArchitecture.navigationReadiness, category: 'Navigation' },
  ];

  for (const { checkpoint, category } of warningCheckpoints) {
    if (checkpoint.status === 'warning') {
      checkpoint.actionItems.slice(0, 2).forEach(action => {
        actionItems.push({ action, priority: 'medium', category });
      });
    }
  }

  // Quick wins from strategic report
  const quickWins = result.strategicReport.executiveSummary.quickWins.slice(0, 3);

  return (
    <div className="space-y-6">
      {/* Quick Wins */}
      {quickWins.length > 0 && (
        <div className="bg-green-50 rounded-xl border border-green-200 p-4">
          <h3 className="font-semibold text-green-900 mb-3">⚡ Quick Wins (Start Here)</h3>
          <ul className="space-y-2">
            {quickWins.map((win, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-green-700">
                <input type="checkbox" className="mt-1 rounded border-green-300" />
                <span>{win}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* High Priority */}
      {actionItems.filter(a => a.priority === 'high').length > 0 && (
        <div className="bg-red-50 rounded-xl border border-red-200 p-4">
          <h3 className="font-semibold text-red-900 mb-3">🔴 High Priority</h3>
          <ul className="space-y-2">
            {actionItems.filter(a => a.priority === 'high').slice(0, 5).map((item, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-red-700">
                <input type="checkbox" className="mt-1 rounded border-red-300" />
                <div>
                  <span className="text-xs text-red-500 mr-2">[{item.category}]</span>
                  {item.action}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Medium Priority */}
      {actionItems.filter(a => a.priority === 'medium').length > 0 && (
        <div className="bg-yellow-50 rounded-xl border border-yellow-200 p-4">
          <h3 className="font-semibold text-yellow-900 mb-3">🟡 Medium Priority</h3>
          <ul className="space-y-2">
            {actionItems.filter(a => a.priority === 'medium').slice(0, 5).map((item, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-yellow-700">
                <input type="checkbox" className="mt-1 rounded border-yellow-300" />
                <div>
                  <span className="text-xs text-yellow-500 mr-2">[{item.category}]</span>
                  {item.action}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Strategic Recommendations */}
      {result.strategicReport.executiveSummary.strategicRecommendations.length > 0 && (
        <div className="bg-blue-50 rounded-xl border border-blue-200 p-4">
          <h3 className="font-semibold text-blue-900 mb-3">📋 Strategic Recommendations</h3>
          <ul className="space-y-2">
            {result.strategicReport.executiveSummary.strategicRecommendations.slice(0, 4).map((rec, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-blue-700">
                <span className="mt-0.5">→</span>
                <span>{rec}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

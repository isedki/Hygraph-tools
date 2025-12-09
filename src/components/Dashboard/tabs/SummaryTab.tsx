'use client';

import type { AuditResult } from '@/lib/types';

interface SummaryTabProps {
  result: AuditResult;
}

export function SummaryTab({ result }: SummaryTabProps) {
  const { comprehensiveAssessment, strategicReport, structuralObservations } = result;
  
  // Count statuses across all assessments
  const allCheckpoints = [
    comprehensiveAssessment.structure.distinctContentTypes,
    comprehensiveAssessment.structure.pageVsContentSeparation,
    comprehensiveAssessment.structure.redundantModels,
    comprehensiveAssessment.structure.componentUsage,
    comprehensiveAssessment.contentArchitecture.taxonomySummary,
    comprehensiveAssessment.contentArchitecture.hierarchySummary,
    comprehensiveAssessment.contentArchitecture.navigationReadiness,
    comprehensiveAssessment.reusability.sharedContent,
    comprehensiveAssessment.reusability.sharedComponents,
    comprehensiveAssessment.performance.deepQueryPaths,
    comprehensiveAssessment.performance.recursiveChains,
  ];

  const goodCount = allCheckpoints.filter(c => c.status === 'good').length;
  const warningCount = allCheckpoints.filter(c => c.status === 'warning').length;
  const issueCount = allCheckpoints.filter(c => c.status === 'issue').length;

  // Helper to render markdown-style bold text
  const renderObservationText = (text: string) => {
    const parts = text.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i} className="font-semibold text-gray-900">{part.slice(2, -2)}</strong>;
      }
      return <span key={i}>{part}</span>;
    });
  };

  return (
    <div className="space-y-6">
      {/* Structural Observations */}
      {structuralObservations && structuralObservations.length > 0 && (
        <div className="bg-slate-50 rounded-xl border border-slate-200 p-5">
          <h3 className="font-semibold text-gray-900 mb-3">Structural Observations</h3>
          <ul className="space-y-2">
            {structuralObservations.map((obs, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                <span className="text-slate-400 select-none">-</span>
                <span>{renderObservationText(obs.text)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Overall Score */}
      <div className="bg-white rounded-xl border p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-900">Schema Health Score</h2>
          <div className={`text-4xl font-bold ${
            result.overallScore >= 80 ? 'text-green-600' :
            result.overallScore >= 60 ? 'text-yellow-600' : 'text-red-600'
          }`}>
            {result.overallScore}
          </div>
        </div>
        
        {/* Status Summary */}
        <div className="flex gap-6 text-sm">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-green-500"></span>
            <span className="text-gray-600">{goodCount} Good</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-yellow-500"></span>
            <span className="text-gray-600">{warningCount} Warnings</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-red-500"></span>
            <span className="text-gray-600">{issueCount} Issues</span>
          </div>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard label="Models" value={strategicReport.executiveSummary.metrics.customModels} />
        <MetricCard label="Components" value={strategicReport.executiveSummary.metrics.components} />
        <MetricCard label="Enums" value={strategicReport.executiveSummary.metrics.enums} />
        <MetricCard label="Reuse Score" value={`${comprehensiveAssessment.reusability.reuseScore}%`} />
      </div>

      {/* Key Findings */}
      <div className="bg-white rounded-xl border p-6">
        <h3 className="font-semibold text-gray-900 mb-3">Key Findings</h3>
        <ul className="space-y-2">
          {strategicReport.executiveSummary.keyFindings.slice(0, 5).map((finding, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
              <span className="text-blue-500 mt-0.5">•</span>
              <span>{finding}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Quick Wins */}
      {strategicReport.executiveSummary.quickWins.length > 0 && (
        <div className="bg-green-50 rounded-xl border border-green-200 p-6">
          <h3 className="font-semibold text-green-900 mb-3">⚡ Quick Wins</h3>
          <ul className="space-y-2">
            {strategicReport.executiveSummary.quickWins.slice(0, 3).map((win, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-green-700">
                <span className="mt-0.5">→</span>
                <span>{win}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-white rounded-lg border p-4 text-center">
      <div className="text-2xl font-bold text-gray-900">{value}</div>
      <div className="text-sm text-gray-500">{label}</div>
    </div>
  );
}

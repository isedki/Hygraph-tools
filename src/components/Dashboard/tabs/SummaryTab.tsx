'use client';

import type { AuditResult, CheckpointResult } from '@/lib/types';

interface SummaryTabProps {
  result: AuditResult;
}

export function SummaryTab({ result }: SummaryTabProps) {
  const { comprehensiveAssessment, strategicReport, structuralObservations, schema } = result;
  
  // Calculate totals
  const totalModels = schema.modelCount;
  const totalComponents = schema.componentCount;
  const totalEnums = schema.enumCount;
  const totalTaxonomies = comprehensiveAssessment.contentArchitecture.taxonomyModels.length;
  
  // Get content distribution
  const contentDist = comprehensiveAssessment.contentArchitecture.contentDistribution;
  const totalEntries = contentDist.reduce((sum, d) => sum + d.total, 0);
  const topModels = contentDist
    .filter(d => d.total > 0)
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);
  
  // Find Asset model
  const assetModel = contentDist.find(d => d.model === 'Asset');
  
  // Detect localization
  const localizationCheckpoint = comprehensiveAssessment.structure.localization;
  const localesCount = localizationCheckpoint.findings?.[0]?.match(/\d+/)?.[0] || '0';
  
  // Detect platform purpose from top models
  const detectPurpose = () => {
    const modelNames = topModels.map(m => m.model.toLowerCase()).join(' ');
    if (modelNames.includes('product') || modelNames.includes('page')) return 'e-commerce';
    if (modelNames.includes('article') || modelNames.includes('post')) return 'blog & publication';
    if (modelNames.includes('course') || modelNames.includes('lesson')) return 'learning';
    if (modelNames.includes('tour') || modelNames.includes('stay') || modelNames.includes('place')) return 'travel content';
    return 'content';
  };
  
  const platformPurpose = detectPurpose();
  
  // Collect all critical issues (status='issue')
  const allCheckpoints: CheckpointResult[] = [
    comprehensiveAssessment.structure.distinctContentTypes,
    comprehensiveAssessment.structure.pageVsContentSeparation,
    comprehensiveAssessment.structure.redundantModels,
    comprehensiveAssessment.structure.overlappingModels,
    comprehensiveAssessment.structure.fieldNaming,
    comprehensiveAssessment.structure.componentUsage,
    comprehensiveAssessment.structure.componentReordering,
    comprehensiveAssessment.structure.rteUsage,
    comprehensiveAssessment.structure.localization,
    comprehensiveAssessment.structure.assetCentralization,
    comprehensiveAssessment.structure.enumAnalysis.singleValueEnums,
    comprehensiveAssessment.structure.enumAnalysis.oversizedEnums,
    comprehensiveAssessment.structure.enumAnalysis.enumBasedTenancy,
    comprehensiveAssessment.structure.enumAnalysis.duplicateEnums,
    comprehensiveAssessment.structure.enumAnalysis.unusedEnums,
    comprehensiveAssessment.contentArchitecture.taxonomySummary,
    comprehensiveAssessment.contentArchitecture.hierarchySummary,
    comprehensiveAssessment.contentArchitecture.navigationReadiness,
    comprehensiveAssessment.reusability.sharedContent,
    comprehensiveAssessment.reusability.sharedComponents,
    comprehensiveAssessment.reusability.layoutFlexibility,
    comprehensiveAssessment.performance.deepQueryPaths,
    comprehensiveAssessment.performance.recursiveChains,
    comprehensiveAssessment.relationships.queryCost,
    comprehensiveAssessment.relationships.circularReferences,
  ];
  
  const criticalIssues = allCheckpoints
    .filter(c => c.status === 'issue')
    .slice(0, 5);
  
  const warnings = allCheckpoints.filter(c => c.status === 'warning').length;
  const issues = allCheckpoints.filter(c => c.status === 'issue').length;
  const good = allCheckpoints.filter(c => c.status === 'good').length;
  
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
      {/* Executive Summary Header */}
      <div className="bg-gradient-to-br from-purple-50 to-cyan-50 rounded-xl border border-purple-200 p-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-3">Executive Summary</h2>
        <p className="text-gray-700 leading-relaxed">
          This audit analyzed a <strong>{platformPurpose} platform</strong> built on Hygraph with{' '}
          <strong>{totalModels} models</strong>, <strong>{totalComponents} components</strong>, and{' '}
          <strong>{totalEntries.toLocaleString()} content entries</strong>.{' '}
          {issues > 0 && <span className="text-red-600">The analysis revealed {issues} critical issue{issues !== 1 ? 's' : ''} </span>}
          {warnings > 0 && <span className="text-yellow-600">and {warnings} warning{warnings !== 1 ? 's' : ''} </span>}
          across schema design, content architecture, and system performance.
        </p>
      </div>

      {/* Overall Score */}
      <div className="bg-white rounded-xl border p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Schema Health Score</h3>
            <p className="text-sm text-gray-500 mt-1">{allCheckpoints.length} checkpoints analyzed</p>
          </div>
          <div className={`text-5xl font-bold ${
            result.overallScore >= 80 ? 'text-green-600' :
            result.overallScore >= 60 ? 'text-yellow-600' : 'text-red-600'
          }`}>
            {result.overallScore}
          </div>
        </div>
        
        {/* Status Summary */}
        <div className="flex gap-6 pt-4 border-t">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-green-500"></span>
            <span className="text-sm font-medium text-gray-900">{good}</span>
            <span className="text-sm text-gray-600">Good</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-yellow-500"></span>
            <span className="text-sm font-medium text-gray-900">{warnings}</span>
            <span className="text-sm text-gray-600">Warnings</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-red-500"></span>
            <span className="text-sm font-medium text-gray-900">{issues}</span>
            <span className="text-sm text-gray-600">Issues</span>
          </div>
        </div>
      </div>

      {/* Key Statistics Table */}
      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="px-6 py-4 border-b bg-gray-50">
          <h3 className="font-semibold text-gray-900">Key Statistics</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Metric</th>
                <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700">Value</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              <tr className="hover:bg-gray-50">
                <td className="px-6 py-3 text-sm text-gray-700">Total Models</td>
                <td className="px-6 py-3 text-sm font-medium text-gray-900 text-right">{totalModels}</td>
              </tr>
              <tr className="hover:bg-gray-50">
                <td className="px-6 py-3 text-sm text-gray-700">Total Components</td>
                <td className="px-6 py-3 text-sm font-medium text-gray-900 text-right">{totalComponents}</td>
              </tr>
              <tr className="hover:bg-gray-50">
                <td className="px-6 py-3 text-sm text-gray-700">Total Enums</td>
                <td className="px-6 py-3 text-sm font-medium text-gray-900 text-right">{totalEnums}</td>
              </tr>
              {totalTaxonomies > 0 && (
                <tr className="hover:bg-gray-50">
                  <td className="px-6 py-3 text-sm text-gray-700">Taxonomies</td>
                  <td className="px-6 py-3 text-sm font-medium text-gray-900 text-right">{totalTaxonomies}</td>
                </tr>
              )}
              <tr className="hover:bg-gray-50">
                <td className="px-6 py-3 text-sm text-gray-700">Total Content Entries</td>
                <td className="px-6 py-3 text-sm font-medium text-gray-900 text-right">{totalEntries.toLocaleString()}</td>
              </tr>
              {topModels.map((model, i) => (
                <tr key={i} className="hover:bg-gray-50 bg-blue-50/30">
                  <td className="px-6 py-3 text-sm text-gray-600 pl-12">↳ {model.model}</td>
                  <td className="px-6 py-3 text-sm text-gray-700 text-right">
                    {model.total.toLocaleString()}
                    {model.draft > 0 && (
                      <span className="text-xs text-gray-500 ml-2">
                        ({model.published.toLocaleString()} published)
                      </span>
                    )}
                  </td>
                </tr>
              ))}
              {assetModel && assetModel.total > 0 && (
                <tr className="hover:bg-gray-50">
                  <td className="px-6 py-3 text-sm text-gray-700">Assets</td>
                  <td className="px-6 py-3 text-sm font-medium text-gray-900 text-right">{assetModel.total.toLocaleString()}</td>
                </tr>
              )}
              {localesCount !== '0' && (
                <tr className="hover:bg-gray-50">
                  <td className="px-6 py-3 text-sm text-gray-700">Supported Locales</td>
                  <td className="px-6 py-3 text-sm font-medium text-gray-900 text-right">{localesCount} languages</td>
                </tr>
              )}
              <tr className="hover:bg-gray-50 bg-purple-50/30">
                <td className="px-6 py-3 text-sm font-medium text-gray-700">Reuse Score</td>
                <td className="px-6 py-3 text-sm font-bold text-purple-600 text-right">{comprehensiveAssessment.reusability.reuseScore}%</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Structural Observations */}
      {structuralObservations && structuralObservations.length > 0 && (
        <div className="bg-slate-50 rounded-xl border border-slate-200 p-6">
          <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            Structural Observations
          </h3>
          <ul className="space-y-2.5">
            {structuralObservations.map((obs, i) => (
              <li key={i} className="flex items-start gap-3 text-sm text-gray-700">
                <span className="text-slate-400 select-none mt-0.5">•</span>
                <span>{renderObservationText(obs.text)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Critical Issues */}
      {criticalIssues.length > 0 && (
        <div className="bg-red-50 rounded-xl border border-red-200 p-6">
          <h3 className="font-semibold text-red-900 mb-4 flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            Critical Issues ({criticalIssues.length})
          </h3>
          <div className="space-y-3">
            {criticalIssues.map((issue, i) => (
              <div key={i} className="bg-white rounded-lg p-4 border border-red-200">
                <h4 className="font-medium text-red-900 mb-2">{issue.title}</h4>
                {issue.findings.length > 0 && (
                  <ul className="space-y-1.5">
                    {issue.findings.slice(0, 3).map((finding, j) => (
                      <li key={j} className="text-sm text-red-700 flex items-start gap-2">
                        <span className="mt-0.5">→</span>
                        <span>{finding}</span>
                      </li>
                    ))}
                    {issue.findings.length > 3 && (
                      <li className="text-sm text-red-600 italic">
                        + {issue.findings.length - 3} more
                      </li>
                    )}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick Wins */}
      {strategicReport.executiveSummary.quickWins.length > 0 && (
        <div className="bg-green-50 rounded-xl border border-green-200 p-6">
          <h3 className="font-semibold text-green-900 mb-4 flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            Quick Wins
          </h3>
          <ul className="space-y-2">
            {strategicReport.executiveSummary.quickWins.slice(0, 5).map((win, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-green-700">
                <span className="text-green-500 mt-0.5">✓</span>
                <span>{win}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

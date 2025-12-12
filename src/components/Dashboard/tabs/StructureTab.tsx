'use client';

import { useState } from 'react';
import type { AuditResult } from '@/lib/types';
import { CheckpointGrid } from '../CheckpointCard';

interface StructureTabProps {
  result: AuditResult;
}

function DataQualitySection({ result }: { result: AuditResult }) {
  const emptyFields = result.insights.emptyFields;
  const [sortField, setSortField] = useState<'fillRate' | 'model'>('fillRate');
  const [showAll, setShowAll] = useState(false);
  
  if (!emptyFields) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Data Quality</h3>
        <p className="text-gray-500">No data quality analysis available. Run audit with content to see results.</p>
      </div>
    );
  }
  
  const sortedFillRates = [...emptyFields.fieldFillRates].sort((a, b) => {
    if (sortField === 'fillRate') return a.fillRate - b.fillRate;
    return a.model.localeCompare(b.model);
  });
  
  const displayedFields = showAll ? sortedFillRates : sortedFillRates.slice(0, 20);
  
  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600 bg-green-50';
    if (score >= 60) return 'text-yellow-600 bg-yellow-50';
    if (score >= 40) return 'text-orange-600 bg-orange-50';
    return 'text-red-600 bg-red-50';
  };
  
  const getFillRateBar = (rate: number) => {
    const color = rate >= 80 ? 'bg-green-500' : rate >= 50 ? 'bg-yellow-500' : rate >= 20 ? 'bg-orange-500' : 'bg-red-500';
    return (
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div className={`${color} h-2 rounded-full`} style={{ width: `${rate}%` }} />
      </div>
    );
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Data Quality</h3>
        <div className={`px-3 py-1 rounded-full text-sm font-medium ${getScoreColor(emptyFields.overallDataQuality)}`}>
          {emptyFields.overallDataQuality}% Quality Score
        </div>
      </div>
      
      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-gray-50 rounded-lg p-3">
          <div className="text-2xl font-bold text-gray-900">{emptyFields.modelSummary.length}</div>
          <div className="text-sm text-gray-600">Models Analyzed</div>
        </div>
        <div className="bg-red-50 rounded-lg p-3">
          <div className="text-2xl font-bold text-red-600">{emptyFields.unusedOptionalFields.length}</div>
          <div className="text-sm text-gray-600">Unused Fields</div>
        </div>
        <div className="bg-orange-50 rounded-lg p-3">
          <div className="text-2xl font-bold text-orange-600">{emptyFields.rarelyUsedFields.length}</div>
          <div className="text-sm text-gray-600">Rarely Used</div>
        </div>
        <div className="bg-yellow-50 rounded-lg p-3">
          <div className="text-2xl font-bold text-yellow-600">{emptyFields.dataQualityIssues.length}</div>
          <div className="text-sm text-gray-600">Quality Issues</div>
        </div>
      </div>
      
      {/* Data Quality Issues (Required fields with low fill) */}
      {emptyFields.dataQualityIssues.length > 0 && (
        <div className="border-t border-gray-200 pt-4">
          <h4 className="text-sm font-medium text-gray-700 mb-3">⚠️ Required Fields with Low Fill Rate</h4>
          <div className="space-y-2">
            {emptyFields.dataQualityIssues.slice(0, 5).map((issue, i) => (
              <div key={i} className="flex items-center justify-between bg-yellow-50 rounded px-3 py-2">
                <span className="text-sm">
                  <span className="font-medium">{issue.model}</span>
                  <span className="text-gray-500">.{issue.field}</span>
                </span>
                <span className="text-sm font-medium text-yellow-700">{issue.fillRate}% filled</span>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Unused Fields */}
      {emptyFields.unusedOptionalFields.length > 0 && (
        <div className="border-t border-gray-200 pt-4">
          <h4 className="text-sm font-medium text-gray-700 mb-3">🗑️ Completely Unused Optional Fields</h4>
          <div className="flex flex-wrap gap-2">
            {emptyFields.unusedOptionalFields.slice(0, 10).map((field, i) => (
              <span key={i} className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded">
                {field.model}.{field.field}
              </span>
            ))}
            {emptyFields.unusedOptionalFields.length > 10 && (
              <span className="text-xs text-gray-500">+{emptyFields.unusedOptionalFields.length - 10} more</span>
            )}
          </div>
        </div>
      )}
      
      {/* Field Fill Rates Table */}
      <div className="border-t border-gray-200 pt-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-medium text-gray-700">Field Fill Rates</h4>
          <div className="flex items-center gap-2">
            <select
              value={sortField}
              onChange={(e) => setSortField(e.target.value as 'fillRate' | 'model')}
              className="text-sm border border-gray-300 rounded px-2 py-1"
            >
              <option value="fillRate">Sort by Fill Rate</option>
              <option value="model">Sort by Model</option>
            </select>
          </div>
        </div>
        
        {emptyFields.fieldFillRates.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 px-2 font-medium text-gray-600">Model</th>
                  <th className="text-left py-2 px-2 font-medium text-gray-600">Field</th>
                  <th className="text-left py-2 px-2 font-medium text-gray-600 w-32">Fill Rate</th>
                  <th className="text-right py-2 px-2 font-medium text-gray-600">Sample</th>
                </tr>
              </thead>
              <tbody>
                {displayedFields.map((field, i) => (
                  <tr key={i} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-2 px-2 font-medium">{field.model}</td>
                    <td className="py-2 px-2">
                      {field.field}
                      {field.isRequired && <span className="text-red-500 ml-1">*</span>}
                    </td>
                    <td className="py-2 px-2">
                      <div className="flex items-center gap-2">
                        <div className="w-20">{getFillRateBar(field.fillRate)}</div>
                        <span className={`text-xs font-medium ${field.fillRate < 20 ? 'text-red-600' : field.fillRate < 50 ? 'text-orange-600' : 'text-gray-600'}`}>
                          {field.fillRate}%
                        </span>
                      </div>
                    </td>
                    <td className="py-2 px-2 text-right text-gray-500">{field.isFilled}/{field.sampleSize}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            
            {sortedFillRates.length > 20 && (
              <button
                onClick={() => setShowAll(!showAll)}
                className="mt-3 text-sm text-blue-600 hover:text-blue-800"
              >
                {showAll ? 'Show less' : `Show all ${sortedFillRates.length} fields`}
              </button>
            )}
          </div>
        ) : (
          <p className="text-gray-500 text-sm">No field data available</p>
        )}
      </div>
      
      {/* Recommendations */}
      {emptyFields.recommendations.length > 0 && (
        <div className="border-t border-gray-200 pt-4">
          <h4 className="text-sm font-medium text-gray-700 mb-3">💡 Recommendations</h4>
          <ul className="space-y-2">
            {emptyFields.recommendations.map((rec, i) => (
              <li key={i} className="text-sm text-gray-600 flex items-start gap-2">
                <span className="text-gray-400 mt-1">•</span>
                <span>{rec}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export function StructureTab({ result }: StructureTabProps) {
  const { structure } = result.comprehensiveAssessment;

  const coreCheckpoints = [
    structure.distinctContentTypes,
    structure.pageVsContentSeparation,
    structure.redundantModels,
    structure.overlappingModels,
    structure.fieldNaming,
  ];

  const componentCheckpoints = [
    structure.componentUsage,
    structure.componentReordering,
    structure.rteUsage,
  ];

  const advancedCheckpoints = [
    structure.localization,
    structure.recursiveChains,
    structure.assetCentralization,
  ];

  const enumCheckpoints = [
    structure.enumAnalysis.singleValueEnums,
    structure.enumAnalysis.oversizedEnums,
    structure.enumAnalysis.enumBasedTenancy,
    structure.enumAnalysis.duplicateEnums,
    structure.enumAnalysis.unusedEnums,
  ];

  return (
    <div className="space-y-8">
      <CheckpointGrid checkpoints={coreCheckpoints} title="Model Organization" />
      <CheckpointGrid checkpoints={componentCheckpoints} title="Component Usage" />
      <CheckpointGrid checkpoints={advancedCheckpoints} title="Advanced Patterns" />
      <CheckpointGrid checkpoints={enumCheckpoints} title="Enum Analysis" />
      <DataQualitySection result={result} />
    </div>
  );
}

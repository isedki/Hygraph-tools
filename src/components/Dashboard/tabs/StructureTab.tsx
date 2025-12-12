'use client';

import { useState } from 'react';
import type { AuditResult } from '@/lib/types';
import { CheckpointCard } from '../CheckpointCard';
import { SubTabs, getWorstStatus, countIssues } from '../SubTabs';

interface StructureTabProps {
  result: AuditResult;
  showAll?: boolean;
}

type StructureSubTab = 'models' | 'components' | 'enums' | 'data-quality';

export function StructureTab({ result, showAll = false }: StructureTabProps) {
  const { structure } = result.comprehensiveAssessment;
  const [activeSubTab, setActiveSubTab] = useState<StructureSubTab>('models');

  // Define checkpoints for each sub-tab
  const modelCheckpoints = [
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
    structure.localization,
    structure.assetCentralization,
  ];

  const enumCheckpoints = [
    structure.enumAnalysis.singleValueEnums,
    structure.enumAnalysis.oversizedEnums,
    structure.enumAnalysis.enumBasedTenancy,
    structure.enumAnalysis.duplicateEnums,
    structure.enumAnalysis.unusedEnums,
  ];

  // Build sub-tab config with status indicators
  const subTabs = [
    {
      id: 'models' as StructureSubTab,
      label: 'Model Organization',
      description: 'Are models well-defined and non-redundant?',
      status: getWorstStatus(modelCheckpoints.map(c => c.status)),
      count: countIssues(modelCheckpoints.map(c => c.status)),
    },
    {
      id: 'components' as StructureSubTab,
      label: 'Component Patterns',
      description: 'How are components structured and reused?',
      status: getWorstStatus(componentCheckpoints.map(c => c.status)),
      count: countIssues(componentCheckpoints.map(c => c.status)),
    },
    {
      id: 'enums' as StructureSubTab,
      label: 'Enum Health',
      description: 'Single-value, oversized, or duplicate enums?',
      status: getWorstStatus(enumCheckpoints.map(c => c.status)),
      count: countIssues(enumCheckpoints.map(c => c.status)),
    },
    {
      id: 'data-quality' as StructureSubTab,
      label: 'Field Fill Rates',
      description: 'Which fields are empty or rarely used?',
      status: result.insights.emptyFields 
        ? (result.insights.emptyFields.overallDataQuality >= 80 ? 'good' : result.insights.emptyFields.overallDataQuality >= 60 ? 'warning' : 'issue')
        : 'good',
      count: result.insights.emptyFields?.dataQualityIssues.length || 0,
    },
  ];

  // Filter checkpoints based on showAll
  const filterCheckpoints = (checkpoints: typeof modelCheckpoints) => {
    if (showAll) return checkpoints;
    const issues = checkpoints.filter(c => c.status === 'issue' || c.status === 'warning');
    return issues.length > 0 ? issues : checkpoints; // Show all if no issues
  };

  const renderContent = () => {
    switch (activeSubTab) {
      case 'models':
        return <ModelOrganizationSection checkpoints={modelCheckpoints} showAll={showAll} />;
      case 'components':
        return <ComponentPatternsSection checkpoints={componentCheckpoints} showAll={showAll} />;
      case 'enums':
        return <EnumHealthSection checkpoints={enumCheckpoints} showAll={showAll} />;
      case 'data-quality':
        return <DataQualitySection result={result} />;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      <SubTabs 
        tabs={subTabs} 
        activeTab={activeSubTab} 
        onChange={(id) => setActiveSubTab(id as StructureSubTab)} 
      />
      {renderContent()}
    </div>
  );
}

// Sub-sections
function ModelOrganizationSection({ checkpoints, showAll }: { checkpoints: any[]; showAll: boolean }) {
  const issues = checkpoints.filter(c => c.status === 'issue' || c.status === 'warning');
  const goodItems = checkpoints.filter(c => c.status === 'good');
  const [expanded, setExpanded] = useState(showAll);

  return (
    <div className="space-y-4">
      {/* Show issues first */}
      {issues.map((checkpoint, i) => (
        <CheckpointCard key={`issue-${i}`} checkpoint={checkpoint} collapsible={false} />
      ))}
      
      {/* Good items - collapsed by default */}
      {goodItems.length > 0 && (
        <>
          {!showAll && !expanded ? (
            <button
              onClick={() => setExpanded(true)}
              className="w-full py-3 px-4 bg-green-50 hover:bg-green-100 border border-green-200 rounded-lg text-sm text-green-700 font-medium transition-colors flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{goodItems.length} passing check{goodItems.length !== 1 ? 's' : ''}</span>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          ) : (
            <>
              {goodItems.map((checkpoint, i) => (
                <CheckpointCard key={`good-${i}`} checkpoint={checkpoint} />
              ))}
              {!showAll && (
                <button
                  onClick={() => setExpanded(false)}
                  className="w-full py-2 text-sm text-gray-500 hover:text-gray-700"
                >
                  Hide passing checks
                </button>
              )}
            </>
          )}
        </>
      )}
      
      {/* Show message if all good */}
      {issues.length === 0 && goodItems.length === 0 && (
        <div className="py-8 text-center text-gray-500">
          No checkpoints available
        </div>
      )}
    </div>
  );
}

function ComponentPatternsSection({ checkpoints, showAll }: { checkpoints: any[]; showAll: boolean }) {
  const issues = checkpoints.filter(c => c.status === 'issue' || c.status === 'warning');
  const goodItems = checkpoints.filter(c => c.status === 'good');
  const [expanded, setExpanded] = useState(showAll);

  return (
    <div className="space-y-4">
      {issues.map((checkpoint, i) => (
        <CheckpointCard key={`issue-${i}`} checkpoint={checkpoint} collapsible={false} />
      ))}
      
      {goodItems.length > 0 && (
        <>
          {!showAll && !expanded ? (
            <button
              onClick={() => setExpanded(true)}
              className="w-full py-3 px-4 bg-green-50 hover:bg-green-100 border border-green-200 rounded-lg text-sm text-green-700 font-medium transition-colors flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{goodItems.length} passing check{goodItems.length !== 1 ? 's' : ''}</span>
            </button>
          ) : (
            <>
              {goodItems.map((checkpoint, i) => (
                <CheckpointCard key={`good-${i}`} checkpoint={checkpoint} />
              ))}
              {!showAll && (
                <button onClick={() => setExpanded(false)} className="w-full py-2 text-sm text-gray-500 hover:text-gray-700">
                  Hide passing checks
                </button>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}

function EnumHealthSection({ checkpoints, showAll }: { checkpoints: any[]; showAll: boolean }) {
  const issues = checkpoints.filter(c => c.status === 'issue' || c.status === 'warning');
  const goodItems = checkpoints.filter(c => c.status === 'good');
  const [expanded, setExpanded] = useState(showAll);

  return (
    <div className="space-y-4">
      {issues.map((checkpoint, i) => (
        <CheckpointCard key={`issue-${i}`} checkpoint={checkpoint} collapsible={false} />
      ))}
      
      {goodItems.length > 0 && (
        <>
          {!showAll && !expanded ? (
            <button
              onClick={() => setExpanded(true)}
              className="w-full py-3 px-4 bg-green-50 hover:bg-green-100 border border-green-200 rounded-lg text-sm text-green-700 font-medium transition-colors flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{goodItems.length} passing check{goodItems.length !== 1 ? 's' : ''}</span>
            </button>
          ) : (
            <>
              {goodItems.map((checkpoint, i) => (
                <CheckpointCard key={`good-${i}`} checkpoint={checkpoint} />
              ))}
              {!showAll && (
                <button onClick={() => setExpanded(false)} className="w-full py-2 text-sm text-gray-500 hover:text-gray-700">
                  Hide passing checks
                </button>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}

function DataQualitySection({ result }: { result: AuditResult }) {
  const emptyFields = result.insights.emptyFields;
  const [sortField, setSortField] = useState<'fillRate' | 'model'>('fillRate');
  const [showAllFields, setShowAllFields] = useState(false);
  
  if (!emptyFields) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6 text-center">
        <p className="text-gray-500">No data quality analysis available. Run audit with content to see results.</p>
      </div>
    );
  }
  
  const sortedFillRates = [...emptyFields.fieldFillRates].sort((a, b) => {
    if (sortField === 'fillRate') return a.fillRate - b.fillRate;
    return a.model.localeCompare(b.model);
  });
  
  const displayedFields = showAllFields ? sortedFillRates : sortedFillRates.slice(0, 15);
  
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

  const hasIssues = emptyFields.dataQualityIssues.length > 0 || emptyFields.unusedOptionalFields.length > 0;

  return (
    <div className="space-y-6">
      {/* Score Card */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-gray-900">Overall Data Quality</h3>
          <p className="text-sm text-gray-500">{emptyFields.modelSummary.length} models analyzed</p>
        </div>
        <div className={`px-4 py-2 rounded-full text-lg font-bold ${getScoreColor(emptyFields.overallDataQuality)}`}>
          {emptyFields.overallDataQuality}%
        </div>
      </div>
      
      {/* Issues Section - Show first if there are issues */}
      {hasIssues && (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          {/* Data Quality Issues */}
          {emptyFields.dataQualityIssues.length > 0 && (
            <div className="p-4 border-b border-gray-100">
              <h4 className="text-sm font-medium text-yellow-700 mb-3 flex items-center gap-2">
                <span>⚠️</span>
                Required Fields with Low Fill Rate ({emptyFields.dataQualityIssues.length})
              </h4>
              <div className="space-y-2">
                {emptyFields.dataQualityIssues.slice(0, 5).map((issue, i) => (
                  <div key={i} className="flex items-center justify-between bg-yellow-50 rounded px-3 py-2">
                    <span className="text-sm">
                      <span className="font-medium">{issue.model}</span>
                      <span className="text-gray-500">.{issue.field}</span>
                    </span>
                    <span className="text-sm font-medium text-yellow-700">{issue.fillRate}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* Unused Fields */}
          {emptyFields.unusedOptionalFields.length > 0 && (
            <div className="p-4">
              <h4 className="text-sm font-medium text-red-700 mb-3 flex items-center gap-2">
                <span>🗑️</span>
                Unused Optional Fields ({emptyFields.unusedOptionalFields.length})
              </h4>
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
        </div>
      )}
      
      {/* Field Fill Rates Table */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex items-center justify-between mb-4">
          <h4 className="font-medium text-gray-900">Field Fill Rates</h4>
          <select
            value={sortField}
            onChange={(e) => setSortField(e.target.value as 'fillRate' | 'model')}
            className="text-sm border border-gray-300 rounded px-2 py-1"
          >
            <option value="fillRate">Sort by Fill Rate</option>
            <option value="model">Sort by Model</option>
          </select>
        </div>
        
        {emptyFields.fieldFillRates.length > 0 ? (
          <>
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
            </div>
            
            {sortedFillRates.length > 15 && (
              <button
                onClick={() => setShowAllFields(!showAllFields)}
                className="mt-3 text-sm text-blue-600 hover:text-blue-800"
              >
                {showAllFields ? 'Show less' : `Show all ${sortedFillRates.length} fields`}
              </button>
            )}
          </>
        ) : (
          <p className="text-gray-500 text-sm">No field data available</p>
        )}
      </div>
      
      {/* Recommendations */}
      {emptyFields.recommendations.length > 0 && (
        <div className="bg-blue-50 rounded-lg border border-blue-200 p-4">
          <h4 className="text-sm font-medium text-blue-700 mb-3">💡 Recommendations</h4>
          <ul className="space-y-2">
            {emptyFields.recommendations.map((rec, i) => (
              <li key={i} className="text-sm text-blue-900 flex items-start gap-2">
                <span className="text-blue-400 mt-1">•</span>
                <span>{rec}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

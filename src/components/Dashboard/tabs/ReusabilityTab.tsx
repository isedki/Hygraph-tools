'use client';

import { useState } from 'react';
import type { AuditResult } from '@/lib/types';
import { CheckpointCard } from '../CheckpointCard';
import { SubTabs } from '../SubTabs';

interface ReusabilityTabProps {
  result: AuditResult;
  showAll?: boolean;
}

type ReusabilitySubTab = 'components' | 'duplicates' | 'separation';

export function ReusabilityTab({ result, showAll = false }: ReusabilityTabProps) {
  const [activeSubTab, setActiveSubTab] = useState<ReusabilitySubTab>('components');
  const { reusability, duplicates } = result.comprehensiveAssessment;

  const totalDuplicates = duplicates.enums.groups.length + duplicates.components.groups.length + duplicates.models.groups.length;

  // Calculate status
  const getComponentStatus = (): 'good' | 'warning' | 'issue' => {
    if (reusability.sharedComponents.status === 'issue') return 'issue';
    if (reusability.sharedComponents.status === 'warning' || reusability.layoutFlexibility.status === 'warning') return 'warning';
    return 'good';
  };

  const getDuplicatesStatus = (): 'good' | 'warning' | 'issue' => {
    if (totalDuplicates > 5) return 'issue';
    if (totalDuplicates > 0) return 'warning';
    return 'good';
  };

  const getSeparationStatus = (): 'good' | 'warning' | 'issue' => {
    if (reusability.contentVsPresentation.overallLeakageScore < 60) return 'issue';
    if (reusability.contentVsPresentation.overallLeakageScore < 80) return 'warning';
    return 'good';
  };

  const subTabs = [
    {
      id: 'components' as ReusabilitySubTab,
      label: 'Components & Layout',
      description: 'Shared components, flexible layouts',
      status: getComponentStatus(),
    },
    {
      id: 'duplicates' as ReusabilitySubTab,
      label: 'Duplicates',
      description: 'Similar enums, components, models',
      status: getDuplicatesStatus(),
      count: totalDuplicates,
    },
    {
      id: 'separation' as ReusabilitySubTab,
      label: 'Content vs Presentation',
      description: 'Field type separation analysis',
      status: getSeparationStatus(),
      count: reusability.contentVsPresentation.leakyModels.length,
    },
  ];

  const renderContent = () => {
    switch (activeSubTab) {
      case 'components':
        return <ComponentsSection result={result} showAll={showAll} />;
      case 'duplicates':
        return <DuplicatesSection result={result} />;
      case 'separation':
        return <ContentSeparationSection result={result} />;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Reuse Score */}
      <div className="bg-white rounded-lg border p-4 flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-gray-900">Reuse Score</h3>
          <p className="text-sm text-gray-500">Component and content reusability</p>
        </div>
        <div className={`px-4 py-2 rounded-full text-lg font-bold ${
          reusability.reuseScore >= 70 ? 'text-green-600 bg-green-50' :
          reusability.reuseScore >= 50 ? 'text-yellow-600 bg-yellow-50' : 'text-red-600 bg-red-50'
        }`}>
          {reusability.reuseScore}%
        </div>
      </div>

      <SubTabs
        tabs={subTabs}
        activeTab={activeSubTab}
        onChange={(id) => setActiveSubTab(id as ReusabilitySubTab)}
      />

      {renderContent()}
    </div>
  );
}

// Components Section
function ComponentsSection({ result, showAll }: { result: AuditResult; showAll: boolean }) {
  const { reusability } = result.comprehensiveAssessment;
  const [showBreakdown, setShowBreakdown] = useState(false);

  const checkpoints = [
    reusability.sharedContent,
    reusability.sharedComponents,
    reusability.layoutFlexibility,
  ];

  const issues = checkpoints.filter(c => c.status === 'issue' || c.status === 'warning');
  const goodItems = checkpoints.filter(c => c.status === 'good');
  const [showGood, setShowGood] = useState(showAll);

  return (
    <div className="space-y-6">
      {/* Score Breakdown */}
      <div className="bg-white rounded-lg border p-4">
        <button 
          onClick={() => setShowBreakdown(!showBreakdown)}
          className="w-full flex items-center justify-between text-left"
        >
          <h4 className="font-medium text-gray-900">Reuse Score Breakdown</h4>
          <svg className={`w-5 h-5 text-gray-500 transition-transform ${showBreakdown ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        {showBreakdown && (
          <div className="mt-4 space-y-2">
            {reusability.reuseScoreBreakdown.map((item, i) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <span className="text-gray-600">{item.reason}</span>
                <span className={`font-medium ${item.value >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {item.value > 0 ? '+' : ''}{item.value}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Issues first */}
      <div className="space-y-4">
        {issues.map((checkpoint, i) => (
          <CheckpointCard key={`issue-${i}`} checkpoint={checkpoint} collapsible={false} />
        ))}
      </div>

      {/* Good items */}
      {goodItems.length > 0 && (
        <>
          {!showAll && !showGood ? (
            <button
              onClick={() => setShowGood(true)}
              className="w-full py-3 px-4 bg-green-50 hover:bg-green-100 border border-green-200 rounded-lg text-sm text-green-700 font-medium transition-colors flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{goodItems.length} passing check{goodItems.length !== 1 ? 's' : ''}</span>
            </button>
          ) : (
            <div className="space-y-4">
              {goodItems.map((checkpoint, i) => (
                <CheckpointCard key={`good-${i}`} checkpoint={checkpoint} />
              ))}
              {!showAll && (
                <button onClick={() => setShowGood(false)} className="w-full py-2 text-sm text-gray-500 hover:text-gray-700">
                  Hide passing checks
                </button>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// Duplicates Section
function DuplicatesSection({ result }: { result: AuditResult }) {
  const { duplicates } = result.comprehensiveAssessment;
  const [expandEnums, setExpandEnums] = useState(false);
  const [expandComponents, setExpandComponents] = useState(false);
  const [expandModels, setExpandModels] = useState(false);

  const totalDuplicates = duplicates.enums.groups.length + duplicates.components.groups.length + duplicates.models.groups.length;

  if (totalDuplicates === 0) {
    return (
      <div className="bg-green-50 rounded-lg border border-green-200 p-6 text-center">
        <span className="text-green-500 text-2xl">✓</span>
        <p className="text-sm text-green-700 mt-2">No duplicate patterns detected.</p>
        <p className="text-xs text-green-600 mt-1">Your schema has good uniqueness across enums, components, and models.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className={`rounded-lg p-4 text-center border ${
          duplicates.enums.groups.length > 0 ? 'bg-yellow-50 border-yellow-100' : 'bg-green-50 border-green-100'
        }`}>
          <div className={`text-2xl font-bold ${duplicates.enums.groups.length > 0 ? 'text-yellow-600' : 'text-green-600'}`}>
            {duplicates.enums.groups.length}
          </div>
          <div className={`text-xs ${duplicates.enums.groups.length > 0 ? 'text-yellow-700' : 'text-green-700'}`}>
            Enum Groups
          </div>
        </div>
        <div className={`rounded-lg p-4 text-center border ${
          duplicates.components.groups.length > 0 ? 'bg-yellow-50 border-yellow-100' : 'bg-green-50 border-green-100'
        }`}>
          <div className={`text-2xl font-bold ${duplicates.components.groups.length > 0 ? 'text-yellow-600' : 'text-green-600'}`}>
            {duplicates.components.groups.length}
          </div>
          <div className={`text-xs ${duplicates.components.groups.length > 0 ? 'text-yellow-700' : 'text-green-700'}`}>
            Component Groups
          </div>
        </div>
        <div className={`rounded-lg p-4 text-center border ${
          duplicates.models.groups.length > 0 ? 'bg-yellow-50 border-yellow-100' : 'bg-green-50 border-green-100'
        }`}>
          <div className={`text-2xl font-bold ${duplicates.models.groups.length > 0 ? 'text-yellow-600' : 'text-green-600'}`}>
            {duplicates.models.groups.length}
          </div>
          <div className={`text-xs ${duplicates.models.groups.length > 0 ? 'text-yellow-700' : 'text-green-700'}`}>
            Model Groups
          </div>
        </div>
      </div>

      {/* Duplicate Enums */}
      {duplicates.enums.groups.length > 0 && (
        <div className="bg-white rounded-lg border border-yellow-200 p-4">
          <button 
            onClick={() => setExpandEnums(!expandEnums)}
            className="w-full flex items-center justify-between"
          >
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              <span className="text-yellow-500">⚠️</span>
              Duplicate Enum Groups ({duplicates.enums.groups.length})
            </h3>
            <svg className={`w-5 h-5 text-gray-500 transition-transform ${expandEnums ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {expandEnums && (
            <div className="mt-4 space-y-3">
              {duplicates.enums.groups.map((group, i) => (
                <div key={i} className="text-sm p-3 bg-yellow-50 rounded border border-yellow-200">
                  <div className="font-medium text-gray-900 mb-2">
                    {group.enums.join(' + ')}
                  </div>
                  <div className="text-xs text-gray-600">
                    <span className="font-medium">Shared values:</span> {group.sharedValues.slice(0, 8).join(', ')}{group.sharedValues.length > 8 ? '...' : ''}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    💡 Consider consolidating into a single enum
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Duplicate Components */}
      {duplicates.components.groups.length > 0 && (
        <div className="bg-white rounded-lg border border-yellow-200 p-4">
          <button 
            onClick={() => setExpandComponents(!expandComponents)}
            className="w-full flex items-center justify-between"
          >
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              <span className="text-yellow-500">⚠️</span>
              Similar Component Groups ({duplicates.components.groups.length})
            </h3>
            <svg className={`w-5 h-5 text-gray-500 transition-transform ${expandComponents ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {expandComponents && (
            <div className="mt-4 space-y-3">
              {duplicates.components.groups.map((group, i) => (
                <div key={i} className="text-sm p-3 bg-yellow-50 rounded border border-yellow-200">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-gray-900">{group.components.join(' + ')}</span>
                    <span className="text-xs bg-yellow-200 text-yellow-700 px-2 py-0.5 rounded">{group.similarity}% similar</span>
                  </div>
                  <div className="text-xs text-gray-600">
                    <span className="font-medium">Shared fields:</span> {group.sharedFields.slice(0, 6).join(', ')}{group.sharedFields.length > 6 ? '...' : ''}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    💡 Consider merging or extracting common fields
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Duplicate Models */}
      {duplicates.models.groups.length > 0 && (
        <div className="bg-white rounded-lg border border-yellow-200 p-4">
          <button 
            onClick={() => setExpandModels(!expandModels)}
            className="w-full flex items-center justify-between"
          >
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              <span className="text-yellow-500">⚠️</span>
              Overlapping Model Groups ({duplicates.models.groups.length})
            </h3>
            <svg className={`w-5 h-5 text-gray-500 transition-transform ${expandModels ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {expandModels && (
            <div className="mt-4 space-y-3">
              {duplicates.models.groups.map((group, i) => (
                <div key={i} className="text-sm p-3 bg-yellow-50 rounded border border-yellow-200">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-gray-900">{group.models.join(' + ')}</span>
                    <span className="text-xs bg-yellow-200 text-yellow-700 px-2 py-0.5 rounded">{group.similarity}% overlap</span>
                  </div>
                  <div className="text-xs text-gray-600">{group.reason}</div>
                  <div className="text-xs text-gray-500 mt-1">
                    💡 Consider using a single model with a type discriminator
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Content vs Presentation Section
function ContentSeparationSection({ result }: { result: AuditResult }) {
  const { reusability } = result.comprehensiveAssessment;
  const { contentVsPresentation } = reusability;
  const [showAllModels, setShowAllModels] = useState(false);

  const displayedModels = showAllModels 
    ? contentVsPresentation.leakyModels 
    : contentVsPresentation.leakyModels.slice(0, 6);

  return (
    <div className="space-y-6">
      {/* Score Card */}
      <div className="bg-white rounded-lg border p-4 flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-gray-900">Separation Score</h3>
          <p className="text-sm text-gray-500">Content vs Presentation field balance</p>
        </div>
        <div className={`px-4 py-2 rounded-full text-lg font-bold ${
          contentVsPresentation.overallLeakageScore >= 80 ? 'text-green-600 bg-green-50' :
          contentVsPresentation.overallLeakageScore >= 60 ? 'text-yellow-600 bg-yellow-50' : 'text-red-600 bg-red-50'
        }`}>
          {contentVsPresentation.overallLeakageScore}%
        </div>
      </div>

      {/* Explanation */}
      <div className="bg-blue-50 rounded-lg border border-blue-200 p-4">
        <h4 className="text-sm font-medium text-blue-700 mb-2">💡 What is Content vs Presentation?</h4>
        <p className="text-sm text-blue-900">
          Models should ideally contain <strong>content fields</strong> (text, references, data) rather than 
          <strong> presentation fields</strong> (colors, sizes, spacing). Mixing presentation into content 
          models reduces reusability and creates frontend coupling.
        </p>
      </div>

      {contentVsPresentation.leakyModels.length === 0 ? (
        <div className="bg-green-50 rounded-lg border border-green-200 p-6 text-center">
          <span className="text-green-500 text-2xl">✓</span>
          <p className="text-sm text-green-700 mt-2">Good content/presentation separation.</p>
          <p className="text-xs text-green-600 mt-1">Your models keep content and presentation concerns appropriately separated.</p>
        </div>
      ) : (
        <>
          {/* Models with Leakage */}
          <div className="bg-white rounded-lg border p-4">
            <h3 className="font-semibold text-gray-900 mb-3">
              Models with Mixed Concerns ({contentVsPresentation.leakyModels.length})
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-2 text-gray-600 font-medium">Model</th>
                    <th className="text-center py-2 px-2 text-gray-600 font-medium">Content</th>
                    <th className="text-center py-2 px-2 text-gray-600 font-medium">Config</th>
                    <th className="text-center py-2 px-2 text-gray-600 font-medium">Presentation</th>
                    <th className="text-center py-2 px-2 text-gray-600 font-medium">Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {displayedModels.map((model, i) => {
                    const total = model.contentCount + model.configCount + model.presentationCount;
                    const contentPct = total > 0 ? Math.round((model.contentCount / total) * 100) : 0;
                    const configPct = total > 0 ? Math.round((model.configCount / total) * 100) : 0;
                    const presentationPct = total > 0 ? Math.round((model.presentationCount / total) * 100) : 0;

                    return (
                      <tr key={i} className="border-b last:border-0 hover:bg-gray-50">
                        <td className="py-2 px-2 font-medium text-gray-900">{model.model}</td>
                        <td className="py-2 px-2 text-center">
                          <span className="text-green-600">{model.contentCount}</span>
                        </td>
                        <td className="py-2 px-2 text-center">
                          <span className="text-yellow-600">{model.configCount}</span>
                        </td>
                        <td className="py-2 px-2 text-center">
                          <span className="text-red-600">{model.presentationCount}</span>
                        </td>
                        <td className="py-2 px-2">
                          <div className="flex h-2 rounded overflow-hidden bg-gray-200 min-w-[60px]">
                            {contentPct > 0 && <div className="bg-green-500" style={{ width: `${contentPct}%` }} />}
                            {configPct > 0 && <div className="bg-yellow-500" style={{ width: `${configPct}%` }} />}
                            {presentationPct > 0 && <div className="bg-red-500" style={{ width: `${presentationPct}%` }} />}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {contentVsPresentation.leakyModels.length > 6 && (
              <button
                onClick={() => setShowAllModels(!showAllModels)}
                className="mt-3 text-sm text-blue-600 hover:text-blue-800"
              >
                {showAllModels ? 'Show less' : `Show all ${contentVsPresentation.leakyModels.length} models`}
              </button>
            )}
          </div>

          {/* Legend */}
          <div className="flex justify-center gap-6 text-xs">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-green-500"></div>
              <span className="text-gray-600">Content (text, references)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-yellow-500"></div>
              <span className="text-gray-600">Config (booleans, settings)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-red-500"></div>
              <span className="text-gray-600">Presentation (colors, sizes)</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

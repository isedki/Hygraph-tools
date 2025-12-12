'use client';

import { useState } from 'react';
import type { AuditResult, ModelFreshness } from '@/lib/types';
import { CheckpointCard } from '../CheckpointCard';
import { SubTabs } from '../SubTabs';

interface InsightsTabProps {
  result: AuditResult;
  showAll?: boolean;
}

type InsightsSubTab = 'adoption' | 'freshness' | 'richtext' | 'api' | 'seo';

export function InsightsTab({ result, showAll = false }: InsightsTabProps) {
  const [activeSubTab, setActiveSubTab] = useState<InsightsSubTab>('adoption');
  const { payloadEfficiency, contentAdoption, seoReadiness, contentFreshness, richTextUsage } = result.insights;

  // Calculate status for each sub-tab
  const getAdoptionStatus = (): 'good' | 'warning' | 'issue' => {
    if (contentAdoption.ghostModels.length > 3) return 'issue';
    if (contentAdoption.ghostModels.length > 0) return 'warning';
    return 'good';
  };

  const getFreshnessStatus = (): 'good' | 'warning' | 'issue' => {
    if (!contentFreshness) return 'good';
    if (contentFreshness.overallFreshness.score < 40) return 'issue';
    if (contentFreshness.overallFreshness.score < 70) return 'warning';
    return 'good';
  };

  const getRichTextStatus = (): 'good' | 'warning' | 'issue' => {
    if (!richTextUsage) return 'good';
    if (richTextUsage.overallScore < 60) return 'issue';
    if (richTextUsage.overallScore < 80) return 'warning';
    return 'good';
  };

  const getApiStatus = (): 'good' | 'warning' | 'issue' => {
    if (payloadEfficiency.overallScore < 60) return 'issue';
    if (payloadEfficiency.overallScore < 80) return 'warning';
    return 'good';
  };

  const getSeoStatus = (): 'good' | 'warning' | 'issue' => {
    if (seoReadiness.overallScore < 60) return 'issue';
    if (seoReadiness.overallScore < 80) return 'warning';
    return 'good';
  };

  const subTabs = [
    {
      id: 'adoption' as InsightsSubTab,
      label: 'Adoption & Usage',
      description: 'Which models have content? Ghost models?',
      status: getAdoptionStatus(),
      count: contentAdoption.ghostModels.length,
    },
    {
      id: 'freshness' as InsightsSubTab,
      label: 'Content Freshness',
      description: 'How old is your content? Stale alerts',
      status: getFreshnessStatus(),
      count: contentFreshness?.staleContentAlert.length || 0,
    },
    {
      id: 'richtext' as InsightsSubTab,
      label: 'Rich Text Quality',
      description: 'Hardcoded URLs? Embedded images? Link patterns',
      status: getRichTextStatus(),
      count: richTextUsage ? (richTextUsage.absoluteUrls.length + richTextUsage.embeddedImages.length) : 0,
    },
    {
      id: 'api' as InsightsSubTab,
      label: 'API Efficiency',
      description: 'Payload sizes and caching readiness',
      status: getApiStatus(),
      count: payloadEfficiency.heavyModels.length,
    },
    {
      id: 'seo' as InsightsSubTab,
      label: 'SEO Readiness',
      description: 'Meta fields, slugs, social sharing, alt text',
      status: getSeoStatus(),
    },
  ];

  const renderContent = () => {
    switch (activeSubTab) {
      case 'adoption':
        return <ContentAdoptionSection result={result} />;
      case 'freshness':
        return <ContentFreshnessSection result={result} />;
      case 'richtext':
        return <RichTextUsageSection result={result} />;
      case 'api':
        return <ApiEfficiencySection result={result} />;
      case 'seo':
        return <SeoReadinessSection result={result} showAll={showAll} />;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      <SubTabs
        tabs={subTabs}
        activeTab={activeSubTab}
        onChange={(id) => setActiveSubTab(id as InsightsSubTab)}
      />
      {renderContent()}
    </div>
  );
}

// Content Adoption Section
function ContentAdoptionSection({ result }: { result: AuditResult }) {
  const { contentAdoption } = result.insights;

  return (
    <div className="space-y-6">
      {/* Score Card */}
      <div className="bg-white rounded-lg border p-4 flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-gray-900">Content Adoption Rate</h3>
          <p className="text-sm text-gray-500">{contentAdoption.totalModels} models analyzed</p>
        </div>
        <div className={`px-4 py-2 rounded-full text-lg font-bold ${
          contentAdoption.adoptionRate >= 80 ? 'text-green-600 bg-green-50' :
          contentAdoption.adoptionRate >= 60 ? 'text-yellow-600 bg-yellow-50' : 'text-red-600 bg-red-50'
        }`}>
          {contentAdoption.adoptionRate}%
        </div>
      </div>

      {/* Distribution Stats */}
      <div className="grid grid-cols-5 gap-3">
        <div className="bg-red-50 rounded-lg p-3 text-center border border-red-100">
          <div className="text-2xl font-bold text-red-600">{contentAdoption.distribution.ghost}</div>
          <div className="text-xs text-red-700">Ghost</div>
        </div>
        <div className="bg-orange-50 rounded-lg p-3 text-center border border-orange-100">
          <div className="text-2xl font-bold text-orange-600">{contentAdoption.distribution.underutilized}</div>
          <div className="text-xs text-orange-700">Underutilized</div>
        </div>
        <div className="bg-yellow-50 rounded-lg p-3 text-center border border-yellow-100">
          <div className="text-2xl font-bold text-yellow-600">{contentAdoption.distribution.lowAdoption}</div>
          <div className="text-xs text-yellow-700">Low</div>
        </div>
        <div className="bg-green-50 rounded-lg p-3 text-center border border-green-100">
          <div className="text-2xl font-bold text-green-600">{contentAdoption.distribution.healthy}</div>
          <div className="text-xs text-green-700">Healthy</div>
        </div>
        <div className="bg-blue-50 rounded-lg p-3 text-center border border-blue-100">
          <div className="text-2xl font-bold text-blue-600">{contentAdoption.distribution.highVolume}</div>
          <div className="text-xs text-blue-700">High Volume</div>
        </div>
      </div>

      {/* Ghost Models - Show first as they're issues */}
      {contentAdoption.ghostModels.length > 0 && (
        <div className="bg-white rounded-lg border border-red-200 p-4">
          <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <span className="text-red-500">👻</span>
            Ghost Models ({contentAdoption.ghostModels.length})
          </h3>
          <div className="space-y-2">
            {contentAdoption.ghostModels.map((ghost, i) => (
              <div key={i} className="flex items-center justify-between text-sm p-2 bg-red-50 rounded">
                <div>
                  <span className="font-medium text-gray-900">{ghost.model}</span>
                  {ghost.createdFor && <span className="text-gray-500 ml-2">({ghost.createdFor})</span>}
                </div>
                <div className="text-gray-500 text-xs">
                  {ghost.fieldCount} fields{ghost.hasRelations && ' • has relations'}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Underutilized */}
      {contentAdoption.underutilized.length > 0 && (
        <div className="bg-white rounded-lg border p-4">
          <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <span className="text-orange-500">📉</span>
            Underutilized Models ({contentAdoption.underutilized.length})
          </h3>
          <div className="space-y-2">
            {contentAdoption.underutilized.slice(0, 5).map((model, i) => (
              <div key={i} className="flex items-center justify-between text-sm p-2 bg-orange-50 rounded">
                <span className="font-medium text-gray-900">{model.model}</span>
                <span className="text-orange-600">{model.entries} entries</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* High Volume */}
      {contentAdoption.highVolume.length > 0 && (
        <div className="bg-white rounded-lg border p-4">
          <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <span className="text-blue-500">📈</span>
            High Volume Models ({contentAdoption.highVolume.length})
          </h3>
          <div className="space-y-2">
            {contentAdoption.highVolume.map((model, i) => (
              <div key={i} className="flex items-center justify-between text-sm p-2 bg-blue-50 rounded">
                <span className="font-medium text-gray-900">{model.model}</span>
                <div className="text-right">
                  <span className="text-blue-600 font-medium">{model.entries.toLocaleString()}</span>
                  <span className="text-gray-500 text-xs ml-2">({model.published.toLocaleString()} published)</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recommendations */}
      {contentAdoption.recommendations.length > 0 && (
        <div className="bg-blue-50 rounded-lg border border-blue-200 p-4">
          <h4 className="text-sm font-medium text-blue-700 mb-2">💡 Recommendations</h4>
          <ul className="space-y-1">
            {contentAdoption.recommendations.map((rec, i) => (
              <li key={i} className="text-sm text-blue-900 flex items-start gap-2">
                <span className="text-blue-400">•</span>
                {rec}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// Content Freshness Section
function ContentFreshnessSection({ result }: { result: AuditResult }) {
  const freshness = result.insights.contentFreshness;
  const [showAllModels, setShowAllModels] = useState(false);

  if (!freshness) {
    return (
      <div className="bg-white rounded-lg border p-6 text-center text-gray-500">
        No content freshness data available. Run audit with content to see results.
      </div>
    );
  }

  const formatDate = (date: Date | null) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const displayedModels = showAllModels ? freshness.modelFreshness : freshness.modelFreshness.slice(0, 8);

  return (
    <div className="space-y-6">
      {/* Score Card */}
      <div className="bg-white rounded-lg border p-4 flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-gray-900">Freshness Score</h3>
          <p className="text-sm text-gray-500">{freshness.overallFreshness.totalEntries.toLocaleString()} entries analyzed</p>
        </div>
        <div className={`px-4 py-2 rounded-full text-lg font-bold ${
          freshness.overallFreshness.score >= 80 ? 'text-green-600 bg-green-50' :
          freshness.overallFreshness.score >= 60 ? 'text-yellow-600 bg-yellow-50' : 'text-red-600 bg-red-50'
        }`}>
          {freshness.overallFreshness.score}%
        </div>
      </div>

      {/* Distribution */}
      <div className="grid grid-cols-4 gap-3">
        <div className="bg-green-50 rounded-lg p-3 text-center border border-green-100">
          <div className="text-2xl font-bold text-green-600">{freshness.overallFreshness.freshPercentage}%</div>
          <div className="text-xs text-green-700">Fresh (&lt;{freshness.thresholds.fresh}d)</div>
        </div>
        <div className="bg-yellow-50 rounded-lg p-3 text-center border border-yellow-100">
          <div className="text-2xl font-bold text-yellow-600">
            {100 - freshness.overallFreshness.freshPercentage - freshness.overallFreshness.stalePercentage - freshness.overallFreshness.dormantPercentage}%
          </div>
          <div className="text-xs text-yellow-700">Aging</div>
        </div>
        <div className="bg-orange-50 rounded-lg p-3 text-center border border-orange-100">
          <div className="text-2xl font-bold text-orange-600">{freshness.overallFreshness.stalePercentage}%</div>
          <div className="text-xs text-orange-700">Stale</div>
        </div>
        <div className="bg-red-50 rounded-lg p-3 text-center border border-red-100">
          <div className="text-2xl font-bold text-red-600">{freshness.overallFreshness.dormantPercentage}%</div>
          <div className="text-xs text-red-700">Dormant (&gt;{freshness.thresholds.dormant}d)</div>
        </div>
      </div>

      {/* Stale Content Alerts */}
      {freshness.staleContentAlert.length > 0 && (
        <div className="bg-white rounded-lg border border-orange-200 p-4">
          <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <span className="text-orange-500">⚠️</span>
            Stale Content Alerts ({freshness.staleContentAlert.length})
          </h3>
          <div className="space-y-2">
            {freshness.staleContentAlert.map((alert, i) => (
              <div key={i} className="flex items-center justify-between text-sm p-2 bg-orange-50 rounded">
                <span className="font-medium text-gray-900">{alert.model}</span>
                <div className="text-right">
                  <span className="text-orange-600 font-medium">{alert.percentage}% stale</span>
                  <span className="text-gray-500 text-xs ml-2">({alert.staleCount} entries)</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Per-Model Freshness Table */}
      <div className="bg-white rounded-lg border p-4">
        <h3 className="font-semibold text-gray-900 mb-3">Freshness by Model</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2 px-2 text-gray-600 font-medium">Model</th>
                <th className="text-right py-2 px-2 text-gray-600 font-medium">Entries</th>
                <th className="text-right py-2 px-2 text-gray-600 font-medium">Avg Age</th>
                <th className="text-center py-2 px-2 text-gray-600 font-medium">Distribution</th>
                <th className="text-right py-2 px-2 text-gray-600 font-medium">Last Update</th>
              </tr>
            </thead>
            <tbody>
              {displayedModels.map((model: ModelFreshness, i: number) => {
                const total = model.totalEntries;
                const freshPct = total > 0 ? Math.round((model.fresh / total) * 100) : 0;
                const agingPct = total > 0 ? Math.round((model.aging / total) * 100) : 0;
                const stalePct = total > 0 ? Math.round((model.stale / total) * 100) : 0;
                const dormantPct = total > 0 ? Math.round((model.dormant / total) * 100) : 0;

                return (
                  <tr key={i} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="py-2 px-2 font-medium text-gray-900">{model.model}</td>
                    <td className="py-2 px-2 text-right text-gray-600">{model.totalEntries.toLocaleString()}</td>
                    <td className="py-2 px-2 text-right">
                      <span className={
                        model.avgAgeDays > 180 ? 'text-red-600' :
                        model.avgAgeDays > 90 ? 'text-orange-600' :
                        model.avgAgeDays > 30 ? 'text-yellow-600' : 'text-green-600'
                      }>
                        {model.avgAgeDays}d
                      </span>
                    </td>
                    <td className="py-2 px-2">
                      <div className="flex h-3 rounded overflow-hidden bg-gray-200 min-w-[80px]">
                        {freshPct > 0 && <div className="bg-green-500" style={{ width: `${freshPct}%` }} />}
                        {agingPct > 0 && <div className="bg-yellow-500" style={{ width: `${agingPct}%` }} />}
                        {stalePct > 0 && <div className="bg-orange-500" style={{ width: `${stalePct}%` }} />}
                        {dormantPct > 0 && <div className="bg-red-500" style={{ width: `${dormantPct}%` }} />}
                      </div>
                    </td>
                    <td className="py-2 px-2 text-right text-gray-500 text-xs">{formatDate(model.newestEntry)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {freshness.modelFreshness.length > 8 && (
            <button
              onClick={() => setShowAllModels(!showAllModels)}
              className="mt-3 text-sm text-blue-600 hover:text-blue-800"
            >
              {showAllModels ? 'Show less' : `Show all ${freshness.modelFreshness.length} models`}
            </button>
          )}
        </div>
      </div>

      {/* Recommendations */}
      {freshness.recommendations.length > 0 && (
        <div className="bg-blue-50 rounded-lg border border-blue-200 p-4">
          <h4 className="text-sm font-medium text-blue-700 mb-2">💡 Recommendations</h4>
          <ul className="space-y-1">
            {freshness.recommendations.map((rec, i) => (
              <li key={i} className="text-sm text-blue-900 flex items-start gap-2">
                <span className="text-blue-400">•</span>
                {rec}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// Rich Text Usage Section
function RichTextUsageSection({ result }: { result: AuditResult }) {
  const richText = result.insights.richTextUsage;
  const [showAllUrls, setShowAllUrls] = useState(false);

  if (!richText) {
    return (
      <div className="bg-white rounded-lg border p-6 text-center text-gray-500">
        No Rich Text analysis available.
      </div>
    );
  }

  const totalAbsoluteUrls = richText.absoluteUrls.reduce((sum, u) => sum + u.count, 0);
  const totalEmbeddedImages = richText.embeddedImages.reduce((sum, e) => sum + e.count, 0);

  return (
    <div className="space-y-6">
      {/* Score Card */}
      <div className="bg-white rounded-lg border p-4 flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-gray-900">Rich Text Quality</h3>
          <p className="text-sm text-gray-500">{richText.modelsWithRichText.length} models with Rich Text</p>
        </div>
        <div className={`px-4 py-2 rounded-full text-lg font-bold ${
          richText.overallScore >= 80 ? 'text-green-600 bg-green-50' :
          richText.overallScore >= 60 ? 'text-yellow-600 bg-yellow-50' : 'text-red-600 bg-red-50'
        }`}>
          {richText.overallScore}%
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        <div className="bg-blue-50 rounded-lg p-3 text-center border border-blue-100">
          <div className="text-2xl font-bold text-blue-600">{richText.modelsWithRichText.length}</div>
          <div className="text-xs text-blue-700">Models with RT</div>
        </div>
        <div className={`rounded-lg p-3 text-center border ${totalAbsoluteUrls > 0 ? 'bg-red-50 border-red-100' : 'bg-green-50 border-green-100'}`}>
          <div className={`text-2xl font-bold ${totalAbsoluteUrls > 0 ? 'text-red-600' : 'text-green-600'}`}>{totalAbsoluteUrls}</div>
          <div className={`text-xs ${totalAbsoluteUrls > 0 ? 'text-red-700' : 'text-green-700'}`}>Absolute URLs</div>
        </div>
        <div className={`rounded-lg p-3 text-center border ${totalEmbeddedImages > 0 ? 'bg-orange-50 border-orange-100' : 'bg-green-50 border-green-100'}`}>
          <div className={`text-2xl font-bold ${totalEmbeddedImages > 0 ? 'text-orange-600' : 'text-green-600'}`}>{totalEmbeddedImages}</div>
          <div className={`text-xs ${totalEmbeddedImages > 0 ? 'text-orange-700' : 'text-green-700'}`}>Embedded Images</div>
        </div>
        <div className="bg-gray-50 rounded-lg p-3 text-center border border-gray-200">
          <div className="text-2xl font-bold text-gray-600">{richText.linkAnalysis.staticLinks.reduce((s, l) => s + l.count, 0)}</div>
          <div className="text-xs text-gray-700">Static Links</div>
        </div>
      </div>

      {/* Absolute URLs Warning */}
      {richText.absoluteUrls.length > 0 && (
        <div className="bg-white rounded-lg border border-red-200 p-4">
          <h3 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
            <span className="text-red-500">🔗</span>
            Absolute URLs Detected
          </h3>
          <p className="text-sm text-gray-600 mb-3">Hard-coded URLs make content less portable.</p>
          <div className="space-y-2">
            {(showAllUrls ? richText.absoluteUrls : richText.absoluteUrls.slice(0, 3)).map((item, i) => (
              <div key={i} className="text-sm p-2 bg-red-50 rounded">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium">{item.model}.{item.field}</span>
                  <span className="text-red-600">{item.count} URL(s)</span>
                </div>
                <div className="text-xs text-gray-500 truncate">
                  {item.urls.slice(0, 2).join(', ')}{item.urls.length > 2 ? '...' : ''}
                </div>
              </div>
            ))}
          </div>
          {richText.absoluteUrls.length > 3 && (
            <button onClick={() => setShowAllUrls(!showAllUrls)} className="mt-2 text-sm text-blue-600 hover:text-blue-800">
              {showAllUrls ? 'Show less' : `Show all ${richText.absoluteUrls.length}`}
            </button>
          )}
        </div>
      )}

      {/* Embedded Images */}
      {richText.embeddedImages.length > 0 && (
        <div className="bg-white rounded-lg border border-orange-200 p-4">
          <h3 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
            <span className="text-orange-500">🖼️</span>
            Embedded Images in Rich Text
          </h3>
          <p className="text-sm text-gray-600 mb-3">Images bypass asset management. Use Asset references instead.</p>
          <div className="space-y-2">
            {richText.embeddedImages.map((item, i) => (
              <div key={i} className="flex items-center justify-between text-sm p-2 bg-orange-50 rounded">
                <span>{item.model}.{item.field}</span>
                <span className="text-orange-600">{item.count} image(s)</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Models with Rich Text */}
      {richText.modelsWithRichText.length > 0 && (
        <div className="bg-white rounded-lg border p-4">
          <h3 className="font-semibold text-gray-900 mb-3">Models Using Rich Text</h3>
          <div className="flex flex-wrap gap-2">
            {richText.modelsWithRichText.map((m, i) => (
              <span key={i} className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                {m.model} ({m.fields.join(', ')})
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Recommendations */}
      {richText.recommendations.length > 0 && (
        <div className="bg-blue-50 rounded-lg border border-blue-200 p-4">
          <h4 className="text-sm font-medium text-blue-700 mb-2">💡 Recommendations</h4>
          <ul className="space-y-1">
            {richText.recommendations.map((rec, i) => (
              <li key={i} className="text-sm text-blue-900 flex items-start gap-2">
                <span className="text-blue-400">•</span>
                {rec}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// API Efficiency Section
function ApiEfficiencySection({ result }: { result: AuditResult }) {
  const { payloadEfficiency } = result.insights;
  const caching = result.insights.enhancedPerformance?.cachingReadiness;

  return (
    <div className="space-y-6">
      {/* Payload Score Card */}
      <div className="bg-white rounded-lg border p-4 flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-gray-900">Payload Efficiency</h3>
          <p className="text-sm text-gray-500">Avg. {payloadEfficiency.avgPayloadKB} KB per model</p>
        </div>
        <div className={`px-4 py-2 rounded-full text-lg font-bold ${
          payloadEfficiency.overallScore >= 80 ? 'text-green-600 bg-green-50' :
          payloadEfficiency.overallScore >= 60 ? 'text-yellow-600 bg-yellow-50' : 'text-red-600 bg-red-50'
        }`}>
          {payloadEfficiency.overallScore}%
        </div>
      </div>

      {/* Heavy Models */}
      {payloadEfficiency.heavyModels.length > 0 && (
        <div className="bg-white rounded-lg border border-red-200 p-4">
          <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <span className="text-red-500">⚠️</span>
            Heavy Models ({payloadEfficiency.heavyModels.length})
          </h3>
          <div className="space-y-2">
            {payloadEfficiency.heavyModels.map((model, i) => (
              <div key={i} className="flex items-center justify-between text-sm p-2 bg-red-50 rounded">
                <div>
                  <span className="font-medium text-gray-900">{model.model}</span>
                  <span className="text-gray-500 ml-2 text-xs">{model.reason}</span>
                </div>
                <span className="text-red-600 font-medium">{model.kb} KB</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Caching Readiness */}
      {caching && (
        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">Caching Readiness</h3>
            <div className={`px-3 py-1 rounded-full text-sm font-medium ${
              caching.overallScore >= 80 ? 'text-green-600 bg-green-50' :
              caching.overallScore >= 60 ? 'text-yellow-600 bg-yellow-50' : 'text-red-600 bg-red-50'
            }`}>
              {caching.overallScore}%
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="bg-green-50 rounded-lg p-3 text-center">
              <div className="text-xl font-bold text-green-600">{caching.modelsWithUniqueId.length}</div>
              <div className="text-xs text-green-700">With Cache Key</div>
            </div>
            <div className={`rounded-lg p-3 text-center ${caching.modelsWithoutUniqueId.length > 0 ? 'bg-orange-50' : 'bg-green-50'}`}>
              <div className={`text-xl font-bold ${caching.modelsWithoutUniqueId.length > 0 ? 'text-orange-600' : 'text-green-600'}`}>
                {caching.modelsWithoutUniqueId.length}
              </div>
              <div className={`text-xs ${caching.modelsWithoutUniqueId.length > 0 ? 'text-orange-700' : 'text-green-700'}`}>Without Cache Key</div>
            </div>
          </div>

          {caching.modelsWithoutUniqueId.length > 0 && (
            <div className="space-y-2">
              {caching.cacheKeyRecommendations.slice(0, 3).map((rec, i) => (
                <div key={i} className="text-sm p-2 bg-orange-50 rounded">
                  <span className="font-medium">{rec.model}</span>
                  <span className="text-gray-500 ml-2 text-xs">{rec.suggestion}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Payload Table */}
      <div className="bg-white rounded-lg border p-4">
        <h3 className="font-semibold text-gray-900 mb-3">Payload by Model</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2 px-2 text-gray-600 font-medium">Model</th>
                <th className="text-right py-2 px-2 text-gray-600 font-medium">Est. Size</th>
                <th className="text-right py-2 px-2 text-gray-600 font-medium">Risk</th>
              </tr>
            </thead>
            <tbody>
              {payloadEfficiency.estimates.slice(0, 8).map((est, i) => (
                <tr key={i} className="border-b last:border-0">
                  <td className="py-2 px-2 font-medium text-gray-900">{est.model}</td>
                  <td className="py-2 px-2 text-right text-gray-600">{est.estimatedKB} KB</td>
                  <td className="py-2 px-2 text-right">
                    <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                      est.riskLevel === 'high' ? 'bg-red-100 text-red-700' :
                      est.riskLevel === 'medium' ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'
                    }`}>
                      {est.riskLevel}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// SEO Readiness Section
function SeoReadinessSection({ result, showAll }: { result: AuditResult; showAll: boolean }) {
  const { seoReadiness } = result.insights;
  const checkpoints = [
    seoReadiness.metaFieldCoverage,
    seoReadiness.slugConsistency,
    seoReadiness.socialSharing,
    seoReadiness.structuredData,
    seoReadiness.altTextCoverage,
  ];

  const issues = checkpoints.filter(c => c.status === 'issue' || c.status === 'warning');
  const goodItems = checkpoints.filter(c => c.status === 'good');
  const [expanded, setExpanded] = useState(showAll);

  return (
    <div className="space-y-6">
      {/* Score Card */}
      <div className="bg-white rounded-lg border p-4 flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-gray-900">SEO Readiness</h3>
          <p className="text-sm text-gray-500">5 checkpoints analyzed</p>
        </div>
        <div className={`px-4 py-2 rounded-full text-lg font-bold ${
          seoReadiness.overallScore >= 80 ? 'text-green-600 bg-green-50' :
          seoReadiness.overallScore >= 60 ? 'text-yellow-600 bg-yellow-50' : 'text-red-600 bg-red-50'
        }`}>
          {seoReadiness.overallScore}%
        </div>
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
            <div className="space-y-4">
              {goodItems.map((checkpoint, i) => (
                <CheckpointCard key={`good-${i}`} checkpoint={checkpoint} />
              ))}
              {!showAll && (
                <button onClick={() => setExpanded(false)} className="w-full py-2 text-sm text-gray-500 hover:text-gray-700">
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

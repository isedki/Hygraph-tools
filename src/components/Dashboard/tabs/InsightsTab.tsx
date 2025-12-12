'use client';

import { useState } from 'react';
import type { AuditResult, ModelFreshness } from '@/lib/types';
import { CheckpointCard } from '../CheckpointCard';

interface InsightsTabProps {
  result: AuditResult;
}

function ContentFreshnessSection({ result }: { result: AuditResult }) {
  const freshness = result.insights.contentFreshness;
  const [showAllModels, setShowAllModels] = useState(false);
  
  if (!freshness) {
    return (
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Content Freshness</h2>
        </div>
        <div className="bg-white rounded-lg border p-6 text-center text-gray-500">
          No content freshness data available. Run audit with content to see results.
        </div>
      </section>
    );
  }
  
  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    if (score >= 40) return 'text-orange-600';
    return 'text-red-600';
  };
  
  const getFreshnessLabel = (score: number) => {
    if (score >= 80) return { label: 'Excellent', color: 'bg-green-100 text-green-700' };
    if (score >= 60) return { label: 'Good', color: 'bg-yellow-100 text-yellow-700' };
    if (score >= 40) return { label: 'Needs Attention', color: 'bg-orange-100 text-orange-700' };
    return { label: 'Critical', color: 'bg-red-100 text-red-700' };
  };
  
  const formatDate = (date: Date | null) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    });
  };
  
  const displayedModels = showAllModels 
    ? freshness.modelFreshness 
    : freshness.modelFreshness.slice(0, 10);
  
  const { label: freshnessLabel, color: freshnessLabelColor } = getFreshnessLabel(freshness.overallFreshness.score);

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900">Content Freshness</h2>
        <div className="flex items-center gap-3">
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${freshnessLabelColor}`}>
            {freshnessLabel}
          </span>
          <div className={`text-2xl font-bold ${getScoreColor(freshness.overallFreshness.score)}`}>
            {freshness.overallFreshness.score}%
          </div>
        </div>
      </div>
      
      {/* Freshness Distribution */}
      <div className="grid grid-cols-4 gap-3 mb-4">
        <div className="bg-green-50 rounded-lg p-3 text-center border border-green-100">
          <div className="text-2xl font-bold text-green-600">{freshness.overallFreshness.freshPercentage}%</div>
          <div className="text-xs text-green-700">Fresh (&lt;{freshness.thresholds.fresh}d)</div>
        </div>
        <div className="bg-yellow-50 rounded-lg p-3 text-center border border-yellow-100">
          <div className="text-2xl font-bold text-yellow-600">
            {100 - freshness.overallFreshness.freshPercentage - freshness.overallFreshness.stalePercentage - freshness.overallFreshness.dormantPercentage}%
          </div>
          <div className="text-xs text-yellow-700">Aging ({freshness.thresholds.fresh}-{freshness.thresholds.aging}d)</div>
        </div>
        <div className="bg-orange-50 rounded-lg p-3 text-center border border-orange-100">
          <div className="text-2xl font-bold text-orange-600">{freshness.overallFreshness.stalePercentage}%</div>
          <div className="text-xs text-orange-700">Stale ({freshness.thresholds.aging}-{freshness.thresholds.stale}d)</div>
        </div>
        <div className="bg-red-50 rounded-lg p-3 text-center border border-red-100">
          <div className="text-2xl font-bold text-red-600">{freshness.overallFreshness.dormantPercentage}%</div>
          <div className="text-xs text-red-700">Dormant (&gt;{freshness.thresholds.dormant}d)</div>
        </div>
      </div>
      
      {/* Threshold Info */}
      <div className="bg-gray-50 rounded-lg p-3 mb-4 text-xs text-gray-600">
        <strong>Thresholds:</strong> Fresh &lt;{freshness.thresholds.fresh} days • 
        Aging {freshness.thresholds.fresh}-{freshness.thresholds.aging} days • 
        Stale {freshness.thresholds.aging}-{freshness.thresholds.stale} days • 
        Dormant &gt;{freshness.thresholds.dormant} days
      </div>
      
      {/* Stale Content Alerts */}
      {freshness.staleContentAlert.length > 0 && (
        <div className="bg-white rounded-xl border border-orange-200 p-4 mb-4">
          <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <span className="text-orange-500">⚠️</span>
            Stale Content Alerts
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
      
      {/* Per-Model Freshness */}
      <div className="bg-white rounded-xl border p-4">
        <h3 className="font-semibold text-gray-900 mb-3">Freshness by Model</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2 px-3 text-gray-600 font-medium">Model</th>
                <th className="text-right py-2 px-3 text-gray-600 font-medium">Entries</th>
                <th className="text-right py-2 px-3 text-gray-600 font-medium">Avg Age</th>
                <th className="text-center py-2 px-3 text-gray-600 font-medium">Distribution</th>
                <th className="text-right py-2 px-3 text-gray-600 font-medium">Last Update</th>
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
                    <td className="py-2 px-3 font-medium text-gray-900">{model.model}</td>
                    <td className="py-2 px-3 text-right text-gray-600">{model.totalEntries.toLocaleString()}</td>
                    <td className="py-2 px-3 text-right">
                      <span className={
                        model.avgAgeDays > 180 ? 'text-red-600' :
                        model.avgAgeDays > 90 ? 'text-orange-600' :
                        model.avgAgeDays > 30 ? 'text-yellow-600' : 'text-green-600'
                      }>
                        {model.avgAgeDays}d
                      </span>
                    </td>
                    <td className="py-2 px-3">
                      <div className="flex h-4 rounded overflow-hidden bg-gray-200 min-w-[100px]">
                        {freshPct > 0 && <div className="bg-green-500" style={{ width: `${freshPct}%` }} title={`Fresh: ${freshPct}%`} />}
                        {agingPct > 0 && <div className="bg-yellow-500" style={{ width: `${agingPct}%` }} title={`Aging: ${agingPct}%`} />}
                        {stalePct > 0 && <div className="bg-orange-500" style={{ width: `${stalePct}%` }} title={`Stale: ${stalePct}%`} />}
                        {dormantPct > 0 && <div className="bg-red-500" style={{ width: `${dormantPct}%` }} title={`Dormant: ${dormantPct}%`} />}
                      </div>
                    </td>
                    <td className="py-2 px-3 text-right text-gray-500 text-xs">
                      {formatDate(model.newestEntry)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          
          {freshness.modelFreshness.length > 10 && (
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
        <div className="mt-4 p-3 bg-gray-50 rounded-lg border">
          <h4 className="text-sm font-medium text-gray-700 mb-2">Recommendations</h4>
          <ul className="space-y-1">
            {freshness.recommendations.map((rec, i) => (
              <li key={i} className="text-sm text-gray-600 flex items-start gap-2">
                <span className="text-gray-400">•</span>
                {rec}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

export function InsightsTab({ result }: InsightsTabProps) {
  const { payloadEfficiency, contentAdoption, seoReadiness } = result.insights;

  return (
    <div className="space-y-8">
      {/* Content Adoption Section */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Content Adoption</h2>
          <div className={`text-2xl font-bold ${
            contentAdoption.overallScore >= 80 ? 'text-green-600' :
            contentAdoption.overallScore >= 60 ? 'text-yellow-600' : 'text-red-600'
          }`}>
            {contentAdoption.adoptionRate}% adopted
          </div>
        </div>

        {/* Adoption Stats */}
        <div className="grid grid-cols-5 gap-3 mb-4">
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

        {/* Ghost Models */}
        {contentAdoption.ghostModels.length > 0 && (
          <div className="bg-white rounded-xl border p-4 mb-4">
            <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <span className="text-red-500">👻</span>
              Ghost Models (0 entries)
            </h3>
            <div className="space-y-2">
              {contentAdoption.ghostModels.map((ghost, i) => (
                <div key={i} className="flex items-center justify-between text-sm p-2 bg-red-50 rounded border border-red-100">
                  <div>
                    <span className="font-medium text-gray-900">{ghost.model}</span>
                    {ghost.createdFor && (
                      <span className="text-gray-500 ml-2">({ghost.createdFor})</span>
                    )}
                  </div>
                  <div className="text-gray-500 text-xs">
                    {ghost.fieldCount} fields
                    {ghost.hasRelations && ' • has relations'}
                  </div>
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-3">
              Consider removing unused models or populating them with content.
            </p>
          </div>
        )}

        {/* Underutilized Models */}
        {contentAdoption.underutilized.length > 0 && (
          <div className="bg-white rounded-xl border p-4 mb-4">
            <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <span className="text-orange-500">📉</span>
              Underutilized Models (1-4 entries)
            </h3>
            <div className="space-y-2">
              {contentAdoption.underutilized.slice(0, 5).map((model, i) => (
                <div key={i} className="flex items-center justify-between text-sm p-2 bg-orange-50 rounded border border-orange-100">
                  <span className="font-medium text-gray-900">{model.model}</span>
                  <span className="text-orange-600">{model.entries} entries</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* High Volume Models */}
        {contentAdoption.highVolume.length > 0 && (
          <div className="bg-white rounded-xl border p-4">
            <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <span className="text-blue-500">📈</span>
              High Volume Models (500+ entries)
            </h3>
            <div className="space-y-2">
              {contentAdoption.highVolume.map((model, i) => (
                <div key={i} className="flex items-center justify-between text-sm p-2 bg-blue-50 rounded border border-blue-100">
                  <span className="font-medium text-gray-900">{model.model}</span>
                  <div className="text-right">
                    <span className="text-blue-600 font-medium">{model.entries.toLocaleString()}</span>
                    <span className="text-gray-500 text-xs ml-2">
                      ({model.published.toLocaleString()} published)
                    </span>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-3">
              Ensure queries for these models use pagination and field selection.
            </p>
          </div>
        )}

        {/* Recommendations */}
        {contentAdoption.recommendations.length > 0 && (
          <div className="mt-4 p-3 bg-gray-50 rounded-lg border">
            <h4 className="text-sm font-medium text-gray-700 mb-2">Recommendations</h4>
            <ul className="space-y-1">
              {contentAdoption.recommendations.map((rec, i) => (
                <li key={i} className="text-sm text-gray-600 flex items-start gap-2">
                  <span className="text-gray-400">•</span>
                  {rec}
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {/* API Payload Efficiency Section */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">API Payload Efficiency</h2>
          <div className={`text-2xl font-bold ${
            payloadEfficiency.overallScore >= 80 ? 'text-green-600' :
            payloadEfficiency.overallScore >= 60 ? 'text-yellow-600' : 'text-red-600'
          }`}>
            {payloadEfficiency.overallScore}%
          </div>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-3 gap-4 mb-4">
          <div className="bg-white rounded-lg border p-4 text-center">
            <div className="text-2xl font-bold text-gray-900">{payloadEfficiency.avgPayloadKB} KB</div>
            <div className="text-sm text-gray-500">Avg. Payload</div>
          </div>
          <div className="bg-white rounded-lg border p-4 text-center">
            <div className="text-2xl font-bold text-gray-900">{payloadEfficiency.totalModelsAnalyzed}</div>
            <div className="text-sm text-gray-500">Models Analyzed</div>
          </div>
          <div className={`rounded-lg border p-4 text-center ${
            payloadEfficiency.heavyModels.length > 0 ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'
          }`}>
            <div className={`text-2xl font-bold ${
              payloadEfficiency.heavyModels.length > 0 ? 'text-red-600' : 'text-green-600'
            }`}>
              {payloadEfficiency.heavyModels.length}
            </div>
            <div className={`text-sm ${
              payloadEfficiency.heavyModels.length > 0 ? 'text-red-700' : 'text-green-700'
            }`}>Heavy Models</div>
          </div>
        </div>

        {/* Heavy Models */}
        {payloadEfficiency.heavyModels.length > 0 && (
          <div className="bg-white rounded-xl border p-4 mb-4">
            <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <span className="text-red-500">⚠️</span>
              Heavy Models (&gt;50KB estimated)
            </h3>
            <div className="space-y-2">
              {payloadEfficiency.heavyModels.map((model, i) => (
                <div key={i} className="flex items-center justify-between text-sm p-3 bg-red-50 rounded border border-red-100">
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

        {/* Top 10 Models by Payload */}
        <div className="bg-white rounded-xl border p-4">
          <h3 className="font-semibold text-gray-900 mb-3">Payload by Model</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-3 text-gray-600 font-medium">Model</th>
                  <th className="text-right py-2 px-3 text-gray-600 font-medium">Est. Size</th>
                  <th className="text-right py-2 px-3 text-gray-600 font-medium">Risk</th>
                  <th className="text-left py-2 px-3 text-gray-600 font-medium">Heavy Fields</th>
                </tr>
              </thead>
              <tbody>
                {payloadEfficiency.estimates.slice(0, 10).map((est, i) => (
                  <tr key={i} className="border-b last:border-0">
                    <td className="py-2 px-3 font-medium text-gray-900">{est.model}</td>
                    <td className="py-2 px-3 text-right text-gray-600">{est.estimatedKB} KB</td>
                    <td className="py-2 px-3 text-right">
                      <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                        est.riskLevel === 'high' ? 'bg-red-100 text-red-700' :
                        est.riskLevel === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-green-100 text-green-700'
                      }`}>
                        {est.riskLevel}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-gray-500 text-xs">
                      {est.heavyFields.length > 0 
                        ? est.heavyFields.slice(0, 2).join(', ') + (est.heavyFields.length > 2 ? '...' : '')
                        : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Recommendations */}
        {payloadEfficiency.recommendations.length > 0 && (
          <div className="mt-4 p-3 bg-gray-50 rounded-lg border">
            <h4 className="text-sm font-medium text-gray-700 mb-2">Recommendations</h4>
            <ul className="space-y-1">
              {payloadEfficiency.recommendations.map((rec, i) => (
                <li key={i} className="text-sm text-gray-600 flex items-start gap-2">
                  <span className="text-gray-400">•</span>
                  {rec}
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {/* Content Freshness Section */}
      <ContentFreshnessSection result={result} />

      {/* Rich Text Usage Section */}
      <RichTextUsageSection result={result} />

      {/* SEO Readiness Section */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">SEO Readiness</h2>
          <div className={`text-2xl font-bold ${
            seoReadiness.overallScore >= 80 ? 'text-green-600' :
            seoReadiness.overallScore >= 60 ? 'text-yellow-600' : 'text-red-600'
          }`}>
            {seoReadiness.overallScore}%
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <CheckpointCard checkpoint={seoReadiness.metaFieldCoverage} />
          <CheckpointCard checkpoint={seoReadiness.slugConsistency} />
          <CheckpointCard checkpoint={seoReadiness.socialSharing} />
          <CheckpointCard checkpoint={seoReadiness.structuredData} />
          <CheckpointCard checkpoint={seoReadiness.altTextCoverage} />
        </div>
      </section>
    </div>
  );
}

function RichTextUsageSection({ result }: { result: AuditResult }) {
  const richText = result.insights.richTextUsage;
  const [showAllUrls, setShowAllUrls] = useState(false);
  
  if (!richText) {
    return (
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Rich Text Analysis</h2>
        </div>
        <div className="bg-white rounded-lg border p-6 text-center text-gray-500">
          No Rich Text analysis available.
        </div>
      </section>
    );
  }
  
  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const totalModels = richText.modelsWithRichText.length;
  const totalAbsoluteUrls = richText.absoluteUrls.reduce((sum, u) => sum + u.count, 0);
  const totalEmbeddedImages = richText.embeddedImages.reduce((sum, e) => sum + e.count, 0);
  const totalStaticLinks = richText.linkAnalysis.staticLinks.reduce((sum, l) => sum + l.count, 0);

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900">Rich Text Analysis</h2>
        <div className={`text-2xl font-bold ${getScoreColor(richText.overallScore)}`}>
          {richText.overallScore}%
        </div>
      </div>
      
      {/* Stats */}
      <div className="grid grid-cols-4 gap-3 mb-4">
        <div className="bg-blue-50 rounded-lg p-3 text-center border border-blue-100">
          <div className="text-2xl font-bold text-blue-600">{totalModels}</div>
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
          <div className="text-2xl font-bold text-gray-600">{totalStaticLinks}</div>
          <div className="text-xs text-gray-700">Static Links</div>
        </div>
      </div>
      
      {/* Models with Rich Text */}
      {richText.modelsWithRichText.length > 0 && (
        <div className="bg-white rounded-xl border p-4 mb-4">
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
      
      {/* Absolute URLs Warning */}
      {richText.absoluteUrls.length > 0 && (
        <div className="bg-white rounded-xl border border-red-200 p-4 mb-4">
          <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <span className="text-red-500">🔗</span>
            Absolute URLs Detected
          </h3>
          <p className="text-sm text-gray-600 mb-3">
            Hard-coded URLs make content less portable and harder to maintain. Consider using relative URLs or reference fields.
          </p>
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
            <button
              onClick={() => setShowAllUrls(!showAllUrls)}
              className="mt-2 text-sm text-blue-600 hover:text-blue-800"
            >
              {showAllUrls ? 'Show less' : `Show all ${richText.absoluteUrls.length}`}
            </button>
          )}
        </div>
      )}
      
      {/* Embedded Images Warning */}
      {richText.embeddedImages.length > 0 && (
        <div className="bg-white rounded-xl border border-orange-200 p-4 mb-4">
          <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <span className="text-orange-500">🖼️</span>
            Embedded Images in Rich Text
          </h3>
          <p className="text-sm text-gray-600 mb-3">
            Images embedded directly in Rich Text bypass Hygraph&apos;s asset management. Use Asset references instead.
          </p>
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
      
      {/* Link Analysis */}
      {(richText.linkAnalysis.staticLinks.length > 0 || richText.linkAnalysis.referenceLinks.length > 0) && (
        <div className="bg-white rounded-xl border p-4 mb-4">
          <h3 className="font-semibold text-gray-900 mb-3">Link Patterns</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2">Static Links ({richText.linkAnalysis.staticLinks.length})</h4>
              {richText.linkAnalysis.staticLinks.length > 0 ? (
                <div className="space-y-1">
                  {richText.linkAnalysis.staticLinks.slice(0, 5).map((link, i) => (
                    <div key={i} className="text-xs bg-gray-100 px-2 py-1 rounded flex justify-between">
                      <span>{link.model}.{link.field}</span>
                      <span className="text-gray-500">{link.count}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-gray-500">No static links found</p>
              )}
            </div>
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2">Reference Links ({richText.linkAnalysis.referenceLinks.length})</h4>
              {richText.linkAnalysis.referenceLinks.length > 0 ? (
                <div className="space-y-1">
                  {richText.linkAnalysis.referenceLinks.slice(0, 5).map((link, i) => (
                    <div key={i} className="text-xs bg-green-100 px-2 py-1 rounded flex justify-between">
                      <span>{link.model}.{link.field}</span>
                      <span className="text-green-600">{link.count}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-gray-500">No reference-based links</p>
              )}
            </div>
          </div>
        </div>
      )}
      
      {/* Recommendations */}
      {richText.recommendations.length > 0 && (
        <div className="p-3 bg-gray-50 rounded-lg border">
          <h4 className="text-sm font-medium text-gray-700 mb-2">Recommendations</h4>
          <ul className="space-y-1">
            {richText.recommendations.map((rec, i) => (
              <li key={i} className="text-sm text-gray-600 flex items-start gap-2">
                <span className="text-gray-400">•</span>
                {rec}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

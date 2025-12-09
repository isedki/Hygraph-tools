'use client';

import type { AuditResult } from '@/lib/types';
import { CheckpointCard } from '../CheckpointCard';

interface InsightsTabProps {
  result: AuditResult;
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

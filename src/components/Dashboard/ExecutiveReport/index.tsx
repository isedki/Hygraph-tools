'use client';

import { useState, useCallback, useMemo } from 'react';
import type { AuditResult } from '@/lib/types';
import { generateExecutiveReport, formatAsMarkdown, formatAsPlainText, type ExecutiveReport, type ExportFormat } from '@/lib/reports';

interface ExecutiveReportModalProps {
  result: AuditResult;
  endpoint?: string;
  hourlyRate?: number;
  isOpen: boolean;
  onClose: () => void;
}

export function ExecutiveReportModal({
  result,
  endpoint,
  hourlyRate = 50,
  isOpen,
  onClose,
}: ExecutiveReportModalProps) {
  const [format, setFormat] = useState<ExportFormat>('markdown');
  const [copied, setCopied] = useState(false);
  const [activeSection, setActiveSection] = useState<string>('summary');

  // Generate the report
  const report = useMemo(() => {
    return generateExecutiveReport(result, { hourlyRate, endpoint });
  }, [result, hourlyRate, endpoint]);

  // Format the report
  const formattedContent = useMemo(() => {
    if (format === 'markdown') {
      return formatAsMarkdown(report);
    } else if (format === 'plaintext') {
      return formatAsPlainText(report);
    } else {
      return JSON.stringify(report, null, 2);
    }
  }, [report, format]);

  // Copy to clipboard
  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(formattedContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  }, [formattedContent]);

  // Download as file
  const handleDownload = useCallback(() => {
    const ext = format === 'markdown' ? 'md' : format === 'plaintext' ? 'txt' : 'json';
    const blob = new Blob([formattedContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `content-investment-report.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  }, [formattedContent, format]);

  if (!isOpen) return null;

  const { executiveSummary, findings, investmentBreakdown, wasteAnalysis, internalComparisons, methodology } = report;

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col border border-slate-700">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
          <div>
            <h2 className="text-xl font-bold text-white">Executive Report</h2>
            <p className="text-sm text-slate-400">Content Investment Analysis</p>
          </div>
          <div className="flex items-center gap-3">
            {/* Format selector */}
            <select
              value={format}
              onChange={(e) => setFormat(e.target.value as ExportFormat)}
              className="px-3 py-1.5 bg-slate-800 border border-slate-600 rounded-lg text-sm text-white"
            >
              <option value="markdown">Markdown</option>
              <option value="plaintext">Plain Text</option>
              <option value="json">JSON</option>
            </select>
            
            {/* Copy button */}
            <button
              onClick={handleCopy}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                copied 
                  ? 'bg-green-600 text-white' 
                  : 'bg-blue-600 hover:bg-blue-700 text-white'
              }`}
            >
              {copied ? '✓ Copied!' : 'Copy All'}
            </button>
            
            {/* Download button */}
            <button
              onClick={handleDownload}
              className="px-4 py-1.5 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm font-medium text-white transition-colors"
            >
              Download
            </button>
            
            {/* Close button */}
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-slate-700 rounded-lg transition-colors"
            >
              <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex gap-1 px-6 py-2 border-b border-slate-700 bg-slate-800/50 overflow-x-auto">
          {[
            { id: 'summary', label: 'Summary', icon: '📊' },
            { id: 'findings', label: 'Findings', icon: '🔍' },
            { id: 'investment', label: 'Investment', icon: '💰' },
            { id: 'waste', label: 'Waste', icon: '🗑️' },
            { id: 'comparisons', label: 'Comparisons', icon: '⚖️' },
            { id: 'methodology', label: 'Methodology', icon: '📋' },
            { id: 'raw', label: 'Raw Export', icon: '📄' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveSection(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                activeSection === tab.id
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-400 hover:text-white hover:bg-slate-700'
              }`}
            >
              <span className="mr-1">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {/* Summary Section */}
          {activeSection === 'summary' && (
            <div className="space-y-6">
              {/* Bottom Line Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4">
                  <div className="text-3xl font-bold text-green-400">
                    ${executiveSummary.bottomLine.contentWorth.toLocaleString()}
                  </div>
                  <div className="text-sm text-green-300">Content Value</div>
                </div>
                <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
                  <div className="text-3xl font-bold text-red-400">
                    ${executiveSummary.bottomLine.wasting.toLocaleString()}
                  </div>
                  <div className="text-sm text-red-300">
                    Wasting ({executiveSummary.bottomLine.wastePercentage}%)
                  </div>
                </div>
                <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4">
                  <div className="text-3xl font-bold text-blue-400">
                    ${executiveSummary.bottomLine.recoverable.toLocaleString()}
                  </div>
                  <div className="text-sm text-blue-300">Recoverable</div>
                </div>
              </div>

              {/* Status Indicators */}
              <div className="bg-slate-800 rounded-xl p-4">
                <h3 className="text-lg font-semibold text-white mb-4">Status Overview</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {executiveSummary.statusIndicators.map(si => (
                    <div key={si.metric} className="text-center">
                      <div className="text-2xl font-bold text-white">
                        {si.value}
                        {si.trend === 'up' && <span className="text-green-400 ml-1">↗</span>}
                        {si.trend === 'down' && <span className="text-red-400 ml-1">↘</span>}
                      </div>
                      <div className="text-sm text-slate-400">{si.metric}</div>
                      <div className="text-xs text-slate-500 mt-1">{si.verdict}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Top Actions */}
              <div className="bg-slate-800 rounded-xl p-4">
                <h3 className="text-lg font-semibold text-white mb-4">Top Actions</h3>
                <div className="space-y-3">
                  {executiveSummary.topActions.map(action => (
                    <div 
                      key={action.rank}
                      className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <span className="w-8 h-8 flex items-center justify-center bg-blue-600 rounded-full text-white font-bold">
                          {action.rank}
                        </span>
                        <span className="text-white">{action.action}</span>
                      </div>
                      <div className="flex items-center gap-4 text-sm">
                        <span className="text-green-400 font-medium">
                          ${action.impact.toLocaleString()}
                        </span>
                        <span className="text-slate-400">{action.effort}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Narrative */}
              <div className="bg-slate-800/50 rounded-xl p-4 border-l-4 border-blue-500">
                <p className="text-slate-300 italic">{executiveSummary.narrativeSummary}</p>
              </div>
            </div>
          )}

          {/* Findings Section */}
          {activeSection === 'findings' && (
            <div className="space-y-6">
              {findings.length === 0 ? (
                <div className="text-center text-slate-400 py-8">
                  ✅ No significant findings
                </div>
              ) : (
                findings.map((finding, index) => (
                  <div key={finding.id} className="bg-slate-800 rounded-xl p-5">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="text-lg font-semibold text-white">
                          {index + 1}. {finding.title}
                        </h3>
                        <div className="flex items-center gap-4 mt-1 text-sm">
                          <span className="text-red-400 font-medium">
                            Impact: ${finding.impact.toLocaleString()}
                          </span>
                          {finding.risk && (
                            <span className="text-orange-400">{finding.risk}</span>
                          )}
                          <span className={`px-2 py-0.5 rounded text-xs ${
                            finding.confidence === 'high' ? 'bg-green-500/20 text-green-400' :
                            finding.confidence === 'medium' ? 'bg-yellow-500/20 text-yellow-400' :
                            'bg-slate-500/20 text-slate-400'
                          }`}>
                            {finding.confidence.toUpperCase()}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4 text-sm">
                      <div>
                        <h4 className="text-slate-400 uppercase text-xs mb-1">What We Found</h4>
                        <p className="text-slate-300">{finding.whatWeFound}</p>
                      </div>
                      
                      {finding.whyItHappens && (
                        <div>
                          <h4 className="text-slate-400 uppercase text-xs mb-1">Why This Happens</h4>
                          <p className="text-slate-300">{finding.whyItHappens}</p>
                        </div>
                      )}

                      <div>
                        <h4 className="text-slate-400 uppercase text-xs mb-1">Recommendations</h4>
                        <ul className="space-y-1">
                          {finding.recommendations.map((rec, i) => (
                            <li key={i} className="flex items-center gap-2 text-slate-300">
                              <span className="text-blue-400">{String.fromCharCode(65 + i)})</span>
                              {rec.option} <span className="text-slate-500">({rec.effort})</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      <details className="group">
                        <summary className="text-slate-400 cursor-pointer hover:text-slate-200 text-xs uppercase">
                          Evidence ({finding.evidence.length} items)
                        </summary>
                        <ul className="mt-2 space-y-1 text-slate-400">
                          {finding.evidence.map((e, i) => (
                            <li key={i}>• {e}</li>
                          ))}
                        </ul>
                      </details>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Investment Section */}
          {activeSection === 'investment' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between text-sm text-slate-400 mb-4">
                <span>Total Value: <strong className="text-green-400">${investmentBreakdown.totalValue.toLocaleString()}</strong></span>
                <span>Total Entries: <strong className="text-white">{investmentBreakdown.totalEntries.toLocaleString()}</strong></span>
                <span>Avg Time: <strong className="text-white">{investmentBreakdown.avgTimePerEntry} min</strong></span>
                <span>Rate: <strong className="text-white">${investmentBreakdown.hourlyRate}/hr</strong></span>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-700">
                      <th className="text-left py-2 px-3 text-slate-400">Model</th>
                      <th className="text-right py-2 px-3 text-slate-400">Entries</th>
                      <th className="text-right py-2 px-3 text-slate-400">Avg Time</th>
                      <th className="text-right py-2 px-3 text-slate-400">Value</th>
                      <th className="text-right py-2 px-3 text-slate-400">%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {investmentBreakdown.models.map(model => (
                      <tr key={model.model} className="border-b border-slate-800 hover:bg-slate-800/50">
                        <td className="py-2 px-3 text-white">{model.model}</td>
                        <td className="py-2 px-3 text-right text-slate-300">{model.entries}</td>
                        <td className="py-2 px-3 text-right text-slate-300">{model.avgTimeMinutes} min</td>
                        <td className="py-2 px-3 text-right text-green-400">${model.totalValue.toLocaleString()}</td>
                        <td className="py-2 px-3 text-right text-slate-300">
                          <div className="flex items-center justify-end gap-2">
                            <span>{model.percentOfTotal}%</span>
                            <div className="w-16 h-2 bg-slate-700 rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-blue-500 rounded-full"
                                style={{ width: `${model.percentOfTotal}%` }}
                              />
                            </div>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="text-xs text-slate-500 mt-4">
                Time formula: Base (1 min) + Fields (×12s) + Relations (×20s) + Required (×5s)
              </div>
            </div>
          )}

          {/* Waste Section */}
          {activeSection === 'waste' && (
            <div className="space-y-6">
              {wasteAnalysis.categories.length === 0 ? (
                <div className="text-center text-slate-400 py-8">
                  ✅ No significant waste detected
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-center">
                      <div className="text-2xl font-bold text-red-400">
                        ${wasteAnalysis.totalWaste.toLocaleString()}
                      </div>
                      <div className="text-sm text-red-300">Total Waste</div>
                    </div>
                    <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4 text-center">
                      <div className="text-2xl font-bold text-green-400">
                        ${wasteAnalysis.totalRecoverable.toLocaleString()}
                      </div>
                      <div className="text-sm text-green-300">Recoverable</div>
                    </div>
                  </div>

                  {wasteAnalysis.categories.map(cat => (
                    <div key={cat.category} className="bg-slate-800 rounded-xl p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-lg font-semibold text-white">{cat.label}</h3>
                        <span className="text-red-400 font-medium">
                          ${cat.totalAmount.toLocaleString()}
                        </span>
                      </div>
                      <div className="space-y-2">
                        {cat.items.map(item => (
                          <div 
                            key={item.name}
                            className="flex items-center justify-between p-2 bg-slate-700/50 rounded-lg text-sm"
                          >
                            <span className="text-white">{item.name}</span>
                            <div className="flex items-center gap-4">
                              <span className="text-slate-400">{item.details}</span>
                              <span className="text-red-400">${item.amount.toLocaleString()}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="mt-2 text-xs text-slate-500">
                        {cat.recoverable ? '✓ Fully recoverable' : '~ Partially recoverable'} 
                        ({cat.recoverableAmount > 0 ? `$${cat.recoverableAmount.toLocaleString()}` : 'N/A'})
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          )}

          {/* Comparisons Section */}
          {activeSection === 'comparisons' && (
            <div className="space-y-6">
              {/* Model Comparisons */}
              <div className="bg-slate-800 rounded-xl p-4">
                <h3 className="text-lg font-semibold text-white mb-4">Best vs Worst (Internal)</h3>
                {internalComparisons.modelComparisons.length === 0 ? (
                  <p className="text-slate-400">Not enough data for comparisons</p>
                ) : (
                  <div className="space-y-4">
                    {internalComparisons.modelComparisons.map(comp => (
                      <div key={comp.metric} className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg">
                        <div className="font-medium text-white">{comp.metric}</div>
                        <div className="flex items-center gap-6 text-sm">
                          <div className="text-center">
                            <div className="text-green-400">{comp.bestModel}</div>
                            <div className="text-slate-400">{comp.bestValue}</div>
                          </div>
                          <div className="text-slate-500">vs</div>
                          <div className="text-center">
                            <div className="text-red-400">{comp.worstModel}</div>
                            <div className="text-slate-400">{comp.worstValue}</div>
                          </div>
                          <div className="text-yellow-400 font-medium">{comp.gap}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Theoretical Targets */}
              <div className="bg-slate-800 rounded-xl p-4">
                <h3 className="text-lg font-semibold text-white mb-4">Theoretical Targets</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-700">
                        <th className="text-left py-2 px-3 text-slate-400">Metric</th>
                        <th className="text-center py-2 px-3 text-slate-400">Current</th>
                        <th className="text-center py-2 px-3 text-slate-400">Target</th>
                        <th className="text-center py-2 px-3 text-slate-400">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {internalComparisons.theoreticalTargets.map(target => (
                        <tr key={target.metric} className="border-b border-slate-800">
                          <td className="py-2 px-3 text-white">{target.metric}</td>
                          <td className="py-2 px-3 text-center text-slate-300">{target.currentValue}</td>
                          <td className="py-2 px-3 text-center text-slate-400">{target.target}</td>
                          <td className="py-2 px-3 text-center">
                            <span className={`px-2 py-0.5 rounded text-xs ${
                              target.status === 'met' ? 'bg-green-500/20 text-green-400' :
                              target.status === 'close' ? 'bg-yellow-500/20 text-yellow-400' :
                              'bg-red-500/20 text-red-400'
                            }`}>
                              {target.status === 'met' ? '✓ Met' : target.status === 'close' ? '~ Close' : '⚠️ Needs Work'}
                            </span>
                            {target.note && (
                              <span className="ml-2 text-xs text-slate-500">{target.note}</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="mt-4 text-xs text-slate-500 italic">
                  {internalComparisons.disclaimer}
                </p>
              </div>
            </div>
          )}

          {/* Methodology Section */}
          {activeSection === 'methodology' && (
            <div className="space-y-6">
              {/* Data Source */}
              <div className="bg-slate-800 rounded-xl p-4">
                <h3 className="text-lg font-semibold text-white mb-4">Data Source</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-slate-400">Provider:</span>
                    <span className="ml-2 text-white">{methodology.provenance.provider}</span>
                  </div>
                  <div>
                    <span className="text-slate-400">Access:</span>
                    <span className="ml-2 text-white">{methodology.provenance.accessType}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-slate-400">Endpoint:</span>
                    <code className="ml-2 text-blue-400 text-xs bg-slate-900 px-2 py-0.5 rounded">
                      {methodology.provenance.endpoint}
                    </code>
                  </div>
                  <div>
                    <span className="text-slate-400">Scan Time:</span>
                    <span className="ml-2 text-white">
                      {new Date(methodology.provenance.scanTime).toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>

              {/* Coverage */}
              <div className="bg-slate-800 rounded-xl p-4">
                <h3 className="text-lg font-semibold text-white mb-4">Coverage</h3>
                <div className="grid grid-cols-3 gap-4 text-sm text-center">
                  <div>
                    <div className="text-2xl font-bold text-green-400">
                      {methodology.provenance.coverage.modelsAnalyzed}
                    </div>
                    <div className="text-slate-400">Models</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-green-400">
                      {methodology.provenance.coverage.entriesAnalyzed.toLocaleString()}
                    </div>
                    <div className="text-slate-400">Entries</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-green-400">
                      {methodology.provenance.coverage.componentsAnalyzed}
                    </div>
                    <div className="text-slate-400">Components</div>
                  </div>
                </div>
                <div className="mt-4 text-center text-sm text-green-400">
                  {methodology.provenance.coverage.sampling === 'none' 
                    ? '✓ Full dataset (no sampling)' 
                    : 'Sampled data'}
                </div>
              </div>

              {/* Calculations */}
              <div className="bg-slate-800 rounded-xl p-4">
                <h3 className="text-lg font-semibold text-white mb-4">Calculations</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex">
                    <span className="text-slate-400 w-32">Content Value:</span>
                    <span className="text-white">{methodology.calculations.contentValue}</span>
                  </div>
                  <div className="flex">
                    <span className="text-slate-400 w-32">Time/Entry:</span>
                    <span className="text-white">{methodology.calculations.timePerEntry}</span>
                  </div>
                  <div className="flex">
                    <span className="text-slate-400 w-32">Waste:</span>
                    <span className="text-white">{methodology.calculations.wasteCalculation}</span>
                  </div>
                </div>
              </div>

              {/* Assumptions & Limitations */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-800 rounded-xl p-4">
                  <h3 className="text-lg font-semibold text-white mb-4">Assumptions</h3>
                  <ul className="space-y-2 text-sm">
                    {methodology.assumptions.map(a => (
                      <li key={a.id} className="flex items-start gap-2">
                        <span className={`mt-0.5 w-2 h-2 rounded-full ${
                          a.impact === 'high' ? 'bg-red-400' :
                          a.impact === 'medium' ? 'bg-yellow-400' : 'bg-green-400'
                        }`} />
                        <span className="text-slate-300">{a.description}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="bg-slate-800 rounded-xl p-4">
                  <h3 className="text-lg font-semibold text-white mb-4">Limitations</h3>
                  <ul className="space-y-2 text-sm">
                    {methodology.limitations.map(l => (
                      <li key={l.id} className="text-slate-300">
                        • {l.description}
                        {l.workaround && (
                          <span className="text-slate-500 text-xs block ml-3">
                            → {l.workaround}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Confidence Levels */}
              <div className="bg-slate-800 rounded-xl p-4">
                <h3 className="text-lg font-semibold text-white mb-4">Confidence Levels</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-green-500/20 text-green-400 text-xs">HIGH</span>
                    <span className="text-slate-300">{methodology.confidenceLevels.high}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-yellow-500/20 text-yellow-400 text-xs">MEDIUM</span>
                    <span className="text-slate-300">{methodology.confidenceLevels.medium}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-slate-500/20 text-slate-400 text-xs">LOW</span>
                    <span className="text-slate-300">{methodology.confidenceLevels.low}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Raw Export Section */}
          {activeSection === 'raw' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="text-sm text-slate-400">
                  Format: <strong className="text-white">{format === 'markdown' ? 'Markdown' : format === 'plaintext' ? 'Plain Text' : 'JSON'}</strong>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCopy}
                    className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                      copied 
                        ? 'bg-green-600 text-white' 
                        : 'bg-blue-600 hover:bg-blue-700 text-white'
                    }`}
                  >
                    {copied ? '✓ Copied!' : 'Copy'}
                  </button>
                  <button
                    onClick={handleDownload}
                    className="px-3 py-1 bg-slate-700 hover:bg-slate-600 rounded text-xs font-medium text-white transition-colors"
                  >
                    Download
                  </button>
                </div>
              </div>
              <pre className="bg-slate-950 rounded-xl p-4 text-xs text-slate-300 overflow-auto max-h-[60vh] font-mono">
                {formattedContent}
              </pre>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-700 flex items-center justify-between text-xs text-slate-500">
          <span>Generated: {new Date(report.generatedAt).toLocaleString()}</span>
          <span>v{report.version}</span>
        </div>
      </div>
    </div>
  );
}


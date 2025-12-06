'use client';

import { useState } from 'react';
import type { AuditResult } from '@/lib/types';
import ExecutiveSummary from './ExecutiveSummary';
import StrengthsSection from './StrengthsSection';
import RelationshipDiagram from './RelationshipDiagram';
import EnumOverview from './EnumOverview';
import ModelRecommendations from './ModelRecommendations';
import StrategicFindings from './StrategicFindings';
import StrategicRecommendationsSection from './StrategicRecommendationsSection';
import ImplementationRoadmapComponent from './ImplementationRoadmap';
import ExportButton from './ExportButton';
import ContentMaturityGauge from './ContentMaturityGauge';
import OmnichannelReadinessCard from './OmnichannelReadinessCard';
import EditorialVelocityPanel from './EditorialVelocityPanel';
import PermissionModelReviewCard from './PermissionModelReviewCard';
import LocalizationAssessmentCard from './LocalizationAssessmentCard';
import PersonalizationReadinessCard from './PersonalizationReadinessCard';

interface DashboardProps {
  result: AuditResult;
  onDisconnect: () => void;
}

type TabType = 'report' | 'findings' | 'roadmap' | 'technical';

const efficiencyStyles = {
  streamlined: { color: 'text-green-400', bg: 'bg-green-500/10' },
  manageable: { color: 'text-blue-400', bg: 'bg-blue-500/10' },
  cumbersome: { color: 'text-yellow-400', bg: 'bg-yellow-500/10' },
  frustrating: { color: 'text-red-400', bg: 'bg-red-500/10' },
};

const maturityStyles = {
  basic: { color: 'text-yellow-400', label: 'Basic' },
  intermediate: { color: 'text-blue-400', label: 'Intermediate' },
  advanced: { color: 'text-green-400', label: 'Advanced' },
};

const riskStyles = {
  low: { color: 'text-green-400', bg: 'bg-green-500/10' },
  medium: { color: 'text-yellow-400', bg: 'bg-yellow-500/10' },
  high: { color: 'text-red-400', bg: 'bg-red-500/10' },
};

export default function Dashboard({ result, onDisconnect }: DashboardProps) {
  const [activeTab, setActiveTab] = useState<TabType>('report');
  const report = result.strategicReport;
  
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-2 rounded-lg bg-gradient-to-br from-purple-500 to-cyan-500">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <div>
                <h1 className="font-bold text-lg">Content Strategy Audit</h1>
                <p className="text-xs text-muted-foreground truncate max-w-md">
                  {result.connectionInfo.endpoint}
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <ExportButton result={result} />
              <button
                onClick={onDisconnect}
                className="btn-secondary text-sm py-2 px-4"
              >
                New Audit
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      <nav className="border-b border-border bg-card/30">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex gap-1">
            {[
              { id: 'report' as TabType, label: 'Executive Report', icon: '📊' },
              { id: 'findings' as TabType, label: 'Areas for Improvement', icon: '🔍' },
              { id: 'roadmap' as TabType, label: 'Implementation Roadmap', icon: '🗺️' },
              { id: 'technical' as TabType, label: 'Technical Details', icon: '⚙️' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-3 text-sm font-medium transition-colors border-b-2 ${
                  activeTab === tab.id
                    ? 'border-purple-500 text-purple-400'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                <span className="mr-2">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-6 py-8">
        {/* Executive Report Tab */}
        {activeTab === 'report' && (
          <div className="space-y-8 animate-fade-in">
            {/* Executive Summary */}
            <ExecutiveSummary 
              report={report} 
              endpoint={result.connectionInfo.endpoint}
              auditDate={result.connectionInfo.connectedAt}
            />

            {/* Operational Readiness */}
            <section className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              <ContentMaturityGauge assessment={report.contentStrategy.contentMaturityAssessment} />
              <OmnichannelReadinessCard readiness={report.contentStrategy.omnichannelReadiness} />
            </section>

            <section className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              <EditorialVelocityPanel velocity={report.editorialExperience.velocityEstimate} />
              <div className="space-y-6">
                <PermissionModelReviewCard review={report.governance.permissionModelReview} />
                <LocalizationAssessmentCard assessment={report.governance.localizationAssessment} />
                <PersonalizationReadinessCard readiness={report.contentStrategy.personalizationReadiness} />
              </div>
            </section>
            
            {/* Strengths Section */}
            <StrengthsSection strengths={report.strengths} />
            
            {/* Strategic Recommendations */}
            <StrategicRecommendationsSection recommendations={report.strategicRecommendations} />
            
            {/* Relationship Diagram */}
            <RelationshipDiagram graph={report.relationshipGraph} />
            
            {/* Use Case & Editorial Experience */}
            <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Use Case Analysis */}
              <div className="rounded-xl border border-border bg-card p-6">
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-3xl">{report.useCaseAnalysis.useCaseIcon}</span>
                  <div>
                    <h2 className="font-semibold text-lg">{report.useCaseAnalysis.detectedUseCase}</h2>
                    <p className="text-xs text-muted-foreground">Detected Architecture</p>
                  </div>
                  <div className="ml-auto text-right">
                    <div className={`text-2xl font-bold ${report.useCaseAnalysis.fitScore >= 70 ? 'text-green-400' : report.useCaseAnalysis.fitScore >= 50 ? 'text-yellow-400' : 'text-red-400'}`}>
                      {report.useCaseAnalysis.fitScore}%
                    </div>
                    <p className="text-xs text-muted-foreground">Fit Score</p>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground mb-4">
                  {report.useCaseAnalysis.fitAssessment}
                </p>
                
                {report.useCaseAnalysis.strengths.length > 0 && (
                  <div className="mt-4">
                    <h4 className="text-xs font-semibold text-green-400 mb-2">Strengths</h4>
                    <ul className="space-y-1">
                      {report.useCaseAnalysis.strengths.slice(0, 3).map((s, i) => (
                        <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                          <span className="text-green-400">✓</span> {s.finding}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
              
              {/* Editorial Experience */}
              <div className="rounded-xl border border-border bg-card p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-semibold text-lg">Editorial Experience</h2>
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${efficiencyStyles[report.editorialExperience.efficiency].bg} ${efficiencyStyles[report.editorialExperience.efficiency].color}`}>
                    {report.editorialExperience.efficiency.charAt(0).toUpperCase() + report.editorialExperience.efficiency.slice(1)}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground mb-4">
                  {report.editorialExperience.editorPersona}
                </p>
                
                {report.editorialExperience.positives.length > 0 && (
                  <div className="mt-4">
                    <h4 className="text-xs font-semibold text-green-400 mb-2">What&apos;s Working</h4>
                    <ul className="space-y-1">
                      {report.editorialExperience.positives.map((p, i) => (
                        <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                          <span className="text-green-400">✓</span> {p}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </section>
            
            {/* Content Strategy & Performance */}
            <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="rounded-xl border border-border bg-card p-6">
                <h2 className="font-semibold text-lg mb-4">Content Model Maturity</h2>
                <div className="flex items-center gap-4 mb-4">
                  <div className={`text-3xl font-bold ${maturityStyles[report.contentStrategy.maturity].color}`}>
                    {maturityStyles[report.contentStrategy.maturity].label}
                  </div>
                  <div className="flex-1 h-2 bg-card rounded-full overflow-hidden">
                    <div 
                      className={`h-full ${maturityStyles[report.contentStrategy.maturity].color.replace('text-', 'bg-').replace('-400', '-500')}`}
                      style={{ width: `${report.contentStrategy.maturity === 'basic' ? 33 : report.contentStrategy.maturity === 'intermediate' ? 66 : 100}%` }}
                    />
                  </div>
                </div>
                <p className="text-sm text-muted-foreground mb-4">
                  {report.contentStrategy.maturityDescription}
                </p>
                
                <div className="grid grid-cols-2 gap-4 mt-4">
                  <div className="bg-card/50 rounded-lg p-3">
                    <div className="text-2xl font-bold text-cyan-400">{report.contentStrategy.reusabilityScore}%</div>
                    <div className="text-xs text-muted-foreground">Reusability</div>
                  </div>
                  <div className="bg-card/50 rounded-lg p-3">
                    <div className={`text-sm font-medium ${report.contentStrategy.governanceReadiness === 'ready' ? 'text-green-400' : report.contentStrategy.governanceReadiness === 'needs-work' ? 'text-yellow-400' : 'text-red-400'}`}>
                      {report.contentStrategy.governanceReadiness === 'ready' ? 'Ready' : report.contentStrategy.governanceReadiness === 'needs-work' ? 'Needs Work' : 'Missing'}
                    </div>
                    <div className="text-xs text-muted-foreground">Governance</div>
                  </div>
                </div>
              </div>
              
              <div className="rounded-xl border border-border bg-card p-6">
                <h2 className="font-semibold text-lg mb-4">Performance Considerations</h2>
                <div className="flex items-center gap-4 mb-4">
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${riskStyles[report.performanceConsiderations.overallRisk].bg} ${riskStyles[report.performanceConsiderations.overallRisk].color}`}>
                    {report.performanceConsiderations.overallRisk.charAt(0).toUpperCase() + report.performanceConsiderations.overallRisk.slice(1)} Risk
                  </span>
                </div>
                <p className="text-sm text-muted-foreground mb-4">
                  {report.performanceConsiderations.riskAssessment}
                </p>
                
                {report.performanceConsiderations.potentialBottlenecks.length > 0 && (
                  <div className="mt-4">
                    <h4 className="text-xs font-semibold text-yellow-400 mb-2">Watch Out For</h4>
                    <ul className="space-y-2">
                      {report.performanceConsiderations.potentialBottlenecks.map((b, i) => (
                        <li key={i} className="text-sm">
                          <span className="text-foreground">{b.issue}</span>
                          <span className="text-muted-foreground"> - {b.impact}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </section>
            
            {/* Enum Overview */}
            <EnumOverview enumOverview={report.enumOverview} />
          </div>
        )}

        {/* Areas for Improvement Tab */}
        {activeTab === 'findings' && (
          <div className="space-y-8 animate-fade-in">
            <div className="mb-6">
              <h2 className="text-2xl font-bold mb-2">Areas for Improvement</h2>
              <p className="text-muted-foreground">
                Detailed findings organized by category with specific recommendations
              </p>
            </div>
            
            {/* Strategic Findings */}
            <StrategicFindings findings={report.findings} />
            
            {/* Model-Specific Recommendations */}
            <ModelRecommendations modelAnalysis={report.modelRecommendations} />
          </div>
        )}

        {/* Implementation Roadmap Tab */}
        {activeTab === 'roadmap' && (
          <div className="animate-fade-in">
            <div className="mb-6">
              <h2 className="text-2xl font-bold mb-2">Implementation Roadmap</h2>
              <p className="text-muted-foreground">
                Phased approach to improving your schema with prioritized tasks
              </p>
            </div>
            <ImplementationRoadmapComponent roadmap={report.implementationRoadmap} />
          </div>
        )}

        {/* Technical Details Tab */}
        {activeTab === 'technical' && (
          <div className="animate-fade-in space-y-6">
            <div className="mb-6">
              <h2 className="text-2xl font-bold mb-2">Technical Details</h2>
              <p className="text-muted-foreground">
                Detailed metrics for developers and technical stakeholders
              </p>
            </div>
            
            {/* Schema Overview */}
            <div className="rounded-xl border border-border bg-card p-6">
              <h3 className="font-semibold mb-4">Schema Overview</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-400">{result.schema.modelCount}</div>
                  <div className="text-xs text-muted-foreground">Models</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-cyan-400">{result.schema.componentCount}</div>
                  <div className="text-xs text-muted-foreground">Components</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-400">{result.schema.enumCount}</div>
                  <div className="text-xs text-muted-foreground">Enums</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-amber-400">{result.schema.totalFields}</div>
                  <div className="text-xs text-muted-foreground">Total Fields</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-400">{result.schema.relationCount}</div>
                  <div className="text-xs text-muted-foreground">Relations</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-rose-400">{result.content.totalEntries.toLocaleString()}</div>
                  <div className="text-xs text-muted-foreground">Entries</div>
                </div>
              </div>
            </div>
            
            {/* Category Scores */}
            <div className="rounded-xl border border-border bg-card p-6">
              <h3 className="font-semibold mb-4">Category Scores</h3>
              <div className="space-y-3">
                {result.categoryScores.map(cat => (
                  <div key={cat.category} className="flex items-center gap-4">
                    <div className="w-32 text-sm text-muted-foreground capitalize">
                      {cat.category.replace('-', ' ')}
                    </div>
                    <div className="flex-1 h-2 bg-card rounded-full overflow-hidden">
                      <div 
                        className={`h-full transition-all ${cat.score >= 70 ? 'bg-green-500' : cat.score >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`}
                        style={{ width: `${cat.score}%` }}
                      />
                    </div>
                    <div className={`w-12 text-right font-medium ${cat.score >= 70 ? 'text-green-400' : cat.score >= 50 ? 'text-yellow-400' : 'text-red-400'}`}>
                      {cat.score}%
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            {/* All Technical Issues */}
            <div className="rounded-xl border border-border bg-card p-6">
              <h3 className="font-semibold mb-4">Technical Issues ({result.allIssues.length})</h3>
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {result.allIssues.map((issue, i) => (
                  <div key={i} className={`p-3 rounded-lg border ${
                    issue.severity === 'critical' ? 'border-red-500/30 bg-red-500/5' :
                    issue.severity === 'warning' ? 'border-yellow-500/30 bg-yellow-500/5' :
                    'border-blue-500/30 bg-blue-500/5'
                  }`}>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="font-medium text-sm">{issue.title}</div>
                        <div className="text-xs text-muted-foreground mt-1">{issue.description}</div>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded capitalize ${
                        issue.severity === 'critical' ? 'bg-red-500/20 text-red-400' :
                        issue.severity === 'warning' ? 'bg-yellow-500/20 text-yellow-400' :
                        'bg-blue-500/20 text-blue-400'
                      }`}>
                        {issue.severity}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>
      
      {/* Footer */}
      <footer className="border-t border-border py-4 mt-8">
        <div className="max-w-6xl mx-auto px-6 text-center text-xs text-muted-foreground">
          Audit completed {result.connectionInfo.connectedAt.toLocaleString()}
        </div>
      </footer>
    </div>
  );
}

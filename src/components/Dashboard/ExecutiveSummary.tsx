'use client';

import type { StrategicAuditReport } from '@/lib/types';

interface ExecutiveSummaryProps {
  report: StrategicAuditReport;
  endpoint: string;
  auditDate: Date;
}

// Extract project info from endpoint URL
// Example: https://eu-central-1-dotcontrol.cdn.hygraph.com/content/cmav7qlmh0kv907w3gztl8a2f/master
function extractProjectInfo(endpoint: string): { projectId: string; region: string; environment: string } {
  try {
    // Extract region: eu-central-1 from the hostname
    const regionMatch = endpoint.match(/https?:\/\/([a-z]+-[a-z]+-\d+)/i);
    let region = 'Unknown';
    if (regionMatch) {
      // Format: "eu-central-1" -> "EU Central 1"
      region = regionMatch[1]
        .split('-')
        .map((part, i) => i < 2 ? part.toUpperCase() : part)
        .join(' ');
    }
    
    // Extract project ID and environment from path: /content/{projectId}/{environment}
    const pathMatch = endpoint.match(/\/content\/([^/]+)\/([^/?]+)/);
    const projectId = pathMatch ? pathMatch[1] : 'Unknown';
    const environment = pathMatch ? pathMatch[2] : 'Unknown';
    
    return { projectId, region, environment };
  } catch {
    return { projectId: 'Unknown', region: 'Unknown', environment: 'Unknown' };
  }
}

const assessmentStyles = {
  excellent: {
    bg: 'from-emerald-500/20 to-green-500/10',
    border: 'border-emerald-500/30',
    badge: 'bg-emerald-500',
    text: 'text-emerald-400',
  },
  good: {
    bg: 'from-blue-500/20 to-cyan-500/10',
    border: 'border-blue-500/30',
    badge: 'bg-blue-500',
    text: 'text-blue-400',
  },
  'needs-attention': {
    bg: 'from-amber-500/20 to-yellow-500/10',
    border: 'border-amber-500/30',
    badge: 'bg-amber-500',
    text: 'text-amber-400',
  },
  critical: {
    bg: 'from-red-500/20 to-rose-500/10',
    border: 'border-red-500/30',
    badge: 'bg-red-500',
    text: 'text-red-400',
  },
};

const assessmentLabels = {
  excellent: 'Excellent',
  good: 'Good',
  'needs-attention': 'Needs Attention',
  critical: 'Critical',
};

export default function ExecutiveSummary({ report, endpoint, auditDate }: ExecutiveSummaryProps) {
  const { executiveSummary, schemaOverview } = report;
  const style = assessmentStyles[executiveSummary.overallAssessment];
  const projectInfo = extractProjectInfo(endpoint);
  
  return (
    <section className="space-y-6">
      {/* Formal Report Header */}
      <div className="pb-6 border-b border-border">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold mb-1">Hygraph Schema Audit Report</h1>
            <p className="text-muted-foreground text-sm">
              Project: <span className="text-foreground font-mono">{projectInfo.projectId}</span>
              <span className="mx-2 text-border">|</span>
              Region: <span className="text-foreground">{projectInfo.region}</span>
              <span className="mx-2 text-border">|</span>
              Environment: <span className="text-foreground capitalize">{projectInfo.environment}</span>
            </p>
          </div>
          <div className="text-right text-sm">
            <div className="text-muted-foreground">
              Generated: <span className="text-foreground">{auditDate.toLocaleString('en-US', { 
                weekday: 'short',
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                timeZoneName: 'short'
              })}</span>
            </div>
            <div className="text-muted-foreground mt-1">
              Assessment Date: <span className="text-foreground">{auditDate.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Executive Summary Card */}
      <div className={`rounded-2xl border ${style.border} bg-gradient-to-br ${style.bg} p-8`}>
        {/* Assessment Badge & Metrics */}
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center gap-3">
            <span className={`px-4 py-1.5 rounded-full text-sm font-semibold text-white ${style.badge}`}>
              {assessmentLabels[executiveSummary.overallAssessment]}
            </span>
            <span className="text-sm text-muted-foreground">Overall Assessment</span>
          </div>
          
          {/* Key Metrics */}
          <div className="flex gap-6 text-center">
            <div>
              <div className="text-2xl font-bold">{executiveSummary.metrics.customModels}</div>
              <div className="text-xs text-muted-foreground">Models</div>
            </div>
            <div>
              <div className="text-2xl font-bold">{executiveSummary.metrics.components}</div>
              <div className="text-xs text-muted-foreground">Components</div>
            </div>
            <div>
              <div className="text-2xl font-bold">{executiveSummary.metrics.enums}</div>
              <div className="text-xs text-muted-foreground">Enums</div>
            </div>
            <div>
              <div className="text-2xl font-bold">{executiveSummary.metrics.contentEntries.toLocaleString()}</div>
              <div className="text-xs text-muted-foreground">Entries</div>
            </div>
          </div>
        </div>
      
        {/* Headline */}
        <h2 className="text-3xl font-bold mb-2 leading-tight">
          {executiveSummary.headline}
        </h2>
        <p className="text-lg text-muted-foreground mb-6">
          {executiveSummary.subheadline}
        </p>
        
        {/* Narrative Summary */}
        {executiveSummary.narrativeSummary && (
          <div className="mb-8 p-4 rounded-xl bg-card/30 border border-border/50">
            <p className="text-foreground leading-relaxed"
               dangerouslySetInnerHTML={{ 
                 __html: executiveSummary.narrativeSummary.replace(
                   /\*\*([^*]+)\*\*/g, 
                   '<strong class="text-foreground">$1</strong>'
                 ) 
               }} 
            />
          </div>
        )}
      
        {/* Key Findings & Recommendations Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Key Findings */}
          <div className="bg-card/50 rounded-xl p-5">
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
              Key Findings
            </h3>
            <ul className="space-y-2">
              {executiveSummary.keyFindings.map((finding, i) => (
                <li key={i} className="text-sm flex items-start gap-2">
                  <span className={`mt-1.5 w-1.5 h-1.5 rounded-full ${style.badge} flex-shrink-0`}></span>
                  <span className="text-muted-foreground">{finding}</span>
                </li>
              ))}
            </ul>
          </div>
          
          {/* Quick Wins */}
          <div className="bg-card/50 rounded-xl p-5">
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Quick Wins
            </h3>
            {executiveSummary.quickWins.length > 0 ? (
              <ul className="space-y-2">
                {executiveSummary.quickWins.map((win, i) => (
                  <li key={i} className="text-sm flex items-start gap-2">
                    <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-green-500 flex-shrink-0"></span>
                    <span className="text-muted-foreground">{win}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No immediate quick wins identified - schema is well-optimized</p>
            )}
          </div>
          
          {/* Strategic Recommendations */}
          <div className="bg-card/50 rounded-xl p-5">
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <svg className="w-5 h-5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
              </svg>
              Strategic Recommendations
            </h3>
            {executiveSummary.strategicRecommendations.length > 0 ? (
              <ul className="space-y-2">
                {executiveSummary.strategicRecommendations.map((rec, i) => (
                  <li key={i} className="text-sm flex items-start gap-2">
                    <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-cyan-500 flex-shrink-0"></span>
                    <span className="text-muted-foreground">{rec}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">Continue maintaining current best practices</p>
            )}
          </div>
        </div>
      </div>

      {/* Schema Overview */}
      {schemaOverview && (
        <div className="rounded-xl border border-border bg-card p-6">
          <h3 className="font-semibold text-lg mb-4">Schema Overview</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-lg bg-card/50 border border-border/50">
              <div className="text-3xl mb-2">📄</div>
              <h4 className="font-medium text-sm text-foreground mb-1">Models</h4>
              <p className="text-sm text-muted-foreground"
                 dangerouslySetInnerHTML={{ 
                   __html: schemaOverview.modelsNarrative.replace(
                     /\*\*([^*]+)\*\*/g, 
                     '<strong class="text-foreground">$1</strong>'
                   ) 
                 }} 
              />
            </div>
            <div className="p-4 rounded-lg bg-card/50 border border-border/50">
              <div className="text-3xl mb-2">🧩</div>
              <h4 className="font-medium text-sm text-foreground mb-1">Components</h4>
              <p className="text-sm text-muted-foreground"
                 dangerouslySetInnerHTML={{ 
                   __html: schemaOverview.componentsNarrative.replace(
                     /\*\*([^*]+)\*\*/g, 
                     '<strong class="text-foreground">$1</strong>'
                   ) 
                 }} 
              />
            </div>
            <div className="p-4 rounded-lg bg-card/50 border border-border/50">
              <div className="text-3xl mb-2">📋</div>
              <h4 className="font-medium text-sm text-foreground mb-1">Enumerations</h4>
              <p className="text-sm text-muted-foreground"
                 dangerouslySetInnerHTML={{ 
                   __html: schemaOverview.enumsNarrative.replace(
                     /\*\*([^*]+)\*\*/g, 
                     '<strong class="text-foreground">$1</strong>'
                   ) 
                 }} 
              />
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

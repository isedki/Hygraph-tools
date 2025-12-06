'use client';

import { useState } from 'react';
import type { AuditIssue } from '@/lib/types';

interface IssueCardProps {
  issue: AuditIssue;
}

const severityConfig = {
  critical: {
    className: 'severity-critical',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
    ),
    label: 'Critical',
  },
  warning: {
    className: 'severity-warning',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    label: 'Warning',
  },
  info: {
    className: 'severity-info',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    label: 'Info',
  },
};

const categoryIcons: Record<string, React.ReactNode> = {
  schema: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
    </svg>
  ),
  component: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
    </svg>
  ),
  content: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  ),
  editorial: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
    </svg>
  ),
  seo: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  ),
  performance: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
  ),
  'best-practices': (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
    </svg>
  ),
  governance: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
    </svg>
  ),
};

export default function IssueCard({ issue }: IssueCardProps) {
  const [expanded, setExpanded] = useState(false);
  const config = severityConfig[issue.severity];

  return (
    <div 
      className={`card p-4 cursor-pointer transition-all hover:border-muted ${
        expanded ? 'ring-1 ring-purple-500/30' : ''
      }`}
      onClick={() => setExpanded(!expanded)}
    >
      <div className="flex items-start gap-4">
        {/* Severity Badge */}
        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${config.className}`}>
          {config.icon}
          {config.label}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-muted-foreground">{categoryIcons[issue.category]}</span>
            <span className="text-xs text-muted uppercase tracking-wide">{issue.category}</span>
          </div>
          
          <h3 className="font-semibold text-foreground mb-1">{issue.title}</h3>
          <p className="text-sm text-muted-foreground">{issue.description}</p>

          {/* Expanded Content */}
          {expanded && (
            <div className="mt-4 space-y-3 animate-fade-in">
              <div className="p-3 rounded-lg bg-background/50">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-muted mb-1">Impact</h4>
                <p className="text-sm text-foreground">{issue.impact}</p>
              </div>
              
              <div className="p-3 rounded-lg bg-green-500/5 border border-green-500/20">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-green-400 mb-1">Recommendation</h4>
                <p className="text-sm text-foreground">{issue.recommendation}</p>
              </div>

              {issue.affectedItems.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-muted mb-2">Affected Items</h4>
                  <div className="flex flex-wrap gap-2">
                    {issue.affectedItems.slice(0, 10).map((item, i) => (
                      <code 
                        key={i}
                        className="px-2 py-1 rounded bg-card border border-border text-xs font-mono"
                      >
                        {item}
                      </code>
                    ))}
                    {issue.affectedItems.length > 10 && (
                      <span className="px-2 py-1 text-xs text-muted-foreground">
                        +{issue.affectedItems.length - 10} more
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Expand Icon */}
        <svg 
          className={`w-5 h-5 text-muted-foreground transition-transform ${expanded ? 'rotate-180' : ''}`} 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>
    </div>
  );
}

export function IssueList({ issues, limit }: { issues: AuditIssue[]; limit?: number }) {
  const displayIssues = limit ? issues.slice(0, limit) : issues;
  
  return (
    <div className="space-y-3">
      {displayIssues.map((issue) => (
        <IssueCard key={issue.id} issue={issue} />
      ))}
      {limit && issues.length > limit && (
        <p className="text-center text-sm text-muted-foreground py-2">
          +{issues.length - limit} more issues
        </p>
      )}
    </div>
  );
}


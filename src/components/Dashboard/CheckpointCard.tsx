'use client';

import { useState } from 'react';
import type { CheckpointResult, CheckpointStatus } from '@/lib/types';

interface CheckpointCardProps {
  checkpoint: CheckpointResult;
  defaultExpanded?: boolean;
  collapsible?: boolean;  // Allow collapsing (primarily for good status)
}

const statusConfig: Record<CheckpointStatus, { bg: string; border: string; icon: string; label: string }> = {
  good: {
    bg: 'bg-green-50',
    border: 'border-green-200',
    icon: '✓',
    label: 'Good',
  },
  warning: {
    bg: 'bg-yellow-50',
    border: 'border-yellow-200',
    icon: '⚠',
    label: 'Needs Attention',
  },
  issue: {
    bg: 'bg-red-50',
    border: 'border-red-200',
    icon: '✗',
    label: 'Issue',
  },
};

export function CheckpointCard({ checkpoint, defaultExpanded, collapsible = true }: CheckpointCardProps) {
  const config = statusConfig[checkpoint.status];
  
  // Default: collapse good items, expand issues/warnings
  const shouldDefaultCollapse = collapsible && checkpoint.status === 'good';
  const [expanded, setExpanded] = useState(defaultExpanded ?? !shouldDefaultCollapse);
  
  const hasContent = checkpoint.findings.length > 0 || 
                     checkpoint.examples.length > 0 || 
                     checkpoint.actionItems.length > 0;
  
  const canCollapse = collapsible && hasContent;

  return (
    <div className={`rounded-lg border ${config.border} ${config.bg} overflow-hidden transition-all`}>
      {/* Header */}
      <div 
        className={`px-4 py-3 flex items-center justify-between ${canCollapse ? 'cursor-pointer hover:bg-white/30' : ''}`}
        onClick={() => canCollapse && setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3">
          <span className={`text-lg ${
            checkpoint.status === 'good' ? 'text-green-600' :
            checkpoint.status === 'warning' ? 'text-yellow-600' : 'text-red-600'
          }`}>
            {config.icon}
          </span>
          <div>
            <h4 className="font-medium text-gray-900">{checkpoint.title}</h4>
            {/* Show first finding as subtitle when collapsed */}
            {!expanded && checkpoint.findings[0] && (
              <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{checkpoint.findings[0]}</p>
            )}
            {expanded && (
              <span className={`text-xs px-2 py-0.5 rounded-full ${
                checkpoint.status === 'good' ? 'bg-green-100 text-green-700' :
                checkpoint.status === 'warning' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'
              }`}>
                {config.label}
              </span>
            )}
          </div>
        </div>
        
        {/* Expand/Collapse indicator */}
        {canCollapse && (
          <svg 
            className={`w-5 h-5 text-gray-400 transition-transform ${expanded ? 'rotate-180' : ''}`}
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        )}
      </div>

      {/* Collapsible content */}
      {expanded && (
        <>
          {/* Findings */}
          {checkpoint.findings.length > 0 && (
            <div className="px-4 py-2 border-t border-gray-100 bg-white/50">
              <p className="text-sm font-medium text-gray-700 mb-1">Findings</p>
              <ul className="text-sm text-gray-600 space-y-1">
                {checkpoint.findings.map((finding, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-gray-400 mt-1">•</span>
                    <span>{finding}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Examples */}
          {checkpoint.examples.length > 0 && (
            <div className="px-4 py-2 border-t border-gray-100 bg-white/30">
              <p className="text-sm font-medium text-gray-700 mb-2">Examples</p>
              <div className="space-y-2">
                {checkpoint.examples.slice(0, 3).map((example, i) => (
                  <div key={i} className="text-sm bg-white rounded p-2 border border-gray-100">
                    {example.items && example.items.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-1">
                        {example.items.map((item, j) => (
                          <code key={j} className="px-1.5 py-0.5 bg-gray-100 rounded text-xs text-gray-700">
                            {item}
                          </code>
                        ))}
                      </div>
                    )}
                    {example.details && (
                      <p className="text-gray-500 text-xs">{example.details}</p>
                    )}
                    {example.sharedFields && example.sharedFields.length > 0 && (
                      <div className="mt-1">
                        <span className="text-xs text-gray-400">Shared: </span>
                        {example.sharedFields.map((field, j) => (
                          <code key={j} className="px-1 py-0.5 bg-blue-50 rounded text-xs text-blue-600 mr-1">
                            {field}
                          </code>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action Items */}
          {checkpoint.actionItems.length > 0 && (
            <div className="px-4 py-2 border-t border-gray-100 bg-white/20">
              <p className="text-sm font-medium text-gray-700 mb-1">Recommended Actions</p>
              <ul className="text-sm text-gray-600 space-y-1">
                {checkpoint.actionItems.map((action, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-blue-500 mt-1">→</span>
                    <span>{action}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// Compact version for summary views
export function CheckpointBadge({ checkpoint }: { checkpoint: CheckpointResult }) {
  const config = statusConfig[checkpoint.status];
  
  return (
    <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded ${config.bg} ${config.border} border`}>
      <span className={`text-sm ${
        checkpoint.status === 'good' ? 'text-green-600' :
        checkpoint.status === 'warning' ? 'text-yellow-600' : 'text-red-600'
      }`}>
        {config.icon}
      </span>
      <span className="text-sm text-gray-700">{checkpoint.title}</span>
    </div>
  );
}

// Grid of checkpoints with summary and optional filtering
export function CheckpointGrid({ 
  checkpoints, 
  title,
  showAll = true,
}: { 
  checkpoints: CheckpointResult[]; 
  title?: string;
  showAll?: boolean;  // When false, shows only issues/warnings
}) {
  const [localShowAll, setLocalShowAll] = useState(showAll);
  
  const goodCount = checkpoints.filter(c => c.status === 'good').length;
  const warningCount = checkpoints.filter(c => c.status === 'warning').length;
  const issueCount = checkpoints.filter(c => c.status === 'issue').length;
  
  // Filter checkpoints based on showAll
  const issues = checkpoints.filter(c => c.status === 'issue' || c.status === 'warning');
  const goodItems = checkpoints.filter(c => c.status === 'good');
  const visibleCheckpoints = localShowAll ? checkpoints : issues;

  return (
    <div className="space-y-4">
      {title && (
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
          <div className="flex items-center gap-3 text-sm">
            {goodCount > 0 && (
              <span className="flex items-center gap-1 text-green-600">
                <span>✓</span> {goodCount}
              </span>
            )}
            {warningCount > 0 && (
              <span className="flex items-center gap-1 text-yellow-600">
                <span>⚠</span> {warningCount}
              </span>
            )}
            {issueCount > 0 && (
              <span className="flex items-center gap-1 text-red-600">
                <span>✗</span> {issueCount}
              </span>
            )}
          </div>
        </div>
      )}
      
      {/* Visible checkpoints */}
      <div className="grid gap-4">
        {visibleCheckpoints.map((checkpoint, i) => (
          <CheckpointCard key={i} checkpoint={checkpoint} />
        ))}
      </div>
      
      {/* Show hidden good items button */}
      {!localShowAll && goodItems.length > 0 && (
        <button
          onClick={() => setLocalShowAll(true)}
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
      )}
      
      {/* Collapse button when showing all */}
      {localShowAll && !showAll && goodItems.length > 0 && issues.length > 0 && (
        <button
          onClick={() => setLocalShowAll(false)}
          className="w-full py-2 text-sm text-gray-500 hover:text-gray-700 transition-colors flex items-center justify-center gap-1"
        >
          <span>Hide passing checks</span>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
          </svg>
        </button>
      )}
    </div>
  );
}

'use client';

import type { CheckpointResult, CheckpointStatus } from '@/lib/types';

interface CheckpointCardProps {
  checkpoint: CheckpointResult;
  defaultExpanded?: boolean;
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

export function CheckpointCard({ checkpoint, defaultExpanded = false }: CheckpointCardProps) {
  const config = statusConfig[checkpoint.status];

  return (
    <div className={`rounded-lg border ${config.border} ${config.bg} overflow-hidden`}>
      {/* Header */}
      <div className="px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className={`text-lg ${
            checkpoint.status === 'good' ? 'text-green-600' :
            checkpoint.status === 'warning' ? 'text-yellow-600' : 'text-red-600'
          }`}>
            {config.icon}
          </span>
          <div>
            <h4 className="font-medium text-gray-900">{checkpoint.title}</h4>
            <span className={`text-xs px-2 py-0.5 rounded-full ${
              checkpoint.status === 'good' ? 'bg-green-100 text-green-700' :
              checkpoint.status === 'warning' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'
            }`}>
              {config.label}
            </span>
          </div>
        </div>
      </div>

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

// Grid of checkpoints with summary
export function CheckpointGrid({ 
  checkpoints, 
  title 
}: { 
  checkpoints: CheckpointResult[]; 
  title?: string;
}) {
  const goodCount = checkpoints.filter(c => c.status === 'good').length;
  const warningCount = checkpoints.filter(c => c.status === 'warning').length;
  const issueCount = checkpoints.filter(c => c.status === 'issue').length;

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
      <div className="grid gap-4">
        {checkpoints.map((checkpoint, i) => (
          <CheckpointCard key={i} checkpoint={checkpoint} />
        ))}
      </div>
    </div>
  );
}

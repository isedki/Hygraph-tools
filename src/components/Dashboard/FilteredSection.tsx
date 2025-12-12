'use client';

import { useState } from 'react';
import type { CheckpointResult } from '@/lib/types';
import { CheckpointCard } from './CheckpointCard';

interface FilteredSectionProps {
  checkpoints: CheckpointResult[];
  showAll: boolean;
  title?: string;
}

export function FilteredSection({ checkpoints, showAll, title }: FilteredSectionProps) {
  const [expanded, setExpanded] = useState(false);
  
  // Separate issues/warnings from good items
  const issues = checkpoints.filter(cp => cp.status === 'issue' || cp.status === 'warning');
  const goodItems = checkpoints.filter(cp => cp.status === 'good');
  
  const visibleCheckpoints = showAll || expanded ? checkpoints : issues;
  const hiddenCount = showAll ? 0 : goodItems.length;
  
  if (checkpoints.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      {title && (
        <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide">{title}</h3>
      )}
      
      {/* Visible checkpoints */}
      <div className="space-y-4">
        {visibleCheckpoints.map((checkpoint, i) => (
          <CheckpointCard key={i} checkpoint={checkpoint} />
        ))}
      </div>
      
      {/* Hidden good items indicator */}
      {!showAll && hiddenCount > 0 && !expanded && (
        <button
          onClick={() => setExpanded(true)}
          className="w-full py-3 px-4 bg-green-50 hover:bg-green-100 border border-green-200 rounded-lg text-sm text-green-700 font-medium transition-colors flex items-center justify-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>{hiddenCount} passing check{hiddenCount !== 1 ? 's' : ''} hidden</span>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      )}
      
      {/* Collapse button when expanded */}
      {!showAll && expanded && hiddenCount > 0 && (
        <button
          onClick={() => setExpanded(false)}
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

// Simple component to show when all items are good
export function AllGoodMessage({ count }: { count: number }) {
  return (
    <div className="py-8 text-center">
      <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-green-100 mb-3">
        <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      </div>
      <p className="text-green-700 font-medium">All {count} checks passing</p>
      <p className="text-sm text-gray-500 mt-1">No issues detected in this section</p>
    </div>
  );
}

// Compact list for displaying good items in collapsed form
export function CollapsedGoodItems({ checkpoints }: { checkpoints: CheckpointResult[] }) {
  const [expanded, setExpanded] = useState(false);
  const goodItems = checkpoints.filter(cp => cp.status === 'good');
  
  if (goodItems.length === 0) return null;
  
  return (
    <div className="border border-green-200 rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full py-3 px-4 bg-green-50 hover:bg-green-100 text-sm text-green-700 font-medium transition-colors flex items-center justify-between"
      >
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>{goodItems.length} passing check{goodItems.length !== 1 ? 's' : ''}</span>
        </div>
        <svg 
          className={`w-4 h-4 transition-transform ${expanded ? 'rotate-180' : ''}`} 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      
      {expanded && (
        <div className="p-4 bg-white space-y-3">
          {goodItems.map((cp, i) => (
            <div key={i} className="flex items-start gap-2 text-sm">
              <span className="text-green-500 mt-0.5">✓</span>
              <div>
                <span className="font-medium text-gray-900">{cp.title}</span>
                {cp.findings[0] && (
                  <span className="text-gray-500 ml-2">— {cp.findings[0]}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

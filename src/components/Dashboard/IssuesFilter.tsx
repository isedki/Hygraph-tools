'use client';

import { useEffect, useState } from 'react';

interface IssuesFilterProps {
  showAll: boolean;
  onToggle: () => void;
  hiddenCount: number;
}

export function IssuesFilter({ showAll, onToggle, hiddenCount }: IssuesFilterProps) {
  return (
    <div className="flex items-center gap-3">
      {!showAll && hiddenCount > 0 && (
        <span className="text-xs text-gray-500">
          {hiddenCount} good item{hiddenCount !== 1 ? 's' : ''} hidden
        </span>
      )}
      
      <button
        onClick={onToggle}
        className={`
          flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all
          ${showAll 
            ? 'bg-gray-100 text-gray-600 hover:bg-gray-200' 
            : 'bg-purple-100 text-purple-700 hover:bg-purple-200'
          }
        `}
      >
        <span className={`
          w-3 h-3 rounded-full border-2 flex items-center justify-center
          ${showAll ? 'border-gray-400' : 'border-purple-500 bg-purple-500'}
        `}>
          {!showAll && (
            <svg className="w-2 h-2 text-white" fill="currentColor" viewBox="0 0 12 12">
              <path d="M10 3L4.5 8.5 2 6" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          )}
        </span>
        {showAll ? 'Show all' : 'Issues only'}
      </button>
    </div>
  );
}

// Global filter state hook with localStorage persistence
const STORAGE_KEY = 'audit-issues-filter';

export function useIssuesFilter(): [boolean, () => void] {
  const [showAll, setShowAll] = useState(false);
  
  // Load from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored !== null) {
      setShowAll(stored === 'true');
    }
  }, []);
  
  const toggle = () => {
    const newValue = !showAll;
    setShowAll(newValue);
    localStorage.setItem(STORAGE_KEY, String(newValue));
  };
  
  return [showAll, toggle];
}

// Compact toggle for the header
export function IssuesFilterToggle({ showAll, onToggle }: { showAll: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      className={`
        flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all border
        ${showAll 
          ? 'border-gray-300 bg-white text-gray-600 hover:bg-gray-50' 
          : 'border-purple-300 bg-purple-50 text-purple-700 hover:bg-purple-100'
        }
      `}
      title={showAll ? 'Showing all items' : 'Showing issues and warnings only'}
    >
      <svg 
        className={`w-4 h-4 ${showAll ? 'text-gray-400' : 'text-purple-500'}`} 
        fill="none" 
        stroke="currentColor" 
        viewBox="0 0 24 24"
      >
        <path 
          strokeLinecap="round" 
          strokeLinejoin="round" 
          strokeWidth={2} 
          d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" 
        />
      </svg>
      <span className="hidden sm:inline">{showAll ? 'All Items' : 'Issues Only'}</span>
    </button>
  );
}

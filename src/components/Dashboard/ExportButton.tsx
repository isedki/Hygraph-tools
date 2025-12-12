'use client';

import { useState } from 'react';
import type { AuditResult } from '@/lib/types';
import { downloadMarkdown } from '@/lib/export/generateMarkdown';

interface ExportButtonProps {
  result: AuditResult;
}

export default function ExportButton({ result }: ExportButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  
  const handleExportMarkdown = () => {
    setIsExporting(true);
    try {
      downloadMarkdown(result);
    } catch (error) {
      console.error('Export failed:', error);
      alert('Failed to generate Markdown. Please try again.');
    } finally {
      setIsExporting(false);
      setIsOpen(false);
    }
  };

  const handleCopyMarkdown = async () => {
    const { generateMarkdown } = await import('@/lib/export/generateMarkdown');
    const markdown = generateMarkdown(result);
    await navigator.clipboard.writeText(markdown);
    alert('Copied to clipboard!');
    setIsOpen(false);
  };
  
  return (
    <div className="relative">
    <button
        onClick={() => setIsOpen(!isOpen)}
      disabled={isExporting}
      className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-500 to-cyan-500 text-white rounded-lg font-medium text-sm hover:opacity-90 transition-opacity disabled:opacity-50"
    >
      {isExporting ? (
        <>
          <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
            <span>Exporting...</span>
        </>
      ) : (
        <>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
            <span>Export</span>
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
        </>
      )}
    </button>
      
      {isOpen && (
        <div className="absolute right-0 mt-2 w-48 bg-card border border-border rounded-lg shadow-lg z-50">
          <button
            onClick={handleExportMarkdown}
            className="w-full px-4 py-2 text-left text-sm hover:bg-muted/50 flex items-center gap-2 rounded-t-lg"
          >
            <span>📄</span>
            Download Markdown
          </button>
          <button
            onClick={handleCopyMarkdown}
            className="w-full px-4 py-2 text-left text-sm hover:bg-muted/50 flex items-center gap-2 rounded-b-lg border-t border-border"
          >
            <span>📋</span>
            Copy to Clipboard
          </button>
        </div>
      )}
    </div>
  );
}




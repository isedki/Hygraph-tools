'use client';

import { useState } from 'react';
import ConnectForm from '@/components/ConnectForm';
import Dashboard from '@/components/Dashboard/Dashboard';
import { createHygraphClient } from '@/lib/hygraph/client';
import { runFullAudit } from '@/lib/analyzers';
import type { AuditResult } from '@/lib/types';

export default function Home() {
  const [auditResult, setAuditResult] = useState<AuditResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [connectionInfo, setConnectionInfo] = useState<{ endpoint: string; token: string } | null>(null);

  const handleConnect = async (endpoint: string, token: string) => {
    setIsLoading(true);
    
    try {
      setLoadingMessage('Connecting to Hygraph...');
      const client = createHygraphClient(endpoint, token);
      
      setLoadingMessage('Analyzing schema...');
      await new Promise(resolve => setTimeout(resolve, 500)); // Small delay for UX
      
      setLoadingMessage('Running comprehensive audit...');
      const result = await runFullAudit(client, endpoint);
      
      setLoadingMessage('Generating report...');
      await new Promise(resolve => setTimeout(resolve, 300)); // Small delay for UX
      
      setAuditResult(result);
      setConnectionInfo({ endpoint, token });
    } catch (error) {
      console.error('Audit failed:', error);
      alert(`Audit failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
      setLoadingMessage('');
    }
  };

  const handleDisconnect = () => {
    setAuditResult(null);
    setConnectionInfo(null);
  };

  // Show loading overlay
  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-6 grid-pattern">
        <div className="relative">
          <div className="w-20 h-20 rounded-full border-4 border-purple-500/20 border-t-purple-500 animate-spin" />
          <div className="absolute inset-0 flex items-center justify-center">
            <svg className="w-8 h-8 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
        </div>
        <div className="text-center">
          <p className="text-lg font-medium text-foreground">{loadingMessage}</p>
          <p className="text-sm text-muted-foreground mt-1">This may take a moment...</p>
        </div>
      </div>
    );
  }

  // Show dashboard if we have results
  if (auditResult && connectionInfo) {
    return (
      <Dashboard 
        result={auditResult} 
        onDisconnect={handleDisconnect}
        endpoint={connectionInfo.endpoint}
        token={connectionInfo.token}
      />
    );
  }

  // Show connection form
  return <ConnectForm onConnect={handleConnect} isLoading={isLoading} />;
}

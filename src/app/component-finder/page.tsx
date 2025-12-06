'use client';

import { useState, useEffect } from 'react';
import { validateConnection, createHygraphClient } from '@/lib/hygraph/client';
import { fetchSchema } from '@/lib/hygraph/introspection';
import { ComponentUsageFinder } from '@/components/ComponentUsageFinder';
import type { HygraphSchema } from '@/lib/types';
import { GraphQLClient } from 'graphql-request';

interface SavedConnection {
  id: string;
  name: string;
  endpoint: string;
  token: string;
  createdAt: string;
}

const STORAGE_KEY = 'hygraph-audit-connections';

function loadSavedConnections(): SavedConnection[] {
  if (typeof window === 'undefined') return [];
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
}

export default function ComponentFinderPage() {
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [client, setClient] = useState<GraphQLClient | null>(null);
  const [schema, setSchema] = useState<HygraphSchema | null>(null);
  
  // Connection form state
  const [endpoint, setEndpoint] = useState('');
  const [token, setToken] = useState('');
  const [savedConnections, setSavedConnections] = useState<SavedConnection[]>([]);
  const [selectedConnectionId, setSelectedConnectionId] = useState<string>('');

  useEffect(() => {
    setSavedConnections(loadSavedConnections());
  }, []);

  const handleSelectConnection = (connectionId: string) => {
    setSelectedConnectionId(connectionId);
    if (connectionId) {
      const connection = savedConnections.find(c => c.id === connectionId);
      if (connection) {
        setEndpoint(connection.endpoint);
        setToken(connection.token);
      }
    } else {
      setEndpoint('');
      setToken('');
    }
    setError(null);
  };

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    
    if (!endpoint.trim() || !token.trim()) {
      setError('Please enter both endpoint and token');
      return;
    }
    
    setIsLoading(true);
    setLoadingMessage('Validating connection...');
    
    try {
      const validation = await validateConnection(endpoint.trim(), token.trim());
      
      if (!validation.valid) {
        setError(validation.error || 'Failed to connect');
        setIsLoading(false);
        return;
      }
      
      setLoadingMessage('Fetching schema...');
      const hygraphClient = createHygraphClient(endpoint.trim(), token.trim());
      const schemaData = await fetchSchema(hygraphClient);
      
      setClient(hygraphClient);
      setSchema(schemaData);
      setIsConnected(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connection failed');
    } finally {
      setIsLoading(false);
      setLoadingMessage('');
    }
  };

  const handleDisconnect = () => {
    setIsConnected(false);
    setClient(null);
    setSchema(null);
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-6 grid-pattern">
        <div className="relative">
          <div className="w-20 h-20 rounded-full border-4 border-purple-500/20 border-t-purple-500 animate-spin" />
          <div className="absolute inset-0 flex items-center justify-center">
            <svg className="w-8 h-8 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
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

  // Connected - show finder
  if (isConnected && client && schema) {
    return <ComponentUsageFinder client={client} schema={schema} onBack={handleDisconnect} endpoint={endpoint} />;
  }

  // Connection form
  return (
    <div className="min-h-screen flex items-center justify-center p-6 grid-pattern">
      <div className="w-full max-w-lg animate-fade-in">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500 to-cyan-500 mb-6 animate-pulse-glow">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold mb-2">
            <span className="gradient-text">Component</span> Usage Finder
          </h1>
          <p className="text-muted">
            Find which content entries use specific components or enums
          </p>
        </div>

        {/* Form */}
        <div className="card-gradient p-8">
          <form onSubmit={handleConnect} className="space-y-6">
            {/* Saved Connections */}
            {savedConnections.length > 0 && (
              <div className="space-y-2">
                <label className="block text-sm font-medium">Saved Projects</label>
                <select
                  value={selectedConnectionId}
                  onChange={(e) => handleSelectConnection(e.target.value)}
                  className="w-full appearance-none cursor-pointer bg-background border border-border rounded-lg p-3"
                >
                  <option value="">+ New Connection</option>
                  {savedConnections.map(conn => (
                    <option key={conn.id} value={conn.id}>{conn.name}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Manual Entry */}
            {!selectedConnectionId && (
              <>
                <div className="space-y-2">
                  <label htmlFor="endpoint" className="block text-sm font-medium">
                    Content API Endpoint
                  </label>
                  <input
                    type="url"
                    id="endpoint"
                    value={endpoint}
                    onChange={(e) => setEndpoint(e.target.value)}
                    placeholder="https://api-xx.hygraph.com/v2/..."
                    className="disabled:opacity-50"
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="token" className="block text-sm font-medium">
                    Permanent Auth Token (PAT)
                  </label>
                  <input
                    type="password"
                    id="token"
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    placeholder="eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9..."
                    className="disabled:opacity-50"
                  />
                </div>
              </>
            )}

            {/* Error */}
            {error && (
              <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
                <div className="flex items-start gap-3">
                  <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>{error}</span>
                </div>
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={!endpoint.trim() || !token.trim()}
              className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              Connect & Find Components
            </button>
          </form>
        </div>

        {/* Features */}
        <div className="mt-8 grid grid-cols-2 gap-4 text-center animate-fade-in-delay-2">
          {[
            { icon: '🔍', label: 'Deep Search' },
            { icon: '🎯', label: 'Nested Components' },
            { icon: '📊', label: 'Usage Analytics' },
            { icon: '🗂️', label: 'Schema Explorer' },
          ].map((feature, i) => (
            <div 
              key={feature.label}
              className="p-4 rounded-lg bg-card/50 border border-border/50"
              style={{ animationDelay: `${0.3 + i * 0.1}s` }}
            >
              <span className="text-2xl mb-2 block">{feature.icon}</span>
              <span className="text-sm text-muted">{feature.label}</span>
            </div>
          ))}
        </div>

        {/* Back to main app link */}
        <div className="mt-8 text-center">
          <a 
            href="/"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            ← Back to Content Strategy Audit
          </a>
        </div>
      </div>
    </div>
  );
}



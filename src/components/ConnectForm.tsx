'use client';

import { useState, useEffect } from 'react';
import { validateConnection } from '@/lib/hygraph/client';

interface SavedConnection {
  id: string;
  name: string;
  endpoint: string;
  token: string;
  createdAt: string;
}

interface ConnectFormProps {
  onConnect: (endpoint: string, token: string) => void;
  isLoading?: boolean;
}

const STORAGE_KEY = 'hygraph-audit-connections';

function generateId(): string {
  return Math.random().toString(36).substring(2, 9);
}

function loadSavedConnections(): SavedConnection[] {
  if (typeof window === 'undefined') return [];
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
}

function saveConnections(connections: SavedConnection[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(connections));
}

export default function ConnectForm({ onConnect, isLoading }: ConnectFormProps) {
  const [endpoint, setEndpoint] = useState('');
  const [token, setToken] = useState('');
  const [connectionName, setConnectionName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [validating, setValidating] = useState(false);
  const [savedConnections, setSavedConnections] = useState<SavedConnection[]>([]);
  const [selectedConnectionId, setSelectedConnectionId] = useState<string>('');
  const [showSaveOption, setShowSaveOption] = useState(false);
  const [saveThisConnection, setSaveThisConnection] = useState(true);

  // Load saved connections on mount
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
        setConnectionName(connection.name);
        setShowSaveOption(false);
      }
    } else {
      setEndpoint('');
      setToken('');
      setConnectionName('');
      setShowSaveOption(true);
    }
    setError(null);
  };

  const handleDeleteConnection = (connectionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = savedConnections.filter(c => c.id !== connectionId);
    setSavedConnections(updated);
    saveConnections(updated);
    if (selectedConnectionId === connectionId) {
      setSelectedConnectionId('');
      setEndpoint('');
      setToken('');
      setConnectionName('');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    
    if (!endpoint.trim()) {
      setError('Please enter your Content API endpoint');
      return;
    }
    
    if (!token.trim()) {
      setError('Please enter your Permanent Auth Token');
      return;
    }
    
    // Validate the connection first
    setValidating(true);
    const result = await validateConnection(endpoint.trim(), token.trim());
    setValidating(false);
    
    if (!result.valid) {
      setError(result.error || 'Failed to connect to Hygraph');
      return;
    }
    
    // Save connection if requested and it's a new one
    if (saveThisConnection && showSaveOption && connectionName.trim()) {
      const newConnection: SavedConnection = {
        id: generateId(),
        name: connectionName.trim(),
        endpoint: endpoint.trim(),
        token: token.trim(),
        createdAt: new Date().toISOString(),
      };
      const updated = [...savedConnections, newConnection];
      setSavedConnections(updated);
      saveConnections(updated);
    }
    
    onConnect(endpoint.trim(), token.trim());
  };

  const isSubmitting = validating || isLoading;
  const hasEndpointAndToken = endpoint.trim() && token.trim();

  // Extract project name from endpoint for display
  const getProjectNameFromEndpoint = (ep: string): string => {
    try {
      const match = ep.match(/\/content\/([^/]+)\//);
      return match ? match[1].substring(0, 8) + '...' : 'Project';
    } catch {
      return 'Project';
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 grid-pattern">
      <div className="w-full max-w-lg animate-fade-in">
        {/* Logo / Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500 to-cyan-500 mb-6 animate-pulse-glow">
            <svg 
              className="w-8 h-8 text-white" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" 
              />
            </svg>
          </div>
          <h1 className="text-3xl font-bold mb-2">
            <span className="gradient-text">Content Strategy</span> Audit
          </h1>
          <p className="text-muted">
            Analyze your Hygraph project like a senior content strategist
          </p>
        </div>

        {/* Form Card */}
        <div className="card-gradient p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            
            {/* Saved Connections Dropdown */}
            {savedConnections.length > 0 && (
              <div className="space-y-2">
                <label className="block text-sm font-medium">
                  Saved Projects
                </label>
                <div className="relative">
                  <select
                    value={selectedConnectionId}
                    onChange={(e) => handleSelectConnection(e.target.value)}
                    className="w-full appearance-none cursor-pointer pr-10"
                    disabled={isSubmitting}
                  >
                    <option value="">+ New Connection</option>
                    {savedConnections.map(conn => (
                      <option key={conn.id} value={conn.id}>
                        {conn.name}
                      </option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
                    <svg className="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
                
                {/* Show saved connection details */}
                {selectedConnectionId && (
                  <div className="flex items-center justify-between p-3 rounded-lg bg-card/50 border border-border/50 mt-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {savedConnections.find(c => c.id === selectedConnectionId)?.name}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {getProjectNameFromEndpoint(endpoint)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => handleDeleteConnection(selectedConnectionId, e)}
                      className="ml-2 p-1.5 rounded hover:bg-red-500/10 text-muted-foreground hover:text-red-400 transition-colors"
                      title="Delete saved connection"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* New Connection Fields - Show when no saved connection selected */}
            {(!selectedConnectionId || savedConnections.length === 0) && (
              <>
                {/* Connection Name for saving */}
                <div className="space-y-2">
                  <label htmlFor="connectionName" className="block text-sm font-medium">
                    Project Name
                    <span className="text-muted-foreground font-normal ml-1">(for saving)</span>
                  </label>
                  <input
                    type="text"
                    id="connectionName"
                    value={connectionName}
                    onChange={(e) => setConnectionName(e.target.value)}
                    placeholder="e.g., Production Site, Staging, Client X"
                    disabled={isSubmitting}
                    className="disabled:opacity-50"
                  />
                </div>

                {/* Endpoint Input */}
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
                    disabled={isSubmitting}
                    className="disabled:opacity-50"
                  />
                  <p className="text-xs text-muted-foreground">
                    Find this in Project Settings → API Access → Content API
                  </p>
                </div>

                {/* Token Input */}
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
                    disabled={isSubmitting}
                    className="disabled:opacity-50"
                  />
                  <p className="text-xs text-muted-foreground">
                    Create a PAT with read access in Project Settings → API Access
                  </p>
                </div>

                {/* Save checkbox */}
                {hasEndpointAndToken && connectionName.trim() && (
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={saveThisConnection}
                      onChange={(e) => setSaveThisConnection(e.target.checked)}
                      className="w-4 h-4 rounded border-border bg-card text-purple-500 focus:ring-purple-500"
                    />
                    <span className="text-sm text-muted-foreground">
                      Save this connection for future audits
                    </span>
                  </label>
                )}
              </>
            )}

            {/* Error Message */}
            {error && (
              <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm animate-fade-in">
                <div className="flex items-start gap-3">
                  <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>{error}</span>
                </div>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting || !hasEndpointAndToken}
              className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span>{validating ? 'Validating...' : 'Running Audit...'}</span>
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                  </svg>
                  <span>Run Strategic Audit</span>
                </>
              )}
            </button>
          </form>

          {/* Security Note */}
          <div className="mt-6 pt-6 border-t border-border">
            <div className="flex items-start gap-3 text-xs text-muted-foreground">
              <svg className="w-4 h-4 flex-shrink-0 mt-0.5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              <span>
                {savedConnections.length > 0 
                  ? 'Saved connections are stored locally in your browser. Credentials never leave your device.'
                  : 'Your credentials are used only for this session. All analysis happens in your browser.'}
              </span>
            </div>
          </div>
        </div>

        {/* Features Preview */}
        <div className="mt-8 grid grid-cols-2 gap-4 text-center animate-fade-in-delay-2">
          {[
            { icon: '📊', label: 'Executive Summary' },
            { icon: '🎯', label: 'Use Case Analysis' },
            { icon: '✏️', label: 'Editorial Experience' },
            { icon: '🚀', label: 'Action Plan' },
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
      </div>
    </div>
  );
}

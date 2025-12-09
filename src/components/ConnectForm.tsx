'use client';

import { useState } from 'react';
import { validateConnection } from '@/lib/hygraph/client';

interface ConnectFormProps {
  onConnect: (endpoint: string, token: string) => void;
  isLoading?: boolean;
}

export default function ConnectForm({ onConnect, isLoading }: ConnectFormProps) {
  const [endpoint, setEndpoint] = useState('');
  const [token, setToken] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [validating, setValidating] = useState(false);

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
    
    onConnect(endpoint.trim(), token.trim());
  };

  const isSubmitting = validating || isLoading;
  const hasEndpointAndToken = endpoint.trim() && token.trim();

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <div className="w-full max-w-md animate-fade-in">
        {/* Logo / Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 mb-5 shadow-lg shadow-indigo-500/20">
            <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <h1 className="text-2xl font-semibold text-white mb-1">
            Hygraph Schema Audit
          </h1>
          <p className="text-slate-400 text-sm">
            Professional content model analysis
          </p>
        </div>

        {/* Form Card */}
        <div className="bg-slate-900/80 backdrop-blur-sm border border-slate-800 rounded-2xl p-6 shadow-xl">
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Endpoint Input */}
            <div className="space-y-2">
              <label htmlFor="endpoint" className="block text-sm font-medium text-slate-300">
                Content API Endpoint
              </label>
              <input
                type="url"
                id="endpoint"
                value={endpoint}
                onChange={(e) => setEndpoint(e.target.value)}
                placeholder="https://api-xx.hygraph.com/v2/..."
                disabled={isSubmitting}
                className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all disabled:opacity-50"
              />
              <p className="text-xs text-slate-500">
                Project Settings → API Access → Content API
              </p>
            </div>

            {/* Token Input */}
            <div className="space-y-2">
              <label htmlFor="token" className="block text-sm font-medium text-slate-300">
                Permanent Auth Token
              </label>
              <input
                type="password"
                id="token"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="eyJhbGciOiJSUzI1NiIs..."
                disabled={isSubmitting}
                className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all disabled:opacity-50"
              />
              <p className="text-xs text-slate-500">
                Create a PAT with read access
              </p>
            </div>

            {/* Error Message */}
            {error && (
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                {error}
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting || !hasEndpointAndToken}
              className="w-full py-3 px-4 bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-medium rounded-lg hover:from-indigo-600 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-slate-900 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span>{validating ? 'Connecting...' : 'Analyzing...'}</span>
                </>
              ) : (
                <span>Run Audit</span>
              )}
            </button>
          </form>

          {/* Security Note */}
          <p className="mt-5 text-center text-xs text-slate-500">
            🔒 Analysis runs locally. Credentials never stored.
          </p>
        </div>

        {/* Features */}
        <div className="mt-6 grid grid-cols-3 gap-3 text-center">
          {[
            { label: 'Structure' },
            { label: 'Performance' },
            { label: 'Roadmap' },
          ].map((feature) => (
            <div key={feature.label} className="py-2 px-3 rounded-lg bg-slate-800/30 border border-slate-800">
              <span className="text-xs text-slate-400">{feature.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

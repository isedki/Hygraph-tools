'use client';

import { useEffect, useState } from 'react';
import { HygraphProvider, useHygraph } from '@/contexts/HygraphContext';
import { fetchSchema, createClient } from '@/lib/schema';
import type { HygraphSchema, HygraphModel } from '@/lib/types';

function SchemaExplorerContent() {
  const { context, isLoading, error } = useHygraph();
  const [schema, setSchema] = useState<HygraphSchema | null>(null);
  const [schemaError, setSchemaError] = useState<string | null>(null);
  const [isLoadingSchema, setIsLoadingSchema] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'component' | 'enum' | 'model'>('all');
  const [selectedItem, setSelectedItem] = useState<{ name: string; type: string } | null>(null);

  // Manual connection for development
  const [manualEndpoint, setManualEndpoint] = useState('');
  const [manualToken, setManualToken] = useState('');
  const [showManualConnect, setShowManualConnect] = useState(false);

  const loadSchema = async (endpoint: string, token: string) => {
    setIsLoadingSchema(true);
    setSchemaError(null);
    try {
      const client = createClient(endpoint, token);
      const fetchedSchema = await fetchSchema(client);
      setSchema(fetchedSchema);
    } catch (err) {
      setSchemaError(err instanceof Error ? err.message : 'Failed to fetch schema');
    } finally {
      setIsLoadingSchema(false);
    }
  };

  // Auto-load schema when context is ready
  useEffect(() => {
    if (context?.endpoint && context?.authToken) {
      loadSchema(context.endpoint, context.authToken);
    }
  }, [context?.endpoint, context?.authToken]);

  // Handle manual connection
  const handleManualConnect = () => {
    if (manualEndpoint && manualToken) {
      loadSchema(manualEndpoint, manualToken);
    }
  };

  // Filter items
  const getFilteredItems = () => {
    if (!schema) return [];
    
    const items: Array<{ name: string; type: string; fieldCount: number; description?: string }> = [];
    
    if (filterType === 'all' || filterType === 'component') {
      schema.components.forEach(c => items.push({ 
        name: c.name, 
        type: 'component', 
        fieldCount: c.fields.length 
      }));
    }
    
    if (filterType === 'all' || filterType === 'enum') {
      schema.enums.forEach(e => items.push({ 
        name: e.name, 
        type: 'enum', 
        fieldCount: e.values.length,
        description: `Values: ${e.values.slice(0, 3).join(', ')}${e.values.length > 3 ? '...' : ''}`
      }));
    }
    
    if (filterType === 'all' || filterType === 'model') {
      schema.models.forEach(m => items.push({ 
        name: m.name, 
        type: 'model', 
        fieldCount: m.fields.length 
      }));
    }
    
    if (searchQuery) {
      return items.filter(i => 
        i.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    
    return items.sort((a, b) => a.name.localeCompare(b.name));
  };

  // Get selected item details
  const getSelectedDetails = (): HygraphModel | null => {
    if (!schema || !selectedItem) return null;
    
    if (selectedItem.type === 'component') {
      return schema.components.find(c => c.name === selectedItem.name) || null;
    }
    if (selectedItem.type === 'model') {
      return schema.models.find(m => m.name === selectedItem.name) || null;
    }
    return null;
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Connecting to Hygraph...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="p-8">
        <div className="card max-w-lg mx-auto text-center">
          <p className="text-red-400 mb-4">{error}</p>
          <button 
            onClick={() => setShowManualConnect(true)}
            className="btn-primary"
          >
            Connect Manually
          </button>
        </div>
      </div>
    );
  }

  // No schema yet - show manual connection or loading
  if (!schema && !isLoadingSchema) {
    return (
      <div className="p-8">
        <div className="card max-w-lg mx-auto">
          <h2 className="text-xl font-bold mb-4">Connect to Hygraph</h2>
          <p className="text-gray-400 text-sm mb-6">
            Enter your Hygraph Content API endpoint and a Permanent Auth Token to analyze your schema.
          </p>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Content API Endpoint</label>
              <input
                type="text"
                value={manualEndpoint}
                onChange={(e) => setManualEndpoint(e.target.value)}
                placeholder="https://api-....hygraph.com/v2/.../master"
                className="w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Permanent Auth Token</label>
              <input
                type="text"
                value={manualToken}
                onChange={(e) => setManualToken(e.target.value)}
                placeholder="eyJ..."
                className="w-full"
              />
            </div>
            <button 
              onClick={handleManualConnect}
              disabled={!manualEndpoint || !manualToken}
              className="btn-primary w-full"
            >
              Connect
            </button>
          </div>
          {schemaError && (
            <p className="mt-4 text-red-400 text-sm">{schemaError}</p>
          )}
        </div>
      </div>
    );
  }

  // Loading schema
  if (isLoadingSchema) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Loading schema...</p>
        </div>
      </div>
    );
  }

  const filteredItems = getFilteredItems();
  const selectedDetails = getSelectedDetails();

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-[var(--border)] bg-[var(--background)]/80 backdrop-blur-xl">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <div>
                <h1 className="text-xl font-bold">Schema Explorer</h1>
                <p className="text-sm text-gray-400">Analyze components, enums & models</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3 text-sm">
              <span className="px-3 py-1.5 rounded-lg bg-purple-500/10 text-purple-400 border border-purple-500/30">
                {schema?.components.length} Components
              </span>
              <span className="px-3 py-1.5 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
                {schema?.enums.length} Enums
              </span>
              <span className="px-3 py-1.5 rounded-lg bg-green-500/10 text-green-400 border border-green-500/30">
                {schema?.models.length} Models
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="p-6">
        <div className="grid grid-cols-12 gap-6">
          {/* Left Panel - List */}
          <div className="col-span-4">
            <div className="card sticky top-24">
              {/* Search */}
              <div className="relative mb-4">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search..."
                  className="pl-10"
                />
              </div>
              
              {/* Filter */}
              <div className="flex flex-wrap gap-2 mb-4">
                {(['all', 'component', 'model', 'enum'] as const).map((type) => (
                  <button
                    key={type}
                    onClick={() => setFilterType(type)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      filterType === type
                        ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                        : 'bg-[var(--card)] border border-[var(--border)] text-gray-400 hover:text-white'
                    }`}
                  >
                    {type === 'all' ? 'All' : type.charAt(0).toUpperCase() + type.slice(1) + 's'}
                  </button>
                ))}
              </div>
              
              {/* List */}
              <div className="space-y-1 max-h-[500px] overflow-y-auto">
                {filteredItems.map((item) => (
                  <button
                    key={`${item.type}-${item.name}`}
                    onClick={() => setSelectedItem({ name: item.name, type: item.type })}
                    className={`w-full text-left p-3 rounded-lg transition-all ${
                      selectedItem?.name === item.name && selectedItem?.type === item.type
                        ? 'bg-purple-500/10 border border-purple-500/30'
                        : 'hover:bg-[var(--card)] border border-transparent hover:border-[var(--border)]'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`p-1.5 rounded ${
                        item.type === 'component' ? 'bg-purple-500/10 text-purple-400' :
                        item.type === 'enum' ? 'bg-cyan-500/10 text-cyan-400' :
                        'bg-green-500/10 text-green-400'
                      }`}>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          {item.type === 'component' && (
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                          )}
                          {item.type === 'enum' && (
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                          )}
                          {item.type === 'model' && (
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
                          )}
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{item.name}</p>
                        <p className="text-xs text-gray-400 truncate">
                          {item.description || `${item.fieldCount} ${item.type === 'enum' ? 'values' : 'fields'}`}
                        </p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Right Panel - Details */}
          <div className="col-span-8">
            {selectedItem && selectedDetails ? (
              <div className="card">
                <div className="flex items-center gap-4 mb-6 pb-4 border-b border-[var(--border)]">
                  <div className={`p-3 rounded-xl ${
                    selectedItem.type === 'component' ? 'bg-purple-500/10 text-purple-400' :
                    selectedItem.type === 'enum' ? 'bg-cyan-500/10 text-cyan-400' :
                    'bg-green-500/10 text-green-400'
                  }`}>
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      {selectedItem.type === 'component' && (
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                      )}
                      {selectedItem.type === 'enum' && (
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                      )}
                      {selectedItem.type === 'model' && (
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
                      )}
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold">{selectedDetails.name}</h2>
                    <p className="text-gray-400 capitalize">{selectedItem.type}</p>
                  </div>
                </div>
                
                {/* Fields */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-400 mb-3">FIELDS ({selectedDetails.fields.length})</h3>
                  <div className="space-y-2">
                    {selectedDetails.fields.map((field) => (
                      <div 
                        key={field.name}
                        className="p-3 rounded-lg bg-[var(--background)] border border-[var(--border)]"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="font-medium">{field.name}</span>
                            {field.isRequired && (
                              <span className="ml-2 text-xs text-red-400">required</span>
                            )}
                            {field.isList && (
                              <span className="ml-2 text-xs text-blue-400">[list]</span>
                            )}
                          </div>
                          <span className={`text-sm ${
                            field.relatedModel ? 'text-purple-400' : 'text-gray-400'
                          }`}>
                            {field.type}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : selectedItem && selectedItem.type === 'enum' ? (
              <div className="card">
                <div className="flex items-center gap-4 mb-6 pb-4 border-b border-[var(--border)]">
                  <div className="p-3 rounded-xl bg-cyan-500/10 text-cyan-400">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold">{selectedItem.name}</h2>
                    <p className="text-gray-400">Enumeration</p>
                  </div>
                </div>
                
                {/* Enum Values */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-400 mb-3">
                    VALUES ({schema?.enums.find(e => e.name === selectedItem.name)?.values.length})
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {schema?.enums.find(e => e.name === selectedItem.name)?.values.map((value) => (
                      <span 
                        key={value}
                        className="px-3 py-1.5 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 text-sm font-mono"
                      >
                        {value}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="card text-center py-16">
                <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-purple-500/20 to-indigo-500/20 flex items-center justify-center">
                  <svg className="w-10 h-10 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                </div>
                <h2 className="text-xl font-semibold mb-2">Select a Schema Element</h2>
                <p className="text-gray-400 max-w-md mx-auto">
                  Choose a component, enum, or model from the list to view its details.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PageElement() {
  return (
    <HygraphProvider elementType="page">
      <SchemaExplorerContent />
    </HygraphProvider>
  );
}




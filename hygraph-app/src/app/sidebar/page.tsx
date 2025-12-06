'use client';

import { useEffect, useState } from 'react';
import { HygraphProvider, useSidebarContext } from '@/contexts/HygraphContext';
import { createClient } from '@/lib/schema';
import type { EntryReference, HygraphSchema, HygraphModel } from '@/lib/types';
import { GraphQLClient } from 'graphql-request';

// Simplified schema fetch for sidebar (just models for reference lookup)
async function fetchModelsForReferences(client: GraphQLClient): Promise<HygraphModel[]> {
  const query = `
    query {
      __schema {
        types {
          name
          kind
          fields(includeDeprecated: false) {
            name
            type {
              name
              kind
              ofType { name kind ofType { name kind } }
            }
          }
        }
        queryType {
          fields { name }
        }
      }
    }
  `;
  
  const result = await client.request<{
    __schema: {
      types: Array<{
        name: string;
        kind: string;
        fields?: Array<{
          name: string;
          type: { name?: string; kind?: string; ofType?: { name?: string; kind?: string; ofType?: { name?: string } } };
        }>;
      }>;
      queryType: { fields: Array<{ name: string }> };
    };
  }>(query);
  
  const queryFieldNames = new Set(result.__schema.queryType.fields.map(f => f.name.toLowerCase()));
  const models: HygraphModel[] = [];
  
  for (const type of result.__schema.types) {
    if (type.kind !== 'OBJECT' || type.name.startsWith('_') || !type.fields) continue;
    
    const pluralApiId = type.name.charAt(0).toLowerCase() + type.name.slice(1) + 's';
    if (!queryFieldNames.has(type.name.toLowerCase()) && !queryFieldNames.has(pluralApiId)) continue;
    
    const fields = type.fields.map(f => {
      const unwrap = (t: typeof f.type): string => t.name || (t.ofType ? unwrap(t.ofType as typeof t) : 'Unknown');
      return {
        name: f.name,
        type: unwrap(f.type),
        isRequired: f.type.kind === 'NON_NULL',
        isList: f.type.kind === 'LIST',
        relatedModel: undefined,
      };
    });
    
    models.push({
      name: type.name,
      apiId: type.name,
      pluralApiId,
      fields,
    });
  }
  
  return models;
}

// Find all entries that reference a given entry
async function findEntryReferences(
  client: GraphQLClient,
  targetEntryId: string,
  targetModelName: string,
  models: HygraphModel[]
): Promise<EntryReference[]> {
  const references: EntryReference[] = [];
  
  for (const model of models) {
    // Find fields that might reference the target model
    const relationFields = model.fields.filter(f => 
      f.type === targetModelName || f.type === 'Asset'
    );
    
    if (relationFields.length === 0) continue;
    
    for (const field of relationFields) {
      try {
        const whereClause = field.isList 
          ? `{ ${field.name}_some: { id: "${targetEntryId}" } }`
          : `{ ${field.name}: { id: "${targetEntryId}" } }`;
        
        // Find a title field
        const titleField = model.fields.find(f => 
          ['title', 'name', 'heading', 'label', 'slug'].includes(f.name.toLowerCase()) &&
          f.type === 'String'
        )?.name || '';
        
        const query = `
          query {
            entries: ${model.pluralApiId}(where: ${whereClause}, stage: DRAFT, first: 20) {
              id
              ${titleField}
            }
          }
        `;
        
        const response = await client.request<{ entries: Array<{ id: string; [key: string]: unknown }> }>(query);
        
        if (response.entries?.length > 0) {
          for (const entry of response.entries) {
            references.push({
              entryId: entry.id,
              entryTitle: (titleField && entry[titleField] ? String(entry[titleField]) : entry.id),
              modelName: model.name,
              modelPluralApiId: model.pluralApiId,
              fieldName: field.name,
            });
          }
        }
      } catch {
        // Skip failed queries
      }
    }
  }
  
  return references;
}

function EntryReferencesContent() {
  const { context, entry, isLoading, error } = useSidebarContext();
  const [references, setReferences] = useState<EntryReference[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  // Manual connection for development
  const [manualEndpoint, setManualEndpoint] = useState('');
  const [manualToken, setManualToken] = useState('');
  const [manualEntryId, setManualEntryId] = useState('');
  const [manualModelName, setManualModelName] = useState('');

  const searchReferences = async (endpoint: string, token: string, entryId: string, modelName: string) => {
    setIsSearching(true);
    setSearchError(null);
    setReferences([]);
    
    try {
      const client = createClient(endpoint, token);
      const models = await fetchModelsForReferences(client);
      const refs = await findEntryReferences(client, entryId, modelName, models);
      setReferences(refs);
      setHasSearched(true);
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : 'Failed to search references');
    } finally {
      setIsSearching(false);
    }
  };

  // Auto-search when entry changes (in Hygraph context)
  useEffect(() => {
    if (context?.endpoint && context?.authToken && entry?.id && entry?.modelApiId) {
      searchReferences(context.endpoint, context.authToken, entry.id, entry.modelApiId);
    }
  }, [context?.endpoint, context?.authToken, entry?.id, entry?.modelApiId]);

  // Loading state
  if (isLoading) {
    return (
      <div className="p-4 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Development mode - manual input
  if (!entry || !context?.endpoint) {
    return (
      <div className="p-4">
        <h2 className="font-bold mb-3 flex items-center gap-2">
          <svg className="w-5 h-5 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101" />
          </svg>
          Entry References
        </h2>
        <p className="text-gray-400 text-xs mb-4">
          Find where this entry is used
        </p>
        
        <div className="space-y-3">
          <input
            type="text"
            value={manualEndpoint}
            onChange={(e) => setManualEndpoint(e.target.value)}
            placeholder="API Endpoint"
            className="text-sm"
          />
          <input
            type="text"
            value={manualToken}
            onChange={(e) => setManualToken(e.target.value)}
            placeholder="Auth Token"
            className="text-sm"
          />
          <input
            type="text"
            value={manualEntryId}
            onChange={(e) => setManualEntryId(e.target.value)}
            placeholder="Entry ID"
            className="text-sm"
          />
          <input
            type="text"
            value={manualModelName}
            onChange={(e) => setManualModelName(e.target.value)}
            placeholder="Model Name (e.g., Page)"
            className="text-sm"
          />
          <button
            onClick={() => searchReferences(manualEndpoint, manualToken, manualEntryId, manualModelName)}
            disabled={!manualEndpoint || !manualToken || !manualEntryId || isSearching}
            className="btn-primary w-full text-sm"
          >
            {isSearching ? 'Searching...' : 'Find References'}
          </button>
        </div>
        
        {searchError && (
          <p className="mt-3 text-red-400 text-xs">{searchError}</p>
        )}
        
        {hasSearched && renderResults()}
      </div>
    );
  }

  function renderResults() {
    if (isSearching) {
      return (
        <div className="mt-4 flex items-center justify-center py-6">
          <div className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
        </div>
      );
    }

    if (references.length > 0) {
      return (
        <div className="mt-4">
          <div className="p-3 rounded-lg bg-orange-500/10 border border-orange-500/30 mb-3">
            <p className="text-sm text-orange-400 font-medium">
              {references.length} reference{references.length !== 1 ? 's' : ''} found
            </p>
            <p className="text-xs text-gray-400 mt-1">
              Deleting may affect these entries
            </p>
          </div>
          
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {references.map((ref, i) => (
              <div 
                key={`${ref.entryId}-${i}`}
                className="p-2 rounded-lg bg-[var(--card)] border border-[var(--border)]"
              >
                <p className="font-medium text-sm truncate">{ref.entryTitle}</p>
                <p className="text-xs text-gray-400">
                  <span className="text-orange-400">{ref.modelName}</span>
                  <span className="mx-1">via</span>
                  <span className="text-cyan-400">{ref.fieldName}</span>
                </p>
              </div>
            ))}
          </div>
        </div>
      );
    }

    if (hasSearched) {
      return (
        <div className="mt-4 text-center py-6">
          <div className="w-10 h-10 mx-auto mb-2 rounded-full bg-green-500/10 flex items-center justify-center">
            <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <p className="text-green-400 text-sm font-medium">No references</p>
          <p className="text-gray-400 text-xs mt-1">Safe to delete</p>
        </div>
      );
    }

    return null;
  }

  // Normal sidebar view
  return (
    <div className="p-4">
      <h2 className="font-bold mb-1 flex items-center gap-2">
        <svg className="w-5 h-5 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101" />
        </svg>
        Entry References
      </h2>
      <p className="text-gray-400 text-xs mb-4">
        Where is this entry used?
      </p>
      
      {renderResults()}
    </div>
  );
}

export default function SidebarElement() {
  return (
    <HygraphProvider elementType="sidebar">
      <EntryReferencesContent />
    </HygraphProvider>
  );
}


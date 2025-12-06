'use client';

import { useState } from 'react';
import { GraphQLClient } from 'graphql-request';
import type { HygraphSchema, HygraphModel } from '@/lib/types';

// Simplified entry info - just what we need
interface EntryInfo {
  entryId: string;
  modelName: string;
  modelPluralApiId: string;
  title: string;
  // Asset-specific fields
  isAsset?: boolean;
  assetUrl?: string;
  assetFileName?: string;
  assetMimeType?: string;
  assetSize?: number;
  assetWidth?: number;
  assetHeight?: number;
}

interface EntryReference {
  entryId: string;
  entryTitle: string;
  modelName: string;
  modelPluralApiId: string;
  fieldName: string;
}

interface ReverseLookupProps {
  client: GraphQLClient;
  schema: HygraphSchema;
  projectId: string;
}

// Build Hygraph app URL for an entry
function buildHygraphUrl(projectId: string, modelApiId: string, entryId: string): string {
  return `https://app.hygraph.com/${projectId}/master/content/${modelApiId}/${entryId}`;
}

// Get the singular query name for a model
function getSingularQueryName(model: HygraphModel): string {
  const name = model.name;
  return name.charAt(0).toLowerCase() + name.slice(1);
}

// Get title fields for a model
function getTitleFields(model: HygraphModel): string {
  const titleCandidates = ['title', 'name', 'heading', 'label', 'slug', 'displayName', 'internalName'];
  const found = model.fields
    .filter(f => titleCandidates.includes(f.name.toLowerCase()) && f.type === 'String')
    .map(f => f.name);
  return found.length > 0 ? found.join(' ') : '';
}

export default function ReverseLookup({ client, schema, projectId }: ReverseLookupProps) {
  const [entryId, setEntryId] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [result, setResult] = useState<EntryInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // References state
  const [references, setReferences] = useState<EntryReference[]>([]);
  const [isSearchingReferences, setIsSearchingReferences] = useState(false);
  const [referencesSearched, setReferencesSearched] = useState(false);

  const handleSearch = async () => {
    if (!entryId.trim()) return;
    
    setIsSearching(true);
    setError(null);
    setResult(null);
    setReferences([]);
    setReferencesSearched(false);

    try {
      let foundModel: HygraphModel | null = null;
      let entryData: Record<string, unknown> | null = null;

      // Check if it's an Asset first
      try {
        const assetQuery = `
          query FindAsset {
            asset(where: { id: "${entryId.trim()}" }, stage: DRAFT) {
              id
              __typename
              fileName
              url
              mimeType
              size
              width
              height
            }
          }
        `;
        
        const assetResponse = await client.request<{ asset: Record<string, unknown> | null }>(assetQuery);
        
        if (assetResponse.asset && assetResponse.asset.id) {
          foundModel = {
            name: 'Asset',
            apiId: 'Asset',
            pluralApiId: 'assets',
            fields: [],
            isComponent: false,
            isSystem: true,
          };
          entryData = assetResponse.asset;
        }
      } catch {
        // Not an asset, continue
      }

      // If not an asset, search through all models
      if (!foundModel) {
        for (const model of schema.models) {
          const singularName = getSingularQueryName(model);
          const titleFields = getTitleFields(model);
          
          try {
            const query = `
              query FindEntry {
                entry: ${singularName}(where: { id: "${entryId.trim()}" }, stage: DRAFT) {
                  id
                  __typename
                  ${titleFields}
                }
              }
            `;
            
            const response = await client.request<{ entry: Record<string, unknown> | Record<string, unknown>[] | null }>(query);
            
            if (response.entry) {
              const entry = Array.isArray(response.entry) 
                ? (response.entry.length > 0 ? response.entry[0] : null)
                : response.entry;
              
              if (entry && entry.id) {
                foundModel = model;
                entryData = entry;
                break;
              }
            }
          } catch {
            // Try plural query as fallback
            try {
              const titleFields = getTitleFields(model);
              const pluralQuery = `
                query FindEntry {
                  entries: ${model.pluralApiId}(where: { id: "${entryId.trim()}" }, stage: DRAFT, first: 1) {
                    id
                    __typename
                    ${titleFields}
                  }
                }
              `;
              
              const response = await client.request<{ entries: Record<string, unknown>[] }>(pluralQuery);
              
              if (response.entries && response.entries.length > 0) {
                foundModel = model;
                entryData = response.entries[0];
                break;
              }
            } catch {
              // Continue to next model
            }
          }
        }
      }

      if (!foundModel || !entryData) {
        setError('Entry not found. Make sure the ID is correct and you have access to it.');
        return;
      }

      // Find title
      const isAsset = foundModel.name === 'Asset';
      let title: string;
      
      if (isAsset) {
        title = (entryData.fileName as string) || entryId;
      } else {
        const titleField = ['title', 'name', 'heading', 'label', 'slug'].find(
          f => entryData![f] && typeof entryData![f] === 'string'
        );
        title = titleField ? (entryData[titleField] as string) : entryId.trim();
      }

      const newResult: EntryInfo = {
        entryId: entryId.trim(),
        modelName: foundModel.name,
        modelPluralApiId: foundModel.pluralApiId,
        title,
        isAsset,
        assetUrl: isAsset ? (entryData.url as string) : undefined,
        assetFileName: isAsset ? (entryData.fileName as string) : undefined,
        assetMimeType: isAsset ? (entryData.mimeType as string) : undefined,
        assetSize: isAsset ? (entryData.size as number) : undefined,
        assetWidth: isAsset ? (entryData.width as number) : undefined,
        assetHeight: isAsset ? (entryData.height as number) : undefined,
      };

      setResult(newResult);
      
      // Auto-trigger reference search
      searchReferences(newResult);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
    } finally {
      setIsSearching(false);
    }
  };

  // Search for all entries that reference this entry
  const searchReferences = async (entryInfo: EntryInfo) => {
    setIsSearchingReferences(true);
    setReferences([]);
    const foundReferences: EntryReference[] = [];
    
    try {
      const targetModelName = entryInfo.modelName;
      const targetEntryId = entryInfo.entryId;
      
      for (const model of schema.models) {
        // Find fields that relate to the target model
        const relationFields = model.fields.filter(f => {
          if (targetModelName === 'Asset') {
            return f.type === 'Asset' || f.relatedModel === 'Asset';
          }
          return f.relatedModel === targetModelName;
        });
        
        if (relationFields.length === 0) continue;
        
        for (const field of relationFields) {
          try {
            const whereClause = field.isList 
              ? `{ ${field.name}_some: { id: "${targetEntryId}" } }`
              : `{ ${field.name}: { id: "${targetEntryId}" } }`;
            
            const titleField = model.fields.find(f => 
              ['title', 'name', 'heading', 'label', 'slug', 'displayName'].includes(f.name.toLowerCase()) && 
              f.type === 'String'
            )?.name || '';
            
            const query = `
              query FindReferences {
                entries: ${model.pluralApiId}(where: ${whereClause}, stage: DRAFT, first: 50) {
                  id
                  __typename
                  ${titleField}
                }
              }
            `;
            
            const response = await client.request<{ entries: Record<string, unknown>[] }>(query);
            
            if (response.entries && response.entries.length > 0) {
              for (const entry of response.entries) {
                foundReferences.push({
                  entryId: entry.id as string,
                  entryTitle: (titleField && entry[titleField] ? entry[titleField] as string : entry.id as string),
                  modelName: model.name,
                  modelPluralApiId: model.pluralApiId,
                  fieldName: field.name,
                });
              }
            }
          } catch {
            // Skip if query fails
          }
        }
      }
      
      setReferences(foundReferences);
      setReferencesSearched(true);
    } catch (err) {
      console.error('Error finding references:', err);
    } finally {
      setIsSearchingReferences(false);
    }
  };

  const getHygraphUrl = () => {
    if (!result) return '#';
    return buildHygraphUrl(projectId, result.modelPluralApiId, result.entryId);
  };

  return (
    <div className="space-y-6">
      {/* Search Input */}
      <div className="card p-6">
        <h3 className="text-lg font-semibold mb-2">Where Is This Entry Used?</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Enter an entry or asset ID to find all content that references it
        </p>
        
        <div className="flex gap-3">
          <input
            type="text"
            value={entryId}
            onChange={(e) => setEntryId(e.target.value)}
            placeholder="Enter entry ID (e.g., clq1i5fka2d9q01uh42ut5z47)"
            className="flex-1"
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          />
          <button
            onClick={handleSearch}
            disabled={isSearching || !entryId.trim()}
            className="btn-primary flex items-center gap-2"
          >
            {isSearching ? (
              <>
                <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Searching...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                Lookup
              </>
            )}
          </button>
        </div>

        {error && (
          <div className="mt-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
            {error}
          </div>
        )}
      </div>

      {/* Results - Single consolidated card */}
      {result && (
        <div className="card p-6">
          {/* Entry Header */}
          <div className="flex items-start justify-between mb-6 pb-4 border-b border-border">
            <div className="flex items-start gap-4">
              {/* Asset Preview (for images) */}
              {result.isAsset && result.assetUrl && result.assetMimeType?.startsWith('image/') && (
                <div className="flex-shrink-0">
                  <img 
                    src={result.assetUrl} 
                    alt={result.assetFileName || 'Asset preview'}
                    className="w-20 h-20 object-cover rounded-lg border border-border"
                  />
                </div>
              )}
              {/* Non-image asset icon */}
              {result.isAsset && (!result.assetMimeType?.startsWith('image/')) && (
                <div className="flex-shrink-0 w-20 h-20 rounded-lg border border-border bg-card flex items-center justify-center">
                  <svg className="w-8 h-8 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                </div>
              )}
              <div>
                <h3 className="text-lg font-bold">{result.title}</h3>
                <p className="text-sm text-muted-foreground">
                  <span className={result.isAsset ? "text-yellow-400" : "text-green-400"}>
                    {result.isAsset ? 'Asset' : result.modelName}
                  </span>
                  <span className="mx-2">•</span>
                  <code className="text-xs bg-card px-1.5 py-0.5 rounded">{result.entryId}</code>
                </p>
                {/* Asset Details */}
                {result.isAsset && (
                  <div className="mt-2 flex flex-wrap gap-2 text-xs">
                    {result.assetMimeType && (
                      <span className="px-2 py-0.5 rounded bg-yellow-500/10 text-yellow-400">
                        {result.assetMimeType}
                      </span>
                    )}
                    {result.assetSize && (
                      <span className="px-2 py-0.5 rounded bg-card border border-border">
                        {(result.assetSize / 1024).toFixed(1)} KB
                      </span>
                    )}
                    {result.assetWidth && result.assetHeight && (
                      <span className="px-2 py-0.5 rounded bg-card border border-border">
                        {result.assetWidth} x {result.assetHeight}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              <a
                href={getHygraphUrl()}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-secondary flex items-center gap-2 text-sm"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
                Open in Hygraph
              </a>
              {result.isAsset && result.assetUrl && (
                <a
                  href={result.assetUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-secondary flex items-center gap-2 text-sm"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Download
                </a>
              )}
            </div>
          </div>

          {/* References Section */}
          {isSearchingReferences && (
            <div className="flex items-center justify-center py-8 gap-3">
              <svg className="animate-spin w-5 h-5 text-orange-400" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <span className="text-muted-foreground">Searching for references...</span>
            </div>
          )}

          {referencesSearched && !isSearchingReferences && (
            <>
              {references.length > 0 ? (
                <>
                  <div className="mb-4 p-3 rounded-lg bg-orange-500/10 border border-orange-500/30">
                    <p className="text-sm text-orange-400 font-medium">
                      Found {references.length} reference{references.length !== 1 ? 's' : ''} to this entry
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Deleting this entry may affect the entries listed below
                    </p>
                  </div>
                  
                  <div className="space-y-2 max-h-80 overflow-y-auto">
                    {references.map((ref, i) => (
                      <div 
                        key={`${ref.entryId}-${i}`}
                        className="p-3 rounded-lg bg-card border border-border hover:border-orange-500/30 transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium">{ref.entryTitle}</p>
                            <p className="text-sm text-muted-foreground">
                              <span className="text-orange-400">{ref.modelName}</span>
                              <span className="mx-2">via</span>
                              <span className="text-cyan-400">{ref.fieldName}</span>
                            </p>
                          </div>
                          <a
                            href={buildHygraphUrl(projectId, ref.modelPluralApiId, ref.entryId)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn-secondary text-xs flex items-center gap-1"
                          >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                            </svg>
                            Open
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  {/* Group by model summary */}
                  <div className="mt-4 pt-4 border-t border-border">
                    <p className="text-xs text-muted-foreground mb-2">References by Model:</p>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(
                        references.reduce((acc, ref) => {
                          acc[ref.modelName] = (acc[ref.modelName] || 0) + 1;
                          return acc;
                        }, {} as Record<string, number>)
                      ).map(([model, count]) => (
                        <span key={model} className="px-2 py-1 rounded bg-orange-500/10 text-orange-400 text-xs">
                          {model}: {count}
                        </span>
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-center py-8">
                  <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-green-500/10 flex items-center justify-center">
                    <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <p className="text-green-400 font-medium">No references found</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    This entry is not referenced by any other entries. Safe to delete!
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}


'use client';

import { useState } from 'react';
import type { AuditResult, HygraphModel, DuplicateCheckResult } from '@/lib/types';
import { createHygraphClient } from '@/lib/hygraph/client';
import { checkForDuplicates, identifyKeyFields } from '@/lib/hygraph/duplicateEntries';

interface DuplicatesTabProps {
  result: AuditResult;
  endpoint: string;
  token: string;
}

// Minimum entries for a model to be worth checking for duplicates
const MIN_ENTRIES_FOR_CHECK = 10;

export function DuplicatesTab({ result, endpoint, token }: DuplicatesTabProps) {
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [duplicateResult, setDuplicateResult] = useState<DuplicateCheckResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Get models from the audit result with entry counts
  const modelsWithCounts = result.comprehensiveAssessment.contentArchitecture.contentDistribution
    .filter(d => d.total >= MIN_ENTRIES_FOR_CHECK)
    .sort((a, b) => b.total - a.total);

  // Find the full model object for the selected model
  const getModelObject = (modelName: string): HygraphModel | undefined => {
    // We need to reconstruct a basic HygraphModel from what we have
    // The schema in the result has analysis data, not the raw model
    // We'll create a minimal model structure for the API call
    const dist = modelsWithCounts.find(d => d.model === modelName);
    if (!dist) return undefined;
    
    // Get field info from performance assessment or other sources
    // For now, we'll query with basic fields
    return {
      name: modelName,
      apiId: modelName,
      pluralApiId: modelName.toLowerCase() + 's', // This is a simplification
      fields: [], // Will be populated by the check
      isComponent: false,
      isSystem: false,
    };
  };

  const handleAnalyze = async () => {
    if (!selectedModel) return;
    
    setIsAnalyzing(true);
    setError(null);
    setDuplicateResult(null);
    
    try {
      const client = createHygraphClient(endpoint, token);
      
      // We need to fetch the actual model schema first
      // For now, let's use a simplified approach
      const model = getModelObject(selectedModel);
      if (!model) {
        throw new Error('Model not found');
      }
      
      // Fetch schema to get actual field info
      const schemaQuery = `
        query {
          __type(name: "${selectedModel}") {
            fields {
              name
              type {
                name
                kind
                ofType {
                  name
                  kind
                }
              }
            }
          }
        }
      `;
      
      const schemaResult = await client.request<{ __type: { fields: Array<{ name: string; type: { name: string | null; kind: string; ofType?: { name: string | null; kind: string } } }> } }>(schemaQuery);
      
      // Build model with actual fields
      const fields = (schemaResult.__type?.fields || []).map(f => ({
        name: f.name,
        type: f.type.ofType?.name || f.type.name || 'String',
        isRequired: f.type.kind === 'NON_NULL',
        isList: f.type.kind === 'LIST' || f.type.ofType?.kind === 'LIST',
      }));
      
      const fullModel: HygraphModel = {
        ...model,
        fields,
        pluralApiId: getPluralApiId(selectedModel),
      };
      
      const duplicateCheckResult = await checkForDuplicates(client, fullModel);
      setDuplicateResult(duplicateCheckResult);
    } catch (err) {
      console.error('Duplicate check failed:', err);
      setError(err instanceof Error ? err.message : 'Failed to check for duplicates');
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Simple pluralization helper
  function getPluralApiId(name: string): string {
    const lower = name.toLowerCase();
    if (lower.endsWith('y') && !['ay', 'ey', 'iy', 'oy', 'uy'].some(v => lower.endsWith(v))) {
      return lower.slice(0, -1) + 'ies';
    }
    if (lower.endsWith('s') || lower.endsWith('x') || lower.endsWith('ch') || lower.endsWith('sh')) {
      return lower + 'es';
    }
    return lower + 's';
  }

  return (
    <div className="max-w-6xl mx-auto px-6 py-8 space-y-8">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold mb-2">Duplicate Entry Detection</h2>
        <p className="text-muted-foreground">
          Find duplicate content entries within your models based on title, name, slug, and other key fields.
        </p>
      </div>

      {/* Model Selector */}
      <div className="card p-6">
        <h3 className="font-semibold mb-4">Select a Model to Analyze</h3>
        
        {modelsWithCounts.length === 0 ? (
          <p className="text-muted-foreground">
            No models with {MIN_ENTRIES_FOR_CHECK}+ entries found. Duplicate checking works best with larger datasets.
          </p>
        ) : (
          <div className="space-y-4">
            <div className="flex gap-4 items-end">
              <div className="flex-1">
                <label className="block text-sm font-medium mb-2">Model</label>
                <select
                  value={selectedModel}
                  onChange={(e) => {
                    setSelectedModel(e.target.value);
                    setDuplicateResult(null);
                    setError(null);
                  }}
                  className="w-full px-4 py-2 rounded-lg bg-slate-800/50 border border-slate-700 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="">Select a model...</option>
                  {modelsWithCounts.map(d => (
                    <option key={d.model} value={d.model}>
                      {d.model} ({d.total.toLocaleString()} entries)
                    </option>
                  ))}
                </select>
              </div>
              
              <button
                onClick={handleAnalyze}
                disabled={!selectedModel || isAnalyzing}
                className="btn-primary py-2 px-6 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isAnalyzing ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Analyzing...
                  </span>
                ) : (
                  'Analyze for Duplicates'
                )}
              </button>
            </div>
            
            {selectedModel && (
              <p className="text-sm text-muted-foreground">
                Will check for duplicates based on: title, name, headline, slug fields (if present)
              </p>
            )}
          </div>
        )}
      </div>

      {/* Error Display */}
      {error && (
        <div className="card p-4 border-red-500/50 bg-red-500/10">
          <p className="text-red-400">{error}</p>
        </div>
      )}

      {/* Results */}
      {duplicateResult && (
        <div className="space-y-6">
          {/* Summary */}
          <div className="card p-6">
            <h3 className="font-semibold mb-4">Analysis Results</h3>
            <div className="grid grid-cols-3 gap-4">
              <div className="p-4 rounded-lg bg-slate-800/50">
                <p className="text-2xl font-bold">{duplicateResult.totalEntries}</p>
                <p className="text-sm text-muted-foreground">Entries Analyzed</p>
              </div>
              <div className="p-4 rounded-lg bg-slate-800/50">
                <p className="text-2xl font-bold">{duplicateResult.duplicateGroups.length}</p>
                <p className="text-sm text-muted-foreground">Duplicate Groups</p>
              </div>
              <div className="p-4 rounded-lg bg-slate-800/50">
                <p className="text-2xl font-bold">
                  {duplicateResult.duplicateGroups.reduce((sum, g) => sum + g.entries.length, 0)}
                </p>
                <p className="text-sm text-muted-foreground">Total Duplicates</p>
              </div>
            </div>
            
            <div className="mt-4 text-sm text-muted-foreground">
              <strong>Fields analyzed:</strong> {duplicateResult.analyzedFields.join(', ') || 'None found'}
            </div>
          </div>

          {/* Duplicate Groups */}
          {duplicateResult.duplicateGroups.length === 0 ? (
            <div className="card p-6 text-center">
              <div className="text-4xl mb-2">✅</div>
              <h3 className="font-semibold text-lg">No Duplicates Found</h3>
              <p className="text-muted-foreground">
                All entries in {duplicateResult.model} appear to be unique based on the analyzed fields.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <h3 className="font-semibold">Duplicate Groups ({duplicateResult.duplicateGroups.length})</h3>
              
              {duplicateResult.duplicateGroups.map((group, idx) => (
                <div key={idx} className="card p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <span className="font-medium">
                        {group.entries.length} entries with same{' '}
                        <span className="text-purple-400">{group.matchedFields.join(', ')}</span>
                      </span>
                    </div>
                    <span className="px-2 py-1 rounded-full text-xs bg-yellow-500/20 text-yellow-400">
                      {group.entries.length} duplicates
                    </span>
                  </div>
                  
                  <div className="text-sm text-muted-foreground mb-3">
                    Match: &quot;{group.matchKey.split('|||')[0]}&quot;
                  </div>
                  
                  <div className="space-y-2">
                    {group.entries.map((entry, entryIdx) => (
                      <div 
                        key={entryIdx}
                        className="flex items-center justify-between p-2 rounded bg-slate-800/50 text-sm"
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-muted-foreground">#{entryIdx + 1}</span>
                          <span className="font-mono text-xs text-slate-500">{entry.id}</span>
                          {group.matchedFields.map(field => (
                            <span key={field} className="text-white">
                              {String(entry[field] || '')}
                            </span>
                          ))}
                        </div>
                        <a
                          href={`${endpoint.replace('/graphql', '').replace('api-', 'app-')}/content/${duplicateResult.model}/${entry.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-purple-400 hover:text-purple-300 text-xs"
                        >
                          Open in Hygraph →
                        </a>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Help Text */}
      {!duplicateResult && !isAnalyzing && (
        <div className="card p-6 bg-slate-800/30">
          <h3 className="font-semibold mb-2">How it works</h3>
          <ul className="text-sm text-muted-foreground space-y-2">
            <li>• Select a model with 10+ entries from the dropdown</li>
            <li>• Click &quot;Analyze&quot; to fetch entries and check for duplicates</li>
            <li>• Duplicates are detected by matching title, name, headline, or slug fields</li>
            <li>• Results show groups of entries that share the same values</li>
            <li>• Maximum 200 entries are analyzed per model for performance</li>
          </ul>
        </div>
      )}
    </div>
  );
}

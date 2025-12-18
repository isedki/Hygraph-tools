'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { HygraphProvider, useHygraph } from '@/contexts/HygraphContext';
import { fetchSchema, createClient } from '@/lib/schema';
import type { HygraphSchema, HygraphModel, HygraphField } from '@/lib/types';

// Filter types
interface Filter {
  id: string;
  field: string;
  operator: string;
  value: string;
}

// Selected fields with nested support
interface SelectedFields {
  [fieldName: string]: boolean | SelectedFields;
}

// Query options
interface QueryOptions {
  stage: 'DRAFT' | 'PUBLISHED';
  first: number;
  skip: number;
  orderBy: string;
  orderDirection: 'ASC' | 'DESC';
}

// Get operators based on field type
function getOperatorsForType(fieldType: string): { value: string; label: string }[] {
  switch (fieldType) {
    case 'String':
    case 'ID':
      return [
        { value: '', label: 'equals' },
        { value: '_not', label: 'not equals' },
        { value: '_contains', label: 'contains' },
        { value: '_not_contains', label: 'not contains' },
        { value: '_starts_with', label: 'starts with' },
        { value: '_ends_with', label: 'ends with' },
        { value: '_in', label: 'in list' },
      ];
    case 'Int':
    case 'Float':
      return [
        { value: '', label: 'equals' },
        { value: '_not', label: 'not equals' },
        { value: '_gt', label: 'greater than' },
        { value: '_gte', label: 'greater or equal' },
        { value: '_lt', label: 'less than' },
        { value: '_lte', label: 'less or equal' },
        { value: '_in', label: 'in list' },
      ];
    case 'Boolean':
      return [
        { value: '', label: 'equals' },
      ];
    case 'DateTime':
    case 'Date':
      return [
        { value: '', label: 'equals' },
        { value: '_gt', label: 'after' },
        { value: '_gte', label: 'on or after' },
        { value: '_lt', label: 'before' },
        { value: '_lte', label: 'on or before' },
      ];
    default:
      // Enum or relation
      return [
        { value: '', label: 'equals' },
        { value: '_in', label: 'in list' },
        { value: '_not', label: 'not equals' },
      ];
  }
}

// Generate GraphQL query string
function generateQuery(
  model: HygraphModel,
  selectedFields: SelectedFields,
  filters: Filter[],
  options: QueryOptions,
  schema: HygraphSchema
): string {
  const hasFilters = filters.length > 0;
  const hasVariables = hasFilters || options.first > 0;
  
  // Build variables declaration
  let variablesDecl = '';
  if (hasVariables) {
    const vars: string[] = [];
    if (hasFilters) vars.push(`$where: ${model.name}WhereInput`);
    if (options.first > 0) {
      vars.push('$first: Int');
      vars.push('$skip: Int');
    }
    variablesDecl = `(${vars.join(', ')})`;
  }
  
  // Build query arguments
  const args: string[] = [];
  if (hasFilters) args.push('where: $where');
  if (options.orderBy) args.push(`orderBy: ${options.orderBy}_${options.orderDirection}`);
  if (options.first > 0) {
    args.push('first: $first');
    args.push('skip: $skip');
  }
  args.push(`stage: ${options.stage}`);
  
  const argsStr = args.length > 0 ? `(${args.join(', ')})` : '';
  
  // Build field selection
  const buildFieldSelection = (fields: SelectedFields, modelFields: HygraphField[], indent: number): string => {
    const indentStr = '  '.repeat(indent);
    const lines: string[] = [];
    
    for (const [fieldName, value] of Object.entries(fields)) {
      if (!value) continue;
      
      const fieldDef = modelFields.find(f => f.name === fieldName);
      if (!fieldDef) continue;
      
      if (typeof value === 'object' && fieldDef.relatedModel) {
        // Find related model fields
        const relatedModel = schema.models.find(m => m.name === fieldDef.relatedModel) ||
                           schema.components.find(c => c.name === fieldDef.relatedModel);
        if (relatedModel) {
          const nestedFields = buildFieldSelection(value, relatedModel.fields, indent + 1);
          if (nestedFields) {
            lines.push(`${indentStr}${fieldName} {`);
            lines.push(nestedFields);
            lines.push(`${indentStr}}`);
          }
        }
      } else if (value === true) {
        lines.push(`${indentStr}${fieldName}`);
      }
    }
    
    return lines.join('\n');
  };
  
  const fieldSelection = buildFieldSelection(selectedFields, model.fields, 2);
  
  return `query Get${model.name}s${variablesDecl} {
  ${model.pluralApiId}${argsStr} {
${fieldSelection || '    id'}
  }
}`;
}

// Generate variables object
function generateVariables(filters: Filter[], options: QueryOptions, modelFields: HygraphField[]): Record<string, unknown> {
  const variables: Record<string, unknown> = {};
  
  if (filters.length > 0) {
    const where: Record<string, unknown> = {};
    for (const filter of filters) {
      const field = modelFields.find(f => f.name === filter.field);
      const key = filter.field + filter.operator;
      
      // Handle different value types
      if (filter.operator === '_in') {
        where[key] = filter.value.split(',').map(v => v.trim());
      } else if (field?.type === 'Int' || field?.type === 'Float') {
        where[key] = Number(filter.value);
      } else if (field?.type === 'Boolean') {
        where[key] = filter.value === 'true';
      } else {
        where[key] = filter.value;
      }
    }
    variables.where = where;
  }
  
  if (options.first > 0) {
    variables.first = options.first;
    variables.skip = options.skip;
  }
  
  return variables;
}

// Generate TypeScript types
function generateTypes(model: HygraphModel, selectedFields: SelectedFields, schema: HygraphSchema): string {
  const buildInterface = (name: string, fields: SelectedFields, modelFields: HygraphField[], indent: number): string => {
    const indentStr = '  '.repeat(indent);
    const lines: string[] = [];
    
    for (const [fieldName, value] of Object.entries(fields)) {
      if (!value) continue;
      
      const fieldDef = modelFields.find(f => f.name === fieldName);
      if (!fieldDef) continue;
      
      let tsType = 'unknown';
      switch (fieldDef.type) {
        case 'String':
        case 'ID':
          tsType = 'string';
          break;
        case 'Int':
        case 'Float':
          tsType = 'number';
          break;
        case 'Boolean':
          tsType = 'boolean';
          break;
        case 'DateTime':
        case 'Date':
          tsType = 'string';
          break;
        case 'Json':
          tsType = 'Record<string, unknown>';
          break;
        default:
          if (typeof value === 'object' && fieldDef.relatedModel) {
            tsType = fieldDef.relatedModel;
          } else {
            tsType = fieldDef.type;
          }
      }
      
      if (fieldDef.isList) tsType = `${tsType}[]`;
      if (!fieldDef.isRequired) tsType = `${tsType} | null`;
      
      lines.push(`${indentStr}${fieldName}: ${tsType};`);
    }
    
    return lines.join('\n');
  };
  
  // Build main interface
  const mainFields = buildInterface(model.name, selectedFields, model.fields, 1);
  
  // Build nested interfaces
  const nestedInterfaces: string[] = [];
  const buildNestedInterfaces = (fields: SelectedFields, modelFields: HygraphField[]) => {
    for (const [fieldName, value] of Object.entries(fields)) {
      if (typeof value !== 'object') continue;
      
      const fieldDef = modelFields.find(f => f.name === fieldName);
      if (!fieldDef?.relatedModel) continue;
      
      const relatedModel = schema.models.find(m => m.name === fieldDef.relatedModel) ||
                         schema.components.find(c => c.name === fieldDef.relatedModel);
      if (!relatedModel) continue;
      
      const nestedFields = buildInterface(fieldDef.relatedModel, value, relatedModel.fields, 1);
      nestedInterfaces.push(`interface ${fieldDef.relatedModel} {\n${nestedFields}\n}`);
      
      buildNestedInterfaces(value, relatedModel.fields);
    }
  };
  
  buildNestedInterfaces(selectedFields, model.fields);
  
  return `${nestedInterfaces.join('\n\n')}${nestedInterfaces.length > 0 ? '\n\n' : ''}interface ${model.name} {
${mainFields}
}

type Get${model.name}sResponse = {
  ${model.pluralApiId}: ${model.name}[];
}`;
}

function QueryBuilderContent() {
  const { context, isLoading, error } = useHygraph();
  const [schema, setSchema] = useState<HygraphSchema | null>(null);
  const [schemaError, setSchemaError] = useState<string | null>(null);
  const [isLoadingSchema, setIsLoadingSchema] = useState(false);
  
  // Manual connection for development
  const [manualEndpoint, setManualEndpoint] = useState('');
  const [manualToken, setManualToken] = useState('');
  const [activeEndpoint, setActiveEndpoint] = useState('');
  const [activeToken, setActiveToken] = useState('');
  
  // Query builder state
  const [selectedModel, setSelectedModel] = useState<HygraphModel | null>(null);
  const [selectedFields, setSelectedFields] = useState<SelectedFields>({});
  const [filters, setFilters] = useState<Filter[]>([]);
  const [options, setOptions] = useState<QueryOptions>({
    stage: 'PUBLISHED',
    first: 10,
    skip: 0,
    orderBy: '',
    orderDirection: 'DESC',
  });
  
  // Output state
  const [activeTab, setActiveTab] = useState<'query' | 'variables' | 'types' | 'preview'>('query');
  const [previewData, setPreviewData] = useState<unknown>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [copied, setCopied] = useState(false);

  const loadSchema = async (endpoint: string, token: string) => {
    setIsLoadingSchema(true);
    setSchemaError(null);
    try {
      const client = createClient(endpoint, token);
      const fetchedSchema = await fetchSchema(client);
      setSchema(fetchedSchema);
      setActiveEndpoint(endpoint);
      setActiveToken(token);
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

  // When model changes, reset fields and pre-select id
  useEffect(() => {
    if (selectedModel) {
      const defaultFields: SelectedFields = { id: true };
      // Pre-select common fields
      for (const field of selectedModel.fields) {
        if (['title', 'name', 'slug', 'createdAt', 'updatedAt'].includes(field.name)) {
          defaultFields[field.name] = true;
        }
      }
      setSelectedFields(defaultFields);
      setFilters([]);
      
      // Set default orderBy if createdAt exists
      if (selectedModel.fields.some(f => f.name === 'createdAt')) {
        setOptions(prev => ({ ...prev, orderBy: 'createdAt' }));
      }
    }
  }, [selectedModel]);

  // Toggle field selection
  const toggleField = useCallback((fieldPath: string[], value?: boolean) => {
    setSelectedFields(prev => {
      const newFields = { ...prev };
      let current: SelectedFields = newFields;
      
      for (let i = 0; i < fieldPath.length - 1; i++) {
        const key = fieldPath[i];
        if (typeof current[key] !== 'object') {
          current[key] = {};
        }
        current = current[key] as SelectedFields;
      }
      
      const lastKey = fieldPath[fieldPath.length - 1];
      current[lastKey] = value !== undefined ? value : !current[lastKey];
      
      return newFields;
    });
  }, []);

  // Add filter
  const addFilter = useCallback(() => {
    if (!selectedModel) return;
    const firstField = selectedModel.fields.find(f => !f.relatedModel);
    if (!firstField) return;
    
    setFilters(prev => [...prev, {
      id: crypto.randomUUID(),
      field: firstField.name,
      operator: '',
      value: '',
    }]);
  }, [selectedModel]);

  // Update filter
  const updateFilter = useCallback((id: string, updates: Partial<Filter>) => {
    setFilters(prev => prev.map(f => f.id === id ? { ...f, ...updates } : f));
  }, []);

  // Remove filter
  const removeFilter = useCallback((id: string) => {
    setFilters(prev => prev.filter(f => f.id !== id));
  }, []);

  // Generate query and variables
  const query = useMemo(() => {
    if (!selectedModel || !schema) return '';
    return generateQuery(selectedModel, selectedFields, filters, options, schema);
  }, [selectedModel, selectedFields, filters, options, schema]);

  const variables = useMemo(() => {
    if (!selectedModel) return {};
    return generateVariables(filters, options, selectedModel.fields);
  }, [selectedModel, filters, options]);

  const types = useMemo(() => {
    if (!selectedModel || !schema) return '';
    return generateTypes(selectedModel, selectedFields, schema);
  }, [selectedModel, selectedFields, schema]);

  // Run query
  const runQuery = async () => {
    if (!activeEndpoint || !activeToken || !query) return;
    
    setIsRunning(true);
    setPreviewError(null);
    try {
      const client = createClient(activeEndpoint, activeToken);
      const result = await client.request(query, variables);
      setPreviewData(result);
      setActiveTab('preview');
    } catch (err) {
      setPreviewError(err instanceof Error ? err.message : 'Query failed');
    } finally {
      setIsRunning(false);
    }
  };

  // Copy to clipboard
  const copyToClipboard = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Get content models only (not components)
  const contentModels = useMemo(() => {
    return schema?.models.filter(m => !m.isSystem && !m.isComponent) || [];
  }, [schema]);

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

  // No schema yet - show manual connection
  if (!schema && !isLoadingSchema) {
    return (
      <div className="p-8">
        <div className="card max-w-lg mx-auto">
          <h2 className="text-xl font-bold mb-4">Connect to Hygraph</h2>
          <p className="text-gray-400 text-sm mb-6">
            Enter your Hygraph Content API endpoint and a Permanent Auth Token.
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
                type="password"
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

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-[var(--border)] bg-[var(--background)]/80 backdrop-blur-xl">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                </svg>
              </div>
              <div>
                <h1 className="text-xl font-bold">Query Builder</h1>
                <p className="text-sm text-gray-400">Build GraphQL queries visually</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <select
                value={selectedModel?.name || ''}
                onChange={(e) => {
                  const model = contentModels.find(m => m.name === e.target.value);
                  setSelectedModel(model || null);
                }}
                className="px-4 py-2 rounded-lg bg-[var(--card)] border border-[var(--border)] text-white"
              >
                <option value="">Select a model...</option>
                {contentModels.map(model => (
                  <option key={model.name} value={model.name}>{model.name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      {selectedModel ? (
        <div className="flex-1 grid grid-cols-12 divide-x divide-[var(--border)]">
          {/* Left Panel - Fields */}
          <div className="col-span-3 p-4 overflow-y-auto max-h-[calc(100vh-80px)]">
            <h3 className="text-sm font-semibold text-gray-400 mb-3">SELECT FIELDS</h3>
            <FieldTree
              fields={selectedModel.fields}
              selected={selectedFields}
              onToggle={toggleField}
              schema={schema!}
              path={[]}
            />
          </div>

          {/* Middle Panel - Filters & Options */}
          <div className="col-span-4 p-4 overflow-y-auto max-h-[calc(100vh-80px)]">
            {/* Stage Toggle */}
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-gray-400 mb-3">STAGE</h3>
              <div className="flex gap-2">
                {(['PUBLISHED', 'DRAFT'] as const).map(stage => (
                  <button
                    key={stage}
                    onClick={() => setOptions(prev => ({ ...prev, stage }))}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      options.stage === stage
                        ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                        : 'bg-[var(--card)] border border-[var(--border)] text-gray-400 hover:text-white'
                    }`}
                  >
                    {stage}
                  </button>
                ))}
              </div>
            </div>

            {/* Filters */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-400">FILTERS</h3>
                <button
                  onClick={addFilter}
                  className="text-xs text-purple-400 hover:text-purple-300"
                >
                  + Add Filter
                </button>
              </div>
              
              {filters.length === 0 ? (
                <p className="text-sm text-gray-500">No filters applied</p>
              ) : (
                <div className="space-y-3">
                  {filters.map(filter => {
                    const field = selectedModel.fields.find(f => f.name === filter.field);
                    const operators = field ? getOperatorsForType(field.type) : [];
                    
                    return (
                      <div key={filter.id} className="p-3 rounded-lg bg-[var(--card)] border border-[var(--border)]">
                        <div className="flex items-center gap-2 mb-2">
                          <select
                            value={filter.field}
                            onChange={(e) => updateFilter(filter.id, { field: e.target.value, operator: '', value: '' })}
                            className="flex-1 text-sm bg-[var(--background)] border border-[var(--border)] rounded px-2 py-1"
                          >
                            {selectedModel.fields.filter(f => !f.relatedModel || f.type !== f.relatedModel).map(f => (
                              <option key={f.name} value={f.name}>{f.name}</option>
                            ))}
                          </select>
                          <button
                            onClick={() => removeFilter(filter.id)}
                            className="text-gray-400 hover:text-red-400"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                        <div className="flex gap-2">
                          <select
                            value={filter.operator}
                            onChange={(e) => updateFilter(filter.id, { operator: e.target.value })}
                            className="text-sm bg-[var(--background)] border border-[var(--border)] rounded px-2 py-1"
                          >
                            {operators.map(op => (
                              <option key={op.value} value={op.value}>{op.label}</option>
                            ))}
                          </select>
                          {field?.type === 'Boolean' ? (
                            <select
                              value={filter.value}
                              onChange={(e) => updateFilter(filter.id, { value: e.target.value })}
                              className="flex-1 text-sm bg-[var(--background)] border border-[var(--border)] rounded px-2 py-1"
                            >
                              <option value="">Select...</option>
                              <option value="true">true</option>
                              <option value="false">false</option>
                            </select>
                          ) : field?.type === 'DateTime' || field?.type === 'Date' ? (
                            <input
                              type="date"
                              value={filter.value}
                              onChange={(e) => updateFilter(filter.id, { value: e.target.value })}
                              className="flex-1 text-sm bg-[var(--background)] border border-[var(--border)] rounded px-2 py-1"
                            />
                          ) : (
                            <input
                              type={field?.type === 'Int' || field?.type === 'Float' ? 'number' : 'text'}
                              value={filter.value}
                              onChange={(e) => updateFilter(filter.id, { value: e.target.value })}
                              placeholder={filter.operator === '_in' ? 'value1, value2, ...' : 'value'}
                              className="flex-1 text-sm bg-[var(--background)] border border-[var(--border)] rounded px-2 py-1"
                            />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Order By */}
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-gray-400 mb-3">ORDER BY</h3>
              <div className="flex gap-2">
                <select
                  value={options.orderBy}
                  onChange={(e) => setOptions(prev => ({ ...prev, orderBy: e.target.value }))}
                  className="flex-1 text-sm bg-[var(--card)] border border-[var(--border)] rounded px-3 py-2"
                >
                  <option value="">None</option>
                  {selectedModel.fields.filter(f => ['String', 'Int', 'Float', 'DateTime', 'Date', 'Boolean'].includes(f.type)).map(f => (
                    <option key={f.name} value={f.name}>{f.name}</option>
                  ))}
                </select>
                <button
                  onClick={() => setOptions(prev => ({ ...prev, orderDirection: prev.orderDirection === 'ASC' ? 'DESC' : 'ASC' }))}
                  className={`px-3 py-2 rounded-lg border ${
                    options.orderDirection === 'DESC'
                      ? 'bg-purple-500/20 border-purple-500/30 text-purple-400'
                      : 'bg-[var(--card)] border-[var(--border)] text-gray-400'
                  }`}
                >
                  {options.orderDirection === 'DESC' ? '↓ DESC' : '↑ ASC'}
                </button>
              </div>
            </div>

            {/* Pagination */}
            <div>
              <h3 className="text-sm font-semibold text-gray-400 mb-3">PAGINATION</h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">First (limit)</label>
                  <input
                    type="number"
                    value={options.first}
                    onChange={(e) => setOptions(prev => ({ ...prev, first: parseInt(e.target.value) || 0 }))}
                    min={0}
                    className="w-full text-sm bg-[var(--card)] border border-[var(--border)] rounded px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Skip (offset)</label>
                  <input
                    type="number"
                    value={options.skip}
                    onChange={(e) => setOptions(prev => ({ ...prev, skip: parseInt(e.target.value) || 0 }))}
                    min={0}
                    className="w-full text-sm bg-[var(--card)] border border-[var(--border)] rounded px-3 py-2"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Right Panel - Output */}
          <div className="col-span-5 flex flex-col max-h-[calc(100vh-80px)]">
            {/* Tabs */}
            <div className="flex border-b border-[var(--border)]">
              {(['query', 'variables', 'types', 'preview'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === tab
                      ? 'border-purple-500 text-purple-400'
                      : 'border-transparent text-gray-400 hover:text-white'
                  }`}
                >
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </div>

            {/* Tab Content */}
            <div className="flex-1 overflow-y-auto p-4">
              {activeTab === 'query' && (
                <pre className="text-sm text-gray-300 font-mono whitespace-pre-wrap bg-[var(--card)] rounded-lg p-4 border border-[var(--border)]">
                  {query}
                </pre>
              )}
              
              {activeTab === 'variables' && (
                <pre className="text-sm text-gray-300 font-mono whitespace-pre-wrap bg-[var(--card)] rounded-lg p-4 border border-[var(--border)]">
                  {JSON.stringify(variables, null, 2)}
                </pre>
              )}
              
              {activeTab === 'types' && (
                <pre className="text-sm text-gray-300 font-mono whitespace-pre-wrap bg-[var(--card)] rounded-lg p-4 border border-[var(--border)]">
                  {types}
                </pre>
              )}
              
              {activeTab === 'preview' && (
                <div>
                  {previewError ? (
                    <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
                      {previewError}
                    </div>
                  ) : previewData ? (
                    <pre className="text-sm text-gray-300 font-mono whitespace-pre-wrap bg-[var(--card)] rounded-lg p-4 border border-[var(--border)] max-h-[400px] overflow-y-auto">
                      {JSON.stringify(previewData, null, 2)}
                    </pre>
                  ) : (
                    <p className="text-gray-500 text-center py-8">
                      Click &quot;Run Query&quot; to see results
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="p-4 border-t border-[var(--border)] flex gap-3">
              <button
                onClick={runQuery}
                disabled={isRunning || !query}
                className="btn-primary flex-1 flex items-center justify-center gap-2"
              >
                {isRunning ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Running...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Run Query
                  </>
                )}
              </button>
              <button
                onClick={() => {
                  const content = activeTab === 'query' ? query : 
                                 activeTab === 'variables' ? JSON.stringify(variables, null, 2) :
                                 activeTab === 'types' ? types :
                                 JSON.stringify(previewData, null, 2);
                  copyToClipboard(content);
                }}
                className="px-4 py-2 rounded-lg bg-[var(--card)] border border-[var(--border)] text-gray-400 hover:text-white transition-colors"
              >
                {copied ? '✓ Copied!' : 'Copy'}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-cyan-500/20 to-blue-500/20 flex items-center justify-center">
              <svg className="w-10 h-10 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold mb-2">Select a Model</h2>
            <p className="text-gray-400 max-w-md mx-auto">
              Choose a content model from the dropdown above to start building your GraphQL query.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// Recursive Field Tree Component
function FieldTree({ 
  fields, 
  selected, 
  onToggle, 
  schema, 
  path,
  depth = 0 
}: { 
  fields: HygraphField[]; 
  selected: SelectedFields; 
  onToggle: (path: string[], value?: boolean) => void;
  schema: HygraphSchema;
  path: string[];
  depth?: number;
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggleExpand = (fieldName: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(fieldName)) {
        next.delete(fieldName);
      } else {
        next.add(fieldName);
      }
      return next;
    });
  };

  // Don't show system fields at root level
  const filteredFields = depth === 0 
    ? fields.filter(f => !['documentInStages', 'history', 'scheduledIn'].includes(f.name))
    : fields;

  return (
    <div className="space-y-1">
      {filteredFields.map(field => {
        const fieldPath = [...path, field.name];
        const isSelected = typeof selected[field.name] === 'object' 
          ? Object.values(selected[field.name] as SelectedFields).some(v => v)
          : !!selected[field.name];
        const isExpanded = expanded.has(field.name);
        
        // Check if field has expandable relations
        const relatedModel = field.relatedModel 
          ? schema.models.find(m => m.name === field.relatedModel) ||
            schema.components.find(c => c.name === field.relatedModel)
          : null;
        const hasChildren = !!relatedModel && relatedModel.fields.length > 0;

        return (
          <div key={field.name}>
            <div 
              className={`flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer transition-colors ${
                isSelected ? 'bg-purple-500/10' : 'hover:bg-[var(--card)]'
              }`}
              style={{ paddingLeft: `${depth * 16 + 8}px` }}
            >
              {hasChildren ? (
                <button
                  onClick={(e) => { e.stopPropagation(); toggleExpand(field.name); }}
                  className="text-gray-400 hover:text-white"
                >
                  <svg 
                    className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`} 
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              ) : (
                <div className="w-4" />
              )}
              
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => onToggle(fieldPath, !isSelected)}
                className="rounded border-gray-600 bg-transparent text-purple-500 focus:ring-purple-500"
              />
              
              <span 
                className={`text-sm ${isSelected ? 'text-white' : 'text-gray-400'}`}
                onClick={() => onToggle(fieldPath, !isSelected)}
              >
                {field.name}
              </span>
              
              <span className="text-xs text-gray-500 ml-auto">
                {field.isList ? `[${field.type}]` : field.type}
              </span>
            </div>
            
            {hasChildren && isExpanded && relatedModel && (
              <FieldTree
                fields={relatedModel.fields}
                selected={(selected[field.name] as SelectedFields) || {}}
                onToggle={onToggle}
                schema={schema}
                path={fieldPath}
                depth={depth + 1}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function QueryBuilderPage() {
  return (
    <HygraphProvider elementType="page">
      <QueryBuilderContent />
    </HygraphProvider>
  );
}

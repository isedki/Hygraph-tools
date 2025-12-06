'use client';

import { useState, useMemo, useCallback } from 'react';
import { GraphQLClient } from 'graphql-request';
import type { HygraphSchema, HygraphModel } from '@/lib/types';
import {
  buildSchemaElementIndex,
  findComponentUsage,
  traceElementDependencies,
  type SchemaElement,
  type ComponentUsageResult,
} from '@/lib/hygraph/componentUsage';
import UsageStatistics from './UsageStatistics';
import ReverseLookup from './ReverseLookup';
import ExportButtons from './ExportUtils';

interface ComponentUsageFinderProps {
  client: GraphQLClient;
  schema: HygraphSchema;
  onBack: () => void;
  endpoint?: string;
}

type TabType = 'search' | 'statistics' | 'lookup';

interface UsageDataEntry {
  count: number;
  models: string[];
  entries: { id: string; model: string; createdAt?: string }[];
}

// Extract project ID and region from Hygraph endpoint URL
function extractProjectInfo(endpoint: string): { projectId: string; region: string } {
  try {
    // Content API URLs: https://[region].cdn.hygraph.com/content/[projectId]/master
    const contentMatch = endpoint.match(/https:\/\/([^.]+)\.cdn\.hygraph\.com\/content\/([^/]+)/);
    if (contentMatch) {
      return { region: contentMatch[1], projectId: contentMatch[2] };
    }
    
    // Legacy/v2 API URLs: https://api-[region].hygraph.com/v2/[projectId]/master
    const v2Match = endpoint.match(/https:\/\/api-([^.]+)\.hygraph\.com\/v2\/([^/]+)/);
    if (v2Match) {
      return { region: v2Match[1], projectId: v2Match[2] };
    }
    
    // GraphCMS legacy URLs
    const graphcmsMatch = endpoint.match(/\/v2\/([^/]+)/);
    if (graphcmsMatch) {
      return { region: '', projectId: graphcmsMatch[1] };
    }
    
    return { region: '', projectId: 'unknown' };
  } catch {
    return { region: '', projectId: 'unknown' };
  }
}

// Build Hygraph app URL for an entry
function buildHygraphUrl(projectId: string, modelApiId: string, entryId: string): string {
  // Hygraph app URL format: https://app.hygraph.com/[projectId]/master/content/[modelApiId]/[entryId]
  return `https://app.hygraph.com/${projectId}/master/content/${modelApiId}/${entryId}`;
}

// Types for model structure
interface ModelFieldGroup {
  components: { fieldName: string; typeName: string }[];
  relations: { fieldName: string; typeName: string }[];
  enums: { fieldName: string; typeName: string }[];
  scalars: { fieldName: string; typeName: string }[];
}

function getModelFieldGroups(model: HygraphModel, schema: HygraphSchema): ModelFieldGroup {
  const groups: ModelFieldGroup = {
    components: [],
    relations: [],
    enums: [],
    scalars: [],
  };
  
  const componentNames = new Set(schema.components.map(c => c.name));
  const modelNames = new Set(schema.models.map(m => m.name));
  const enumNames = new Set(schema.enums.map(e => e.name));
  
  for (const field of model.fields) {
    const typeName = field.relatedModel || field.type;
    
    if (componentNames.has(typeName)) {
      groups.components.push({ fieldName: field.name, typeName });
    } else if (modelNames.has(typeName)) {
      groups.relations.push({ fieldName: field.name, typeName });
    } else if (enumNames.has(typeName)) {
      groups.enums.push({ fieldName: field.name, typeName });
    } else {
      groups.scalars.push({ fieldName: field.name, typeName });
    }
  }
  
  return groups;
}

export default function ComponentUsageFinder({ client, schema, onBack, endpoint = '' }: ComponentUsageFinderProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedElement, setSelectedElement] = useState<SchemaElement | null>(null);
  const [usageResult, setUsageResult] = useState<ComponentUsageResult | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [filterType, setFilterType] = useState<'all' | 'component' | 'enum' | 'model'>('all');
  const [expandedEntry, setExpandedEntry] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'tree'>('list');
  const [expandedModels, setExpandedModels] = useState<Set<string>>(new Set());
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  
  // New state for tabs and usage scanning
  const [activeTab, setActiveTab] = useState<TabType>('search');
  const [usageData, setUsageData] = useState<Map<string, UsageDataEntry>>(new Map());
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState({ current: 0, total: 0, currentName: '' });
  
  // Extract project info from endpoint for Hygraph links
  const projectInfo = useMemo(() => extractProjectInfo(endpoint), [endpoint]);

  // Build schema element index
  const schemaElements = useMemo(() => {
    return buildSchemaElementIndex(schema);
  }, [schema]);

  // Scan all components/enums for usage statistics
  const scanAllUsage = async () => {
    setIsScanning(true);
    const newUsageData = new Map<string, UsageDataEntry>();
    
    const elementsToScan = schemaElements.filter(e => e.type === 'component' || e.type === 'enum');
    setScanProgress({ current: 0, total: elementsToScan.length, currentName: '' });
    
    for (let i = 0; i < elementsToScan.length; i++) {
      const element = elementsToScan[i];
      setScanProgress({ current: i + 1, total: elementsToScan.length, currentName: element.name });
      
      try {
        const result = await findComponentUsage(
          client,
          schema,
          element.name,
          element.type as 'component' | 'enum'
        );
        
        if (result.usages.length > 0) {
          const models = [...new Set(result.usages.map(u => u.modelName))];
          newUsageData.set(element.name, {
            count: result.usages.length,
            models,
            entries: result.usages.map(u => ({
              id: u.entryId,
              model: u.modelName,
              createdAt: u.entryTitle,
            })),
          });
        }
      } catch (error) {
        console.error(`Error scanning ${element.name}:`, error);
      }
      
      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    setUsageData(newUsageData);
    setIsScanning(false);
  };

  // Handle element selection from statistics
  const handleSelectFromStats = (name: string, type: 'component' | 'enum') => {
    const element = schemaElements.find(e => e.name === name && e.type === type);
    if (element) {
      setSelectedElement(element);
      setActiveTab('search');
    }
  };

  // Filter elements based on search and type
  const filteredElements = useMemo(() => {
    let filtered = schemaElements;
    
    if (filterType !== 'all') {
      filtered = filtered.filter(e => e.type === filterType);
    }
    
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(e => 
        e.name.toLowerCase().includes(query) ||
        e.description?.toLowerCase().includes(query)
      );
    }
    
    return filtered.sort((a, b) => a.name.localeCompare(b.name));
  }, [schemaElements, searchQuery, filterType]);

  // Get dependency trace for selected element
  const dependencyTrace = useMemo(() => {
    if (!selectedElement) return null;
    return traceElementDependencies(selectedElement.name, schema);
  }, [selectedElement, schema]);

  const handleSearch = async () => {
    if (!selectedElement) return;
    if (selectedElement.type !== 'component' && selectedElement.type !== 'enum') {
      return;
    }
    
    setIsSearching(true);
    try {
      const result = await findComponentUsage(
        client,
        schema,
        selectedElement.name,
        selectedElement.type as 'component' | 'enum',
        100
      );
      setUsageResult(result);
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setIsSearching(false);
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'component':
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
        );
      case 'enum':
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
          </svg>
        );
      case 'model':
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
          </svg>
        );
      default:
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
          </svg>
        );
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'component':
        return 'text-purple-400 bg-purple-500/10 border-purple-500/30';
      case 'enum':
        return 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30';
      case 'model':
        return 'text-green-400 bg-green-500/10 border-green-500/30';
      default:
        return 'text-gray-400 bg-gray-500/10 border-gray-500/30';
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={onBack}
                className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                Back
              </button>
              <div className="h-6 w-px bg-border" />
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-cyan-500 flex items-center justify-center">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <div>
                  <h1 className="text-xl font-bold">Hygraph Schema Explorer</h1>
                  <p className="text-sm text-muted-foreground">Analyze schema usage, find content references & discover dependencies</p>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              {usageData.size > 0 && (
                <>
                  <ExportButtons schema={schema} usageData={usageData} />
                  <div className="h-6 w-px bg-border" />
                </>
              )}
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span className="px-2 py-1 rounded bg-card border border-border">
                  {schema.components.length} Components
                </span>
                <span className="px-2 py-1 rounded bg-card border border-border">
                  {schema.enums.length} Enums
                </span>
                <span className="px-2 py-1 rounded bg-card border border-border">
                  {schema.models.length} Models
                </span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Tab Navigation */}
      <div className="border-b border-border bg-card/50">
        <div className="container mx-auto px-6">
          <nav className="flex gap-1">
            {[
              { id: 'search' as TabType, label: 'Search', icon: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z' },
              { id: 'statistics' as TabType, label: 'Statistics', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' },
              { id: 'lookup' as TabType, label: 'Entry Lookup', icon: 'M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-purple-500 text-purple-400'
                    : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={tab.icon} />
                </svg>
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      <div className="container mx-auto px-6 py-8">
        {/* Statistics Tab - Full Width */}
        {activeTab === 'statistics' && (
          <div className="space-y-6">
            {/* Scan Button */}
            {usageData.size === 0 && !isScanning && (
              <div className="card p-8 text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-purple-500/10 flex items-center justify-center">
                  <svg className="w-8 h-8 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold mb-2">Scan Usage Statistics</h3>
                <p className="text-muted-foreground mb-6">
                  Scan all components and enums to find usage statistics, identify unused elements, and see which models use them.
                </p>
                <button onClick={scanAllUsage} className="btn-primary">
                  Start Full Scan
                </button>
              </div>
            )}
            
            {/* Scan Progress */}
            {isScanning && (
              <div className="card p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold">Scanning Usage...</h3>
                  <span className="text-sm text-muted-foreground">
                    {scanProgress.current} / {scanProgress.total}
                  </span>
                </div>
                <div className="w-full h-2 bg-background rounded-full overflow-hidden mb-2">
                  <div 
                    className="h-full bg-gradient-to-r from-purple-500 to-cyan-500 transition-all duration-300"
                    style={{ width: `${(scanProgress.current / scanProgress.total) * 100}%` }}
                  />
                </div>
                <p className="text-sm text-muted-foreground">
                  Currently scanning: <span className="text-foreground">{scanProgress.currentName}</span>
                </p>
              </div>
            )}
            
            {/* Usage Statistics */}
            {usageData.size > 0 && !isScanning && (
              <>
                <div className="flex justify-end">
                  <button onClick={scanAllUsage} className="btn-secondary text-sm">
                    Rescan All
                  </button>
                </div>
                <UsageStatistics 
                  schema={schema} 
                  usageData={usageData} 
                  onSelectElement={handleSelectFromStats} 
                />
              </>
            )}
          </div>
        )}

        {/* Entry Lookup Tab - Full Width */}
        {activeTab === 'lookup' && (
          <ReverseLookup 
            client={client} 
            schema={schema}
            projectId={projectInfo.projectId}
          />
        )}

        {/* Search Tab - Two Column Layout */}
        {activeTab === 'search' && (
        <div className="grid grid-cols-12 gap-8">
          {/* Left Panel - Element Selection */}
          <div className="col-span-4">
            <div className="card sticky top-24">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">Schema Elements</h2>
                
                {/* View Mode Toggle */}
                <div className="flex items-center gap-1 bg-background rounded-lg p-1 border border-border">
                  <button
                    onClick={() => setViewMode('list')}
                    className={`p-1.5 rounded transition-colors ${
                      viewMode === 'list' 
                        ? 'bg-purple-500/20 text-purple-400' 
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                    title="List View"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                    </svg>
                  </button>
                  <button
                    onClick={() => setViewMode('tree')}
                    className={`p-1.5 rounded transition-colors ${
                      viewMode === 'tree' 
                        ? 'bg-purple-500/20 text-purple-400' 
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                    title="Tree View"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                    </svg>
                  </button>
                </div>
              </div>
              
              {/* Search Input */}
              <div className="relative mb-4">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search elements..."
                  className="w-full pl-10 pr-4 py-2 text-sm"
                />
              </div>
              
              {/* Type Filter - Only show in list view */}
              {viewMode === 'list' && (
                <div className="flex flex-wrap gap-2 mb-4">
                  {(['all', 'component', 'model', 'enum'] as const).map((type) => (
                    <button
                      key={type}
                      onClick={() => setFilterType(type)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                        filterType === type
                          ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                          : 'bg-card border border-border text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {type === 'all' ? 'All' : type.charAt(0).toUpperCase() + type.slice(1) + 's'}
                    </button>
                  ))}
                </div>
              )}
              
              {/* Tree View */}
              {viewMode === 'tree' && (
                <div className="space-y-1 max-h-[500px] overflow-y-auto pr-2">
                  {schema.models
                    .filter(m => !searchQuery || m.name.toLowerCase().includes(searchQuery.toLowerCase()))
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map((model) => {
                      const groups = getModelFieldGroups(model, schema);
                      const isExpanded = expandedModels.has(model.name);
                      const hasContent = groups.components.length > 0 || groups.relations.length > 0 || groups.enums.length > 0;
                      
                      return (
                        <div key={model.name} className="select-none">
                          {/* Model Header */}
                          <button
                            onClick={() => {
                              const newExpanded = new Set(expandedModels);
                              if (isExpanded) {
                                newExpanded.delete(model.name);
                              } else {
                                newExpanded.add(model.name);
                              }
                              setExpandedModels(newExpanded);
                            }}
                            className="w-full flex items-center gap-2 p-2 rounded-lg hover:bg-card transition-colors"
                          >
                            <svg 
                              className={`w-4 h-4 text-muted-foreground transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                              fill="none" 
                              stroke="currentColor" 
                              viewBox="0 0 24 24"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                            <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                            </svg>
                            <span className="font-medium text-sm">{model.name}</span>
                            <span className="text-xs text-muted-foreground ml-auto">
                              {model.fields.length} fields
                            </span>
                          </button>
                          
                          {/* Model Contents */}
                          {isExpanded && hasContent && (
                            <div className="ml-6 border-l border-border pl-2 space-y-1">
                              {/* Components Section */}
                              {groups.components.length > 0 && (
                                <div>
                                  <button
                                    onClick={() => {
                                      const key = `${model.name}-components`;
                                      const newExpanded = new Set(expandedSections);
                                      if (expandedSections.has(key)) {
                                        newExpanded.delete(key);
                                      } else {
                                        newExpanded.add(key);
                                      }
                                      setExpandedSections(newExpanded);
                                    }}
                                    className="w-full flex items-center gap-2 p-1.5 rounded hover:bg-card/50 transition-colors"
                                  >
                                    <svg 
                                      className={`w-3 h-3 text-muted-foreground transition-transform ${expandedSections.has(`${model.name}-components`) ? 'rotate-90' : ''}`}
                                      fill="none" 
                                      stroke="currentColor" 
                                      viewBox="0 0 24 24"
                                    >
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                    </svg>
                                    <span className="text-xs text-purple-400 font-medium">Components</span>
                                    <span className="text-xs text-muted-foreground">({groups.components.length})</span>
                                  </button>
                                  {expandedSections.has(`${model.name}-components`) && (
                                    <div className="ml-5 space-y-0.5">
                                      {groups.components.map((c, i) => (
                                        <div 
                                          key={i}
                                          className="flex items-center gap-2 p-1 text-xs cursor-pointer hover:bg-purple-500/10 rounded"
                                          onClick={() => {
                                            const el = schemaElements.find(e => e.name === c.typeName && e.type === 'component');
                                            if (el) {
                                              setSelectedElement(el);
                                              setUsageResult(null);
                                            }
                                          }}
                                        >
                                          <div className="w-1.5 h-1.5 rounded-full bg-purple-400" />
                                          <span className="text-muted-foreground">{c.fieldName}:</span>
                                          <span className="text-purple-400">{c.typeName}</span>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              )}
                              
                              {/* Relations Section */}
                              {groups.relations.length > 0 && (
                                <div>
                                  <button
                                    onClick={() => {
                                      const key = `${model.name}-relations`;
                                      const newExpanded = new Set(expandedSections);
                                      if (expandedSections.has(key)) {
                                        newExpanded.delete(key);
                                      } else {
                                        newExpanded.add(key);
                                      }
                                      setExpandedSections(newExpanded);
                                    }}
                                    className="w-full flex items-center gap-2 p-1.5 rounded hover:bg-card/50 transition-colors"
                                  >
                                    <svg 
                                      className={`w-3 h-3 text-muted-foreground transition-transform ${expandedSections.has(`${model.name}-relations`) ? 'rotate-90' : ''}`}
                                      fill="none" 
                                      stroke="currentColor" 
                                      viewBox="0 0 24 24"
                                    >
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                    </svg>
                                    <span className="text-xs text-green-400 font-medium">Relations</span>
                                    <span className="text-xs text-muted-foreground">({groups.relations.length})</span>
                                  </button>
                                  {expandedSections.has(`${model.name}-relations`) && (
                                    <div className="ml-5 space-y-0.5">
                                      {groups.relations.map((r, i) => (
                                        <div 
                                          key={i}
                                          className="flex items-center gap-2 p-1 text-xs cursor-pointer hover:bg-green-500/10 rounded"
                                          onClick={() => {
                                            const el = schemaElements.find(e => e.name === r.typeName && e.type === 'model');
                                            if (el) {
                                              setSelectedElement(el);
                                              setUsageResult(null);
                                            }
                                          }}
                                        >
                                          <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
                                          <span className="text-muted-foreground">{r.fieldName}:</span>
                                          <span className="text-green-400">{r.typeName}</span>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              )}
                              
                              {/* Enums Section */}
                              {groups.enums.length > 0 && (
                                <div>
                                  <button
                                    onClick={() => {
                                      const key = `${model.name}-enums`;
                                      const newExpanded = new Set(expandedSections);
                                      if (expandedSections.has(key)) {
                                        newExpanded.delete(key);
                                      } else {
                                        newExpanded.add(key);
                                      }
                                      setExpandedSections(newExpanded);
                                    }}
                                    className="w-full flex items-center gap-2 p-1.5 rounded hover:bg-card/50 transition-colors"
                                  >
                                    <svg 
                                      className={`w-3 h-3 text-muted-foreground transition-transform ${expandedSections.has(`${model.name}-enums`) ? 'rotate-90' : ''}`}
                                      fill="none" 
                                      stroke="currentColor" 
                                      viewBox="0 0 24 24"
                                    >
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                    </svg>
                                    <span className="text-xs text-cyan-400 font-medium">Enums</span>
                                    <span className="text-xs text-muted-foreground">({groups.enums.length})</span>
                                  </button>
                                  {expandedSections.has(`${model.name}-enums`) && (
                                    <div className="ml-5 space-y-0.5">
                                      {groups.enums.map((en, i) => (
                                        <div 
                                          key={i}
                                          className="flex items-center gap-2 p-1 text-xs cursor-pointer hover:bg-cyan-500/10 rounded"
                                          onClick={() => {
                                            const el = schemaElements.find(e => e.name === en.typeName && e.type === 'enum');
                                            if (el) {
                                              setSelectedElement(el);
                                              setUsageResult(null);
                                            }
                                          }}
                                        >
                                          <div className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                                          <span className="text-muted-foreground">{en.fieldName}:</span>
                                          <span className="text-cyan-400">{en.typeName}</span>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                          
                          {/* Show message if no components/relations/enums */}
                          {isExpanded && !hasContent && (
                            <div className="ml-6 pl-2 py-2 text-xs text-muted-foreground italic">
                              Only scalar fields
                            </div>
                          )}
                        </div>
                      );
                    })}
                </div>
              )}
              
              {/* List View - Element List */}
              {viewMode === 'list' && (
              <div className="space-y-1 max-h-[500px] overflow-y-auto pr-2">
                {filteredElements.map((element) => (
                  <button
                    key={`${element.type}-${element.name}`}
                    onClick={() => {
                      setSelectedElement(element);
                      setUsageResult(null);
                    }}
                    className={`w-full text-left p-3 rounded-lg transition-all ${
                      selectedElement?.name === element.name
                        ? 'bg-purple-500/10 border border-purple-500/30'
                        : 'hover:bg-card border border-transparent hover:border-border'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`p-1.5 rounded ${getTypeColor(element.type)}`}>
                        {getTypeIcon(element.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{element.name}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {element.usedIn && element.usedIn.length > 0 
                            ? `Used in ${element.usedIn.length} places`
                            : element.fieldCount 
                              ? `${element.fieldCount} fields`
                              : element.type
                          }
                        </p>
                      </div>
                    </div>
                  </button>
                ))}
                
                {filteredElements.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <svg className="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="text-sm">No elements found</p>
                  </div>
                )}
              </div>
              )}
            </div>
          </div>

          {/* Right Panel - Details & Results */}
          <div className="col-span-8 space-y-6">
            {selectedElement ? (
              <>
                {/* Element Details Card */}
                <div className="card">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-4">
                      <div className={`p-3 rounded-xl ${getTypeColor(selectedElement.type)}`}>
                        {getTypeIcon(selectedElement.type)}
                      </div>
                      <div>
                        <h2 className="text-2xl font-bold">{selectedElement.name}</h2>
                        <p className="text-muted-foreground capitalize">{selectedElement.type}</p>
                      </div>
                    </div>
                    
                    {(selectedElement.type === 'component' || selectedElement.type === 'enum') && (
                      <button
                        onClick={handleSearch}
                        disabled={isSearching}
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
                            Find Content Usage
                          </>
                        )}
                      </button>
                    )}
                  </div>

                  {/* Dependency Trace */}
                  {dependencyTrace && (
                    <div className="border-t border-border pt-4 mt-4">
                      <h3 className="text-sm font-semibold text-muted-foreground mb-3">SCHEMA REFERENCES</h3>
                      
                      {dependencyTrace.directUsage.length > 0 && (
                        <div className="mb-4">
                          <p className="text-xs text-muted-foreground mb-2">Direct Usage:</p>
                          <div className="flex flex-wrap gap-2">
                            {dependencyTrace.directUsage.map((usage, i) => (
                              <span key={i} className="px-2 py-1 rounded bg-green-500/10 text-green-400 text-xs font-mono">
                                {usage}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {dependencyTrace.indirectUsage.length > 0 && (
                        <div>
                          <p className="text-xs text-muted-foreground mb-2">Indirect Usage (via components):</p>
                          <div className="flex flex-wrap gap-2">
                            {dependencyTrace.indirectUsage.map((usage, i) => (
                              <span key={i} className="px-2 py-1 rounded bg-yellow-500/10 text-yellow-400 text-xs font-mono">
                                {usage.in} → {usage.through}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {dependencyTrace.directUsage.length === 0 && dependencyTrace.indirectUsage.length === 0 && (
                        <p className="text-sm text-muted-foreground">No schema references found</p>
                      )}
                    </div>
                  )}
                </div>

                {/* Usage Results */}
                {usageResult && (
                  <div className="card">
                    <div className="flex items-center justify-between mb-6">
                      <div>
                        <h3 className="text-lg font-semibold">Content Entries Using This {selectedElement.type}</h3>
                        <p className="text-sm text-muted-foreground">
                          Found {usageResult.totalUsages} usage{usageResult.totalUsages !== 1 ? 's' : ''} across {usageResult.modelsWithUsage.length} model{usageResult.modelsWithUsage.length !== 1 ? 's' : ''}
                        </p>
                      </div>
                      
                      {usageResult.modelsWithUsage.length > 0 && (
                        <div className="flex gap-1">
                          {usageResult.modelsWithUsage.map(model => (
                            <span key={model} className="px-2 py-1 rounded bg-card border border-border text-xs font-medium">
                              {model}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    
                    {usageResult.usages.length > 0 ? (
                      <div className="space-y-3">
                        {usageResult.usages.map((usage, index) => (
                          <div
                            key={`${usage.entryId}-${index}`}
                            className="rounded-lg border border-border overflow-hidden"
                          >
                            <button
                              onClick={() => setExpandedEntry(
                                expandedEntry === `${usage.entryId}-${index}` ? null : `${usage.entryId}-${index}`
                              )}
                              className="w-full p-4 flex items-center justify-between hover:bg-card/50 transition-colors"
                            >
                              <div className="flex items-center gap-4">
                                <div className="p-2 rounded-lg bg-purple-500/10">
                                  <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                  </svg>
                                </div>
                                <div className="text-left">
                                  <p className="font-medium">{usage.entryTitle}</p>
                                  <p className="text-sm text-muted-foreground">
                                    <span className="text-purple-400">{usage.modelName}</span>
                                    <span className="mx-2">•</span>
                                    <span className="font-mono text-xs">{usage.fieldPath.join(' → ')}</span>
                                  </p>
                                </div>
                              </div>
                              
                              <div className="flex items-center gap-3">
                                <span className="text-xs font-mono text-muted-foreground">{usage.entryId.slice(0, 8)}...</span>
                                <svg
                                  className={`w-5 h-5 text-muted-foreground transition-transform ${
                                    expandedEntry === `${usage.entryId}-${index}` ? 'rotate-180' : ''
                                  }`}
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                              </div>
                            </button>
                            
                            {expandedEntry === `${usage.entryId}-${index}` && (
                              <div className="px-4 pb-4 border-t border-border bg-card/30">
                                <div className="mt-4 space-y-4">
                                  {/* Entry Info with Open in Hygraph */}
                                  <div className="flex items-start justify-between">
                                    <div>
                                      <p className="text-xs text-muted-foreground mb-2">ENTRY ID</p>
                                      <code className="text-sm font-mono text-cyan-400 bg-cyan-500/10 px-2 py-1 rounded">
                                        {usage.entryId}
                                      </code>
                                    </div>
                                    <a
                                      href={buildHygraphUrl(projectInfo.projectId, usage.modelPluralApiId || usage.modelName, usage.entryId)}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="btn-secondary flex items-center gap-2 text-sm"
                                      onClick={(e) => e.stopPropagation()}
                                      title={`Open: ${buildHygraphUrl(projectInfo.projectId, usage.modelPluralApiId || usage.modelName, usage.entryId)}`}
                                    >
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                      </svg>
                                      Open in Hygraph
                                    </a>
                                  </div>
                                  
                                  {/* Path to Component */}
                                  <div>
                                    <p className="text-xs text-muted-foreground mb-2">LOCATION PATH</p>
                                    <div className="flex items-center gap-2 flex-wrap">
                                      {usage.fieldPath.map((segment, i) => (
                                        <span key={i} className="flex items-center gap-2">
                                          <span className="px-2 py-1 rounded bg-card border border-border text-sm font-mono">
                                            {segment}
                                          </span>
                                          {i < usage.fieldPath.length - 1 && (
                                            <svg className="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                            </svg>
                                          )}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                  
                                  {/* Component Data Preview */}
                                  {Object.keys(usage.componentData).length > 0 && (
                                    <div>
                                      <p className="text-xs text-muted-foreground mb-2">COMPONENT DATA</p>
                                      <pre className="p-3 rounded-lg bg-background border border-border text-xs font-mono overflow-x-auto">
                                        {JSON.stringify(usage.componentData, null, 2)}
                                      </pre>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-12 text-muted-foreground">
                        <svg className="w-16 h-16 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                        </svg>
                        <p className="text-lg font-medium">No content entries found</p>
                        <p className="text-sm mt-1">This {selectedElement.type} isn&apos;t used in any content yet</p>
                      </div>
                    )}
                  </div>
                )}

                {/* No search yet prompt */}
                {!usageResult && !isSearching && (selectedElement.type === 'component' || selectedElement.type === 'enum') && (
                  <div className="card text-center py-12">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-purple-500/10 flex items-center justify-center">
                      <svg className="w-8 h-8 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                    </div>
                    <h3 className="text-lg font-semibold mb-2">Ready to Search</h3>
                    <p className="text-muted-foreground mb-4">
                      Click &quot;Find Content Usage&quot; to discover which content entries use this {selectedElement.type}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      We&apos;ll search through all entries, including deeply nested components
                    </p>
                  </div>
                )}
              </>
            ) : (
              /* No selection prompt */
              <div className="card text-center py-16">
                <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-purple-500/20 to-cyan-500/20 flex items-center justify-center">
                  <svg className="w-10 h-10 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                </div>
                <h2 className="text-xl font-semibold mb-2">Select a Schema Element</h2>
                <p className="text-muted-foreground max-w-md mx-auto">
                  Choose a component or enum from the list to find all content entries that use it, even when deeply nested within other components.
                </p>
              </div>
            )}
          </div>
        </div>
        )}
      </div>
    </div>
  );
}

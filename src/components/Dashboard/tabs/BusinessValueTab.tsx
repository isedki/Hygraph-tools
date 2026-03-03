'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import { GraphQLClient } from 'graphql-request';
import type { AuditResult, BusinessValueData, ModelEditorExperienceData, ModelCostData } from '@/lib/types';
import { analyzeBusinessValue } from '@/lib/analyzers/businessValue';
import { ExecutiveReportModal } from '../ExecutiveReport';
import {
  analyzeProjectIntelligence,
  scanContributors,
  getStageDisplayName,
  getStageDescription,
  getHealthStatus,
  getFrictionStatus,
  type ProjectIntelligence,
  type TopContributorsAnalysis,
} from '@/lib/analyzers/projectIntelligence';

interface BusinessValueTabProps {
  result: AuditResult;
  endpoint?: string;
  token?: string;
}

interface DuplicateScanResult {
  modelName: string;
  totalEntries: number;
  sampledEntries: number;
  exactDuplicates: { field: string; value: string; count: number; entries: { id: string }[] }[];
  nearDuplicates: { field: string; value: string; similarity: number; count: number }[];
  duplicatePercentage: number;
  wastedEffort?: number; // Estimated $ wasted on duplicates
}

// Team Activity types
interface WeekActivity {
  weekStart: string; // ISO date string for week start (Monday)
  weekLabel: string; // e.g., "Jan 27 - Feb 2"
  modelCounts: Record<string, number>;
  total: number;
}

interface TeamActivityData {
  weeks: WeekActivity[];
  topModels: string[]; // Top 5 most active models
  totalEntries: number;
  peakWeek: { label: string; count: number };
  modelTotals: Record<string, number>;
}

// Editor experience table sort
type EditorSortColumn = 'timeMinutes' | 'clicks' | 'cognitiveLoad' | 'namingClarity' | 'descriptionsPercent' | 'overallScore';
type EditorSortDirection = 'asc' | 'desc';

// Model Overview data structure
interface ModelOverviewData {
  name: string;
  fields: number;
  relations: number;
  assets: number;
  richText: number;
  enums: number;
  components: number;
  locales: number;
  entries: number;
  complexity: number;
  // For expanded view
  fieldNames: string[];
  relationDetails: { field: string; target: string }[];
  assetFields: string[];
  richTextFields: string[];
  enumFields: string[];
  componentFields: string[];
}

type SortColumn = 'name' | 'fields' | 'relations' | 'assets' | 'richText' | 'enums' | 'components' | 'locales' | 'entries' | 'complexity';
type SortDirection = 'asc' | 'desc';

export function BusinessValueTab({ result, endpoint, token }: BusinessValueTabProps) {
  const [hourlyRate, setHourlyRate] = useState(50);
  const [showAllCostModels, setShowAllCostModels] = useState(false);
  const [showExecutiveReport, setShowExecutiveReport] = useState(false);
  
  // Model Overview state
  const [sortColumn, setSortColumn] = useState<SortColumn>('complexity');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [expandedOverviewRow, setExpandedOverviewRow] = useState<string | null>(null);
  const [showAllOverviewModels, setShowAllOverviewModels] = useState(false);
  
  // Editor Experience table state
  const [editorSortColumn, setEditorSortColumn] = useState<EditorSortColumn>('timeMinutes');
  const [editorSortDirection, setEditorSortDirection] = useState<EditorSortDirection>('desc');
  const [expandedEditorRow, setExpandedEditorRow] = useState<string | null>(null);
  const [showAllEditorModels, setShowAllEditorModels] = useState(false);
  
  // Duplicate scanning state
  const [selectedDuplicateModel, setSelectedDuplicateModel] = useState<string>('');
  const [duplicateScanResults, setDuplicateScanResults] = useState<DuplicateScanResult[]>([]);
  const [isDuplicateScanning, setIsDuplicateScanning] = useState(false);
  const [duplicateScanError, setDuplicateScanError] = useState<string | null>(null);
  const [expandedDuplicateRow, setExpandedDuplicateRow] = useState<string | null>(null);
  
  // Team Activity state
  const [teamActivityData, setTeamActivityData] = useState<TeamActivityData | null>(null);
  const [isActivityScanning, setIsActivityScanning] = useState(false);
  const [activityScanError, setActivityScanError] = useState<string | null>(null);
  
  // Project Intelligence state
  const [contributorsData, setContributorsData] = useState<TopContributorsAnalysis | null>(null);
  const [isContributorScanning, setIsContributorScanning] = useState(false);
  const [contributorScanError, setContributorScanError] = useState<string | null>(null);
  const [showIntelligenceMethodology, setShowIntelligenceMethodology] = useState(false);
  
  // Compute Project Intelligence (instant - no API calls needed)
  const projectIntelligence = useMemo<ProjectIntelligence | null>(() => {
    try {
      return analyzeProjectIntelligence(result);
    } catch (err) {
      console.warn('Failed to analyze project intelligence:', err);
      return null;
    }
  }, [result]);
  
  // Scan contributors (async, on-demand)
  const scanForContributors = useCallback(async () => {
    if (!endpoint || !token) {
      setContributorScanError('Endpoint and token required');
      return;
    }
    
    setIsContributorScanning(true);
    setContributorScanError(null);
    
    try {
      const data = await scanContributors(endpoint, token, result);
      setContributorsData(data);
    } catch (err) {
      setContributorScanError(err instanceof Error ? err.message : 'Failed to scan contributors');
    } finally {
      setIsContributorScanning(false);
    }
  }, [endpoint, token, result]);
  
  // Get entry counts from content distribution
  const entryCounts = useMemo(() => {
    const counts: Record<string, { draft: number; published: number; total: number }> = {};
    for (const entry of result.comprehensiveAssessment.contentArchitecture.contentDistribution) {
      counts[entry.model] = { draft: entry.draft, published: entry.published, total: entry.total };
    }
    return counts;
  }, [result]);
  
  // Models with content (for duplicate scanning dropdown)
  const modelsWithContent = useMemo(() => {
    return result.comprehensiveAssessment.contentArchitecture.contentDistribution
      .filter(entry => entry.total > 0)
      .sort((a, b) => b.total - a.total);
  }, [result]);

  // Build Model Overview data from schema analysis
  const modelOverviewData = useMemo((): ModelOverviewData[] => {
    const models: ModelOverviewData[] = [];
    
    // Get model data from various sources in the result
    const contentDistribution = result.comprehensiveAssessment.contentArchitecture.contentDistribution;
    const editorialComplexity = result.editorial.modelComplexity;
    
    // Create a map of model complexity scores
    const complexityMap = new Map<string, number>();
    for (const mc of editorialComplexity) {
      complexityMap.set(mc.model, mc.complexityScore);
    }
    
    // Collect model names from ALL sources to include ghost models
    const modelNames = new Set<string>();
    
    // From content distribution
    for (const cd of contentDistribution) {
      modelNames.add(cd.model);
    }
    
    // From editorial complexity
    for (const mc of editorialComplexity) {
      modelNames.add(mc.model);
    }
    
    // From ghost models in content adoption analysis
    const ghostModels = result.insights.contentAdoption?.ghostModels || [];
    for (const gm of ghostModels) {
      modelNames.add(gm.model);
    }
    
    // From underutilized models
    const underutilized = result.insights.contentAdoption?.underutilized || [];
    for (const um of underutilized) {
      modelNames.add(um.model);
    }
    
    // From structure assessment - distinct content types
    const distinctTypes = result.comprehensiveAssessment.structure.distinctContentTypes.examples || [];
    for (const dt of distinctTypes) {
      if (dt.items) {
        for (const item of dt.items) {
          modelNames.add(item);
        }
      }
    }
    
    for (const modelName of modelNames) {
      const distEntry = contentDistribution.find(cd => cd.model === modelName);
      const editEntry = editorialComplexity.find(ec => ec.model === modelName);
      const ghostEntry = ghostModels.find(gm => gm.model === modelName);
      
      // Count field types from editorial analysis (now includes real counts)
      const fieldCount = editEntry?.fieldCount || ghostEntry?.fieldCount || 0;
      const relationCount = editEntry?.relationCount || (ghostEntry?.hasRelations ? 1 : 0);
      
      // Use actual counts from editorial analysis instead of estimates
      const richTextCount = editEntry?.richTextCount ?? 0;
      const enumCount = editEntry?.enumCount ?? 0;
      const componentCount = editEntry?.componentCount ?? 0;
      const assetCount = editEntry?.assetCount ?? 0;
      
      // Get localization info
      const localeEntry = result.governance.localizationAnalysis.localizedModels.includes(modelName);
      const localeCount = localeEntry ? result.governance.localizationAnalysis.localeCount : 0;
      
      // Calculate complexity (0-100 scale)
      const baseComplexity = complexityMap.get(modelName) || Math.min(100, fieldCount * 3 + relationCount * 5);
      
      models.push({
        name: modelName,
        fields: fieldCount,
        relations: relationCount,
        assets: assetCount,
        richText: richTextCount,
        enums: enumCount,
        components: componentCount,
        locales: localeCount,
        entries: distEntry?.total || 0,
        complexity: Math.min(100, baseComplexity),
        fieldNames: [],
        relationDetails: [],
        assetFields: [],
        richTextFields: [],
        enumFields: [],
        componentFields: [],
      });
    }
    
    return models;
  }, [result]);

  // Sort model overview data
  const sortedModelOverview = useMemo(() => {
    return [...modelOverviewData].sort((a, b) => {
      let aVal: number | string = a[sortColumn];
      let bVal: number | string = b[sortColumn];
      
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortDirection === 'asc' 
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      }
      
      return sortDirection === 'asc' 
        ? (aVal as number) - (bVal as number)
        : (bVal as number) - (aVal as number);
    });
  }, [modelOverviewData, sortColumn, sortDirection]);

  // Calculate totals
  const totals = useMemo(() => {
    return modelOverviewData.reduce((acc, model) => ({
      fields: acc.fields + model.fields,
      relations: acc.relations + model.relations,
      assets: acc.assets + model.assets,
      richText: acc.richText + model.richText,
      enums: acc.enums + model.enums,
      components: acc.components + model.components,
      entries: acc.entries + model.entries,
    }), { fields: 0, relations: 0, assets: 0, richText: 0, enums: 0, components: 0, entries: 0 });
  }, [modelOverviewData]);

  // Calculate combined complexity (weighted by entries)
  const combinedComplexity = useMemo(() => {
    const totalEntries = totals.entries || 1;
    let weightedSum = 0;
    let totalWeight = 0;
    
    for (const model of modelOverviewData) {
      const weight = (model.entries + 10) / totalEntries;
      weightedSum += model.complexity * weight;
      totalWeight += weight;
    }
    
    return totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 0;
  }, [modelOverviewData, totals.entries]);

  // Get complexity level label
  const getComplexityLevel = (score: number): { label: string; color: string } => {
    if (score <= 25) return { label: 'SIMPLE', color: 'text-green-400' };
    if (score <= 50) return { label: 'MODERATE', color: 'text-yellow-400' };
    if (score <= 75) return { label: 'COMPLEX', color: 'text-orange-400' };
    return { label: 'VERY COMPLEX', color: 'text-red-400' };
  };

  // Heaviest models
  const heaviestModels = useMemo(() => {
    return [...modelOverviewData]
      .sort((a, b) => b.complexity - a.complexity)
      .slice(0, 3)
      .map(m => `${m.name} (${m.complexity})`);
  }, [modelOverviewData]);

  // Handle sort
  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('desc');
    }
  };

  // Export CSV
  const exportCSV = useCallback(() => {
    const headers = ['Model', 'Fields', 'Relations', 'Assets', 'Rich Text', 'Enums', 'Components', 'Locales', 'Entries', 'Complexity'];
    const rows = sortedModelOverview.map(m => [
      m.name,
      m.fields,
      m.relations,
      m.assets,
      m.richText,
      m.enums,
      m.components,
      m.locales,
      m.entries,
      m.complexity
    ]);
    
    // Add totals row
    rows.push(['TOTAL', totals.fields, totals.relations, totals.assets, totals.richText, totals.enums, totals.components, '—', totals.entries, '']);
    
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'model-overview.csv';
    a.click();
    URL.revokeObjectURL(url);
  }, [sortedModelOverview, totals]);
  
  // Re-calculate business value when hourly rate changes
  const businessValue = useMemo(() => {
    if (result.insights.businessValue && hourlyRate === 50) {
      return result.insights.businessValue;
    }
    
    return analyzeBusinessValue(
      {
        models: result.comprehensiveAssessment.structure.distinctContentTypes.examples
          .filter(e => e.items)
          .flatMap(e => e.items || [])
          .map(name => {
            const model = result.schema.modelCount > 0 ? { name, apiId: name.toLowerCase(), pluralApiId: name.toLowerCase() + 's', fields: [], isSystem: false } : null;
            return model;
          })
          .filter(Boolean) as any[],
        enums: [],
        components: [],
        taxonomies: [],
      },
      entryCounts,
      hourlyRate
    );
  }, [result, hourlyRate, entryCounts]);

  const data = result.insights.businessValue || businessValue;

  // Build editor experience models from editorial.modelComplexity (more accurate data)
  const editorExperienceModels = useMemo(() => {
    const modelComplexity = result.editorial.modelComplexity || [];
    
    return modelComplexity.map(mc => {
      // Time calculation based on actual field types:
      // - Basic fields (string, int, bool): ~10s each
      // - Rich text: ~90s each (writing content)
      // - Single relations: ~20s each (searching/selecting)
      // - Multi relations: ~60s each (adding/managing multiple items)
      // - Assets: ~30s each (uploading/selecting media)
      // - Enums: ~5s each (dropdown selection)
      // - Single components: ~45s each (expanding/filling nested fields)
      // - Multi components: ~120s each (adding/managing multiple component instances)
      // - Required fields add ~5s extra (validation/attention)
      
      const basicFieldCount = mc.fieldCount - mc.richTextCount - mc.relationCount - mc.assetCount - mc.enumCount - mc.componentCount;
      const basicFieldTime = Math.max(0, basicFieldCount) * 10;
      const richTextTime = mc.richTextCount * 90;
      
      // Relations: single (20s) vs multi (60s)
      const singleRelations = mc.relationCount - (mc.multiRelationCount || 0);
      const multiRelations = mc.multiRelationCount || 0;
      const relationTime = (singleRelations * 20) + (multiRelations * 60);
      
      const assetTime = mc.assetCount * 30;
      const enumTime = mc.enumCount * 5;
      
      // Components: single (45s) vs multi (120s)
      const singleComponents = mc.componentCount - (mc.multiComponentCount || 0);
      const multiComponents = mc.multiComponentCount || 0;
      const componentTime = (singleComponents * 45) + (multiComponents * 120);
      
      const requiredBonus = mc.requiredFields * 5;
      
      const totalTimeSeconds = 60 + basicFieldTime + richTextTime + relationTime + assetTime + enumTime + componentTime + requiredBonus;
      const timeMinutes = totalTimeSeconds / 60;
      
      // Clicks calculation:
      // - Base: 5 (navigate, create, save)
      // - Basic fields: 2 clicks each
      // - Rich text: 5 clicks (formatting, etc.)
      // - Single relations: 4 clicks (open picker, search, select, confirm)
      // - Multi relations: 8 clicks (multiple add cycles)
      // - Assets: 5 clicks (open media library, upload/select, confirm)
      // - Enums: 2 clicks (open dropdown, select)
      // - Single components: 4 clicks (add component, fill fields)
      // - Multi components: 10 clicks (multiple add cycles)
      const basicClicks = Math.max(0, basicFieldCount) * 2;
      const richTextClicks = mc.richTextCount * 5;
      const relationClicks = (singleRelations * 4) + (multiRelations * 8);
      const assetClicks = mc.assetCount * 5;
      const enumClicks = mc.enumCount * 2;
      const componentClicks = (singleComponents * 4) + (multiComponents * 10);
      const clicks = 5 + basicClicks + richTextClicks + relationClicks + assetClicks + enumClicks + componentClicks;
      
      // Cognitive load: based on field types and complexity
      const fieldPenalty = Math.min(mc.fieldCount * 2, 40);
      const requiredPenalty = Math.min(mc.requiredFields * 3, 30);
      const relationPenalty = Math.min(mc.relationCount * 4, 20);
      const richTextPenalty = Math.min(mc.richTextCount * 5, 15);
      const componentPenalty = Math.min(mc.componentCount * 3, 15);
      const cognitiveLoad = Math.min(100, fieldPenalty + requiredPenalty + relationPenalty + richTextPenalty + componentPenalty);
      
      // Overall score: 100 - cognitive load
      const overallScore = Math.max(0, 100 - cognitiveLoad);
      
      // Complexity label
      const complexity = overallScore >= 80 ? 'simple' as const : 
                        overallScore >= 60 ? 'moderate' as const : 
                        overallScore >= 40 ? 'complex' as const : 'very-complex' as const;
      
      // Visual anchor: check if model likely has title/name field (estimate based on model name patterns)
      const hasVisualAnchor = mc.fieldCount > 0; // Assume models with fields have anchors (simplified)
      
      // Naming clarity: estimate based on field count (more fields = harder to name well)
      const namingClarity = mc.fieldCount <= 5 ? 95 : 
                           mc.fieldCount <= 10 ? 85 : 
                           mc.fieldCount <= 15 ? 75 : 65;
      
      // Descriptions: we don't have this data, so estimate based on complexity score
      // Higher complexity usually means less documentation
      const descriptionsPercent = mc.complexityScore <= 30 ? 80 : 
                                  mc.complexityScore <= 50 ? 50 : 
                                  mc.complexityScore <= 70 ? 30 : 10;
      
      return {
        modelName: mc.model,
        timeMinutes: Math.round(timeMinutes * 10) / 10,
        clicks,
        cognitiveLoad,
        overallScore,
        complexity,
        hasVisualAnchor,
        namingClarity,
        descriptionsPercent,
        // Additional raw data for transparency
        fieldCount: mc.fieldCount,
        requiredFields: mc.requiredFields,
        relationCount: mc.relationCount,
        multiRelationCount: mc.multiRelationCount || 0,
        richTextCount: mc.richTextCount,
        assetCount: mc.assetCount,
        enumCount: mc.enumCount,
        componentCount: mc.componentCount,
        multiComponentCount: mc.multiComponentCount || 0,
        rawComplexityScore: mc.complexityScore,
      };
    });
  }, [result.editorial.modelComplexity]);

  // Sort editor experience models
  const sortedEditorModels = useMemo(() => {
    if (editorExperienceModels.length === 0) return [];
    
    return [...editorExperienceModels]
      .sort((a, b) => {
        const aVal = a[editorSortColumn as keyof typeof a];
        const bVal = b[editorSortColumn as keyof typeof b];
        
        if (typeof aVal === 'boolean' && typeof bVal === 'boolean') {
          return editorSortDirection === 'asc' 
            ? (aVal ? 1 : 0) - (bVal ? 1 : 0)
            : (bVal ? 1 : 0) - (aVal ? 1 : 0);
        }
        
        return editorSortDirection === 'asc' 
          ? (aVal as number) - (bVal as number)
          : (bVal as number) - (aVal as number);
      })
      .map((model, index) => ({ ...model, rank: index + 1 }));
  }, [editorExperienceModels, editorSortColumn, editorSortDirection]);

  // Calculate editor averages
  const editorAverages = useMemo(() => {
    if (editorExperienceModels.length === 0) return { avgTime: 0, avgClicks: 0, avgCognitiveLoad: 0 };
    const avgTime = editorExperienceModels.reduce((sum, m) => sum + m.timeMinutes, 0) / editorExperienceModels.length;
    const avgClicks = editorExperienceModels.reduce((sum, m) => sum + m.clicks, 0) / editorExperienceModels.length;
    const avgCognitiveLoad = editorExperienceModels.reduce((sum, m) => sum + m.cognitiveLoad, 0) / editorExperienceModels.length;
    return { 
      avgTime: Math.round(avgTime * 10) / 10, 
      avgClicks: Math.round(avgClicks), 
      avgCognitiveLoad: Math.round(avgCognitiveLoad) 
    };
  }, [editorExperienceModels]);

  // Models needing attention (score < 50)
  const worstEditorModels = useMemo(() => {
    return editorExperienceModels
      .filter(m => m.overallScore < 50)
      .sort((a, b) => a.overallScore - b.overallScore)
      .slice(0, 5)
      .map(m => m.modelName);
  }, [editorExperienceModels]);

  // Handle editor sort
  const handleEditorSort = (column: EditorSortColumn) => {
    if (editorSortColumn === column) {
      setEditorSortDirection(editorSortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setEditorSortColumn(column);
      setEditorSortDirection('desc');
    }
  };

  // Sort duplicate results by wasted effort (highest first)
  const rankedDuplicateResults = useMemo(() => {
    // Calculate wasted effort for each result
    const withWaste = duplicateScanResults.map(result => {
      const duplicateCount = result.exactDuplicates.reduce((sum, d) => sum + (d.count - 1), 0);
      // Estimate: each duplicate entry costs ~$5 (based on average time)
      const wastedEffort = Math.round(duplicateCount * (hourlyRate / 12)); // ~5 min per entry
      return { ...result, wastedEffort };
    });
    
    return withWaste
      .sort((a, b) => (b.wastedEffort || 0) - (a.wastedEffort || 0))
      .map((result, index) => ({ ...result, rank: index + 1 }));
  }, [duplicateScanResults, hourlyRate]);

  // Duplicate scanning function
  const scanForDuplicates = useCallback(async () => {
    if (!endpoint || !token) {
      setDuplicateScanError('Endpoint and token required for duplicate scanning');
      return;
    }

    setIsDuplicateScanning(true);
    setDuplicateScanError(null);
    
    try {
      const client = new GraphQLClient(endpoint, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const modelsToScan = selectedDuplicateModel 
        ? modelsWithContent.filter(m => m.model === selectedDuplicateModel)
        : modelsWithContent.slice(0, 5);

      const results: DuplicateScanResult[] = [];

      for (const modelInfo of modelsToScan) {
        try {
          const pluralApiId = pluralizeModelName(modelInfo.model);
          const sampleSize = Math.min(50, modelInfo.total);
          
          console.log(`[Duplicates] Scanning ${modelInfo.model} (${pluralApiId}), sample size: ${sampleSize}`);
          
          // First, discover available String/Text fields via introspection
          const introspectQuery = `
            query IntrospectModel {
              __type(name: "${modelInfo.model}") {
                fields {
                  name
                  type {
                    name
                    kind
                  }
                }
              }
            }
          `;
          
          let stringFields: string[] = [];
          try {
            const introspectResponse = await client.request<{ __type: { fields: { name: string; type: { name: string; kind: string } }[] } }>(introspectQuery);
            stringFields = introspectResponse.__type?.fields
              ?.filter(f => 
                (f.type.name === 'String' || f.type.kind === 'SCALAR') && 
                !['id', 'createdAt', 'updatedAt', 'publishedAt', 'stage'].includes(f.name)
              )
              .map(f => f.name)
              .slice(0, 10) || []; // Limit to 10 fields
            console.log(`[Duplicates] ${modelInfo.model}: Found fields:`, stringFields);
          } catch (introspectErr) {
            console.warn(`[Duplicates] Introspection failed for ${modelInfo.model}:`, introspectErr);
            // Fallback to common field names
            stringFields = ['title', 'name', 'slug', 'heading', 'label', 'text', 'description'];
          }
          
          let entries: { id: string; [key: string]: unknown }[] = [];
          
          if (stringFields.length > 0) {
            // Try multiple query approaches
            const queries = [
              // Approach 1: With stage filter
              `query SampleEntries {
                ${pluralApiId}(first: ${sampleSize}, stage: DRAFT) {
                  id
                  ${stringFields.join('\n                  ')}
                }
              }`,
              // Approach 2: Without stage filter (for CDN)
              `query SampleEntries {
                ${pluralApiId}(first: ${sampleSize}) {
                  id
                  ${stringFields.join('\n                  ')}
                }
              }`,
            ];

            for (const query of queries) {
              if (entries.length > 0) break;
              try {
                const response = await client.request<Record<string, { id: string; [key: string]: unknown }[]>>(query);
                entries = response[pluralApiId] || [];
                console.log(`[Duplicates] ${modelInfo.model}: Got ${entries.length} entries`);
              } catch (queryErr) {
                console.warn(`[Duplicates] Query failed for ${modelInfo.model}:`, queryErr);
              }
            }

            // If still no entries, try with just id
            if (entries.length === 0) {
              const basicQuery = `
                query SampleEntries {
                  ${pluralApiId}(first: ${sampleSize}) {
                    id
                  }
                }
              `;
              try {
                const basicResponse = await client.request<Record<string, { id: string }[]>>(basicQuery);
                entries = basicResponse[pluralApiId] || [];
              } catch {
                entries = [];
              }
            }
          } else {
            // No string fields found, just get count
            const basicQuery = `
              query SampleEntries {
                ${pluralApiId}(first: ${sampleSize}, stage: DRAFT) {
                  id
                }
              }
            `;
            try {
              const basicResponse = await client.request<Record<string, { id: string }[]>>(basicQuery);
              entries = basicResponse[pluralApiId] || [];
            } catch {
              entries = [];
            }
          }
          
          // Calculate similarity between two entries (0-100%)
          const calculateSimilarity = (entry1: Record<string, unknown>, entry2: Record<string, unknown>): number => {
            const keys1 = Object.keys(entry1).filter(k => k !== 'id' && k !== '__typename');
            const keys2 = Object.keys(entry2).filter(k => k !== 'id' && k !== '__typename');
            const allKeys = [...new Set([...keys1, ...keys2])];
            
            if (allKeys.length === 0) return 0;
            
            let matchingFields = 0;
            for (const key of allKeys) {
              const val1 = entry1[key];
              const val2 = entry2[key];
              
              if (val1 === val2) {
                matchingFields++;
              } else if (typeof val1 === 'string' && typeof val2 === 'string') {
                // For strings, check if they're very similar (Jaccard-like)
                const str1 = val1.toLowerCase().trim();
                const str2 = val2.toLowerCase().trim();
                if (str1 === str2) {
                  matchingFields++;
                } else if (str1.length > 3 && str2.length > 3) {
                  // Simple token overlap for longer strings
                  const tokens1 = new Set(str1.split(/\s+/));
                  const tokens2 = new Set(str2.split(/\s+/));
                  const intersection = [...tokens1].filter(t => tokens2.has(t)).length;
                  const union = new Set([...tokens1, ...tokens2]).size;
                  const jaccard = union > 0 ? intersection / union : 0;
                  if (jaccard >= 0.8) matchingFields++; // 80% token similarity
                }
              }
            }
            
            return (matchingFields / allKeys.length) * 100;
          };
          
          // Find duplicate groups (entries with 80%+ similarity)
          const SIMILARITY_THRESHOLD = 80;
          const duplicateGroups: { entries: { id: string; fields: Record<string, unknown> }[]; similarity: number }[] = [];
          const processedIds = new Set<string>();
          
          for (let i = 0; i < entries.length; i++) {
            if (processedIds.has(entries[i].id)) continue;
            
            const group: { id: string; fields: Record<string, unknown> }[] = [{ 
              id: entries[i].id, 
              fields: Object.fromEntries(
                Object.entries(entries[i]).filter(([k]) => k !== 'id' && k !== '__typename')
              )
            }];
            let groupSimilarity = 100;
            
            for (let j = i + 1; j < entries.length; j++) {
              if (processedIds.has(entries[j].id)) continue;
              
              const similarity = calculateSimilarity(entries[i], entries[j]);
              if (similarity >= SIMILARITY_THRESHOLD) {
                group.push({ 
                  id: entries[j].id, 
                  fields: Object.fromEntries(
                    Object.entries(entries[j]).filter(([k]) => k !== 'id' && k !== '__typename')
                  )
                });
                groupSimilarity = Math.min(groupSimilarity, similarity);
                processedIds.add(entries[j].id);
              }
            }
            
            if (group.length > 1) {
              processedIds.add(entries[i].id);
              duplicateGroups.push({ entries: group, similarity: Math.round(groupSimilarity) });
            }
          }
          
          // Sort by group size (most duplicates first)
          duplicateGroups.sort((a, b) => b.entries.length - a.entries.length);
          
          // Convert to the expected format
          const exactDuplicates = duplicateGroups.slice(0, 10).map((group, idx) => {
            // Get a representative field value for display
            const firstEntry = group.entries[0].fields;
            const displayField = Object.keys(firstEntry)[0] || 'unknown';
            const displayValue = String(firstEntry[displayField] || '').substring(0, 100);
            
            return {
              field: `${group.similarity}% similar`,
              value: displayValue || `Group ${idx + 1}`,
              count: group.entries.length,
              entries: group.entries.map(e => ({ id: e.id })),
            };
          });
          
          // Count total duplicate entries (entries in groups - 1 per group)
          const duplicateCount = duplicateGroups.reduce((sum, g) => sum + (g.entries.length - 1), 0);
          const duplicatePercentage = entries.length > 0 ? (duplicateCount / entries.length) * 100 : 0;
          
          results.push({
            modelName: modelInfo.model,
            totalEntries: modelInfo.total,
            sampledEntries: entries.length,
            exactDuplicates,
            nearDuplicates: [],
            duplicatePercentage: Math.round(duplicatePercentage * 10) / 10,
          });
        } catch (err) {
          console.warn(`Failed to scan ${modelInfo.model}:`, err);
          results.push({
            modelName: modelInfo.model,
            totalEntries: modelInfo.total,
            sampledEntries: 0,
            exactDuplicates: [],
            nearDuplicates: [],
            duplicatePercentage: 0,
          });
        }
      }

      setDuplicateScanResults(results);
    } catch (err) {
      setDuplicateScanError(err instanceof Error ? err.message : 'Failed to scan for duplicates');
    } finally {
      setIsDuplicateScanning(false);
    }
  }, [endpoint, token, selectedDuplicateModel, modelsWithContent]);

  // Team Activity scanning function
  // Helper to pluralize model names properly
  const pluralizeModelName = (modelName: string): string => {
    const name = modelName.charAt(0).toLowerCase() + modelName.slice(1);
    // Common pluralization rules
    if (name.endsWith('y') && !['day', 'key', 'way'].some(w => name.endsWith(w))) {
      return name.slice(0, -1) + 'ies';
    }
    if (name.endsWith('s') || name.endsWith('x') || name.endsWith('ch') || name.endsWith('sh')) {
      return name + 'es';
    }
    if (name.endsWith('f')) {
      return name.slice(0, -1) + 'ves';
    }
    if (name.endsWith('fe')) {
      return name.slice(0, -2) + 'ves';
    }
    return name + 's';
  };

  const scanTeamActivity = useCallback(async () => {
    if (!endpoint || !token) {
      setActivityScanError('Endpoint and token required for activity scanning');
      return;
    }

    setIsActivityScanning(true);
    setActivityScanError(null);

    try {
      const client = new GraphQLClient(endpoint, {
        headers: { Authorization: `Bearer ${token}` },
      });

      // Calculate date range: last 12 weeks (3 months)
      const now = new Date();
      const threeMonthsAgo = new Date(now);
      threeMonthsAgo.setDate(threeMonthsAgo.getDate() - 84); // 12 weeks
      const startDate = threeMonthsAgo.toISOString();

      // Get top models by entry count to scan
      const modelsToScan = modelsWithContent.slice(0, 10); // Top 10 models
      
      console.log('[TeamActivity] Scanning', modelsToScan.length, 'models since', startDate);
      
      // Initialize week buckets (12 weeks)
      const weeks: WeekActivity[] = [];
      for (let i = 0; i < 12; i++) {
        const weekStart = new Date(now);
        weekStart.setDate(weekStart.getDate() - (i * 7) - weekStart.getDay() + 1); // Monday of each week
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 6);
        
        const formatDate = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        
        weeks.push({
          weekStart: weekStart.toISOString().split('T')[0],
          weekLabel: `${formatDate(weekStart)} - ${formatDate(weekEnd)}`,
          modelCounts: {},
          total: 0,
        });
      }

      const modelTotals: Record<string, number> = {};
      const errors: string[] = [];

      for (const modelInfo of modelsToScan) {
        const pluralApiId = pluralizeModelName(modelInfo.model);
        
        // Try multiple query approaches
        const queries = [
          // Approach 1: With date filter (for content API)
          `query RecentEntries {
            ${pluralApiId}(first: 100, where: { createdAt_gte: "${startDate}" }, orderBy: createdAt_DESC, stage: DRAFT) {
              id
              createdAt
            }
          }`,
          // Approach 2: Without date filter, just get recent entries (for CDN)
          `query RecentEntries {
            ${pluralApiId}(first: 100, orderBy: createdAt_DESC) {
              id
              createdAt
            }
          }`,
        ];

        let entries: { id: string; createdAt: string }[] = [];
        let success = false;

        for (const query of queries) {
          if (success) break;
          try {
            const response = await client.request<Record<string, { id: string; createdAt: string }[]>>(query);
            entries = response[pluralApiId] || [];
            success = true;
            console.log(`[TeamActivity] ${modelInfo.model} (${pluralApiId}): ${entries.length} entries`);
          } catch (err) {
            const errorMsg = err instanceof Error ? err.message : String(err);
            console.warn(`[TeamActivity] Query failed for ${modelInfo.model}:`, errorMsg);
          }
        }

        if (!success) {
          errors.push(modelInfo.model);
          continue;
        }

        // Filter to entries within date range (client-side filter for CDN endpoint)
        const threeMonthsAgoDate = new Date(startDate);
        const recentEntries = entries.filter(e => new Date(e.createdAt) >= threeMonthsAgoDate);
        
        modelTotals[modelInfo.model] = recentEntries.length;

        // Bucket entries into weeks
        for (const entry of recentEntries) {
          const createdAt = new Date(entry.createdAt);
          
          for (const week of weeks) {
            const weekStartDate = new Date(week.weekStart);
            const weekEndDate = new Date(weekStartDate);
            weekEndDate.setDate(weekEndDate.getDate() + 7);
            
            if (createdAt >= weekStartDate && createdAt < weekEndDate) {
              week.modelCounts[modelInfo.model] = (week.modelCounts[modelInfo.model] || 0) + 1;
              week.total++;
              break;
            }
          }
        }
      }

      // Calculate totals and find peak week
      const totalEntries = weeks.reduce((sum, w) => sum + w.total, 0);
      const peakWeek = weeks.reduce((peak, w) => w.total > peak.count ? { label: w.weekLabel, count: w.total } : peak, { label: '', count: 0 });
      
      // Get top 5 most active models
      const topModels = Object.entries(modelTotals)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([model]) => model);

      console.log('[TeamActivity] Results:', { totalEntries, topModels, errors });

      if (errors.length > 0 && totalEntries === 0) {
        setActivityScanError(`Could not query models: ${errors.join(', ')}. Check API permissions.`);
      }

      setTeamActivityData({
        weeks: weeks.reverse(), // Oldest first
        topModels,
        totalEntries,
        peakWeek,
        modelTotals,
      });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to scan team activity';
      console.error('[TeamActivity] Error:', errorMsg);
      setActivityScanError(errorMsg);
    } finally {
      setIsActivityScanning(false);
    }
  }, [endpoint, token, modelsWithContent]);

  if (!data) {
    return (
      <div className="card p-8 text-center">
        <p className="text-muted-foreground">Business value analysis not available.</p>
      </div>
    );
  }

  const { editorExperience, contentCost } = data;
  
  // Build cost per model from actual content distribution + editor experience data
  const computedCostModels = useMemo(() => {
    const contentDist = result.comprehensiveAssessment.contentArchitecture.contentDistribution;
    
    return contentDist
      .filter(cd => cd.total > 0)
      .map(cd => {
        // Find matching editor experience data
        const editorModel = editorExperienceModels.find(m => m.modelName === cd.model);
        const timePerEntry = editorModel?.timeMinutes || 3; // Default 3 min if not found
        const costPerEntry = (timePerEntry / 60) * hourlyRate;
        const totalCost = costPerEntry * cd.total;
        
        return {
          modelName: cd.model,
          entryCount: cd.total,
          timePerEntryMinutes: Math.round(timePerEntry * 10) / 10,
          costPerEntry: Math.round(costPerEntry * 100) / 100,
          totalCost: Math.round(totalCost),
          complexity: editorModel?.complexity || 'moderate' as const,
        };
      })
      .sort((a, b) => b.totalCost - a.totalCost);
  }, [result.comprehensiveAssessment.contentArchitecture.contentDistribution, editorExperienceModels, hourlyRate]);

  // Computed totals
  const computedTotalEntries = computedCostModels.reduce((sum, m) => sum + m.entryCount, 0);
  const computedTotalCost = computedCostModels.reduce((sum, m) => sum + m.totalCost, 0);

  // Efficiency metrics calculations (must be after computedTotalEntries/computedTotalCost)
  const efficiencyMetrics = useMemo(() => {
    // Content velocity (entries per week, estimated)
    const contentVelocity = Math.round(computedTotalEntries / 52); // Assume ~1 year of content
    
    // Utilization rate (entries vs expected capacity - 100 entries per active model as baseline)
    const utilizationRate = modelOverviewData.length > 0 
      ? Math.min(100, Math.round((computedTotalEntries / (modelOverviewData.length * 100)) * 100))
      : 0;
    
    // Freshness score: derive from average days since update (lower = fresher = better)
    // Score: 100 if avg 0 days, 0 if avg 365+ days
    const avgDaysSinceUpdate = result.insights.contentFreshness?.models
      .filter(m => m.daysSinceUpdate >= 0)
      .reduce((sum, m, _, arr) => sum + m.daysSinceUpdate / arr.length, 0) || 180;
    const freshnessScore = Math.max(0, Math.round(100 - (avgDaysSinceUpdate / 365) * 100));
    
    // Productivity Score: weighted combination
    const productivityScore = Math.round(
      (freshnessScore * 0.4) + 
      ((100 - editorAverages.avgCognitiveLoad) * 0.3) +
      (utilizationRate * 0.3)
    );
    
    // Ghost models cost
    const ghostModels = modelOverviewData.filter(m => m.entries === 0);
    const ghostModelCost = ghostModels.length * 2 * hourlyRate; // ~2 hours setup per model
    
    // Over-engineered models
    const overEngineeredModels = modelOverviewData.filter(m => m.fields > 10 && m.entries < 10);
    const overEngineeredCost = overEngineeredModels.reduce((sum, m) => 
      sum + Math.round((m.fields - 5) * 0.25 * hourlyRate), 0);
    
    // Duplicate waste from scans
    const duplicateWaste = rankedDuplicateResults.reduce((sum, r) => sum + (r.wastedEffort || 0), 0);
    
    // Total waste
    const totalWaste = ghostModelCost + overEngineeredCost + duplicateWaste;
    
    // ROI calculation
    const roiRatio = totalWaste > 0 ? Math.round(computedTotalCost / totalWaste) : 999;
    const roiLabel = roiRatio > 20 ? 'Excellent' : roiRatio > 10 ? 'Good' : roiRatio > 5 ? 'Fair' : 'Needs Attention';
    
    // Waste percentage
    const wastePercent = computedTotalCost > 0 ? Math.round((totalWaste / computedTotalCost) * 100) : 0;
    
    return {
      contentVelocity,
      utilizationRate,
      freshnessScore,
      productivityScore,
      ghostModels,
      ghostModelCost,
      overEngineeredModels,
      overEngineeredCost,
      duplicateWaste,
      totalWaste,
      roiRatio,
      roiLabel,
      wastePercent,
    };
  }, [computedTotalEntries, computedTotalCost, modelOverviewData, result.insights.contentFreshness, editorAverages.avgCognitiveLoad, rankedDuplicateResults, hourlyRate]);
  
  const displayedCostModels = showAllCostModels 
    ? computedCostModels 
    : computedCostModels.slice(0, 10);
    
  const displayedOverviewModels = showAllOverviewModels
    ? sortedModelOverview
    : sortedModelOverview.slice(0, 15);

  const getComplexityColor = (score: number) => {
    if (score <= 25) return 'text-green-400 bg-green-500/20';
    if (score <= 50) return 'text-yellow-400 bg-yellow-500/20';
    if (score <= 75) return 'text-orange-400 bg-orange-500/20';
    return 'text-red-400 bg-red-500/20';
  };

  const getDuplicatePercentageColor = (pct: number) => {
    if (pct <= 5) return 'text-green-400';
    if (pct <= 15) return 'text-yellow-400';
    if (pct <= 30) return 'text-orange-400';
    return 'text-red-400';
  };

  const SortHeader = ({ column, label }: { column: SortColumn; label: string }) => (
    <th 
      className="py-3 px-3 font-medium text-muted-foreground cursor-pointer hover:text-white transition-colors select-none"
      onClick={() => handleSort(column)}
    >
      <div className="flex items-center justify-end gap-1">
        {label}
        <span className="text-xs">
          {sortColumn === column ? (sortDirection === 'asc' ? '↑' : '↓') : '↕'}
        </span>
      </div>
    </th>
  );

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-3">
            <span className="text-3xl">💰</span>
            Business Value Analysis
          </h2>
          <p className="text-muted-foreground mt-1">
            Editor efficiency, content creation costs, and ROI insights
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowExecutiveReport(true)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors font-medium"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Generate Report
          </button>
          <div className={`px-4 py-2 rounded-full text-lg font-bold ${
            data.overallScore >= 70 ? 'text-green-400 bg-green-500/20' :
            data.overallScore >= 50 ? 'text-yellow-400 bg-yellow-500/20' : 
            'text-red-400 bg-red-500/20'
          }`}>
            {data.overallScore}%
          </div>
        </div>
      </div>

      {/* Project Intelligence Section */}
      {projectIntelligence && (
        <section className="card p-6 border-indigo-500/30 bg-gradient-to-br from-indigo-500/5 to-purple-500/5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <span>🎯</span> Project Intelligence
            </h3>
            <span className="text-xs text-muted-foreground">
              Analyzed: {new Date(projectIntelligence.analyzedAt).toLocaleTimeString()}
            </span>
          </div>
          
          {/* Intelligence Cards Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            {/* Lifecycle Stage */}
            <div className="card p-3 text-center border-blue-500/30 bg-blue-500/10">
              <div className="text-2xl mb-1">📍</div>
              <div className="text-lg font-bold text-blue-400">
                {getStageDisplayName(projectIntelligence.lifecycle.stage)}
              </div>
              <div className="text-xs text-blue-300">Stage</div>
              <div className="text-xs text-muted-foreground mt-1">
                {projectIntelligence.lifecycle.confidence} confidence
              </div>
            </div>
            
            {/* Content Readiness */}
            <div className={`card p-3 text-center ${
              projectIntelligence.contentReadiness.productionPercent >= 80 
                ? 'border-green-500/30 bg-green-500/10' 
                : projectIntelligence.contentReadiness.productionPercent >= 60
                ? 'border-yellow-500/30 bg-yellow-500/10'
                : 'border-orange-500/30 bg-orange-500/10'
            }`}>
              <div className="text-2xl mb-1">🎯</div>
              <div className={`text-lg font-bold ${
                projectIntelligence.contentReadiness.productionPercent >= 80 
                  ? 'text-green-400' 
                  : projectIntelligence.contentReadiness.productionPercent >= 60
                  ? 'text-yellow-400'
                  : 'text-orange-400'
              }`}>
                {projectIntelligence.contentReadiness.productionPercent}%
              </div>
              <div className={`text-xs ${
                projectIntelligence.contentReadiness.productionPercent >= 80 
                  ? 'text-green-300' 
                  : projectIntelligence.contentReadiness.productionPercent >= 60
                  ? 'text-yellow-300'
                  : 'text-orange-300'
              }`}>Prod-Ready</div>
              <div className="text-xs text-muted-foreground mt-1">
                {projectIntelligence.contentReadiness.testCount} test entries
              </div>
            </div>
            
            {/* Schema Health */}
            <div className={`card p-3 text-center ${
              projectIntelligence.schemaHealth.score >= 80 
                ? 'border-green-500/30 bg-green-500/10' 
                : projectIntelligence.schemaHealth.score >= 60
                ? 'border-yellow-500/30 bg-yellow-500/10'
                : 'border-orange-500/30 bg-orange-500/10'
            }`}>
              <div className="text-2xl mb-1">💚</div>
              <div className={`text-lg font-bold ${
                projectIntelligence.schemaHealth.score >= 80 
                  ? 'text-green-400' 
                  : projectIntelligence.schemaHealth.score >= 60
                  ? 'text-yellow-400'
                  : 'text-orange-400'
              }`}>
                {projectIntelligence.schemaHealth.score}/100
              </div>
              <div className={`text-xs ${
                projectIntelligence.schemaHealth.score >= 80 
                  ? 'text-green-300' 
                  : projectIntelligence.schemaHealth.score >= 60
                  ? 'text-yellow-300'
                  : 'text-orange-300'
              }`}>Health</div>
              <div className="text-xs text-muted-foreground mt-1">
                {getHealthStatus(projectIntelligence.schemaHealth.score).label}
              </div>
            </div>
            
            {/* Friction */}
            <div className={`card p-3 text-center ${
              projectIntelligence.friction.score >= 80 
                ? 'border-green-500/30 bg-green-500/10' 
                : projectIntelligence.friction.score >= 60
                ? 'border-yellow-500/30 bg-yellow-500/10'
                : 'border-red-500/30 bg-red-500/10'
            }`}>
              <div className="text-2xl mb-1">🔍</div>
              <div className={`text-lg font-bold ${
                projectIntelligence.friction.score >= 80 
                  ? 'text-green-400' 
                  : projectIntelligence.friction.score >= 60
                  ? 'text-yellow-400'
                  : 'text-red-400'
              }`}>
                {projectIntelligence.friction.totalSignals}
              </div>
              <div className={`text-xs ${
                projectIntelligence.friction.score >= 80 
                  ? 'text-green-300' 
                  : projectIntelligence.friction.score >= 60
                  ? 'text-yellow-300'
                  : 'text-red-300'
              }`}>Friction Signals</div>
              <div className="text-xs text-muted-foreground mt-1">
                {getFrictionStatus(projectIntelligence.friction.score).label}
              </div>
            </div>
          </div>
          
          {/* Top Contributors Section */}
          <div className="border-t border-slate-700 pt-4 mt-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span>👥</span>
                <span className="font-medium text-slate-200">Top Contributors</span>
                <span className="text-xs text-muted-foreground">(Last 3 Months)</span>
              </div>
              {!contributorsData && (
                <button
                  onClick={scanForContributors}
                  disabled={isContributorScanning || !endpoint || !token}
                  className="px-3 py-1.5 text-xs bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-lg transition-colors"
                >
                  {isContributorScanning ? 'Scanning...' : 'Scan Activity'}
                </button>
              )}
            </div>
            
            {contributorScanError && (
              <div className="text-xs text-red-400 mb-2">{contributorScanError}</div>
            )}
            
            {!contributorsData && !isContributorScanning && (
              <div className="text-sm text-muted-foreground">
                Click "Scan Activity" to identify top contributors
              </div>
            )}
            
            {contributorsData && contributorsData.top3.length > 0 && (
              <div className="space-y-2">
                {contributorsData.top3.map((contributor, i) => (
                  <div key={contributor.id} className="flex items-center gap-3 p-2 rounded-lg bg-slate-800/50">
                    <div className="w-6 h-6 rounded-full bg-indigo-500/30 flex items-center justify-center text-xs font-bold text-indigo-300">
                      {i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-white truncate">{contributor.name}</div>
                      {contributor.email && (
                        <div className="text-xs text-muted-foreground truncate">{contributor.email}</div>
                      )}
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-medium text-indigo-400">{contributor.totalEntries} entries</div>
                      <div className="text-xs text-muted-foreground">
                        {contributor.focusAreas.slice(0, 2).map(f => f.model).join(', ')}
                      </div>
                    </div>
                  </div>
                ))}
                <div className="text-xs text-muted-foreground mt-2">
                  Total: {contributorsData.totalContributors} contributors, {contributorsData.totalEntries} entries
                </div>
              </div>
            )}
            
            {contributorsData && contributorsData.top3.length === 0 && (
              <div className="text-sm text-muted-foreground">
                No contributor data available (createdBy/updatedBy fields may not be exposed)
              </div>
            )}
          </div>
          
          {/* Friction Signals */}
          {projectIntelligence.friction.signals.length > 0 && (
            <div className="border-t border-slate-700 pt-4 mt-4">
              <div className="flex items-center gap-2 mb-3">
                <span>⚠️</span>
                <span className="font-medium text-slate-200">Friction Detected</span>
              </div>
              <div className="space-y-2">
                {projectIntelligence.friction.signals.slice(0, 3).map((signal) => (
                  <div 
                    key={signal.id} 
                    className={`p-3 rounded-lg ${
                      signal.severity === 'critical' || signal.severity === 'high'
                        ? 'bg-red-500/10 border border-red-500/30'
                        : signal.severity === 'medium'
                        ? 'bg-yellow-500/10 border border-yellow-500/30'
                        : 'bg-slate-800/50 border border-slate-700'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className={`text-xs px-2 py-0.5 rounded ${
                            signal.severity === 'critical' || signal.severity === 'high'
                              ? 'bg-red-500/20 text-red-300'
                              : signal.severity === 'medium'
                              ? 'bg-yellow-500/20 text-yellow-300'
                              : 'bg-slate-500/20 text-slate-300'
                          }`}>
                            {signal.severity.toUpperCase()}
                          </span>
                          <span className="font-medium text-white">{signal.name}</span>
                        </div>
                        <div className="text-sm text-slate-300 mt-1">{signal.description}</div>
                        <div className="text-xs text-muted-foreground mt-1">
                          💡 {signal.recommendation}
                        </div>
                      </div>
                      {signal.estimatedWaste && signal.estimatedWaste > 0 && (
                        <div className="text-right ml-4">
                          <div className="text-sm font-medium text-red-400">
                            ~${signal.estimatedWaste.toLocaleString()}
                          </div>
                          <div className="text-xs text-muted-foreground">waste</div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* Quick Actions */}
          {projectIntelligence.quickActions.length > 0 && (
            <div className="border-t border-slate-700 pt-4 mt-4">
              <div className="flex items-center gap-2 mb-3">
                <span>📋</span>
                <span className="font-medium text-slate-200">Quick Actions</span>
              </div>
              <ul className="space-y-1">
                {projectIntelligence.quickActions.map((action, i) => (
                  <li key={i} className="text-sm text-slate-300 flex items-start gap-2">
                    <span className="text-indigo-400">•</span>
                    {action}
                  </li>
                ))}
              </ul>
            </div>
          )}
          
          {/* Executive Summary */}
          <div className="border-t border-slate-700 pt-4 mt-4">
            <div className="flex items-center gap-2 mb-2">
              <span>💡</span>
              <span className="font-medium text-slate-200">Summary</span>
            </div>
            <p className="text-sm text-slate-300 leading-relaxed">
              {projectIntelligence.executiveSummary}
            </p>
          </div>
          
          {/* Methodology Toggle */}
          <details className="border-t border-slate-700 pt-4 mt-4">
            <summary className="text-xs text-muted-foreground cursor-pointer hover:text-white transition-colors">
              How are these metrics calculated?
            </summary>
            <div className="mt-3 space-y-3 text-xs text-slate-400">
              <div>
                <strong className="text-blue-400">Lifecycle Stage:</strong> Based on ghost model ratio ({(projectIntelligence.lifecycle.metrics.ghostModelRatio * 100).toFixed(0)}%), 
                draft ratio ({(projectIntelligence.lifecycle.metrics.draftRatio * 100).toFixed(0)}%), 
                and entries per model ({projectIntelligence.lifecycle.metrics.entriesPerModel.toFixed(1)}).
              </div>
              <div>
                <strong className="text-green-400">Content Readiness:</strong> Scans for test patterns (test, demo, lorem, sample) in entry names and draft status.
              </div>
              <div>
                <strong className="text-purple-400">Schema Health:</strong> Weighted average of naming consistency ({projectIntelligence.schemaHealth.breakdown.namingConsistency.score}%), 
                documentation ({projectIntelligence.schemaHealth.breakdown.documentation.score}%), 
                ghost models ({projectIntelligence.schemaHealth.breakdown.ghostModels.score}%), 
                component reuse ({projectIntelligence.schemaHealth.breakdown.componentReuse.score}%), 
                and relation hygiene ({projectIntelligence.schemaHealth.breakdown.relationHygiene.score}%).
              </div>
              <div>
                <strong className="text-red-400">Friction Score:</strong> Starts at 100, deducts points per signal: critical (-25), high (-15), medium (-8), low (-3).
              </div>
            </div>
          </details>
        </section>
      )}

      {/* Core Metrics Row 1 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card p-4 text-center border-green-500/30 bg-green-500/10">
          <div className="text-3xl font-bold text-green-400">
            ${computedTotalCost.toLocaleString()}
          </div>
          <div className="text-sm text-green-300">Total Content Value</div>
          <div className="text-xs text-muted-foreground mt-1">{computedTotalEntries.toLocaleString()} entries</div>
        </div>
        <div className="card p-4 text-center border-blue-500/30 bg-blue-500/10">
          <div className="text-3xl font-bold text-blue-400">
            {computedTotalEntries.toLocaleString()}
          </div>
          <div className="text-sm text-blue-300">Total Entries</div>
          <div className="text-xs text-muted-foreground mt-1">across {computedCostModels.length} models</div>
        </div>
        <div className="card p-4 text-center border-purple-500/30 bg-purple-500/10">
          <div className="text-3xl font-bold text-purple-400">
            {modelOverviewData.filter(m => m.entries > 0).length}
          </div>
          <div className="text-sm text-purple-300">Models with Content</div>
          <div className="text-xs text-muted-foreground mt-1">{modelOverviewData.filter(m => m.entries === 0).length} empty</div>
        </div>
        <div className="card p-4 text-center border-orange-500/30 bg-orange-500/10">
          <div className="text-3xl font-bold text-orange-400">
            {editorAverages.avgTime.toFixed(1)}m
          </div>
          <div className="text-sm text-orange-300">Avg. Time/Entry</div>
          <div className="text-xs text-muted-foreground mt-1">{editorAverages.avgClicks} clicks avg</div>
        </div>
      </div>

      {/* Efficiency Metrics Row 2 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className={`card p-4 text-center ${
          efficiencyMetrics.productivityScore >= 70 ? 'border-green-500/30 bg-green-500/10' :
          efficiencyMetrics.productivityScore >= 50 ? 'border-yellow-500/30 bg-yellow-500/10' :
          'border-red-500/30 bg-red-500/10'
        }`}>
          <div className={`text-3xl font-bold ${
            efficiencyMetrics.productivityScore >= 70 ? 'text-green-400' :
            efficiencyMetrics.productivityScore >= 50 ? 'text-yellow-400' :
            'text-red-400'
          }`}>
            {efficiencyMetrics.productivityScore}
          </div>
          <div className={`text-sm ${
            efficiencyMetrics.productivityScore >= 70 ? 'text-green-300' :
            efficiencyMetrics.productivityScore >= 50 ? 'text-yellow-300' :
            'text-red-300'
          }`}>Productivity Score</div>
          <div className="text-xs text-muted-foreground mt-1">out of 100</div>
        </div>
        <div className="card p-4 text-center border-cyan-500/30 bg-cyan-500/10">
          <div className="text-3xl font-bold text-cyan-400">
            {efficiencyMetrics.contentVelocity}
          </div>
          <div className="text-sm text-cyan-300">Content Velocity</div>
          <div className="text-xs text-muted-foreground mt-1">entries/week avg</div>
        </div>
        <div className={`card p-4 text-center ${
          efficiencyMetrics.totalWaste > 1000 ? 'border-red-500/30 bg-red-500/10' :
          efficiencyMetrics.totalWaste > 500 ? 'border-orange-500/30 bg-orange-500/10' :
          'border-green-500/30 bg-green-500/10'
        }`}>
          <div className={`text-3xl font-bold ${
            efficiencyMetrics.totalWaste > 1000 ? 'text-red-400' :
            efficiencyMetrics.totalWaste > 500 ? 'text-orange-400' :
            'text-green-400'
          }`}>
            ${efficiencyMetrics.totalWaste.toLocaleString()}
          </div>
          <div className={`text-sm ${
            efficiencyMetrics.totalWaste > 1000 ? 'text-red-300' :
            efficiencyMetrics.totalWaste > 500 ? 'text-orange-300' :
            'text-green-300'
          }`}>Waste Estimate</div>
          <div className="text-xs text-muted-foreground mt-1">{efficiencyMetrics.wastePercent}% of value</div>
        </div>
        <div className={`card p-4 text-center ${
          efficiencyMetrics.roiRatio >= 20 ? 'border-green-500/30 bg-green-500/10' :
          efficiencyMetrics.roiRatio >= 10 ? 'border-yellow-500/30 bg-yellow-500/10' :
          'border-red-500/30 bg-red-500/10'
        }`}>
          <div className={`text-3xl font-bold ${
            efficiencyMetrics.roiRatio >= 20 ? 'text-green-400' :
            efficiencyMetrics.roiRatio >= 10 ? 'text-yellow-400' :
            'text-red-400'
          }`}>
            {efficiencyMetrics.roiRatio > 100 ? '99+' : efficiencyMetrics.roiRatio}:1
          </div>
          <div className={`text-sm ${
            efficiencyMetrics.roiRatio >= 20 ? 'text-green-300' :
            efficiencyMetrics.roiRatio >= 10 ? 'text-yellow-300' :
            'text-red-300'
          }`}>ROI Ratio</div>
          <div className="text-xs text-muted-foreground mt-1">{efficiencyMetrics.roiLabel}</div>
        </div>
      </div>

      {/* Quick Insights Summary */}
      <div className="card p-4 border-slate-500/30 bg-slate-800/30">
        <div className="flex items-start gap-3">
          <span className="text-2xl">💡</span>
          <div className="space-y-2 text-sm">
            <p className="text-slate-200">
              Your content is worth <strong className="text-green-400">${computedTotalCost.toLocaleString()}</strong> based on {computedTotalEntries.toLocaleString()} entries across {computedCostModels.length} active models.
            </p>
            {efficiencyMetrics.wastePercent > 0 && (
              <p className="text-slate-200">
                <strong className="text-orange-400">{efficiencyMetrics.wastePercent}%</strong> potential waste from {efficiencyMetrics.ghostModels.length} ghost model{efficiencyMetrics.ghostModels.length !== 1 ? 's' : ''} and {efficiencyMetrics.overEngineeredModels.length} over-engineered model{efficiencyMetrics.overEngineeredModels.length !== 1 ? 's' : ''}.
              </p>
            )}
            <p className="text-slate-200">
              ROI is <strong className={
                efficiencyMetrics.roiRatio >= 20 ? 'text-green-400' :
                efficiencyMetrics.roiRatio >= 10 ? 'text-yellow-400' :
                'text-red-400'
              }>{efficiencyMetrics.roiRatio > 100 ? '99+' : efficiencyMetrics.roiRatio}:1</strong> — {efficiencyMetrics.roiLabel} (industry benchmark: 5:1).
            </p>
            <p className="text-slate-200">
              Content velocity: <strong className="text-cyan-400">{efficiencyMetrics.contentVelocity}/week</strong> ({efficiencyMetrics.contentVelocity > 10 ? 'high' : efficiencyMetrics.contentVelocity > 3 ? 'moderate' : 'low'} activity).
            </p>
          </div>
        </div>
      </div>

      {/* Methodology Section */}
      <details className="card border-slate-500/30">
        <summary className="p-4 cursor-pointer text-sm font-medium text-slate-300 hover:text-white transition-colors flex items-center gap-2">
          <span>📊</span> How are these metrics calculated?
        </summary>
        <div className="px-4 pb-4 space-y-4 text-xs font-mono bg-slate-900/50 border-t border-slate-700">
          {/* Total Content Value */}
          <div className="pt-4">
            <div className="text-green-400 font-bold mb-1">TOTAL CONTENT VALUE</div>
            <div className="text-slate-400 space-y-1">
              <div>= Sum of (Entries × Time per Entry × Hourly Rate) for each model</div>
              {computedCostModels.slice(0, 3).map((m, i) => (
                <div key={i} className="pl-2 text-slate-500">
                  {i === 0 && '= ('}{m.modelName}: {m.entryCount} × {m.timePerEntryMinutes}m × ${hourlyRate}/hr{i < Math.min(2, computedCostModels.length - 1) ? ') + ...' : ')'}
                </div>
              ))}
              <div className="text-green-400 pl-2">= ${computedTotalCost.toLocaleString()}</div>
            </div>
          </div>

          {/* Productivity Score */}
          <div>
            <div className="text-purple-400 font-bold mb-1">PRODUCTIVITY SCORE (0-100)</div>
            <div className="text-slate-400 space-y-1">
              <div>= (Freshness Score × 40%) + ((100 - Cognitive Load) × 30%) + (Utilization Rate × 30%)</div>
              <div className="pl-2 text-slate-500">
                = ({efficiencyMetrics.freshnessScore} × 0.4) + ((100 - {editorAverages.avgCognitiveLoad}) × 0.3) + ({efficiencyMetrics.utilizationRate} × 0.3)
              </div>
              <div className="text-purple-400 pl-2">= {efficiencyMetrics.productivityScore}</div>
            </div>
          </div>

          {/* Waste Estimate */}
          <div>
            <div className="text-red-400 font-bold mb-1">WASTE ESTIMATE</div>
            <div className="text-slate-400 space-y-1">
              <div>= Ghost Models + Over-engineered + Duplicate Content</div>
              <div className="pl-2 text-slate-500">
                = ({efficiencyMetrics.ghostModels.length} models × 2hr × ${hourlyRate}/hr) + ${efficiencyMetrics.overEngineeredCost} + ${efficiencyMetrics.duplicateWaste}
              </div>
              <div className="pl-2 text-slate-500">
                = ${efficiencyMetrics.ghostModelCost} + ${efficiencyMetrics.overEngineeredCost} + ${efficiencyMetrics.duplicateWaste}
              </div>
              <div className="text-red-400 pl-2">= ${efficiencyMetrics.totalWaste.toLocaleString()}</div>
            </div>
          </div>

          {/* ROI Ratio */}
          <div>
            <div className="text-cyan-400 font-bold mb-1">ROI RATIO</div>
            <div className="text-slate-400 space-y-1">
              <div>= Total Content Value ÷ Waste Estimate</div>
              <div className="pl-2 text-slate-500">
                = ${computedTotalCost.toLocaleString()} ÷ ${efficiencyMetrics.totalWaste.toLocaleString()}
              </div>
              <div className="text-cyan-400 pl-2">= {efficiencyMetrics.roiRatio > 100 ? '99+' : efficiencyMetrics.roiRatio}:1 ({efficiencyMetrics.roiLabel})</div>
            </div>
          </div>

          {/* Content Velocity */}
          <div className="pb-2">
            <div className="text-blue-400 font-bold mb-1">CONTENT VELOCITY</div>
            <div className="text-slate-400 space-y-1">
              <div>= Total Entries ÷ 52 weeks (estimated annual production)</div>
              <div className="pl-2 text-slate-500">
                = {computedTotalEntries.toLocaleString()} ÷ 52
              </div>
              <div className="text-blue-400 pl-2">= {efficiencyMetrics.contentVelocity} entries/week</div>
            </div>
          </div>
        </div>
      </details>

      {/* Model Overview Table */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <span>📋</span> Model Overview
          </h3>
          <button
            onClick={exportCSV}
            className="flex items-center gap-2 px-3 py-1.5 text-sm bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors"
          >
            Export CSV ⬇️
          </button>
        </div>
        
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-800/50">
                <tr>
                  <th 
                    className="text-left py-3 px-4 font-medium text-muted-foreground cursor-pointer hover:text-white transition-colors"
                    onClick={() => handleSort('name')}
                  >
                    <div className="flex items-center gap-1">
                      Model
                      <span className="text-xs">
                        {sortColumn === 'name' ? (sortDirection === 'asc' ? '↑' : '↓') : '↕'}
                      </span>
                    </div>
                  </th>
                  <SortHeader column="fields" label="Fields" />
                  <SortHeader column="relations" label="Relations" />
                  <SortHeader column="assets" label="Assets" />
                  <SortHeader column="richText" label="Rich Text" />
                  <SortHeader column="enums" label="Enums" />
                  <SortHeader column="components" label="Components" />
                  <SortHeader column="locales" label="Locales" />
                  <SortHeader column="entries" label="Entries" />
                  <SortHeader column="complexity" label="Complex" />
                </tr>
              </thead>
              <tbody>
                {displayedOverviewModels.map((model) => (
                  <>
                    <tr 
                      key={model.name}
                      className={`border-t border-border hover:bg-slate-800/30 cursor-pointer transition-colors ${
                        expandedOverviewRow === model.name ? 'bg-slate-800/40' : ''
                      } ${model.entries === 0 ? 'opacity-50' : ''}`}
                      onClick={() => setExpandedOverviewRow(expandedOverviewRow === model.name ? null : model.name)}
                    >
                      <td className="py-3 px-4 font-medium text-white">
                        <div className="flex items-center gap-2">
                          {model.name}
                          {model.entries === 0 && (
                            <span className="text-xs text-muted-foreground">(empty)</span>
                          )}
                          <span className="text-muted-foreground text-xs">
                            {expandedOverviewRow === model.name ? '▼' : '▶'}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-right text-slate-300">{model.fields}</td>
                      <td className="py-3 px-3 text-right text-slate-300">{model.relations}</td>
                      <td className="py-3 px-3 text-right text-slate-300">{model.assets}</td>
                      <td className="py-3 px-3 text-right text-slate-300">{model.richText}</td>
                      <td className="py-3 px-3 text-right text-slate-300">{model.enums}</td>
                      <td className="py-3 px-3 text-right text-slate-300">{model.components}</td>
                      <td className="py-3 px-3 text-right text-slate-300">
                        {model.locales > 0 ? model.locales : '—'}
                      </td>
                      <td className={`py-3 px-3 text-right font-medium ${model.entries === 0 ? 'text-muted-foreground' : 'text-white'}`}>
                        {model.entries.toLocaleString()}
                      </td>
                      <td className="py-3 px-3 text-right">
                        <span className={`px-2 py-1 rounded text-xs font-bold ${getComplexityColor(model.complexity)}`}>
                          {model.complexity}
                        </span>
                      </td>
                    </tr>
                    {/* Expanded row details */}
                    {expandedOverviewRow === model.name && (
                      <tr key={`${model.name}-detail`} className="bg-slate-800/20">
                        <td colSpan={9} className="py-4 px-6">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                            <div className="space-y-2">
                              <div className="text-muted-foreground text-xs uppercase">Model Details</div>
                              <div className="text-slate-300">
                                <span className="text-muted-foreground">Total Fields:</span> {model.fields}
                                {model.relations > 0 && (
                                  <span className="ml-3">
                                    <span className="text-muted-foreground">Relations:</span> {model.relations}
                                  </span>
                                )}
                              </div>
                              {model.richText > 0 && (
                                <div className="text-slate-300">
                                  <span className="text-muted-foreground">Rich Text Fields:</span> {model.richText}
                                </div>
                              )}
                              {model.enums > 0 && (
                                <div className="text-slate-300">
                                  <span className="text-muted-foreground">Enum Fields:</span> {model.enums}
                                </div>
                              )}
                              {model.components > 0 && (
                                <div className="text-slate-300">
                                  <span className="text-muted-foreground">Component Fields:</span> {model.components}
                                </div>
                              )}
                            </div>
                            <div className="space-y-2">
                              <div className="text-muted-foreground text-xs uppercase">Complexity Analysis</div>
                              <div className={getComplexityLevel(model.complexity).color}>
                                Level: {getComplexityLevel(model.complexity).label}
                              </div>
                              <div className="text-slate-300">
                                <span className="text-muted-foreground">Score:</span> {model.complexity}/100
                              </div>
                              {model.complexity > 60 && (
                                <div className="text-yellow-400 text-xs mt-2">
                                  ⚠️ Consider simplifying this model to improve editor experience
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
                {/* Totals Row */}
                <tr className="border-t-2 border-border bg-slate-800/30 font-medium">
                  <td className="py-3 px-4 text-white">TOTAL</td>
                  <td className="py-3 px-3 text-right text-white">{totals.fields}</td>
                  <td className="py-3 px-3 text-right text-white">{totals.relations}</td>
                  <td className="py-3 px-3 text-right text-white">{totals.assets}</td>
                  <td className="py-3 px-3 text-right text-white">{totals.richText}</td>
                  <td className="py-3 px-3 text-right text-white">{totals.enums}</td>
                  <td className="py-3 px-3 text-right text-white">{totals.components}</td>
                  <td className="py-3 px-3 text-right text-muted-foreground">—</td>
                  <td className="py-3 px-3 text-right text-white">{totals.entries.toLocaleString()}</td>
                  <td className="py-3 px-3 text-right text-muted-foreground">—</td>
                </tr>
              </tbody>
            </table>
          </div>
          
          {/* Combined Complexity Summary */}
          <div className="p-4 border-t border-border bg-slate-800/20">
            <div className="flex flex-wrap gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Combined Complexity:</span>{' '}
                <span className={`font-bold ${getComplexityLevel(combinedComplexity).color}`}>
                  {combinedComplexity}/100 ({getComplexityLevel(combinedComplexity).label})
                </span>
              </div>
              <div className="text-muted-foreground">|</div>
              <div>
                <span className="text-muted-foreground">Schema Size:</span>{' '}
                <span className="text-white">{modelOverviewData.length} models, {totals.fields} fields</span>
              </div>
              <div className="text-muted-foreground">|</div>
              <div>
                <span className="text-muted-foreground">Heaviest Models:</span>{' '}
                <span className="text-orange-400">{heaviestModels.join(', ')}</span>
              </div>
            </div>
          </div>
          
          {sortedModelOverview.length > 15 && (
            <div className="p-3 border-t border-border">
              <button
                onClick={() => setShowAllOverviewModels(!showAllOverviewModels)}
                className="text-sm text-purple-400 hover:text-purple-300"
              >
                {showAllOverviewModels ? 'Show less' : `Show all ${sortedModelOverview.length} models`}
              </button>
            </div>
          )}
        </div>
      </section>

      {/* Editor Experience - Model-by-Model Analysis Table */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <span>⏱️</span> Editor Experience by Model
          </h3>
          <span className="text-xs text-muted-foreground">Sorted by time (longest first)</span>
        </div>

        {worstEditorModels.length > 0 && (
          <div className="card p-4 mb-4 border-amber-500/30 bg-amber-500/10">
            <div className="flex items-start gap-2">
              <span className="text-amber-400">⚠️</span>
              <div>
                <div className="font-medium text-amber-300">Models Needing Attention</div>
                <div className="text-sm text-amber-200/80 mt-1">
                  {worstEditorModels.join(', ')} - High cognitive load may frustrate editors
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Methodology Card */}
        <details className="card p-4 mb-4 border-slate-500/30 bg-slate-800/30">
          <summary className="cursor-pointer text-sm font-medium text-slate-300 flex items-center gap-2">
            <span>📐</span> Scoring Methodology
          </summary>
          <div className="mt-3 text-xs text-slate-400 space-y-2">
            <p><strong className="text-slate-300">Time Estimate:</strong> Base 1 minute + 12 seconds per field + 20 seconds per relation + 5 seconds per required field</p>
            <p><strong className="text-slate-300">Click Estimate:</strong> Base 5 clicks + 2 per field + 3 per relation</p>
            <p><strong className="text-slate-300">Cognitive Load (0-100):</strong> Field penalty (2 × fields, max 40) + Required penalty (3 × required, max 30) + Relation penalty (5 × relations, max 30)</p>
            <p><strong className="text-slate-300">Overall Score:</strong> 100 − Cognitive Load (higher is better)</p>
            <p><strong className="text-slate-300">Complexity:</strong> Simple (≥80), Moderate (60-79), Complex (40-59), Very Complex (&lt;40)</p>
            <p className="text-slate-500 mt-2 italic">Note: Visual Anchor assumes models have title/name fields. Naming clarity and description coverage are estimated from complexity scores.</p>
          </div>
        </details>

        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-800/50">
                <tr>
                  <th className="text-center py-3 px-2 font-medium text-muted-foreground w-10">#</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Model</th>
                  <th 
                    className="py-3 px-3 font-medium text-muted-foreground cursor-pointer hover:text-white transition-colors text-right"
                    onClick={() => handleEditorSort('timeMinutes')}
                  >
                    <div className="flex items-center justify-end gap-1">
                      Time
                      <span className="text-xs">{editorSortColumn === 'timeMinutes' ? (editorSortDirection === 'asc' ? '↑' : '↓') : '↕'}</span>
                    </div>
                  </th>
                  <th 
                    className="py-3 px-3 font-medium text-muted-foreground cursor-pointer hover:text-white transition-colors text-right"
                    onClick={() => handleEditorSort('clicks')}
                  >
                    <div className="flex items-center justify-end gap-1">
                      Clicks
                      <span className="text-xs">{editorSortColumn === 'clicks' ? (editorSortDirection === 'asc' ? '↑' : '↓') : '↕'}</span>
                    </div>
                  </th>
                  <th className="py-3 px-3 font-medium text-muted-foreground text-center">Req</th>
                  <th className="py-3 px-3 font-medium text-muted-foreground text-center">
                    <span className="text-purple-400">Multi-Rel</span>
                  </th>
                  <th className="py-3 px-3 font-medium text-muted-foreground text-center">
                    <span className="text-purple-400">Multi-Comp</span>
                  </th>
                  <th 
                    className="py-3 px-3 font-medium text-muted-foreground cursor-pointer hover:text-white transition-colors text-center"
                    onClick={() => handleEditorSort('cognitiveLoad')}
                  >
                    <div className="flex items-center justify-center gap-1">
                      Cog. Load
                      <span className="text-xs">{editorSortColumn === 'cognitiveLoad' ? (editorSortDirection === 'asc' ? '↑' : '↓') : '↕'}</span>
                    </div>
                  </th>
                  <th className="py-3 px-3 font-medium text-muted-foreground text-left text-xs">Cog. Breakdown</th>
                </tr>
              </thead>
              <tbody>
                {(showAllEditorModels ? sortedEditorModels : sortedEditorModels.slice(0, 10)).map((model) => {
                  const getCogLoadColor = (load: number) => {
                    if (load <= 30) return 'text-green-400 bg-green-500/20';
                    if (load <= 50) return 'text-yellow-400 bg-yellow-500/20';
                    if (load <= 70) return 'text-orange-400 bg-orange-500/20';
                    return 'text-red-400 bg-red-500/20';
                  };
                  const getTimeColor = (time: number) => {
                    if (time <= 3) return 'text-green-400';
                    if (time <= 6) return 'text-yellow-400';
                    if (time <= 10) return 'text-orange-400';
                    return 'text-red-400';
                  };
                  return (
                    <>
                      <tr 
                        key={model.modelName}
                        className={`border-t border-border hover:bg-slate-800/30 cursor-pointer transition-colors ${
                          expandedEditorRow === model.modelName ? 'bg-slate-800/40' : ''
                        }`}
                        onClick={() => setExpandedEditorRow(expandedEditorRow === model.modelName ? null : model.modelName)}
                      >
                        <td className="py-3 px-2 text-center text-muted-foreground font-mono text-xs">{model.rank}</td>
                        <td className="py-3 px-4 font-medium text-white">
                          <div className="flex items-center gap-2">
                            {model.modelName}
                            <span className="text-muted-foreground text-xs">{expandedEditorRow === model.modelName ? '▼' : '▶'}</span>
                          </div>
                        </td>
                        <td className={`py-3 px-3 text-right font-medium ${getTimeColor(model.timeMinutes)}`}>
                          {model.timeMinutes.toFixed(1)}m
                        </td>
                        <td className="py-3 px-3 text-right text-slate-300">{model.clicks}</td>
                        <td className="py-3 px-3 text-center text-slate-300">{model.requiredFields}</td>
                        <td className="py-3 px-3 text-center">
                          {model.multiRelationCount > 0 
                            ? <span className="text-purple-400 font-medium">{model.multiRelationCount}</span>
                            : <span className="text-slate-500">—</span>
                          }
                        </td>
                        <td className="py-3 px-3 text-center">
                          {model.multiComponentCount > 0 
                            ? <span className="text-purple-400 font-medium">{model.multiComponentCount}</span>
                            : <span className="text-slate-500">—</span>
                          }
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span className={`px-2 py-1 rounded text-xs font-bold ${getCogLoadColor(model.cognitiveLoad)}`}>
                            {model.cognitiveLoad}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-left text-xs text-slate-400">
                          <span title="Fields + Required + Relations + Rich Text + Components">
                            F:{Math.min(model.fieldCount * 2, 40)} R:{Math.min(model.requiredFields * 3, 30)} Rel:{Math.min(model.relationCount * 4, 20)} RT:{Math.min(model.richTextCount * 5, 15)} C:{Math.min(model.componentCount * 3, 15)}
                          </span>
                        </td>
                      </tr>
                      {expandedEditorRow === model.modelName && (
                        <tr key={`${model.modelName}-detail`} className="bg-slate-800/20">
                          <td colSpan={10} className="py-4 px-6">
                            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
                              <div className="space-y-1">
                                <div className="text-muted-foreground text-xs uppercase">Field Breakdown</div>
                                <div className="text-white">{model.fieldCount} total fields</div>
                                <div className="text-slate-300 text-xs">• {model.requiredFields} required</div>
                                <div className="text-slate-300 text-xs">
                                  • {model.relationCount} relations
                                  {model.multiRelationCount > 0 && <span className="text-purple-400"> ({model.multiRelationCount} multi)</span>}
                                </div>
                                <div className="text-slate-300 text-xs">• {model.assetCount} assets</div>
                                <div className="text-slate-300 text-xs">• {model.richTextCount} rich text</div>
                                <div className="text-slate-300 text-xs">• {model.enumCount} enums</div>
                                <div className="text-slate-300 text-xs">
                                  • {model.componentCount} components
                                  {model.multiComponentCount > 0 && <span className="text-purple-400"> ({model.multiComponentCount} multi)</span>}
                                </div>
                              </div>
                              <div className="space-y-1">
                                <div className="text-muted-foreground text-xs uppercase">Time Breakdown</div>
                                <div className="text-white">Base: 1m</div>
                                {model.richTextCount > 0 && <div className="text-slate-300 text-xs">Rich text: {((model.richTextCount * 90) / 60).toFixed(1)}m</div>}
                                {model.componentCount > 0 && (
                                  <div className="text-slate-300 text-xs">
                                    Components: {((((model.componentCount - model.multiComponentCount) * 45) + (model.multiComponentCount * 120)) / 60).toFixed(1)}m
                                    {model.multiComponentCount > 0 && <span className="text-purple-400"> ({model.multiComponentCount} multi)</span>}
                                  </div>
                                )}
                                {model.assetCount > 0 && <div className="text-slate-300 text-xs">Assets: {((model.assetCount * 30) / 60).toFixed(1)}m</div>}
                                {model.relationCount > 0 && (
                                  <div className="text-slate-300 text-xs">
                                    Relations: {((((model.relationCount - model.multiRelationCount) * 20) + (model.multiRelationCount * 60)) / 60).toFixed(1)}m
                                    {model.multiRelationCount > 0 && <span className="text-purple-400"> ({model.multiRelationCount} multi)</span>}
                                  </div>
                                )}
                                <div className="text-slate-300 text-xs">Other fields: {(((model.fieldCount - model.richTextCount - model.componentCount - model.assetCount - model.relationCount - model.enumCount) * 10) / 60).toFixed(1)}m</div>
                              </div>
                              <div className="space-y-1">
                                <div className="text-muted-foreground text-xs uppercase">Click Analysis</div>
                                <div className="text-white">Base navigation: 5</div>
                                {model.richTextCount > 0 && <div className="text-slate-300 text-xs">Rich text: {model.richTextCount * 5}</div>}
                                {model.assetCount > 0 && <div className="text-slate-300 text-xs">Assets: {model.assetCount * 5}</div>}
                                {model.relationCount > 0 && (
                                  <div className="text-slate-300 text-xs">
                                    Relations: {((model.relationCount - model.multiRelationCount) * 4) + (model.multiRelationCount * 8)}
                                    {model.multiRelationCount > 0 && <span className="text-purple-400"> ({model.multiRelationCount} multi)</span>}
                                  </div>
                                )}
                                {model.componentCount > 0 && (
                                  <div className="text-slate-300 text-xs">
                                    Components: {((model.componentCount - model.multiComponentCount) * 4) + (model.multiComponentCount * 10)}
                                    {model.multiComponentCount > 0 && <span className="text-purple-400"> ({model.multiComponentCount} multi)</span>}
                                  </div>
                                )}
                                <div className="text-slate-300 text-xs">Other fields: {(model.fieldCount - model.richTextCount - model.assetCount - model.relationCount - model.componentCount) * 2}</div>
                              </div>
                              <div className="space-y-1">
                                <div className="text-muted-foreground text-xs uppercase">Cognitive Load</div>
                                <div className="text-white">Total: {model.cognitiveLoad}/100</div>
                                <div className="text-slate-300 text-xs">Fields: {Math.min(model.fieldCount * 2, 40)}/40</div>
                                <div className="text-slate-300 text-xs">Required: {Math.min(model.requiredFields * 3, 30)}/30</div>
                                <div className="text-slate-300 text-xs">Relations: {Math.min(model.relationCount * 4, 20)}/20</div>
                                <div className="text-slate-300 text-xs">Rich text: {Math.min(model.richTextCount * 5, 15)}/15</div>
                                <div className="text-slate-300 text-xs">Components: {Math.min(model.componentCount * 3, 15)}/15</div>
                              </div>
                              <div className="space-y-1">
                                <div className="text-muted-foreground text-xs uppercase">Quick Wins</div>
                                {model.fieldCount > 15 && (
                                  <div className="text-yellow-400 text-xs">• Break into components</div>
                                )}
                                {model.requiredFields > 5 && (
                                  <div className="text-yellow-400 text-xs">• Reduce required fields</div>
                                )}
                                {model.relationCount > 3 && (
                                  <div className="text-yellow-400 text-xs">• Simplify relations</div>
                                )}
                                {model.richTextCount > 2 && (
                                  <div className="text-yellow-400 text-xs">• Many rich text fields</div>
                                )}
                                {model.overallScore >= 70 && (
                                  <div className="text-green-400 text-xs">✓ Well optimized</div>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>
          {sortedEditorModels.length > 10 && (
            <div className="p-3 border-t border-border">
              <button
                onClick={() => setShowAllEditorModels(!showAllEditorModels)}
                className="text-sm text-purple-400 hover:text-purple-300"
              >
                {showAllEditorModels ? 'Show less' : `Show all ${sortedEditorModels.length} models`}
              </button>
            </div>
          )}
        </div>
      </section>

      {/* Team Activity Section (Last 3 Months) */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <span>📈</span> Team Activity (Last 12 Weeks)
          </h3>
          <button
            onClick={scanTeamActivity}
            disabled={isActivityScanning || !endpoint || !token}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              isActivityScanning || !endpoint || !token
                ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
                : 'bg-purple-600 hover:bg-purple-500 text-white'
            }`}
          >
            {isActivityScanning ? 'Scanning...' : 'Scan Activity'}
          </button>
        </div>

        {activityScanError && (
          <div className="card p-4 mb-4 border-red-500/30 bg-red-500/10">
            <p className="text-sm text-red-400">{activityScanError}</p>
          </div>
        )}

        {!teamActivityData && !isActivityScanning && (
          <div className="card p-6 text-center text-muted-foreground">
            <p>Click "Scan Activity" to see week-by-week publishing breakdown for the last 3 months.</p>
            {(!endpoint || !token) && (
              <p className="text-xs mt-2 text-amber-400">⚠️ Requires API endpoint and token</p>
            )}
          </div>
        )}

        {teamActivityData && (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
              <div className="card p-4 text-center border-blue-500/30 bg-blue-500/10">
                <div className="text-2xl font-bold text-blue-400">{teamActivityData.totalEntries}</div>
                <div className="text-sm text-blue-300">Total Entries (12 weeks)</div>
              </div>
              <div className="card p-4 text-center border-purple-500/30 bg-purple-500/10">
                <div className="text-2xl font-bold text-purple-400">{teamActivityData.topModels.length}</div>
                <div className="text-sm text-purple-300">Active Models</div>
              </div>
              <div className="card p-4 text-center border-green-500/30 bg-green-500/10">
                <div className="text-2xl font-bold text-green-400">{Math.round(teamActivityData.totalEntries / 12)}</div>
                <div className="text-sm text-green-300">Avg/Week</div>
              </div>
              <div className="card p-4 text-center border-orange-500/30 bg-orange-500/10">
                <div className="text-2xl font-bold text-orange-400">{teamActivityData.peakWeek.count}</div>
                <div className="text-sm text-orange-300">Peak Week</div>
              </div>
            </div>

            {/* Most Active Models */}
            <div className="card p-4 mb-4 border-slate-500/30">
              <div className="text-sm text-muted-foreground mb-2">Most Active Models:</div>
              <div className="flex flex-wrap gap-2">
                {teamActivityData.topModels.map((model, i) => (
                  <span key={model} className="px-3 py-1 rounded-full bg-purple-500/20 text-purple-300 text-sm">
                    {i + 1}. {model} ({teamActivityData.modelTotals[model]})
                  </span>
                ))}
              </div>
            </div>

            {/* Week-by-Week Table */}
            <div className="card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-800/50">
                    <tr>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground">Week</th>
                      {teamActivityData.topModels.slice(0, 5).map(model => (
                        <th key={model} className="text-right py-3 px-3 font-medium text-muted-foreground">
                          {model.length > 12 ? model.substring(0, 10) + '...' : model}
                        </th>
                      ))}
                      <th className="text-right py-3 px-3 font-medium text-muted-foreground">Other</th>
                      <th className="text-right py-3 px-4 font-medium text-white">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {teamActivityData.weeks.map((week, i) => {
                      const topModelCounts = teamActivityData.topModels.slice(0, 5).map(m => week.modelCounts[m] || 0);
                      const topModelTotal = topModelCounts.reduce((a, b) => a + b, 0);
                      const otherCount = week.total - topModelTotal;
                      
                      const getActivityColor = (count: number, max: number) => {
                        if (count === 0) return 'text-slate-600';
                        const intensity = count / Math.max(max, 1);
                        if (intensity >= 0.7) return 'text-green-400';
                        if (intensity >= 0.3) return 'text-yellow-400';
                        return 'text-slate-400';
                      };
                      
                      const maxWeekTotal = Math.max(...teamActivityData.weeks.map(w => w.total));
                      
                      return (
                        <tr key={week.weekStart} className={`border-t border-border ${i === teamActivityData.weeks.length - 1 ? 'bg-slate-800/20' : ''}`}>
                          <td className="py-3 px-4 text-white font-medium">{week.weekLabel}</td>
                          {teamActivityData.topModels.slice(0, 5).map(model => {
                            const count = week.modelCounts[model] || 0;
                            return (
                              <td key={model} className={`py-3 px-3 text-right ${getActivityColor(count, 20)}`}>
                                {count > 0 ? count : '—'}
                              </td>
                            );
                          })}
                          <td className="py-3 px-3 text-right text-slate-400">
                            {otherCount > 0 ? otherCount : '—'}
                          </td>
                          <td className={`py-3 px-4 text-right font-bold ${getActivityColor(week.total, maxWeekTotal)}`}>
                            {week.total}
                          </td>
                        </tr>
                      );
                    })}
                    {/* Totals Row */}
                    <tr className="border-t-2 border-border bg-slate-800/40 font-bold">
                      <td className="py-3 px-4 text-white">TOTAL</td>
                      {teamActivityData.topModels.slice(0, 5).map(model => (
                        <td key={model} className="py-3 px-3 text-right text-white">
                          {teamActivityData.modelTotals[model] || 0}
                        </td>
                      ))}
                      <td className="py-3 px-3 text-right text-slate-400">
                        {Object.values(teamActivityData.modelTotals).reduce((a, b) => a + b, 0) - 
                         teamActivityData.topModels.slice(0, 5).reduce((sum, m) => sum + (teamActivityData.modelTotals[m] || 0), 0)}
                      </td>
                      <td className="py-3 px-4 text-right text-green-400">
                        {teamActivityData.totalEntries}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </section>

      {/* Content Activity Section */}
      <section>
        <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
          <span>🕐</span> Content Activity
        </h3>
        <p className="text-sm text-muted-foreground mb-4">See when each model was last updated</p>

        {result.insights.contentFreshness && result.insights.contentFreshness.models.length > 0 ? (
          <>
            {/* Draft Backlog - keep this useful section */}
            {(() => {
              const draftBacklog = result.comprehensiveAssessment.contentArchitecture.contentDistribution
                .filter(cd => cd.draft > cd.published && cd.draft > 0)
                .map(cd => ({
                  model: cd.model,
                  draftCount: cd.draft - cd.published,
                  total: cd.total,
                  estimatedValue: Math.round((cd.draft - cd.published) * ((editorExperienceModels.find(m => m.modelName === cd.model)?.timeMinutes || 3) / 60) * hourlyRate),
                }))
                .sort((a, b) => b.estimatedValue - a.estimatedValue);
              
              const totalBacklogValue = draftBacklog.reduce((sum, d) => sum + d.estimatedValue, 0);
              const totalDrafts = draftBacklog.reduce((sum, d) => sum + d.draftCount, 0);

              return draftBacklog.length > 0 ? (
                <div className="card p-4 mb-4 border-amber-500/30 bg-amber-500/10">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="font-medium text-amber-300 flex items-center gap-2">
                        ⚠️ Draft Backlog
                      </div>
                      <div className="text-sm text-amber-200/80 mt-1">
                        {totalDrafts} unpublished entries worth ~${totalBacklogValue.toLocaleString()} in effort
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {draftBacklog.slice(0, 5).map(item => (
                      <div key={item.model} className="flex items-center justify-between text-sm">
                        <span className="text-white">{item.model}</span>
                        <span className="text-amber-400">
                          {item.draftCount} drafts (~${item.estimatedValue})
                        </span>
                      </div>
                    ))}
                    {draftBacklog.length > 5 && (
                      <div className="text-xs text-muted-foreground">
                        + {draftBacklog.length - 5} more models with drafts
                      </div>
                    )}
                  </div>
                </div>
              ) : null;
            })()}

            {/* Last Updated Table */}
            <div className="card overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-800/50">
                  <tr>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Model</th>
                    <th className="text-right py-3 px-4 font-medium text-muted-foreground">Entries</th>
                    <th className="text-right py-3 px-4 font-medium text-muted-foreground">Last Updated</th>
                    <th className="text-right py-3 px-4 font-medium text-muted-foreground">Days Ago</th>
                  </tr>
                </thead>
                <tbody>
                  {result.insights.contentFreshness.models.map((model, i) => {
                    const getDaysAgoColor = (days: number) => {
                      if (days < 0) return 'text-slate-500';
                      if (days <= 7) return 'text-green-400';
                      if (days <= 30) return 'text-yellow-400';
                      if (days <= 90) return 'text-orange-400';
                      return 'text-red-400';
                    };
                    
                    const getDaysAgoLabel = (days: number) => {
                      if (days < 0) return 'Unknown';
                      if (days === 0) return 'Today';
                      if (days === 1) return '1 day';
                      return `${days} days`;
                    };

                    return (
                      <tr key={i} className="border-t border-border hover:bg-slate-800/30">
                        <td className="py-3 px-4 font-medium text-white">{model.model}</td>
                        <td className="py-3 px-4 text-right text-slate-300">{model.totalEntries.toLocaleString()}</td>
                        <td className="py-3 px-4 text-right text-slate-300">
                          {model.lastUpdated 
                            ? new Date(model.lastUpdated).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                            : '—'
                          }
                        </td>
                        <td className="py-3 px-4 text-right">
                          <span className={`font-medium ${getDaysAgoColor(model.daysSinceUpdate)}`}>
                            {getDaysAgoLabel(model.daysSinceUpdate)}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <div className="card p-6 text-center text-muted-foreground">
            <p>Content activity analysis not available.</p>
          </div>
        )}
      </section>

      {/* Hourly Rate Adjuster */}
      <div className="card p-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-white">Content Creator Hourly Rate</h3>
            <p className="text-sm text-muted-foreground">Adjust to estimate content creation costs</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-white font-medium">$</span>
            <input
              type="number"
              value={hourlyRate}
              onChange={(e) => setHourlyRate(Math.max(1, parseInt(e.target.value) || 50))}
              className="w-20 px-3 py-2 rounded-lg bg-slate-800/50 border border-slate-700 text-white focus:outline-none focus:ring-2 focus:ring-purple-500 text-center"
              min="1"
            />
            <span className="text-muted-foreground">/hour</span>
          </div>
        </div>
      </div>

      {/* Duplicate Content Section */}
      <section>
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <span>🔍</span> Duplicate Content Detection
        </h3>
        
        {/* Model Selection Dropdown */}
        <div className="card p-4 mb-4">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex-1 min-w-[200px]">
              <label className="block text-sm text-muted-foreground mb-2">Select Model to Scan</label>
              <select
                value={selectedDuplicateModel}
                onChange={(e) => setSelectedDuplicateModel(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-800/50 border border-slate-700 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                disabled={isDuplicateScanning}
              >
                <option value="">All Models (Quick Scan - Top 5)</option>
                {modelsWithContent.map(model => (
                  <option key={model.model} value={model.model}>
                    {model.model} ({model.total.toLocaleString()} entries)
                  </option>
                ))}
              </select>
            </div>
            <button
              onClick={scanForDuplicates}
              disabled={isDuplicateScanning || !endpoint || !token}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                isDuplicateScanning || !endpoint || !token
                  ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
                  : 'bg-purple-600 hover:bg-purple-500 text-white'
              }`}
            >
              {isDuplicateScanning ? 'Scanning...' : 'Scan for Duplicates'}
            </button>
          </div>
          {!endpoint || !token ? (
            <p className="text-xs text-muted-foreground mt-2">
              ⚠️ Endpoint and token required for duplicate scanning
            </p>
          ) : null}
        </div>

        {/* Error Display */}
        {duplicateScanError && (
          <div className="card p-4 mb-4 border-red-500/30 bg-red-500/10">
            <p className="text-sm text-red-400">{duplicateScanError}</p>
          </div>
        )}

        {/* Results Table - Sorted by Waste (highest first) */}
        {rankedDuplicateResults.length > 0 && (
          <div className="card overflow-hidden">
            <div className="px-4 py-2 bg-slate-800/30 border-b border-border text-xs text-slate-400">
              ℹ️ Duplicates = entries with ≥80% field similarity. Click row to see duplicate groups.
            </div>
            <table className="w-full text-sm">
              <thead className="bg-slate-800/50">
                <tr>
                  <th className="text-center py-3 px-2 font-medium text-muted-foreground w-10">#</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Model</th>
                  <th className="text-right py-3 px-3 font-medium text-muted-foreground">Entries</th>
                  <th className="text-right py-3 px-3 font-medium text-muted-foreground">Sampled</th>
                  <th className="text-right py-3 px-3 font-medium text-muted-foreground">Duplicates</th>
                  <th className="text-right py-3 px-3 font-medium text-muted-foreground">Groups</th>
                  <th className="text-right py-3 px-3 font-medium text-muted-foreground">Waste $</th>
                  <th className="text-center py-3 px-3 font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rankedDuplicateResults.map((result) => {
                  const duplicateCount = result.exactDuplicates.reduce((sum, d) => sum + (d.count - 1), 0);
                  const getWasteColor = (waste: number) => {
                    if (waste <= 50) return 'text-green-400';
                    if (waste <= 200) return 'text-yellow-400';
                    if (waste <= 500) return 'text-orange-400';
                    return 'text-red-400';
                  };
                  
                  return (
                  <>
                    <tr 
                      key={result.modelName}
                      className={`border-t border-border hover:bg-slate-800/30 cursor-pointer transition-colors ${expandedDuplicateRow === result.modelName ? 'bg-slate-800/40' : ''}`}
                      onClick={() => setExpandedDuplicateRow(expandedDuplicateRow === result.modelName ? null : result.modelName)}
                    >
                      <td className="py-3 px-2 text-center">
                        <span className="text-muted-foreground font-mono text-xs">{result.rank}</span>
                      </td>
                      <td className="py-3 px-4 font-medium text-white">
                        <div className="flex items-center gap-2">
                          {result.modelName}
                          {result.exactDuplicates.length > 0 && (
                            <span className="text-muted-foreground text-xs">
                              {expandedDuplicateRow === result.modelName ? '▼' : '▶'}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-3 text-right text-slate-300">
                        {result.totalEntries.toLocaleString()}
                      </td>
                      <td className="py-3 px-3 text-right text-slate-300">
                        {result.sampledEntries}
                      </td>
                      <td className="py-3 px-3 text-right">
                        <span className={`font-medium ${getDuplicatePercentageColor(result.duplicatePercentage)}`}>
                          {duplicateCount}
                          <span className="text-xs ml-1 text-muted-foreground">({result.duplicatePercentage}%)</span>
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right text-slate-300">
                        {result.exactDuplicates.length}
                      </td>
                      <td className={`py-3 px-3 text-right font-bold ${getWasteColor(result.wastedEffort || 0)}`}>
                        ${(result.wastedEffort || 0).toLocaleString()}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedDuplicateModel(result.modelName);
                          }}
                          className="px-2 py-1 text-xs bg-purple-600/50 hover:bg-purple-600 text-purple-200 rounded transition-colors"
                        >
                          Deep Scan
                        </button>
                      </td>
                    </tr>
                    {/* Expanded duplicate details */}
                    {expandedDuplicateRow === result.modelName && result.exactDuplicates.length > 0 && (
                      <tr key={`${result.modelName}-detail`} className="bg-slate-800/20">
                        <td colSpan={8} className="py-4 px-6">
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <div className="text-muted-foreground text-xs uppercase">
                                Duplicate Groups (≥80% similarity across all fields)
                              </div>
                              <div className="text-xs text-red-400">
                                Estimated waste: <span className="font-bold">${(result.wastedEffort || 0).toLocaleString()}</span>
                              </div>
                            </div>
                            {result.exactDuplicates.slice(0, 5).map((dup, i) => (
                              <div key={i} className="p-3 bg-slate-800/50 rounded-lg">
                                <div className="flex items-center justify-between mb-2">
                                  <span className="text-sm font-medium text-white">
                                    Group {i + 1}: <span className="text-yellow-400">{dup.field}</span>
                                  </span>
                                  <span className="text-xs text-red-400 font-bold px-2 py-1 bg-red-500/20 rounded">
                                    {dup.count} entries
                                  </span>
                                </div>
                                <div className="text-xs text-slate-400">
                                  Sample value: "{dup.value.substring(0, 80)}{dup.value.length > 80 ? '...' : ''}"
                                </div>
                                <div className="text-xs text-muted-foreground mt-1">
                                  Entry IDs: {dup.entries.slice(0, 3).map(e => e.id.substring(0, 8)).join(', ')}
                                  {dup.entries.length > 3 && ` +${dup.entries.length - 3} more`}
                                </div>
                              </div>
                            ))}
                            {result.exactDuplicates.length > 5 && (
                              <div className="text-xs text-muted-foreground">
                                + {result.exactDuplicates.length - 5} more duplicate groups
                              </div>
                            )}
                            <div className="text-xs text-slate-500 mt-2 pt-2 border-t border-slate-700">
                              💡 Duplicates are entries where ≥80% of fields match. Consider merging or removing redundant content.
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Empty state */}
        {duplicateScanResults.length === 0 && !isDuplicateScanning && (
          <div className="card p-6 text-center text-muted-foreground">
            <p>Select a model and click "Scan for Duplicates" to detect duplicate content.</p>
          </div>
        )}
      </section>

      {/* Content Cost Section */}
      <section>
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <span>💵</span> Estimated Content Investment
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div className="card p-4 text-center">
            <div className="text-2xl font-bold text-white">{computedTotalEntries.toLocaleString()}</div>
            <div className="text-sm text-muted-foreground">Total Entries</div>
          </div>
          <div className="card p-4 text-center">
            <div className="text-2xl font-bold text-white">{computedCostModels.length}</div>
            <div className="text-sm text-muted-foreground">Models with Content</div>
          </div>
          <div className="card p-4 text-center border-green-500/30 bg-green-500/10">
            <div className="text-2xl font-bold text-green-400">${computedTotalCost.toLocaleString()}</div>
            <div className="text-sm text-green-300">Estimated Investment</div>
          </div>
        </div>
        
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-800/50">
              <tr>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Model</th>
                <th className="text-right py-3 px-4 font-medium text-muted-foreground">Entries</th>
                <th className="text-right py-3 px-4 font-medium text-muted-foreground">Time/Entry</th>
                <th className="text-right py-3 px-4 font-medium text-muted-foreground">Cost/Entry</th>
                <th className="text-right py-3 px-4 font-medium text-muted-foreground">Total Cost</th>
              </tr>
            </thead>
            <tbody>
              {displayedCostModels.map((model, i) => (
                <tr key={i} className="border-t border-border hover:bg-slate-800/30">
                  <td className="py-3 px-4 font-medium text-white">{model.modelName}</td>
                  <td className="py-3 px-4 text-right text-slate-300">{model.entryCount.toLocaleString()}</td>
                  <td className="py-3 px-4 text-right text-slate-300">{model.timePerEntryMinutes}m</td>
                  <td className="py-3 px-4 text-right text-slate-300">${model.costPerEntry.toFixed(2)}</td>
                  <td className="py-3 px-4 text-right font-medium text-green-400">${model.totalCost.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {computedCostModels.length > 10 && (
            <div className="p-3 border-t border-border">
              <button
                onClick={() => setShowAllCostModels(!showAllCostModels)}
                className="text-sm text-purple-400 hover:text-purple-300"
              >
                {showAllCostModels ? 'Show less' : `Show all ${computedCostModels.length} models`}
              </button>
            </div>
          )}
        </div>
      </section>

      {/* Cost Optimization Section */}
      <section>
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <span>💰</span> Cost Optimization Opportunities
        </h3>

        {(() => {
          // Ghost Models - models with 0 entries
          const ghostModels = modelOverviewData.filter(m => m.entries === 0);
          const ghostModelCost = ghostModels.length * 2 * hourlyRate; // ~2 hours setup per model
          
          // Over-engineered Models - many fields but few entries (high investment, low utilization)
          const overEngineeredModels = modelOverviewData
            .filter(m => m.fields > 10 && m.entries < 10) // Many fields, few entries
            .map(m => ({
              ...m,
              utilizationScore: m.entries > 0 ? Math.min(100, Math.round((m.entries / m.fields) * 50)) : 0,
              wastedSetup: Math.round((m.fields * 0.25) * hourlyRate), // ~15min per field setup
            }))
            .sort((a, b) => a.utilizationScore - b.utilizationScore);
          
          const overEngineeredCost = overEngineeredModels.reduce((sum, m) => sum + m.wastedSetup, 0);
          
          // Storage estimate (if we have asset data)
          const assetData = result.content;
          const estimatedStorageCostMonthly = assetData.totalAssets > 0 
            ? Math.round((assetData.totalAssets * 0.5) / 1000 * 0.10 * 100) / 100 // ~0.5MB avg per asset, $0.10/GB
            : 0;
          
          // Total potential savings
          const totalPotentialSavings = ghostModelCost + overEngineeredCost;

          return (
            <>
              {/* Savings Summary */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                <div className="card p-4 text-center border-green-500/30 bg-green-500/10">
                  <div className="text-2xl font-bold text-green-400">${totalPotentialSavings.toLocaleString()}</div>
                  <div className="text-sm text-green-300">Potential Savings</div>
                  <div className="text-xs text-muted-foreground mt-1">From cleanup</div>
                </div>
                <div className="card p-4 text-center border-red-500/30 bg-red-500/10">
                  <div className="text-2xl font-bold text-red-400">{ghostModels.length}</div>
                  <div className="text-sm text-red-300">Ghost Models</div>
                  <div className="text-xs text-muted-foreground mt-1">0 entries</div>
                </div>
                <div className="card p-4 text-center border-orange-500/30 bg-orange-500/10">
                  <div className="text-2xl font-bold text-orange-400">{overEngineeredModels.length}</div>
                  <div className="text-sm text-orange-300">Over-engineered</div>
                  <div className="text-xs text-muted-foreground mt-1">Low utilization</div>
                </div>
                <div className="card p-4 text-center border-blue-500/30 bg-blue-500/10">
                  <div className="text-2xl font-bold text-blue-400">${estimatedStorageCostMonthly}</div>
                  <div className="text-sm text-blue-300">Est. Storage/mo</div>
                  <div className="text-xs text-muted-foreground mt-1">{assetData.totalAssets.toLocaleString()} assets</div>
                </div>
              </div>

              {/* Ghost Models List */}
              {ghostModels.length > 0 && (
                <div className="card p-4 mb-4 border-red-500/30 bg-red-500/10">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="font-medium text-red-300 flex items-center gap-2">
                        👻 Ghost Models (No Content)
                      </div>
                      <div className="text-sm text-red-200/80 mt-1">
                        {ghostModels.length} models with zero entries costing ~${ghostModelCost.toLocaleString()} in setup/maintenance
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {ghostModels.slice(0, 10).map(m => (
                      <span key={m.name} className="px-3 py-1 rounded-full bg-red-500/20 text-red-300 text-sm">
                        {m.name} ({m.fields} fields)
                      </span>
                    ))}
                    {ghostModels.length > 10 && (
                      <span className="px-3 py-1 rounded-full bg-slate-500/20 text-slate-300 text-sm">
                        +{ghostModels.length - 10} more
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-red-200/60 mt-3">
                    💡 Consider removing unused models or adding content to justify their existence
                  </div>
                </div>
              )}

              {/* Over-engineered Models Table */}
              {overEngineeredModels.length > 0 && (
                <div className="card overflow-hidden">
                  <div className="px-4 py-2 bg-slate-800/30 border-b border-border text-xs text-slate-400">
                    ⚠️ Over-engineered: Models with 10+ fields but fewer than 10 entries (high setup cost, low usage)
                  </div>
                  <table className="w-full text-sm">
                    <thead className="bg-slate-800/50">
                      <tr>
                        <th className="text-left py-3 px-4 font-medium text-muted-foreground">Model</th>
                        <th className="text-right py-3 px-4 font-medium text-muted-foreground">Fields</th>
                        <th className="text-right py-3 px-4 font-medium text-muted-foreground">Entries</th>
                        <th className="text-right py-3 px-4 font-medium text-muted-foreground">Utilization</th>
                        <th className="text-right py-3 px-4 font-medium text-muted-foreground">Wasted Setup</th>
                        <th className="text-right py-3 px-4 font-medium text-muted-foreground">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {overEngineeredModels.slice(0, 10).map((model, i) => (
                        <tr key={i} className="border-t border-border hover:bg-slate-800/30">
                          <td className="py-3 px-4 font-medium text-white">{model.name}</td>
                          <td className="py-3 px-4 text-right text-slate-300">{model.fields}</td>
                          <td className="py-3 px-4 text-right text-slate-300">{model.entries}</td>
                          <td className="py-3 px-4 text-right">
                            <span className={`px-2 py-1 rounded text-xs font-medium ${
                              model.utilizationScore < 20 ? 'text-red-400 bg-red-500/20' :
                              model.utilizationScore < 50 ? 'text-orange-400 bg-orange-500/20' :
                              'text-yellow-400 bg-yellow-500/20'
                            }`}>
                              {model.utilizationScore}%
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right text-orange-400 font-medium">
                            ${model.wastedSetup}
                          </td>
                          <td className="py-3 px-4 text-right text-xs text-muted-foreground">
                            Simplify or populate
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* No Issues */}
              {ghostModels.length === 0 && overEngineeredModels.length === 0 && (
                <div className="card p-6 text-center border-green-500/30 bg-green-500/10">
                  <div className="text-green-400 text-lg">✓ No major cost optimization issues found</div>
                  <div className="text-sm text-green-300/80 mt-1">
                    All models have content and reasonable field counts
                  </div>
                </div>
              )}
            </>
          );
        })()}
      </section>

      {/* Recommendations */}
      {data.recommendations.length > 0 && (
        <section>
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <span>💡</span> Recommendations
          </h3>
          <div className="card p-4 border-blue-500/30 bg-blue-500/10">
            <ul className="space-y-2">
              {data.recommendations.map((rec, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-slate-300">
                  <span className="text-blue-400 mt-0.5">•</span>
                  {rec}
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* Executive Report Modal */}
      <ExecutiveReportModal
        result={result}
        endpoint={endpoint}
        hourlyRate={hourlyRate}
        isOpen={showExecutiveReport}
        onClose={() => setShowExecutiveReport(false)}
      />
    </div>
  );
}

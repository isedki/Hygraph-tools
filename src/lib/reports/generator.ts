import type { AuditResult } from '../types';
import type {
  ExecutiveReport,
  ExecutiveSummary,
  Finding,
  WasteAnalysis,
  WasteCategory,
  InvestmentBreakdown,
  ModelInvestment,
  Methodology,
  StatusIndicator,
  TopAction,
  InternalComparisons,
  ModelComparison,
  TheoreticalTarget,
} from './types';

interface GeneratorOptions {
  hourlyRate?: number;
  endpoint?: string;
}

interface ModelCostData {
  modelName: string;
  entryCount: number;
  timePerEntryMinutes: number;
  costPerEntry: number;
  totalCost: number;
  fieldCount: number;
  relationCount: number;
  requiredFields: number;
}

interface EditorExperienceData {
  modelName: string;
  timeMinutes: number;
  clicks: number;
  cognitiveLoad: number;
  overallScore: number;
  fieldCount: number;
  relationCount: number;
  requiredFields: number;
}

/**
 * Calculate time per entry based on field complexity
 * Formula: Base (2 min) + Required fields (×0.5) + Relations (×1) + Rich text (×2)
 */
function calculateTimePerEntry(
  fieldCount: number,
  requiredFields: number,
  relationCount: number
): number {
  const avgFieldTime = 12; // seconds per field
  const relationBonus = relationCount * 20;
  const requiredBonus = requiredFields * 5;
  const totalTimeSeconds = 60 + (fieldCount * avgFieldTime) + relationBonus + requiredBonus;
  return Math.round((totalTimeSeconds / 60) * 10) / 10; // minutes with 1 decimal
}

/**
 * Build editor experience data from audit result
 */
function buildEditorExperience(result: AuditResult): EditorExperienceData[] {
  const modelComplexity = result.editorial.modelComplexity || [];
  
  return modelComplexity.map(mc => {
    const timeMinutes = calculateTimePerEntry(mc.fieldCount, mc.requiredFields, mc.relationCount);
    const clicks = 5 + (mc.fieldCount * 2) + (mc.relationCount * 3);
    
    const fieldPenalty = Math.min(mc.fieldCount * 2, 40);
    const requiredPenalty = Math.min(mc.requiredFields * 3, 30);
    const relationPenalty = Math.min(mc.relationCount * 5, 30);
    const cognitiveLoad = Math.min(100, fieldPenalty + requiredPenalty + relationPenalty);
    const overallScore = Math.max(0, 100 - cognitiveLoad);
    
    return {
      modelName: mc.model,
      timeMinutes,
      clicks,
      cognitiveLoad,
      overallScore,
      fieldCount: mc.fieldCount,
      relationCount: mc.relationCount,
      requiredFields: mc.requiredFields,
    };
  });
}

/**
 * Build model cost data from audit result
 */
function buildCostData(
  result: AuditResult,
  editorExperience: EditorExperienceData[],
  hourlyRate: number
): ModelCostData[] {
  const contentDist = result.comprehensiveAssessment.contentArchitecture.contentDistribution;
  
  return contentDist
    .filter(cd => cd.total > 0)
    .map(cd => {
      const editorModel = editorExperience.find(m => m.modelName === cd.model);
      const timePerEntry = editorModel?.timeMinutes || 3;
      const costPerEntry = (timePerEntry / 60) * hourlyRate;
      const totalCost = costPerEntry * cd.total;
      
      return {
        modelName: cd.model,
        entryCount: cd.total,
        timePerEntryMinutes: Math.round(timePerEntry * 10) / 10,
        costPerEntry: Math.round(costPerEntry * 100) / 100,
        totalCost: Math.round(totalCost),
        fieldCount: editorModel?.fieldCount || 0,
        relationCount: editorModel?.relationCount || 0,
        requiredFields: editorModel?.requiredFields || 0,
      };
    })
    .sort((a, b) => b.totalCost - a.totalCost);
}

/**
 * Calculate waste from ghost models, over-engineered models, etc.
 */
function calculateWaste(
  result: AuditResult,
  costData: ModelCostData[],
  editorExperience: EditorExperienceData[],
  hourlyRate: number
): WasteAnalysis {
  const categories: WasteCategory[] = [];
  
  // Ghost Models - models with 0 entries (conservative: 15 min cleanup each)
  const ghostModels = result.insights.contentAdoption?.ghostModels || [];
  if (ghostModels.length > 0) {
    const ghostItems = ghostModels.map(gm => ({
      name: gm.model,
      amount: Math.round(0.25 * hourlyRate), // 15 min cleanup time per model
      details: `${gm.fieldCount} fields, 0 entries`,
    }));
    const totalGhostCost = ghostItems.reduce((sum, g) => sum + g.amount, 0);
    
    categories.push({
      category: 'ghost-models',
      label: 'Empty Models (cleanup opportunity)',
      totalAmount: totalGhostCost,
      items: ghostItems,
      recoverable: true,
      recoverableAmount: totalGhostCost,
    });
  }
  
  // NOTE: Removed "over-engineered" category - too speculative without usage data
  
  // Unused Components (conservative: 5 min cleanup each)
  const unusedComponents = result.components.unusedComponents || [];
  if (unusedComponents.length > 0) {
    const componentItems = unusedComponents.map(name => ({
      name,
      amount: Math.round(0.08 * hourlyRate), // ~5 min cleanup per component
      details: 'Not referenced by any model',
    }));
    const totalComponentCost = componentItems.reduce((sum, c) => sum + c.amount, 0);
    
    categories.push({
      category: 'unused-components',
      label: 'Unused Components (cleanup opportunity)',
      totalAmount: totalComponentCost,
      items: componentItems,
      recoverable: true,
      recoverableAmount: totalComponentCost,
    });
  }
  
  // Draft Backlog - content created but not published (this is REAL measurable value)
  const contentDist = result.comprehensiveAssessment.contentArchitecture.contentDistribution;
  const highDraftModels = contentDist.filter(cd => {
    const draftRatio = cd.total > 0 ? cd.draft / cd.total : 0;
    return draftRatio > 0.5 && cd.draft > 5;
  });
  
  if (highDraftModels.length > 0) {
    const draftItems = highDraftModels.map(hd => {
      const editorModel = editorExperience.find(e => e.modelName === hd.model);
      const timePerEntry = editorModel?.timeMinutes || 3;
      // Value of content sitting in draft = time already invested
      const stuckValue = Math.round((hd.draft * timePerEntry / 60) * hourlyRate);
      return {
        name: hd.model,
        amount: stuckValue,
        details: `${hd.draft} drafts (${Math.round((hd.draft / hd.total) * 100)}% unpublished)`,
      };
    });
    const totalDraftCost = draftItems.reduce((sum, d) => sum + d.amount, 0);
    
    categories.push({
      category: 'draft-backlog',
      label: 'Unpublished Content (invested but not live)',
      totalAmount: totalDraftCost,
      items: draftItems,
      recoverable: true,
      recoverableAmount: totalDraftCost,
    });
  }
  
  const totalWaste = categories.reduce((sum, c) => sum + c.totalAmount, 0);
  const totalRecoverable = categories.reduce((sum, c) => sum + c.recoverableAmount, 0);
  
  return {
    totalWaste,
    totalRecoverable,
    categories,
  };
}

/**
 * Generate detailed findings from audit data
 */
function generateFindings(
  result: AuditResult,
  wasteAnalysis: WasteAnalysis,
  costData: ModelCostData[],
  hourlyRate: number
): Finding[] {
  const findings: Finding[] = [];
  
  // Finding: Empty Models
  const ghostCategory = wasteAnalysis.categories.find(c => c.category === 'ghost-models');
  if (ghostCategory && ghostCategory.items.length > 0) {
    findings.push({
      id: 'ghost-models',
      title: `${ghostCategory.items.length} Empty Models (no content)`,
      impact: ghostCategory.totalAmount,
      confidence: 'high',
      dataPoints: ghostCategory.items.length,
      whatWeFound: `${ghostCategory.items.length} models have 0 entries: ${ghostCategory.items.map(i => i.name).join(', ')}. These may be planned for future use or no longer needed.`,
      whyItHappens: 'Empty models often result from schema planning, features not yet implemented, or deprecated functionality.',
      recommendations: [
        { option: 'Review and delete if not needed', effort: '15 min' },
        { option: 'Keep if planned for future use', effort: 'N/A' },
      ],
      evidence: ghostCategory.items.map(i => `${i.name}: ${i.details}`),
    });
  }
  
  // Finding: Draft Backlog
  const draftCategory = wasteAnalysis.categories.find(c => c.category === 'draft-backlog');
  if (draftCategory && draftCategory.items.length > 0) {
    const worstDraft = draftCategory.items[0];
    findings.push({
      id: 'draft-backlog',
      title: `$${draftCategory.totalAmount.toLocaleString()} Stuck in Draft Content`,
      impact: draftCategory.totalAmount,
      risk: `Growing at ~$${Math.round(draftCategory.totalAmount * 0.1)}/month if unaddressed`,
      confidence: 'high',
      dataPoints: draftCategory.items.reduce((sum, d) => {
        const match = d.details.match(/(\d+) drafts/);
        return sum + (match ? parseInt(match[1]) : 0);
      }, 0),
      whatWeFound: `${draftCategory.items.length} models have significant draft backlogs. The worst is "${worstDraft.name}" with ${worstDraft.details}.`,
      whyItHappens: 'Draft backlogs usually indicate bottlenecks in the review/approval process, missing required fields that block publishing, or editors starting content they cannot finish.',
      recommendations: [
        { option: 'Review required fields - make optional where possible', effort: '30 min' },
        { option: 'Implement content workflow with clear ownership', effort: '2-4 hours' },
      ],
      evidence: draftCategory.items.map(i => `${i.name}: ${i.details}`),
    });
  }
  
  // Finding: Over-engineered Models
  const overEngineeredCategory = wasteAnalysis.categories.find(c => c.category === 'over-engineered');
  if (overEngineeredCategory && overEngineeredCategory.items.length > 0) {
    findings.push({
      id: 'over-engineered',
      title: `${overEngineeredCategory.items.length} Over-engineered Models`,
      impact: overEngineeredCategory.totalAmount,
      confidence: 'medium',
      dataPoints: overEngineeredCategory.items.length,
      whatWeFound: `${overEngineeredCategory.items.length} models have many fields (>10) but few entries (<10). This suggests over-engineering: ${overEngineeredCategory.items.map(i => i.name).join(', ')}.`,
      whyItHappens: 'Over-engineered models often result from trying to anticipate all future needs upfront, or copying field patterns from other systems without considering actual usage.',
      recommendations: [
        { option: 'Simplify by removing unused fields', effort: '1-2 hours' },
        { option: 'Split into multiple focused models', effort: '2-4 hours' },
      ],
      evidence: overEngineeredCategory.items.map(i => `${i.name}: ${i.details}`),
    });
  }
  
  return findings.sort((a, b) => b.impact - a.impact);
}

/**
 * Generate top 3 actions based on findings and waste
 */
function generateTopActions(
  findings: Finding[],
  wasteAnalysis: WasteAnalysis
): TopAction[] {
  const actions: TopAction[] = [];
  
  // Sort waste categories by recoverable amount
  const sortedCategories = [...wasteAnalysis.categories].sort(
    (a, b) => b.recoverableAmount - a.recoverableAmount
  );
  
  let rank = 1;
  for (const category of sortedCategories.slice(0, 3)) {
    const finding = findings.find(f => f.id === category.category);
    const effort = finding?.recommendations[0]?.effort || '1 hour';
    
    let action = '';
    switch (category.category) {
      case 'ghost-models':
        action = `Delete ${category.items.length} ghost models`;
        break;
      case 'draft-backlog':
        action = `Fix draft bottleneck in ${category.items[0]?.name || 'models'}`;
        break;
      case 'over-engineered':
        action = `Simplify ${category.items.length} over-engineered models`;
        break;
      case 'unused-components':
        action = `Remove ${category.items.length} unused components`;
        break;
      default:
        action = category.label;
    }
    
    actions.push({
      rank: rank++,
      action,
      impact: category.recoverableAmount,
      effort,
      model: category.items[0]?.name,
    });
  }
  
  return actions;
}

/**
 * Generate status indicators
 */
function generateStatusIndicators(
  result: AuditResult,
  totalCost: number,
  wasteAnalysis: WasteAnalysis
): StatusIndicator[] {
  const contentDist = result.comprehensiveAssessment.contentArchitecture.contentDistribution;
  const totalEntries = contentDist.reduce((sum, cd) => sum + cd.total, 0);
  const totalPublished = contentDist.reduce((sum, cd) => sum + cd.published, 0);
  const publishedRatio = totalEntries > 0 ? (totalPublished / totalEntries) * 100 : 0;
  
  const wasteRatio = totalCost > 0 ? (wasteAnalysis.totalWaste / totalCost) * 100 : 0;
  
  // Calculate freshness score from average days since update (lower days = higher score)
  const avgDaysSinceUpdate = result.insights.contentFreshness?.models
    ?.filter(m => m.daysSinceUpdate >= 0)
    .reduce((sum, m, _, arr) => sum + m.daysSinceUpdate / arr.length, 0) || 180;
  const freshnessScore = Math.max(0, Math.round(100 - (avgDaysSinceUpdate / 365) * 100));
  
  // Schema Health: penalize ghost models and unused components, but cap penalties
  const ghostPenalty = Math.min((result.insights.contentAdoption?.ghostModels?.length || 0) * 3, 30);
  const unusedPenalty = Math.min((result.components.unusedComponents?.length || 0) * 1, 20);
  const schemaHealthScore = Math.max(50, Math.round(100 - ghostPenalty - unusedPenalty));
  
  return [
    {
      metric: 'Production Ready',
      value: `${Math.round(publishedRatio)}%`,
      trend: publishedRatio > 70 ? 'up' : undefined,
      verdict: publishedRatio >= 80 ? 'Ready for launch' : publishedRatio >= 60 ? 'Good progress' : 'In development',
      targetNote: 'published / total entries',
    },
    {
      metric: 'Cleanup Opportunity',
      value: `$${Math.round(wasteAnalysis.totalRecoverable)}`,
      trend: wasteAnalysis.totalRecoverable < 100 ? 'down' : undefined,
      verdict: wasteAnalysis.totalRecoverable < 50 ? 'Minimal' : wasteAnalysis.totalRecoverable < 200 ? 'Minor' : 'Worth reviewing',
      targetNote: 'empty models + unused components',
    },
    {
      metric: 'Content Freshness',
      value: `${freshnessScore}/100`,
      verdict: freshnessScore >= 70 ? 'Active project' : freshnessScore >= 50 ? 'Moderate activity' : 'Review needed',
      targetNote: 'based on last update dates',
    },
    {
      metric: 'Schema Health',
      value: `${schemaHealthScore}/100`,
      verdict: schemaHealthScore >= 80 ? 'Well maintained' : schemaHealthScore >= 60 ? 'Good' : 'Has unused items',
      targetNote: 'penalizes empty models & unused components',
    },
  ];
}

/**
 * Generate methodology section
 */
function generateMethodology(
  result: AuditResult,
  totalEntries: number,
  totalModels: number,
  hourlyRate: number,
  endpoint?: string
): Methodology {
  return {
    provenance: {
      provider: 'Hygraph Content API',
      endpoint: endpoint ? endpoint.replace(/\/v2\/.*/, '/v2/[project]') : 'Not provided',
      accessType: 'read-only',
      scanTime: new Date().toISOString(),
      scanDuration: 0, // Not tracked
      coverage: {
        modelsAnalyzed: totalModels,
        totalModels,
        entriesAnalyzed: totalEntries,
        totalEntries,
        componentsAnalyzed: result.components.components.length,
        totalComponents: result.components.components.length,
        sampling: 'none',
      },
    },
    calculations: {
      contentValue: 'Sum of (Entries × Time per Entry × Hourly Rate) for all models',
      timePerEntry: 'Base (1 min) + Fields (×12s) + Relations (×20s) + Required (×5s) — ESTIMATED',
      wasteCalculation: 'Empty models (15min cleanup) + Unused components (5min cleanup) + Draft backlog (actual entry value)',
    },
    assumptions: [
      {
        id: 'time-model',
        description: '⚠️ Time estimates are MODELED, not measured from actual usage',
        impact: 'high',
      },
      {
        id: 'cleanup-time',
        description: 'Cleanup estimates are conservative (15min/model, 5min/component)',
        impact: 'low',
      },
      {
        id: 'hourly-rate',
        description: `Hourly rate of $${hourlyRate}/hr is configurable`,
        impact: 'medium',
      },
    ],
    limitations: [
      {
        id: 'no-deleted',
        description: 'Cannot detect deleted content',
      },
      {
        id: 'no-actual-time',
        description: 'Cannot measure actual time spent (no tracking)',
        workaround: 'Estimates based on field complexity',
      },
      {
        id: 'no-history',
        description: 'Historical trends limited to available timestamps',
      },
    ],
    confidenceLevels: {
      high: 'Based on 100+ data points, clear pattern',
      medium: 'Based on 30-100 data points, moderate pattern',
      low: 'Based on <30 data points, directional only',
    },
  };
}

/**
 * Generate internal comparisons (model-to-model, no external benchmarks)
 */
function generateInternalComparisons(
  costData: ModelCostData[],
  editorExperience: EditorExperienceData[],
  result: AuditResult
): InternalComparisons {
  const modelComparisons: ModelComparison[] = [];
  
  // Efficiency comparison (time per entry)
  if (costData.length >= 2) {
    const sorted = [...costData].sort((a, b) => a.timePerEntryMinutes - b.timePerEntryMinutes);
    const best = sorted[0];
    const worst = sorted[sorted.length - 1];
    
    if (best && worst && best.modelName !== worst.modelName) {
      const gap = worst.timePerEntryMinutes / best.timePerEntryMinutes;
      modelComparisons.push({
        metric: 'Efficiency',
        bestModel: best.modelName,
        bestValue: `${best.timePerEntryMinutes} min/entry`,
        worstModel: worst.modelName,
        worstValue: `${worst.timePerEntryMinutes} min/entry`,
        gap: `${gap.toFixed(1)}x slower`,
        insight: gap > 2 ? `${worst.modelName} takes ${gap.toFixed(1)}x longer. Consider simplifying.` : undefined,
      });
    }
  }
  
  // Draft ratio comparison
  const contentDist = result.comprehensiveAssessment.contentArchitecture.contentDistribution
    .filter(cd => cd.total >= 5); // Only models with enough content
  
  if (contentDist.length >= 2) {
    const withRatio = contentDist.map(cd => ({
      ...cd,
      draftRatio: cd.total > 0 ? (cd.draft / cd.total) * 100 : 0,
    }));
    const sorted = [...withRatio].sort((a, b) => a.draftRatio - b.draftRatio);
    const best = sorted[0];
    const worst = sorted[sorted.length - 1];
    
    if (best && worst && best.model !== worst.model && worst.draftRatio > 10) {
      modelComparisons.push({
        metric: 'Draft Ratio',
        bestModel: best.model,
        bestValue: `${Math.round(best.draftRatio)}%`,
        worstModel: worst.model,
        worstValue: `${Math.round(worst.draftRatio)}%`,
        gap: `${Math.round(worst.draftRatio - best.draftRatio)}% higher`,
      });
    }
  }
  
  // Value per entry comparison
  if (costData.length >= 2) {
    const sorted = [...costData].sort((a, b) => b.costPerEntry - a.costPerEntry);
    const highest = sorted[0];
    const lowest = sorted[sorted.length - 1];
    
    if (highest && lowest && highest.modelName !== lowest.modelName) {
      modelComparisons.push({
        metric: 'Value per Entry',
        bestModel: highest.modelName,
        bestValue: `$${highest.costPerEntry.toFixed(2)}`,
        worstModel: lowest.modelName,
        worstValue: `$${lowest.costPerEntry.toFixed(2)}`,
        gap: `${(highest.costPerEntry / lowest.costPerEntry).toFixed(1)}x more`,
      });
    }
  }
  
  // Adoption comparison
  const adoption = contentDist.sort((a, b) => b.total - a.total);
  if (adoption.length >= 2) {
    const highest = adoption[0];
    const lowest = adoption[adoption.length - 1];
    
    modelComparisons.push({
      metric: 'Adoption',
      bestModel: highest.model,
      bestValue: `${highest.total} entries`,
      worstModel: lowest.model,
      worstValue: `${lowest.total} entries`,
      gap: `${highest.total - lowest.total} entries`,
    });
  }
  
  // Theoretical targets
  const ghostModels = result.insights.contentAdoption?.ghostModels || [];
  const unusedComponents = result.components.unusedComponents || [];
  const totalEntries = contentDist.reduce((sum, cd) => sum + cd.total, 0);
  const totalDrafts = contentDist.reduce((sum, cd) => sum + cd.draft, 0);
  const draftRatio = totalEntries > 0 ? (totalDrafts / totalEntries) * 100 : 0;
  const avgTimePerEntry = costData.length > 0
    ? costData.reduce((sum, c) => sum + c.timePerEntryMinutes, 0) / costData.length
    : 0;
  
  const theoreticalTargets: TheoreticalTarget[] = [
    {
      metric: 'Ghost Models',
      currentValue: `${ghostModels.length} (${Math.round((ghostModels.length / (contentDist.length + ghostModels.length)) * 100)}%)`,
      target: '0%',
      status: ghostModels.length === 0 ? 'met' : ghostModels.length <= 2 ? 'close' : 'needs-work',
      note: ghostModels.length > 0 ? `${ghostModels.length} to address` : undefined,
    },
    {
      metric: 'Draft Ratio',
      currentValue: `${Math.round(draftRatio)}%`,
      target: '<20%',
      status: draftRatio < 20 ? 'met' : draftRatio < 35 ? 'close' : 'needs-work',
    },
    {
      metric: 'Unused Components',
      currentValue: `${unusedComponents.length}`,
      target: '0',
      status: unusedComponents.length === 0 ? 'met' : unusedComponents.length <= 2 ? 'close' : 'needs-work',
      note: unusedComponents.length > 0 ? `${unusedComponents.length} to review` : undefined,
    },
    {
      metric: 'Avg Time/Entry',
      currentValue: `${avgTimePerEntry.toFixed(1)} min`,
      target: '<10 min',
      status: avgTimePerEntry < 10 ? 'met' : avgTimePerEntry < 15 ? 'close' : 'needs-work',
    },
  ];
  
  return {
    modelComparisons,
    theoreticalTargets,
    disclaimer: 'Targets are theoretical ideals based on a "clean" project with no waste. Not derived from external data sources.',
  };
}

/**
 * Generate narrative summary
 */
function generateNarrativeSummary(
  totalCost: number,
  totalEntries: number,
  wasteAnalysis: WasteAnalysis,
  findings: Finding[],
  statusIndicators: StatusIndicator[]
): string {
  const productionReady = statusIndicators.find(s => s.metric === 'Production Ready');
  const freshness = statusIndicators.find(s => s.metric === 'Content Freshness');
  
  let stage = 'active';
  if (totalEntries < 50) stage = 'early-stage';
  else if (totalEntries > 500) stage = 'mature';
  
  const stageLabel = stage === 'early-stage' ? 'Early-stage' : stage === 'mature' ? 'Mature' : 'Growth-stage';
  
  let summary = `${stageLabel} project with ${totalEntries.toLocaleString()} entries. `;
  
  if (productionReady) {
    summary += `${productionReady.value} content is published. `;
  }
  
  if (freshness) {
    summary += `${freshness.verdict}. `;
  }
  
  // Only mention cleanup if there's something meaningful
  const emptyModels = findings.find(f => f.id === 'ghost-models');
  const unusedComponents = wasteAnalysis.categories.find(c => c.category === 'unused-components');
  
  if (emptyModels || unusedComponents) {
    const items: string[] = [];
    if (emptyModels) items.push(`${emptyModels.dataPoints} empty models`);
    if (unusedComponents) items.push(`${unusedComponents.items.length} unused components`);
    summary += `Optional cleanup: ${items.join(', ')}.`;
  }
  
  return summary;
}

/**
 * Main function to generate the executive report
 */
export function generateExecutiveReport(
  result: AuditResult,
  options: GeneratorOptions = {}
): ExecutiveReport {
  const hourlyRate = options.hourlyRate || 50;
  const endpoint = options.endpoint;
  
  // Build intermediate data
  const editorExperience = buildEditorExperience(result);
  const costData = buildCostData(result, editorExperience, hourlyRate);
  
  // Get total entries from content distribution (accurate count from audit)
  const contentDistribution = result.comprehensiveAssessment?.contentArchitecture?.contentDistribution || [];
  const totalEntriesFromDistribution = contentDistribution.reduce((sum, cd) => sum + cd.total, 0);
  
  // Also try from content analysis
  const totalEntriesFromContent = result.content?.totalEntries || 0;
  
  // Use the larger of the two (in case one source is incomplete)
  const totalEntriesActual = Math.max(totalEntriesFromDistribution, totalEntriesFromContent);
  
  // Calculate totals from cost data
  const totalEntriesFromCost = costData.reduce((sum, c) => sum + c.entryCount, 0);
  const totalEntries = Math.max(totalEntriesActual, totalEntriesFromCost);
  const totalCost = costData.reduce((sum, c) => sum + c.totalCost, 0);
  const totalModels = result.editorial?.modelComplexity?.length || result.schema?.modelCount || 0;
  
  // Calculate waste
  const wasteAnalysis = calculateWaste(result, costData, editorExperience, hourlyRate);
  
  // Generate findings
  const findings = generateFindings(result, wasteAnalysis, costData, hourlyRate);
  
  // Generate top actions
  const topActions = generateTopActions(findings, wasteAnalysis);
  
  // Generate status indicators
  const statusIndicators = generateStatusIndicators(result, totalCost, wasteAnalysis);
  
  // Generate narrative
  const narrativeSummary = generateNarrativeSummary(
    totalCost,
    totalEntries,
    wasteAnalysis,
    findings,
    statusIndicators
  );
  
  // Build executive summary
  const executiveSummary: ExecutiveSummary = {
    bottomLine: {
      contentWorth: totalCost,
      wasting: wasteAnalysis.totalWaste,
      wastePercentage: totalCost > 0 ? Math.round((wasteAnalysis.totalWaste / totalCost) * 100 * 10) / 10 : 0,
      recoverable: wasteAnalysis.totalRecoverable,
      actionsToRecover: topActions.length,
    },
    statusIndicators,
    topActions,
    narrativeSummary,
  };
  
  // Build investment breakdown
  const avgTimePerEntry = costData.length > 0
    ? costData.reduce((sum, c) => sum + c.timePerEntryMinutes * c.entryCount, 0) / totalEntries
    : 0;
  
  const investmentBreakdown: InvestmentBreakdown = {
    models: costData.map(c => ({
      model: c.modelName,
      entries: c.entryCount,
      avgTimeMinutes: c.timePerEntryMinutes,
      totalValue: c.totalCost,
      percentOfTotal: totalCost > 0 ? Math.round((c.totalCost / totalCost) * 100) : 0,
    })),
    totalEntries,
    totalValue: totalCost,
    avgTimePerEntry: Math.round(avgTimePerEntry * 10) / 10,
    hourlyRate,
  };
  
  // Generate methodology
  const methodology = generateMethodology(result, totalEntries, totalModels, hourlyRate, endpoint);
  
  // Generate internal comparisons
  const internalComparisons = generateInternalComparisons(costData, editorExperience, result);
  
  return {
    reportTitle: 'Content Investment Report',
    generatedAt: new Date().toISOString(),
    version: '1.0.0',
    executiveSummary,
    findings,
    investmentBreakdown,
    wasteAnalysis,
    methodology,
    internalComparisons,
  };
}


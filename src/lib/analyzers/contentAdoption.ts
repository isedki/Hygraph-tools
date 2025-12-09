/**
 * Content Adoption Analyzer
 * 
 * Analyzes how well the schema is being utilized by identifying
 * ghost models (0 entries), underutilized models, and adoption patterns.
 */

import type { HygraphSchema, HygraphModel } from '../types';
import { filterSystemModels } from './systemFilters';

export interface GhostModel {
  model: string;
  fieldCount: number;
  hasRelations: boolean;
  createdFor?: string; // Inferred purpose based on name
}

export interface AdoptionCategory {
  model: string;
  entries: number;
  published: number;
  draftOnly: number;
  fieldCount: number;
}

export interface ContentAdoptionAnalysis {
  // Model categories by entry count
  ghostModels: GhostModel[];              // 0 entries
  underutilized: AdoptionCategory[];      // 1-4 entries
  lowAdoption: AdoptionCategory[];        // 5-19 entries
  healthy: AdoptionCategory[];            // 20-499 entries
  highVolume: AdoptionCategory[];         // 500+ entries
  
  // Summary metrics
  adoptionRate: number;                   // % of models with content
  totalModels: number;
  modelsWithContent: number;
  
  // Distribution
  distribution: {
    ghost: number;
    underutilized: number;
    lowAdoption: number;
    healthy: number;
    highVolume: number;
  };
  
  // Insights
  recommendations: string[];
  overallScore: number;
}

/**
 * Infer the purpose of a model based on its name
 */
function inferModelPurpose(name: string): string | undefined {
  const patterns: [RegExp, string][] = [
    [/page/i, 'Pages/Landing pages'],
    [/article|post|blog/i, 'Blog/Articles'],
    [/product/i, 'E-commerce products'],
    [/category|tag/i, 'Taxonomy/Classification'],
    [/author|team|person/i, 'People/Authors'],
    [/banner|hero|cta/i, 'Marketing blocks'],
    [/nav|menu/i, 'Navigation'],
    [/setting|config/i, 'Configuration'],
    [/faq/i, 'FAQ content'],
    [/testimonial|review/i, 'Social proof'],
    [/event/i, 'Events'],
    [/form/i, 'Form handling'],
  ];
  
  for (const [pattern, purpose] of patterns) {
    if (pattern.test(name)) {
      return purpose;
    }
  }
  
  return undefined;
}

/**
 * Analyze content adoption across all models
 */
export function analyzeContentAdoption(
  schema: HygraphSchema,
  entryCounts: Record<string, { draft: number; published: number }>
): ContentAdoptionAnalysis {
  const customModels = filterSystemModels(schema.models);
  
  const ghostModels: GhostModel[] = [];
  const underutilized: AdoptionCategory[] = [];
  const lowAdoption: AdoptionCategory[] = [];
  const healthy: AdoptionCategory[] = [];
  const highVolume: AdoptionCategory[] = [];
  
  for (const model of customModels) {
    const counts = entryCounts[model.name] || { draft: 0, published: 0 };
    const totalEntries = counts.draft; // In Hygraph, draft = total entries
    const published = counts.published;
    const draftOnly = Math.max(0, totalEntries - published);
    
    const hasRelations = model.fields.some(f => f.relatedModel);
    
    const category: AdoptionCategory = {
      model: model.name,
      entries: totalEntries,
      published,
      draftOnly,
      fieldCount: model.fields.length,
    };
    
    if (totalEntries === 0) {
      ghostModels.push({
        model: model.name,
        fieldCount: model.fields.length,
        hasRelations,
        createdFor: inferModelPurpose(model.name),
      });
    } else if (totalEntries < 5) {
      underutilized.push(category);
    } else if (totalEntries < 20) {
      lowAdoption.push(category);
    } else if (totalEntries < 500) {
      healthy.push(category);
    } else {
      highVolume.push(category);
    }
  }
  
  // Sort by entry count
  underutilized.sort((a, b) => a.entries - b.entries);
  lowAdoption.sort((a, b) => a.entries - b.entries);
  healthy.sort((a, b) => b.entries - a.entries);
  highVolume.sort((a, b) => b.entries - a.entries);
  
  // Calculate metrics
  const totalModels = customModels.length;
  const modelsWithContent = totalModels - ghostModels.length;
  const adoptionRate = totalModels > 0 
    ? Math.round((modelsWithContent / totalModels) * 100) 
    : 0;
  
  // Generate recommendations
  const recommendations: string[] = [];
  
  if (ghostModels.length > 0) {
    if (ghostModels.length === 1) {
      recommendations.push(
        `"${ghostModels[0].model}" has no content - consider removing or populating it`
      );
    } else if (ghostModels.length <= 3) {
      recommendations.push(
        `${ghostModels.length} ghost models found (${ghostModels.map(g => g.model).join(', ')}) - review if still needed`
      );
    } else {
      recommendations.push(
        `${ghostModels.length} ghost models with 0 entries - significant schema cleanup opportunity`
      );
    }
  }
  
  if (underutilized.length > 0) {
    const names = underutilized.slice(0, 3).map(u => u.model).join(', ');
    recommendations.push(
      `${underutilized.length} underutilized models (<5 entries): ${names}${underutilized.length > 3 ? '...' : ''}`
    );
  }
  
  if (highVolume.length > 0) {
    const largest = highVolume[0];
    recommendations.push(
      `"${largest.model}" has ${largest.entries.toLocaleString()} entries - ensure queries use pagination`
    );
  }
  
  // Check for models with high draft ratio
  const highDraftRatio = [...underutilized, ...lowAdoption, ...healthy, ...highVolume]
    .filter(m => m.entries > 5 && m.draftOnly > m.published);
  
  if (highDraftRatio.length > 0) {
    const model = highDraftRatio[0];
    recommendations.push(
      `"${model.model}" has more drafts (${model.draftOnly}) than published (${model.published}) - review publishing workflow`
    );
  }
  
  if (recommendations.length === 0) {
    recommendations.push('Content adoption is healthy across all models');
  }
  
  // Calculate score
  let score = 100;
  
  // Penalize ghost models
  const ghostPenalty = Math.min(ghostModels.length * 5, 30);
  score -= ghostPenalty;
  
  // Penalize underutilized
  const underutilizedPenalty = Math.min(underutilized.length * 2, 15);
  score -= underutilizedPenalty;
  
  // Bonus for high adoption
  if (adoptionRate >= 90) score += 5;
  
  score = Math.max(0, Math.min(100, score));
  
  return {
    ghostModels,
    underutilized,
    lowAdoption,
    healthy,
    highVolume,
    adoptionRate,
    totalModels,
    modelsWithContent,
    distribution: {
      ghost: ghostModels.length,
      underutilized: underutilized.length,
      lowAdoption: lowAdoption.length,
      healthy: healthy.length,
      highVolume: highVolume.length,
    },
    recommendations,
    overallScore: score,
  };
}

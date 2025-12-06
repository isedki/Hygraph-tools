import type {
  ContentStrategyAnalysis,
  EditorialAnalysis,
  EditorialVelocityEstimate,
  ModelVelocityBreakdown,
  VelocityCalculation,
} from '../types';

/**
 * TIME ESTIMATION FORMULA (transparent)
 * 
 * Base time: 3 minutes (navigate to model, create entry, save)
 * 
 * Per-field cost:
 * - Simple fields (text, number, boolean): 0.2 min each
 * - Rich text fields: 0.5 min each
 * - Reference fields: 0.5 min each (search + select)
 * 
 * Required field overhead: +0.15 min per required field (validation friction)
 * 
 * Complexity multiplier:
 * - 5+ relations: +1 min per additional relation
 * - 20+ fields: +0.1 min per additional field
 * 
 * This formula is an ESTIMATE based on typical CMS editing patterns.
 * Actual times vary based on content complexity and editor experience.
 */

const FORMULA_EXPLANATION = `
**Time Estimate Formula:**

\`Time = Base (3 min) + Fields + Required Overhead + Relations + Complexity\`

- **Base**: 3 min (create entry, navigate, save)
- **Fields**: 0.2 min × field count
- **Required Overhead**: 0.15 min × required field count
- **Relations**: 0.5 min × relation count (search & select)
- **Complexity Bonus**: Extra time for models >20 fields or >5 relations

*Note: These are estimates based on typical CMS editing patterns.*
`;

/**
 * Estimate how long it takes editors to publish content for key models.
 * Uses field counts, required ratio, relations, and known complexity signals.
 * All calculations are transparent with visible formulas.
 */
export function analyzeEditorialVelocity(
  editorial: EditorialAnalysis,
  contentStrategy: ContentStrategyAnalysis
): EditorialVelocityEstimate {
  const breakdown = editorial.modelComplexity.map(model => {
    return calculateModelVelocity(model, contentStrategy);
  });

  // Sort by time (slowest first) and take top models
  const sortedBreakdown = breakdown
    .sort((a, b) => b.estimatedMinutes - a.estimatedMinutes)
    .slice(0, 8);

  // Calculate average across all models
  const totalMinutes = breakdown.reduce((sum, item) => sum + item.estimatedMinutes, 0);
  const averageMinutes = Math.round(totalMinutes / Math.max(breakdown.length, 1));

  // Identify bottlenecks
  const bottlenecks = contentStrategy.editorialExperience.complexModels
    .slice(0, 5)
    .map(model => {
      const velocityData = breakdown.find(b => b.model === model.name);
      const extraTime = velocityData ? velocityData.estimatedMinutes - averageMinutes : 0;
      return {
        model: model.name,
        issue: model.issues.join(', '),
        timeCost: extraTime > 0 ? `+${extraTime} min above average` : 'At average',
      };
    });

  const velocityTips = generateTips(averageMinutes, bottlenecks.length, sortedBreakdown);

  return {
    averageTimeToPublish: `~${averageMinutes} minute${averageMinutes === 1 ? '' : 's'}`,
    narrative: buildNarrative(averageMinutes, bottlenecks.length),
    formulaExplanation: FORMULA_EXPLANATION.trim(),
    modelComplexityBreakdown: sortedBreakdown,
    bottlenecks,
    velocityTips,
  };
}

/**
 * Calculate velocity for a single model with full formula breakdown
 */
function calculateModelVelocity(
  model: {
    model: string;
    fieldCount: number;
    requiredFields: number;
    relationCount: number;
    complexityScore: number;
  },
  contentStrategy: ContentStrategyAnalysis
): ModelVelocityBreakdown {
  const calculations: VelocityCalculation[] = [];
  
  // Base time
  const baseTime = 3;
  calculations.push({
    component: 'Base time',
    value: 0,
    contribution: baseTime,
    formula: '3 min (create entry, navigate, save)',
  });

  // Field time (0.2 min per field)
  const fieldMultiplier = 0.2;
  const fieldTime = Math.round(model.fieldCount * fieldMultiplier * 10) / 10;
  calculations.push({
    component: 'Fields',
    value: model.fieldCount,
    contribution: fieldTime,
    formula: `${model.fieldCount} fields × ${fieldMultiplier} min = ${fieldTime} min`,
  });

  // Required field overhead (0.15 min per required field)
  const requiredMultiplier = 0.15;
  const requiredTime = Math.round(model.requiredFields * requiredMultiplier * 10) / 10;
  if (requiredTime > 0) {
    calculations.push({
      component: 'Required fields overhead',
      value: model.requiredFields,
      contribution: requiredTime,
      formula: `${model.requiredFields} required × ${requiredMultiplier} min = ${requiredTime} min`,
    });
  }

  // Relation time (0.5 min per relation)
  const relationMultiplier = 0.5;
  const relationTime = Math.round(model.relationCount * relationMultiplier * 10) / 10;
  if (relationTime > 0) {
    calculations.push({
      component: 'Relations (search & select)',
      value: model.relationCount,
      contribution: relationTime,
      formula: `${model.relationCount} relations × ${relationMultiplier} min = ${relationTime} min`,
    });
  }

  // Complexity bonus for large models
  let complexityTime = 0;
  
  if (model.fieldCount > 20) {
    const extraFields = model.fieldCount - 20;
    const extraTime = Math.round(extraFields * 0.1 * 10) / 10;
    complexityTime += extraTime;
    calculations.push({
      component: 'Large model penalty',
      value: extraFields,
      contribution: extraTime,
      formula: `${extraFields} fields over 20 × 0.1 min = ${extraTime} min`,
    });
  }

  if (model.relationCount > 5) {
    const extraRelations = model.relationCount - 5;
    const extraTime = extraRelations * 1;
    complexityTime += extraTime;
    calculations.push({
      component: 'Many relations penalty',
      value: extraRelations,
      contribution: extraTime,
      formula: `${extraRelations} relations over 5 × 1 min = ${extraTime} min`,
    });
  }

  // Total time
  const totalTime = Math.round(Math.max(5, baseTime + fieldTime + requiredTime + relationTime + complexityTime));

  // Generate factors (human-readable summary)
  const factors: string[] = [];
  if (model.fieldCount > 25) factors.push(`${model.fieldCount} fields`);
  if (model.requiredFields > 8) factors.push(`${model.requiredFields} required fields`);
  if (model.relationCount >= 3) factors.push(`${model.relationCount} relations`);
  
  // Check if model is marked as complex in content strategy
  const complexModel = contentStrategy.editorialExperience.complexModels.find(
    m => m.name === model.model
  );
  if (complexModel) {
    factors.push(...complexModel.issues.filter(i => !factors.some(f => i.includes(f))));
  }

  // Build formula summary
  const parts: string[] = [`Base (${baseTime})`];
  if (fieldTime > 0) parts.push(`Fields (${fieldTime})`);
  if (requiredTime > 0) parts.push(`Required (${requiredTime})`);
  if (relationTime > 0) parts.push(`Relations (${relationTime})`);
  if (complexityTime > 0) parts.push(`Complexity (${complexityTime})`);
  const formulaSummary = `${parts.join(' + ')} = ${totalTime} min`;

  return {
    model: model.model,
    estimatedMinutes: totalTime,
    calculation: calculations,
    factors: factors.length > 0 ? factors : ['Simple model structure'],
    formulaSummary,
  };
}

function buildNarrative(averageMinutes: number, bottleneckCount: number): string {
  if (averageMinutes <= 8) {
    return 'Editors can publish most entries quickly. The schema supports fast content creation.';
  }
  if (averageMinutes <= 14) {
    return `Average publishing time is ${averageMinutes} minutes. Simplifying the ${bottleneckCount || 'most complex'} model(s) could reduce this.`;
  }
  return `Content creation averages ~${averageMinutes} minutes per entry. ${bottleneckCount || 'Several'} high-friction models should be prioritized for simplification.`;
}

function generateTips(
  averageMinutes: number, 
  bottleneckCount: number,
  breakdown: ModelVelocityBreakdown[]
): string[] {
  const tips: string[] = [];

  // Identify the biggest time contributors
  const slowestModel = breakdown[0];
  if (slowestModel && slowestModel.estimatedMinutes > 15) {
    const biggestContributor = slowestModel.calculation
      .filter(c => c.component !== 'Base time')
      .sort((a, b) => b.contribution - a.contribution)[0];
    
    if (biggestContributor) {
      if (biggestContributor.component === 'Fields') {
        tips.push(`"${slowestModel.model}" has ${biggestContributor.value} fields. Group into components or tabs to reduce scrolling.`);
      } else if (biggestContributor.component.includes('Relations')) {
        tips.push(`"${slowestModel.model}" has ${biggestContributor.value} relations. Consider inline editing or reference presets.`);
      }
    }
  }

  // General tips based on patterns
  if (averageMinutes > 10) {
    tips.push('Split long forms into guided sections using field groups or components.');
  }
  
  if (bottleneckCount > 0) {
    tips.push('Prioritize simplifying the slowest models for maximum time savings.');
  }

  // Always include documentation tip
  tips.push('Add field-level descriptions or examples to reduce clarification loops.');

  return tips.slice(0, 3);
}

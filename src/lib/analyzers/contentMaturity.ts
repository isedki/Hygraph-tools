import type {
  ComponentAnalysis,
  ContentMaturityAssessment,
  ContentStrategyAnalysis,
  SchemaAnalysis,
  HygraphSchema,
  ScoreContribution,
  DimensionScore,
  ScoreBreakdown,
} from '../types';

// Presentation/layout field patterns that indicate coupling
const PRESENTATION_FIELD_PATTERNS = [
  /^background(Color|Image|Gradient)?$/i,
  /^(text|font|border|outline)Color$/i,
  /^(bg|fg)Color$/i,
  /^color$/i,
  /^(padding|margin)(Top|Bottom|Left|Right)?$/i,
  /^(text)?align(ment)?$/i,
  /^justify(Content)?$/i,
  /^(flex|grid)(Direction|Wrap|Gap)?$/i,
  /^(width|height|maxWidth|minHeight)$/i,
  /^(border)(Radius|Width|Style)?$/i,
  /^opacity$/i,
  /^zIndex$/i,
  /^position$/i,
  /^display(Mode)?$/i,
  /^theme$/i,
  /^colorScheme$/i,
  /^variant$/i,
  /^style$/i,
];

// Config/display toggle patterns
const CONFIG_FIELD_PATTERNS = [
  /^show[A-Z]/,    // showHeader, showFooter, etc.
  /^hide[A-Z]/,    // hideOnMobile, etc.
  /^display[A-Z]/, // displayMode, displayOrder
  /^is(Visible|Hidden|Enabled|Disabled)$/i,
  /^(columns?|rows?|grid)$/i,
  /^layout(Type|Mode)?$/i,
  /^order$/i,
  /^sort(Order)?$/i,
  /^(animate|animation)/i,
  /^transition/i,
];

// Content model name patterns (where coupling is problematic)
const CONTENT_MODEL_PATTERNS = [
  /article/i, /post/i, /page/i, /blog/i, /news/i, /story/i,
  /product/i, /category/i, /event/i, /author/i, /person/i,
  /faq/i, /testimonial/i, /review/i, /comment/i,
];

interface IntuitivenesResult {
  contributions: ScoreContribution[];
}

interface DecouplingResult {
  contributions: ScoreContribution[];
  coupledFields: { model: string; field: string; reason: string }[];
}

/**
 * Evaluate overall content maturity across structure, reuse, editorial clarity, and scalability.
 * Uses factual signals: nesting depth, editorial intuitiveness, content/design decoupling, etc.
 * 
 * SCORING APPROACH: Issue-driven
 * - Start from 100
 * - Subtract penalties for detected issues (with clear reasons)
 * - Add bonuses for detected best practices (with clear reasons)
 * - Every point change must be traceable to a specific finding
 */
export function analyzeContentMaturity(
  schema: HygraphSchema,
  schemaAnalysis: SchemaAnalysis,
  components: ComponentAnalysis,
  contentStrategy: ContentStrategyAnalysis
): ContentMaturityAssessment {
  // === STRUCTURE DIMENSION ===
  const structureResult = calculateStructureScore(schemaAnalysis, contentStrategy);

  // === REUSE DIMENSION ===
  const reuseResult = calculateReuseScore(components, contentStrategy);

  // === EDITORIAL CLARITY DIMENSION (replaces old governance) ===
  const editorialClarityResult = calculateEditorialClarityScore(schema, contentStrategy);

  // === SCALABILITY DIMENSION ===
  const scalabilityResult = calculateScalabilityScore(schemaAnalysis);

  // Calculate overall score from dimensions
  const dimensionScores = [
    structureResult.score,
    reuseResult.score,
    editorialClarityResult.score,
    scalabilityResult.score,
  ];
  const averageScore = Math.round(dimensionScores.reduce((a, b) => a + b, 0) / 4);
  const levelData = mapScoreToLevel(averageScore);

  // Build overall breakdown
  const overallContributions: ScoreContribution[] = [
    { reason: `Structure dimension score`, value: structureResult.score - 100, details: `${structureResult.score}/100` },
    { reason: `Reuse dimension score`, value: reuseResult.score - 100, details: `${reuseResult.score}/100` },
    { reason: `Editorial Clarity dimension score`, value: editorialClarityResult.score - 100, details: `${editorialClarityResult.score}/100` },
    { reason: `Scalability dimension score`, value: scalabilityResult.score - 100, details: `${scalabilityResult.score}/100` },
  ];

  const overallBreakdown: ScoreBreakdown = {
    finalScore: averageScore,
    baseScore: 100,
    contributions: overallContributions,
    formula: `Average of 4 dimensions: (${structureResult.score} + ${reuseResult.score} + ${editorialClarityResult.score} + ${scalabilityResult.score}) ÷ 4 = ${averageScore}`,
  };

  const nextLevelActions = buildNextLevelActions(
    structureResult,
    reuseResult,
    editorialClarityResult,
    scalabilityResult,
    levelData.level
  );

  return {
    level: levelData.level,
    label: levelData.label,
    narrative: levelData.narrative,
    dimensions: {
      structure: structureResult,
      reuse: reuseResult,
      governance: editorialClarityResult,
      scalability: scalabilityResult,
    },
    overallBreakdown,
    nextLevelActions,
  };
}

/**
 * STRUCTURE DIMENSION
 * Evaluates: duplicate models, orphan models, nesting depth, bidirectional refs
 */
function calculateStructureScore(
  schemaAnalysis: SchemaAnalysis,
  contentStrategy: ContentStrategyAnalysis
): DimensionScore {
  const contributions: ScoreContribution[] = [];
  let score = 100;

  // Penalty: Duplicate models
  const duplicateCount = contentStrategy.modelUsage.duplicateModels.length;
  if (duplicateCount > 0) {
    const penalty = duplicateCount * 8;
    score -= penalty;
    const modelNames = contentStrategy.modelUsage.duplicateModels
      .flatMap(d => d.models)
      .slice(0, 4)
      .join(', ');
    contributions.push({
      reason: `${duplicateCount} duplicate model pattern(s) detected`,
      value: -penalty,
      details: `Models with 70%+ similar fields: ${modelNames}`,
    });
  }

  // Penalty: Orphan models (no content AND not referenced)
  const orphanCount = schemaAnalysis.orphanModels.length;
  if (orphanCount > 0) {
    const penalty = Math.min(orphanCount * 4, 20);
    score -= penalty;
    contributions.push({
      reason: `${orphanCount} orphan model(s) with no content or references`,
      value: -penalty,
      details: `Models: ${schemaAnalysis.orphanModels.slice(0, 4).join(', ')}${orphanCount > 4 ? '...' : ''}`,
    });
  }

  // Penalty: Deep nesting
  const deepPaths = schemaAnalysis.deepNestingPaths.filter(p => p.length >= 5);
  if (deepPaths.length > 0) {
    const penalty = deepPaths.length * 6;
    score -= penalty;
    contributions.push({
      reason: `${deepPaths.length} relation chain(s) with 5+ levels`,
      value: -penalty,
      details: `Deepest: ${deepPaths[0]?.join(' → ')}`,
    });
  } else if (schemaAnalysis.maxNestingDepth > 3) {
    const penalty = (schemaAnalysis.maxNestingDepth - 3) * 3;
    score -= penalty;
    contributions.push({
      reason: `Max nesting depth is ${schemaAnalysis.maxNestingDepth} levels`,
      value: -penalty,
      details: 'Consider flattening for query performance',
    });
  }

  // Bonus: Bidirectional relations (Hygraph best practice)
  const twoWayCount = schemaAnalysis.twoWayReferences.length;
  if (twoWayCount > 0) {
    const bonus = Math.min(twoWayCount * 3, 10);
    score += bonus;
    contributions.push({
      reason: `${twoWayCount} bidirectional relation(s) enable flexible navigation`,
      value: bonus,
      details: schemaAnalysis.twoWayReferences.slice(0, 3).map(r => r.join(' ↔ ')).join(', '),
    });
  }

  // Bonus: No structural issues
  if (contributions.length === 0) {
    contributions.push({
      reason: 'Clean structure with no detected issues',
      value: 0,
      details: 'No duplicate models, orphans, or deep nesting',
    });
  }

  score = clampScore(score);

  return {
    score,
    assessment: generateStructureAssessment(score, contributions),
    breakdown: contributions,
  };
}

/**
 * REUSE DIMENSION
 * Evaluates: component usage, reuse rate, unused components, missing componentization
 */
function calculateReuseScore(
  components: ComponentAnalysis,
  contentStrategy: ContentStrategyAnalysis
): DimensionScore {
  const contributions: ScoreContribution[] = [];
  let score = 100;

  // Base from actual reuse score (0-100)
  const reuseRate = components.reuseScore;
  if (reuseRate < 50) {
    const penalty = Math.round((50 - reuseRate) * 0.6);
    score -= penalty;
    contributions.push({
      reason: `Component reuse score is ${reuseRate}%`,
      value: -penalty,
      details: 'Components are defined but not widely reused',
    });
  } else if (reuseRate >= 70) {
    const bonus = Math.round((reuseRate - 70) * 0.3);
    score += bonus;
    contributions.push({
      reason: `Strong component reuse (${reuseRate}%)`,
      value: bonus,
      details: 'Components are well-utilized across models',
    });
  }

  // Penalty: Unused components
  const unusedCount = components.unusedComponents.length;
  if (unusedCount > 0) {
    const penalty = Math.min(unusedCount * 4, 16);
    score -= penalty;
    contributions.push({
      reason: `${unusedCount} unused component(s)`,
      value: -penalty,
      details: `Components: ${components.unusedComponents.slice(0, 4).join(', ')}`,
    });
  }

  // Penalty: Missing componentization opportunities
  const missingCount = contentStrategy.componentStrategy.missingComponents.length;
  if (missingCount > 0) {
    const penalty = Math.min(missingCount * 5, 15);
    score -= penalty;
    const details = contentStrategy.componentStrategy.missingComponents
      .slice(0, 2)
      .map(m => m.description)
      .join('; ');
    contributions.push({
      reason: `${missingCount} field pattern(s) should be componentized`,
      value: -penalty,
      details,
    });
  }

  // Penalty: No components at all
  if (components.components.length === 0 && contentStrategy.componentStrategy.missingComponents.length > 0) {
    score -= 15;
    contributions.push({
      reason: 'No components defined despite duplicate patterns',
      value: -15,
      details: 'Consider creating components for repeated field groups',
    });
  }

  // Bonus: Well-designed components
  const wellDesignedCount = contentStrategy.componentStrategy.wellDesigned.length;
  if (wellDesignedCount >= 3) {
    const bonus = Math.min(wellDesignedCount * 2, 10);
    score += bonus;
    contributions.push({
      reason: `${wellDesignedCount} well-designed, reusable component(s)`,
      value: bonus,
      details: contentStrategy.componentStrategy.wellDesigned.slice(0, 3).join(', '),
    });
  }

  score = clampScore(score);

  return {
    score,
    assessment: generateReuseAssessment(score, contributions),
    breakdown: contributions,
  };
}

/**
 * EDITORIAL CLARITY DIMENSION
 * Evaluates: content/design separation, field intuitiveness, documentation
 */
function calculateEditorialClarityScore(
  schema: HygraphSchema,
  contentStrategy: ContentStrategyAnalysis
): DimensionScore {
  const contributions: ScoreContribution[] = [];
  let score = 100;

  const customModels = schema.models.filter(m => !m.isSystem);
  if (customModels.length === 0) {
    return {
      score: 50,
      assessment: 'No custom models to evaluate',
      breakdown: [{ reason: 'No custom models defined', value: -50 }],
    };
  }

  // 1. Content/Design decoupling
  const decoupling = calculateDecouplingScore(schema);
  for (const contrib of decoupling.contributions) {
    score += contrib.value;
    contributions.push(contrib);
  }

  // 2. Field count per model
  const avgFields = customModels.reduce((sum, m) => sum + m.fields.length, 0) / customModels.length;
  if (avgFields <= 12) {
    contributions.push({
      reason: `Models are concise (avg ${avgFields.toFixed(1)} fields)`,
      value: 8,
      details: 'Editors see manageable forms',
    });
    score += 8;
  } else if (avgFields > 25) {
    const penalty = Math.min(Math.round((avgFields - 25) * 1.5), 20);
    contributions.push({
      reason: `Models are complex (avg ${avgFields.toFixed(1)} fields)`,
      value: -penalty,
      details: 'Editors face overwhelming forms',
    });
    score -= penalty;
  }

  // 3. Required field ratio
  let totalFields = 0;
  let requiredFields = 0;
  for (const model of customModels) {
    for (const field of model.fields) {
      totalFields++;
      if (field.isRequired) requiredFields++;
    }
  }
  const requiredRatio = totalFields > 0 ? requiredFields / totalFields : 0;
  if (requiredRatio > 0.6) {
    const penalty = Math.round((requiredRatio - 0.6) * 30);
    contributions.push({
      reason: `High required-field ratio (${(requiredRatio * 100).toFixed(0)}%)`,
      value: -penalty,
      details: 'Editors have little flexibility',
    });
    score -= penalty;
  } else if (requiredRatio <= 0.3) {
    contributions.push({
      reason: `Balanced required fields (${(requiredRatio * 100).toFixed(0)}%)`,
      value: 5,
      details: 'Good mix of required and optional fields',
    });
    score += 5;
  }

  // 4. Documentation coverage
  const modelsWithDesc = customModels.filter(m => 
    m.fields.some(f => f.description && f.description.length > 0)
  );
  const descRatio = modelsWithDesc.length / customModels.length;
  if (descRatio >= 0.7) {
    contributions.push({
      reason: `Good documentation (${modelsWithDesc.length}/${customModels.length} models)`,
      value: 8,
      details: 'Field descriptions guide editors',
    });
    score += 8;
  } else if (descRatio < 0.3) {
    contributions.push({
      reason: `Limited documentation (${modelsWithDesc.length}/${customModels.length} models)`,
      value: -10,
      details: 'Editors lack guidance on most fields',
    });
    score -= 10;
  }

  // 5. Complex models from content strategy
  const complexCount = contentStrategy.editorialExperience.complexModels.length;
  if (complexCount > 0) {
    const penalty = Math.min(complexCount * 5, 20);
    const modelNames = contentStrategy.editorialExperience.complexModels
      .slice(0, 3)
      .map(m => m.name)
      .join(', ');
    contributions.push({
      reason: `${complexCount} complex model(s) slow editors`,
      value: -penalty,
      details: `Models: ${modelNames}`,
    });
    score -= penalty;
  }

  // 6. Editor-friendly models bonus
  const friendlyCount = contentStrategy.editorialExperience.editorFriendlyModels.length;
  if (friendlyCount >= 5) {
    contributions.push({
      reason: `${friendlyCount} editor-friendly models`,
      value: 6,
      details: 'Simple, well-scoped content types',
    });
    score += 6;
  }

  score = clampScore(score);

  return {
    score,
    assessment: generateEditorialAssessment(score, contributions),
    breakdown: contributions,
  };
}

/**
 * SCALABILITY DIMENSION
 * Evaluates: schema size, growth readiness
 */
function calculateScalabilityScore(schemaAnalysis: SchemaAnalysis): DimensionScore {
  const contributions: ScoreContribution[] = [];
  let score = 100;

  // Model count
  const modelCount = schemaAnalysis.modelCount;
  if (modelCount > 50) {
    const penalty = Math.min((modelCount - 50) * 2, 25);
    contributions.push({
      reason: `Large schema with ${modelCount} models`,
      value: -penalty,
      details: 'May face governance challenges',
    });
    score -= penalty;
  } else if (modelCount > 30) {
    const penalty = Math.min((modelCount - 30) * 1, 10);
    contributions.push({
      reason: `Schema has ${modelCount} models`,
      value: -penalty,
      details: 'Approaching complexity threshold',
    });
    score -= penalty;
  } else if (modelCount <= 20) {
    contributions.push({
      reason: `Focused schema (${modelCount} models)`,
      value: 5,
      details: 'Room for growth without complexity',
    });
    score += 5;
  }

  // Total fields
  const totalFields = schemaAnalysis.totalFields;
  if (totalFields > 600) {
    const penalty = Math.min(Math.round((totalFields - 600) / 30), 15);
    contributions.push({
      reason: `${totalFields} total fields across schema`,
      value: -penalty,
      details: 'High field count increases maintenance burden',
    });
    score -= penalty;
  }

  // Component count (positive for modularity)
  const componentCount = schemaAnalysis.componentCount;
  if (componentCount >= 5) {
    contributions.push({
      reason: `${componentCount} components for modular content`,
      value: 5,
      details: 'Good foundation for reusability',
    });
    score += 5;
  } else if (componentCount === 0 && modelCount > 10) {
    contributions.push({
      reason: 'No components for a schema with 10+ models',
      value: -8,
      details: 'Consider componentization for scalability',
    });
    score -= 8;
  }

  // Enum count (controlled vocabularies)
  const enumCount = schemaAnalysis.enumCount;
  if (enumCount > 0) {
    contributions.push({
      reason: `${enumCount} enum(s) for controlled options`,
      value: 3,
      details: 'Enums ensure consistent values',
    });
    score += 3;
  }

  score = clampScore(score);

  return {
    score,
    assessment: generateScalabilityAssessment(score, contributions),
    breakdown: contributions,
  };
}

/**
 * Calculate content/design decoupling score.
 * Detects layout, styling, and config fields on content models.
 */
function calculateDecouplingScore(schema: HygraphSchema): DecouplingResult {
  const contributions: ScoreContribution[] = [];
  const coupledFields: { model: string; field: string; reason: string }[] = [];

  // Identify content models (where coupling is problematic)
  const contentModels = schema.models.filter(m => 
    !m.isSystem && CONTENT_MODEL_PATTERNS.some(p => p.test(m.name))
  );

  // If no obvious content models, check all custom models
  const modelsToCheck = contentModels.length > 0 
    ? contentModels 
    : schema.models.filter(m => !m.isSystem);

  for (const model of modelsToCheck) {
    for (const field of model.fields) {
      const name = field.name;

      // Check presentation fields
      const isPresentationField = PRESENTATION_FIELD_PATTERNS.some(p => p.test(name));
      if (isPresentationField) {
        coupledFields.push({
          model: model.name,
          field: name,
          reason: 'Layout/styling field on content model',
        });
        continue;
      }

      // Check config fields
      const isConfigField = CONFIG_FIELD_PATTERNS.some(p => p.test(name));
      if (isConfigField) {
        coupledFields.push({
          model: model.name,
          field: name,
          reason: 'Display/config toggle on content model',
        });
        continue;
      }

      // Check enum fields that look like styling
      if (field.enumValues && field.enumValues.length > 0) {
        const enumName = field.name.toLowerCase();
        const values = field.enumValues.map(v => v.toLowerCase()).join(' ');
        if (
          /theme|color|style|variant|size|align/i.test(enumName) ||
          /dark|light|primary|secondary|small|medium|large|left|center|right/i.test(values)
        ) {
          coupledFields.push({
            model: model.name,
            field: field.name,
            reason: 'Styling enum on content model',
          });
        }
      }
    }
  }

  // Generate contributions based on findings
  if (coupledFields.length === 0) {
    contributions.push({
      reason: 'Content is well-separated from presentation',
      value: 12,
      details: 'No layout/styling fields on content models',
    });
  } else if (coupledFields.length <= 3) {
    contributions.push({
      reason: `${coupledFields.length} layout/styling field(s) on content models`,
      value: -5,
      details: coupledFields.map(f => `${f.model}.${f.field}`).join(', '),
    });
  } else if (coupledFields.length <= 8) {
    contributions.push({
      reason: `${coupledFields.length} layout/styling fields mixed with content`,
      value: -12,
      details: `Examples: ${coupledFields.slice(0, 3).map(f => `${f.model}.${f.field}`).join(', ')}`,
    });
  } else {
    contributions.push({
      reason: `${coupledFields.length}+ layout/styling fields tightly coupled to content`,
      value: -20,
      details: 'Content and presentation are intertwined, limiting channel flexibility',
    });
  }

  // Bonus if components properly isolate layout
  const layoutComponents = schema.components.filter(c => 
    /layout|config|style|theme|display/i.test(c.name)
  );
  if (layoutComponents.length > 0 && coupledFields.length < 5) {
    contributions.push({
      reason: `${layoutComponents.length} layout/style component(s) properly isolate presentation`,
      value: 6,
      details: layoutComponents.map(c => c.name).join(', '),
    });
  }

  return { contributions, coupledFields };
}

function clampScore(value: number): number {
  return Math.max(20, Math.min(100, Math.round(value)));
}

function mapScoreToLevel(score: number): { 
  level: ContentMaturityAssessment['level']; 
  label: ContentMaturityAssessment['label']; 
  narrative: string 
} {
  if (score >= 85) {
    return { 
      level: 5, 
      label: 'Optimized', 
      narrative: 'Content platform is optimized with reusable patterns, clean separation, and strong editorial clarity.' 
    };
  }
  if (score >= 70) {
    return { 
      level: 4, 
      label: 'Managed', 
      narrative: 'Schema is well-managed with clear structure and content properly separated from presentation.' 
    };
  }
  if (score >= 55) {
    return { 
      level: 3, 
      label: 'Defined', 
      narrative: 'Foundational standards exist but content/design coupling or complexity needs attention.' 
    };
  }
  if (score >= 40) {
    return { 
      level: 2, 
      label: 'Reactive', 
      narrative: 'Schema supports current needs but mixing content with layout limits flexibility.' 
    };
  }
  return { 
    level: 1, 
    label: 'Chaotic', 
    narrative: 'Content model lacks structure; presentation and content are intertwined.' 
  };
}

function generateStructureAssessment(score: number, contributions: ScoreContribution[]): string {
  const issues = contributions.filter(c => c.value < 0);
  const strengths = contributions.filter(c => c.value > 0);
  
  if (score >= 75) {
    return 'Models follow clear patterns with minimal duplication and shallow nesting.';
  }
  if (score >= 55) {
    const issueCount = issues.length;
    return `Structure works but has ${issueCount} issue(s) that could slow queries or confuse editors.`;
  }
  return 'Schema needs consolidation—structural issues create friction for both developers and editors.';
}

function generateReuseAssessment(score: number, contributions: ScoreContribution[]): string {
  if (score >= 70) {
    return 'Components drive most repetitive content, reducing duplication.';
  }
  if (score >= 45) {
    return 'Some reuse exists; expand component coverage to reduce copy-paste patterns.';
  }
  return 'Content relies on copy-paste patterns; introduce shared components.';
}

function generateEditorialAssessment(score: number, contributions: ScoreContribution[]): string {
  if (score >= 70) {
    return 'Content is well-separated from layout; editors focus on meaning, not styling.';
  }
  if (score >= 50) {
    return 'Some layout/config fields mixed into content models—consider separating.';
  }
  return 'Content and presentation are tightly coupled, limiting channel flexibility.';
}

function generateScalabilityAssessment(score: number, contributions: ScoreContribution[]): string {
  if (score >= 70) {
    return 'Schema can grow without major refactors.';
  }
  if (score >= 50) {
    return 'Growth is possible but requires oversight.';
  }
  return 'Complexity will increase quickly unless structure is simplified.';
}

function buildNextLevelActions(
  structure: DimensionScore,
  reuse: DimensionScore,
  editorial: DimensionScore,
  scalability: DimensionScore,
  level: ContentMaturityAssessment['level']
): string[] {
  const actions: string[] = [];

  // Get specific issues from breakdowns
  const structureIssues = structure.breakdown.filter(c => c.value < 0);
  const reuseIssues = reuse.breakdown.filter(c => c.value < 0);
  const editorialIssues = editorial.breakdown.filter(c => c.value < 0);
  const scalabilityIssues = scalability.breakdown.filter(c => c.value < 0);

  // Structure actions
  if (structure.score < 65 && structureIssues.length > 0) {
    const topIssue = structureIssues[0];
    actions.push(`Fix: ${topIssue.reason}${topIssue.details ? ` (${topIssue.details})` : ''}`);
  }

  // Reuse actions
  if (reuse.score < 65 && reuseIssues.length > 0) {
    const topIssue = reuseIssues[0];
    actions.push(`Fix: ${topIssue.reason}`);
  }

  // Editorial clarity actions
  if (editorial.score < 65 && editorialIssues.length > 0) {
    const topIssue = editorialIssues[0];
    actions.push(`Fix: ${topIssue.reason}`);
  }

  // Scalability actions
  if (scalability.score < 65 && scalabilityIssues.length > 0) {
    const topIssue = scalabilityIssues[0];
    actions.push(`Fix: ${topIssue.reason}`);
  }

  // Generic level-up advice if no specific issues
  if (actions.length === 0 && level < 5) {
    actions.push('Maintain current standards and continue separating content from presentation concerns.');
  }

  return actions.slice(0, 3);
}

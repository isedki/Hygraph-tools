import type {
  ComponentAnalysis,
  ContentStrategyAnalysis,
  HygraphSchema,
  OmnichannelReadiness,
  OmnichannelIndicator,
  SchemaAnalysis,
  ScoreBreakdown,
  ScoreContribution,
} from '../types';

const PRESENTATION_FIELD_REGEX = /(html|markup|color|background|inlineStyle)/i;
const MOBILE_FIELD_REGEX = /(mobile|tablet|responsive|breakpoint)/i;
const EMAIL_FIELD_REGEX = /(subject|preheader|headline|snippet)/i;

/**
 * Evaluate how channel-agnostic the content model is and highlight readiness gaps.
 * 
 * SCORING APPROACH: Issue-driven with transparent breakdown
 * - Each indicator starts at 100
 * - Subtract penalties for detected issues
 * - Add bonuses for best practices
 * - Every point change is traceable
 */
export function analyzeOmnichannelReadiness(
  schema: HygraphSchema,
  schemaAnalysis: SchemaAnalysis,
  components: ComponentAnalysis,
  contentStrategy: ContentStrategyAnalysis
): OmnichannelReadiness {
  // Collect all fields for analysis
  const allFields = collectFields(schema);
  
  // Analyze each indicator with detailed breakdowns
  const presentationFreeContent = analyzePresentationFreeContent(allFields, schema);
  const semanticStructure = analyzeSemanticStructure(contentStrategy, schemaAnalysis);
  const assetFlexibility = analyzeAssetFlexibility(schema, components);
  const apiDesign = analyzeApiDesign(schemaAnalysis);

  // Calculate overall score with breakdown
  const indicatorScores = [
    presentationFreeContent.score,
    semanticStructure.score,
    assetFlexibility.score,
    apiDesign.score,
  ];
  const averageScore = Math.round(indicatorScores.reduce((a, b) => a + b, 0) / 4);
  
  // Build overall breakdown
  const overallContributions: ScoreContribution[] = [
    { 
      reason: 'Presentation-Free Content', 
      value: presentationFreeContent.score - 100,
      details: `${presentationFreeContent.score}/100`,
    },
    { 
      reason: 'Semantic Structure', 
      value: semanticStructure.score - 100,
      details: `${semanticStructure.score}/100`,
    },
    { 
      reason: 'Asset Flexibility', 
      value: assetFlexibility.score - 100,
      details: `${assetFlexibility.score}/100`,
    },
    { 
      reason: 'API Design', 
      value: apiDesign.score - 100,
      details: `${apiDesign.score}/100`,
    },
  ];

  const scoreBreakdown: ScoreBreakdown = {
    finalScore: averageScore,
    baseScore: 100,
    contributions: overallContributions,
    formula: `Average of 4 indicators: (${presentationFreeContent.score} + ${semanticStructure.score} + ${assetFlexibility.score} + ${apiDesign.score}) ÷ 4 = ${averageScore}`,
  };

  const readinessLabel = mapScoreToLabel(averageScore);
  const channels = buildChannelReadiness(
    presentationFreeContent.score, 
    allFields.filter(f => MOBILE_FIELD_REGEX.test(f)).length,
    allFields.filter(f => EMAIL_FIELD_REGEX.test(f)).length,
    apiDesign.score
  );

  return {
    score: averageScore,
    scoreBreakdown,
    readinessLabel,
    narrative: generateNarrative(readinessLabel, averageScore, presentationFreeContent),
    channels,
    indicators: {
      presentationFreeContent,
      semanticStructure,
      assetFlexibility,
      apiDesign,
    },
  };
}

/**
 * INDICATOR 1: Presentation-Free Content
 * Checks for layout/styling fields mixed into content
 */
function analyzePresentationFreeContent(
  allFields: string[],
  schema: HygraphSchema
): OmnichannelIndicator {
  const breakdown: ScoreContribution[] = [];
  let score = 100;

  // Find presentation-heavy fields
  const presentationFields = allFields.filter(f => PRESENTATION_FIELD_REGEX.test(f));
  
  if (presentationFields.length === 0) {
    breakdown.push({
      reason: 'No presentation/styling fields detected in content',
      value: 5,
      details: 'Content is channel-agnostic',
    });
    score += 5;
  } else {
    const penalty = Math.min(presentationFields.length * 8, 50);
    breakdown.push({
      reason: `${presentationFields.length} presentation-related field(s) found`,
      value: -penalty,
      details: presentationFields.slice(0, 4).join(', '),
    });
    score -= penalty;
  }

  // Check for HTML/Rich Text fields (can be presentation-heavy)
  const richTextCount = schema.models.reduce((count, m) => 
    count + m.fields.filter(f => f.type === 'RichText').length, 0
  );
  if (richTextCount > 10) {
    breakdown.push({
      reason: `${richTextCount} RichText fields may contain embedded styling`,
      value: -10,
      details: 'Consider using structured content for better channel flexibility',
    });
    score -= 10;
  }

  // Check for JSON fields (could contain arbitrary presentation)
  const jsonFields = schema.models.reduce((count, m) => 
    count + m.fields.filter(f => f.type === 'Json').length, 0
  );
  if (jsonFields > 5) {
    breakdown.push({
      reason: `${jsonFields} JSON fields may contain presentation data`,
      value: -8,
      details: 'JSON fields are opaque and hard to reformat per channel',
    });
    score -= 8;
  }

  score = clampScore(score);

  return {
    score,
    breakdown,
    examples: presentationFields.slice(0, 6),
  };
}

/**
 * INDICATOR 2: Semantic Structure
 * Checks for clear content organization
 */
function analyzeSemanticStructure(
  contentStrategy: ContentStrategyAnalysis,
  schemaAnalysis: SchemaAnalysis
): OmnichannelIndicator {
  const breakdown: ScoreContribution[] = [];
  let score = 100;

  // Penalty for duplicate models (unclear semantics)
  const duplicateCount = contentStrategy.modelUsage.duplicateModels.length;
  if (duplicateCount > 0) {
    const penalty = Math.min(duplicateCount * 10, 30);
    breakdown.push({
      reason: `${duplicateCount} duplicate model pattern(s) reduce semantic clarity`,
      value: -penalty,
      details: contentStrategy.modelUsage.duplicateModels.flatMap(d => d.models).slice(0, 4).join(', '),
    });
    score -= penalty;
  }

  // Bonus for clear model naming (no versioned/duplicate names)
  const versionedModels = schemaAnalysis.orphanModels.filter(m => /v\d+$/i.test(m));
  if (versionedModels.length > 0) {
    breakdown.push({
      reason: `${versionedModels.length} versioned model name(s) suggest unclear structure`,
      value: -10,
      details: versionedModels.slice(0, 3).join(', '),
    });
    score -= 10;
  }

  // Bonus for having taxonomy/categorization
  const hasTaxonomy = contentStrategy.detectedArchitecture.signals.some(s => 
    /category|tag|taxonomy/i.test(s)
  );
  if (hasTaxonomy) {
    breakdown.push({
      reason: 'Content categorization/taxonomy detected',
      value: 8,
      details: 'Helps organize content across channels',
    });
    score += 8;
  }

  // Bonus for proper content/layout separation
  if (contentStrategy.editorialExperience.editorFriendlyModels.length > 
      contentStrategy.editorialExperience.complexModels.length) {
    breakdown.push({
      reason: 'Most models are semantically clear and editor-friendly',
      value: 5,
    });
    score += 5;
  }

  score = clampScore(score);

  return {
    score,
    breakdown,
    issues: duplicateCount > 0 
      ? ['Some content models duplicate structure, reducing semantic clarity.'] 
      : [],
  };
}

/**
 * INDICATOR 3: Asset Flexibility
 * Checks for responsive/flexible media handling
 */
function analyzeAssetFlexibility(
  schema: HygraphSchema,
  components: ComponentAnalysis
): OmnichannelIndicator {
  const breakdown: ScoreContribution[] = [];
  let score = 100;

  // Count asset fields
  const assetFieldCount = schema.models.reduce((count, model) => 
    count + model.fields.filter(f => 
      f.type === 'Asset' || /image|asset|media|photo|video/i.test(f.name)
    ).length, 0
  );

  if (assetFieldCount === 0) {
    breakdown.push({
      reason: 'No asset/media fields detected',
      value: -20,
      details: 'Content may lack visual elements for channels',
    });
    score -= 20;
  } else {
    // Check for multiple image size/variant patterns
    const hasResponsivePatterns = schema.models.some(m => 
      m.fields.some(f => /thumbnail|hero|og|featured|mobile|desktop/i.test(f.name))
    );
    
    if (hasResponsivePatterns) {
      breakdown.push({
        reason: 'Responsive image patterns detected (thumbnails, variants)',
        value: 10,
        details: 'Supports channel-specific image sizing',
      });
      score += 10;
    } else if (assetFieldCount >= 3) {
      breakdown.push({
        reason: `${assetFieldCount} asset fields but no explicit responsive variants`,
        value: -5,
        details: 'Consider adding thumbnail/mobile variants',
      });
      score -= 5;
    }
  }

  // Check for alt text patterns
  const hasAltText = schema.models.some(m => 
    m.fields.some(f => /alt|caption|description/i.test(f.name))
  );
  if (hasAltText) {
    breakdown.push({
      reason: 'Alt text/caption fields support accessibility',
      value: 5,
    });
    score += 5;
  }

  // Bonus for media-related components
  const mediaComponents = components.components.filter(c => 
    /image|media|asset|video|gallery/i.test(c.name)
  );
  if (mediaComponents.length > 0) {
    breakdown.push({
      reason: `${mediaComponents.length} media component(s) centralize asset handling`,
      value: 8,
      details: mediaComponents.map(c => c.name).join(', '),
    });
    score += 8;
  }

  score = clampScore(score);

  return {
    score,
    breakdown,
    recommendations: score < 65 
      ? ['Add responsive image variants or focal point fields for assets.'] 
      : [],
  };
}

/**
 * INDICATOR 4: API Design
 * Checks for query-friendly structure
 */
function analyzeApiDesign(schemaAnalysis: SchemaAnalysis): OmnichannelIndicator {
  const breakdown: ScoreContribution[] = [];
  let score = 100;

  // Nesting depth check
  const maxDepth = schemaAnalysis.maxNestingDepth;
  if (maxDepth <= 3) {
    breakdown.push({
      reason: `Shallow nesting depth (${maxDepth} levels)`,
      value: 5,
      details: 'Queries are efficient across channels',
    });
    score += 5;
  } else if (maxDepth > 5) {
    const penalty = (maxDepth - 4) * 10;
    breakdown.push({
      reason: `Deep nesting (${maxDepth} levels) complicates queries`,
      value: -penalty,
      details: 'Consider flattening for mobile/API performance',
    });
    score -= penalty;
  } else if (maxDepth > 3) {
    breakdown.push({
      reason: `Moderate nesting depth (${maxDepth} levels)`,
      value: -5,
      details: 'May need pagination for some channels',
    });
    score -= 5;
  }

  // Check for relation density
  const relationDensity = schemaAnalysis.relationCount / Math.max(schemaAnalysis.modelCount, 1);
  if (relationDensity > 5) {
    breakdown.push({
      reason: `High relation density (${relationDensity.toFixed(1)} per model)`,
      value: -10,
      details: 'Complex queries may timeout on mobile/IoT',
    });
    score -= 10;
  } else if (relationDensity <= 2) {
    breakdown.push({
      reason: `Clean relation structure (${relationDensity.toFixed(1)} per model)`,
      value: 5,
    });
    score += 5;
  }

  // Bonus for bidirectional refs (flexible traversal)
  if (schemaAnalysis.twoWayReferences.length > 0) {
    breakdown.push({
      reason: `${schemaAnalysis.twoWayReferences.length} bidirectional relation(s)`,
      value: 5,
      details: 'Enables flexible query patterns',
    });
    score += 5;
  }

  // Check total fields (payload size)
  if (schemaAnalysis.totalFields > 500) {
    breakdown.push({
      reason: `${schemaAnalysis.totalFields} total fields may yield large payloads`,
      value: -8,
      details: 'Use field selection in queries',
    });
    score -= 8;
  }

  score = clampScore(score);

  return {
    score,
    breakdown,
    considerations: maxDepth > 4 
      ? ['Deep relation chains require carefully paginated API queries.']
      : ['Current nesting depth is optimized for most channels.'],
  };
}

function collectFields(schema: HygraphSchema): string[] {
  return schema.models.flatMap(model => 
    model.fields.map(field => `${model.name}.${field.name}`)
  );
}

function buildChannelReadiness(
  presentationScore: number,
  mobileFieldCount: number,
  emailFieldCount: number,
  apiScore: number
): OmnichannelReadiness['channels'] {
  const webReady = presentationScore >= 55;
  const mobileReady = mobileFieldCount > 2 || presentationScore >= 70;
  const emailReady = emailFieldCount > 1;
  const headlessReady = presentationScore >= 65 && apiScore >= 65;

  return {
    web: {
      ready: webReady,
      gaps: webReady ? [] : ['Reduce presentation-heavy fields to keep content reusable.'],
    },
    mobile: {
      ready: mobileReady,
      gaps: mobileReady ? [] : ['Add mobile-specific fields or responsive media options.'],
    },
    email: {
      ready: emailReady,
      gaps: emailReady ? [] : ['Introduce email-friendly fields (subject, preview, CTA copy).'],
    },
    headless: {
      ready: headlessReady,
      gaps: headlessReady ? [] : ['Headless delivery requires stricter separation of content from layout.'],
    },
  };
}

function clampScore(score: number): number {
  return Math.max(20, Math.min(100, Math.round(score)));
}

function mapScoreToLabel(score: number): OmnichannelReadiness['readinessLabel'] {
  if (score >= 80) return 'Optimized';
  if (score >= 65) return 'Channel Ready';
  if (score >= 45) return 'Partially Ready';
  return 'Not Ready';
}

function generateNarrative(
  label: OmnichannelReadiness['readinessLabel'], 
  score: number, 
  presentationIndicator: OmnichannelIndicator
): string {
  const presentationIssues = presentationIndicator.breakdown.filter(b => b.value < 0);
  const issueCount = presentationIssues.length;

  switch (label) {
    case 'Optimized':
      return 'Content is presentation-free and can be orchestrated across channels with minimal additional work.';
    case 'Channel Ready':
      return 'Core channels are supported. Minor adjustments to content/structure boundaries will unlock more automation.';
    case 'Partially Ready':
      return `Some omnichannel foundations exist, but ${issueCount} issue(s) bind content to specific presentations.`;
    default:
      return 'Content is tightly coupled to specific layouts. Decoupling structure from presentation is the first step.';
  }
}

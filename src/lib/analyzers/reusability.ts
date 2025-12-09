import type {
  HygraphSchema,
  HygraphModel,
  HygraphField,
  ReusabilityAssessment,
  CheckpointResult,
  CheckpointStatus,
  LeakyModel,
  ContentPresentationField,
  ScoreContribution,
} from '../types';
import { filterSystemComponents, filterSystemModels } from './systemFilters';

// ============================================
// Pattern Definitions
// ============================================

// Shared content model patterns (should be referenced, not duplicated)
const SHARED_CONTENT_PATTERNS = /^(author|person|user|testimonial|review|comment|category|tag|topic|faq|location|address|contact|social|seo|meta)s?$/i;

// Shared component patterns
const SHARED_COMPONENT_PATTERNS = /^(cta|button|link|banner|hero|card|media|image|video|icon|badge|alert|modal|form|input|tab|accordion|carousel|slider|gallery)s?$/i;

// Layout flexibility indicators (should have list of blocks/sections)
const LAYOUT_FLEX_FIELD_PATTERNS = /^(sections|blocks|modules|components|widgets|elements|content|body|layout)$/i;

// Presentation field patterns (should NOT be on content models)
const PRESENTATION_PATTERNS = [
  /^(background|bg)(Color|Image|Gradient|Style)?$/i,
  /^(text|font|border)(Color|Size|Weight|Style)?$/i,
  /^(padding|margin)(Top|Bottom|Left|Right|X|Y)?$/i,
  /^(align|alignment|justify|textAlign)$/i,
  /^(width|height|maxWidth|minWidth|maxHeight|minHeight)$/i,
  /^(flex|grid)(Direction|Wrap|Gap|Basis)?$/i,
  /^(border)(Radius|Width)?$/i,
  /^(opacity|zIndex|position|display)$/i,
  /^(theme|colorScheme|variant|style)$/i,
  /^(columns?|rows?|gap|spacing)$/i,
  /^(animation|transition|transform)$/i,
];

// Configuration field patterns
const CONFIG_PATTERNS = [
  /^(show|hide|enable|disable|is)(Visible|Hidden|Enabled|Disabled|Active)?[A-Z]/,
  /^(display|visible|hidden|enabled|disabled|active)$/i,
  /^(order|sortOrder|priority|weight|index)$/i,
  /^(limit|max|min|count|perPage|pageSize)$/i,
  /^(autoplay|loop|muted|controls)$/i,
  /^(target|rel|download)$/i,
];

// Content field patterns (expected on content models)
const CONTENT_PATTERNS = [
  /^(title|name|headline|heading|label)$/i,
  /^(description|summary|excerpt|abstract|intro|body|content|text)$/i,
  /^(slug|url|path|link|href)$/i,
  /^(image|photo|picture|thumbnail|cover|avatar|logo|icon|media|video|audio|file|asset)$/i,
  /^(author|creator|owner|assignee)$/i,
  /^(date|time|createdAt|updatedAt|publishedAt|startDate|endDate)$/i,
  /^(category|categories|tag|tags|topic|topics|type|kind)$/i,
  /^(price|cost|amount|quantity|stock|sku)$/i,
  /^(email|phone|address|location)$/i,
  /^(cta|button|action|link)$/i,
];

// Content model patterns (where presentation leakage is problematic)
const CONTENT_MODEL_PATTERNS = /^(article|post|page|blog|news|story|product|category|event|author|person|faq|testimonial|review)s?$/i;

// ============================================
// Main Analyzer
// ============================================

export function analyzeReusability(
  schema: HygraphSchema,
  entryCounts: Record<string, { draft: number; published: number }>
): ReusabilityAssessment {
  const customModels = filterSystemModels(schema.models);
  const components = filterSystemComponents(schema.components || []);

  const sharedContent = analyzeSharedContent(customModels);
  const sharedComponents = analyzeSharedComponents(customModels, components);
  const layoutFlexibility = analyzeLayoutFlexibility(customModels, components);
  const contentVsPresentation = analyzeContentVsPresentation(customModels, components);
  const { reuseScore, reuseScoreBreakdown } = calculateReuseScore(
    sharedContent,
    sharedComponents,
    layoutFlexibility,
    contentVsPresentation,
    components
  );

  return {
    sharedContent,
    sharedComponents,
    layoutFlexibility,
    contentVsPresentation,
    reuseScore,
    reuseScoreBreakdown,
  };
}

// ============================================
// Shared Content Analysis
// ============================================

function analyzeSharedContent(models: HygraphModel[]): CheckpointResult {
  const sharedContentModels: { model: string; referencedBy: string[] }[] = [];
  const missingSharedContent: string[] = [];

  // Find models that match shared content patterns
  for (const model of models) {
    if (SHARED_CONTENT_PATTERNS.test(model.name)) {
      const referencedBy = findModelsReferencingThis(model.name, models);
      if (referencedBy.length > 0) {
        sharedContentModels.push({ model: model.name, referencedBy });
      } else {
        missingSharedContent.push(model.name);
      }
    }
  }

  // Check if shared content patterns should exist but don't
  const expectedSharedContent = ['Author', 'Category', 'Tag'];
  const missingExpected = expectedSharedContent.filter(
    expected => !models.some(m => m.name.toLowerCase().includes(expected.toLowerCase()))
  );

  const status: CheckpointStatus = 
    sharedContentModels.length >= 2 && missingSharedContent.length === 0 ? 'good' :
    sharedContentModels.length > 0 ? 'warning' : 'issue';

  return {
    status,
    title: 'Shared Content',
    findings: [
      ...(sharedContentModels.length > 0
        ? [`${sharedContentModels.length} shared content model(s) properly referenced`]
        : ['No shared content models detected']),
      ...(missingSharedContent.length > 0
        ? [`${missingSharedContent.length} shared content model(s) not referenced: ${missingSharedContent.join(', ')}`]
        : []),
    ],
    examples: sharedContentModels.map(m => ({
      items: [m.model],
      details: `Referenced by ${m.referencedBy.length} model(s): ${m.referencedBy.slice(0, 3).join(', ')}${m.referencedBy.length > 3 ? '...' : ''}`,
    })),
    actionItems: [
      ...missingExpected.map(m => `Create a "${m}" model for reusable content`),
      ...missingSharedContent.map(m => `Connect "${m}" model to content types via references`),
    ],
  };
}

function findModelsReferencingThis(targetModel: string, models: HygraphModel[]): string[] {
  const referencing: string[] = [];
  for (const model of models) {
    if (model.name === targetModel) continue;
    for (const field of model.fields) {
      if (field.relatedModel === targetModel) {
        referencing.push(model.name);
        break;
      }
    }
  }
  return referencing;
}

// ============================================
// Shared Components Analysis
// ============================================

function analyzeSharedComponents(models: HygraphModel[], components: HygraphModel[]): CheckpointResult {
  const componentUsage: { component: string; usedIn: string[] }[] = [];
  const unusedComponents: string[] = [];
  const duplicatedPatterns: { pattern: string; foundIn: string[] }[] = [];

  // Analyze component usage
  for (const comp of components) {
    const usedIn: string[] = [];
    for (const model of models) {
      for (const field of model.fields) {
        if (field.relatedModel === comp.name) {
          usedIn.push(model.name);
          break;
        }
      }
    }

    if (usedIn.length > 1) {
      componentUsage.push({ component: comp.name, usedIn });
    } else if (usedIn.length === 0) {
      unusedComponents.push(comp.name);
    }
  }

  // Find duplicated field patterns that should be components
  const fieldPatterns: Map<string, string[]> = new Map();
  for (const model of models) {
    const patternFields = model.fields
      .filter(f => SHARED_COMPONENT_PATTERNS.test(f.name) || /^(cta|button|link|image|video)/i.test(f.name))
      .map(f => f.name.toLowerCase());
    
    for (const field of patternFields) {
      if (!fieldPatterns.has(field)) {
        fieldPatterns.set(field, []);
      }
      fieldPatterns.get(field)!.push(model.name);
    }
  }

  for (const [pattern, foundIn] of fieldPatterns) {
    if (foundIn.length >= 3 && !components.some(c => c.name.toLowerCase().includes(pattern))) {
      duplicatedPatterns.push({ pattern, foundIn });
    }
  }

  const wellSharedCount = componentUsage.filter(c => c.usedIn.length >= 2).length;
  const status: CheckpointStatus = 
    wellSharedCount >= 3 && unusedComponents.length <= 1 ? 'good' :
    wellSharedCount > 0 ? 'warning' : 'issue';

  // Build findings with specific names inline
  const sharedComponentNames = componentUsage.map(c => c.component);
  const duplicatedPatternNames = duplicatedPatterns.map(p => p.pattern);

  return {
    status,
    title: 'Shared Components',
    findings: [
      componentUsage.length > 0
        ? `${componentUsage.length} component(s) used across multiple models: ${sharedComponentNames.slice(0, 5).join(', ')}${sharedComponentNames.length > 5 ? '...' : ''}`
        : 'No components are shared across multiple models',
      ...(unusedComponents.length > 0
        ? [`${unusedComponents.length} unused component(s): ${unusedComponents.slice(0, 5).join(', ')}${unusedComponents.length > 5 ? '...' : ''}`]
        : []),
      ...(duplicatedPatterns.length > 0
        ? [`${duplicatedPatterns.length} field pattern(s) duplicated that should be components: ${duplicatedPatternNames.slice(0, 5).join(', ')}${duplicatedPatternNames.length > 5 ? '...' : ''}`]
        : []),
    ],
    examples: [
      ...componentUsage.slice(0, 3).map(c => ({
        items: [c.component],
        details: `Used in: ${c.usedIn.join(', ')}`,
      })),
      ...duplicatedPatterns.slice(0, 2).map(p => ({
        items: p.foundIn.slice(0, 4),
        details: `"${p.pattern}" field duplicated - should be a component`,
      })),
    ],
    actionItems: [
      ...unusedComponents.slice(0, 2).map(c => `Remove or integrate unused component "${c}"`),
      ...duplicatedPatterns.slice(0, 2).map(p =>
        `Create a "${capitalize(p.pattern)}" component to replace duplicated fields in ${p.foundIn.slice(0, 3).join(', ')}`
      ),
    ],
  };
}

// ============================================
// Layout Flexibility Analysis
// ============================================

function analyzeLayoutFlexibility(models: HygraphModel[], components: HygraphModel[]): CheckpointResult {
  const flexibleModels: { model: string; flexField: string; allowedTypes: string[] }[] = [];
  const rigidModels: string[] = [];

  // Page-like models that should have layout flexibility
  const pageModels = models.filter(m => /page/i.test(m.name) || m.fields.length > 10);

  for (const model of pageModels) {
    let isFlexible = false;
    
    for (const field of model.fields) {
      // Check for layout flexibility fields (list of components/blocks)
      if (LAYOUT_FLEX_FIELD_PATTERNS.test(field.name) && field.isList) {
        const allowedTypes = field.relatedModel
          ? [field.relatedModel]
          : components.filter(c => 
              model.fields.some(f => f.relatedModel === c.name)
            ).map(c => c.name);

        if (allowedTypes.length > 0) {
          flexibleModels.push({
            model: model.name,
            flexField: field.name,
            allowedTypes,
          });
          isFlexible = true;
          break;
        }
      }
    }

    if (!isFlexible && model.fields.length > 8) {
      rigidModels.push(model.name);
    }
  }

  const status: CheckpointStatus = 
    flexibleModels.length >= pageModels.length * 0.5 ? 'good' :
    flexibleModels.length > 0 ? 'warning' : 'issue';

  // Include specific model names in findings
  const flexibleModelNames = flexibleModels.map(m => m.model);
  const rigidModelNames = rigidModels;

  return {
    status,
    title: 'Layout Flexibility',
    findings: [
      flexibleModels.length > 0
        ? `${flexibleModels.length} model(s) support flexible layouts: ${flexibleModelNames.slice(0, 5).join(', ')}${flexibleModelNames.length > 5 ? '...' : ''}`
        : 'No models support flexible layouts via component lists',
      ...(rigidModels.length > 0
        ? [`${rigidModels.length} model(s) have fixed structure: ${rigidModelNames.slice(0, 5).join(', ')}${rigidModelNames.length > 5 ? '...' : ''}`]
        : []),
    ],
    examples: flexibleModels.map(m => ({
      items: [m.model],
      details: `"${m.flexField}" field allows: ${m.allowedTypes.slice(0, 3).join(', ')}${m.allowedTypes.length > 3 ? '...' : ''}`,
    })),
    actionItems: rigidModels.slice(0, 2).map(m =>
      `Add a "sections" or "blocks" field to "${m}" with a list of reorderable components`
    ),
  };
}

// ============================================
// Content vs Presentation Analysis
// ============================================

function analyzeContentVsPresentation(
  models: HygraphModel[],
  components: HygraphModel[]
): ReusabilityAssessment['contentVsPresentation'] {
  const leakyModels: LeakyModel[] = [];

  // Analyze content models for presentation leakage
  const contentModels = models.filter(m => CONTENT_MODEL_PATTERNS.test(m.name));
  
  // Also check all models if no obvious content models
  const modelsToCheck = contentModels.length > 0 ? contentModels : models;

  for (const model of modelsToCheck) {
    const fields: ContentPresentationField[] = [];
    let contentCount = 0;
    let presentationCount = 0;
    let configCount = 0;

    for (const field of model.fields) {
      const category = categorizeField(field);
      fields.push({
        name: field.name,
        type: field.type,
        category,
        reason: getCategoryReason(field, category),
      });

      if (category === 'content') contentCount++;
      else if (category === 'presentation') presentationCount++;
      else configCount++;
    }

    if (presentationCount > 0 || configCount > 2) {
      leakyModels.push({
        model: model.name,
        fields,
        contentCount,
        presentationCount,
        configCount,
      });
    }
  }

  // Calculate overall leakage score (0-100, lower is more leaky)
  const totalPresentationFields = leakyModels.reduce((sum, m) => sum + m.presentationCount, 0);
  const totalFields = modelsToCheck.reduce((sum, m) => sum + m.fields.length, 0);
  const overallLeakageScore = totalFields > 0
    ? Math.round((1 - totalPresentationFields / totalFields) * 100)
    : 100;

  const worstOffenders = leakyModels
    .filter(m => m.presentationCount >= 3)
    .sort((a, b) => b.presentationCount - a.presentationCount)
    .slice(0, 3)
    .map(m => m.model);

  const status: CheckpointStatus = 
    worstOffenders.length === 0 ? 'good' :
    worstOffenders.length <= 2 ? 'warning' : 'issue';

  return {
    status,
    leakyModels,
    overallLeakageScore,
    worstOffenders,
  };
}

function categorizeField(field: HygraphField): 'content' | 'presentation' | 'config' {
  const name = field.name;

  // Check presentation patterns
  if (PRESENTATION_PATTERNS.some(p => p.test(name))) {
    return 'presentation';
  }

  // Check config patterns
  if (CONFIG_PATTERNS.some(p => p.test(name))) {
    return 'config';
  }

  // Check content patterns (or default to content)
  return 'content';
}

function getCategoryReason(field: HygraphField, category: 'content' | 'presentation' | 'config'): string {
  const name = field.name;

  if (category === 'presentation') {
    if (/color/i.test(name)) return 'Styling field (color)';
    if (/padding|margin|spacing/i.test(name)) return 'Layout spacing field';
    if (/align|justify/i.test(name)) return 'Alignment field';
    if (/theme|variant|style/i.test(name)) return 'Theme/variant field';
    if (/width|height/i.test(name)) return 'Dimension field';
    return 'Presentation field';
  }

  if (category === 'config') {
    if (/^(show|hide|enable|disable)/i.test(name)) return 'Toggle/visibility config';
    if (/order|sort|priority/i.test(name)) return 'Ordering config';
    if (/limit|max|min|count/i.test(name)) return 'Limit/count config';
    return 'Configuration field';
  }

  return 'Content field';
}

// ============================================
// Reuse Score Calculation
// ============================================

function calculateReuseScore(
  sharedContent: CheckpointResult,
  sharedComponents: CheckpointResult,
  layoutFlexibility: CheckpointResult,
  contentVsPresentation: ReusabilityAssessment['contentVsPresentation'],
  components: HygraphModel[]
): { reuseScore: number; reuseScoreBreakdown: ScoreContribution[] } {
  const contributions: ScoreContribution[] = [];
  let score = 50; // Start at 50

  // Component count contribution
  if (components.length >= 5) {
    const bonus = Math.min(components.length * 2, 15);
    score += bonus;
    contributions.push({
      reason: `${components.length} components defined`,
      value: bonus,
      details: 'Good component library',
    });
  } else if (components.length === 0) {
    score -= 15;
    contributions.push({
      reason: 'No components defined',
      value: -15,
      details: 'Missing componentization',
    });
  }

  // Shared content contribution
  if (sharedContent.status === 'good') {
    score += 15;
    contributions.push({
      reason: 'Shared content properly referenced',
      value: 15,
    });
  } else if (sharedContent.status === 'issue') {
    score -= 10;
    contributions.push({
      reason: 'Missing shared content models',
      value: -10,
    });
  }

  // Shared components contribution
  if (sharedComponents.status === 'good') {
    score += 15;
    contributions.push({
      reason: 'Components well-shared across models',
      value: 15,
    });
  } else if (sharedComponents.status === 'issue') {
    score -= 10;
    contributions.push({
      reason: 'Components not effectively shared',
      value: -10,
    });
  }

  // Layout flexibility contribution
  if (layoutFlexibility.status === 'good') {
    score += 10;
    contributions.push({
      reason: 'Flexible layouts with component lists',
      value: 10,
    });
  } else if (layoutFlexibility.status === 'issue') {
    score -= 10;
    contributions.push({
      reason: 'Rigid/hardcoded layouts',
      value: -10,
    });
  }

  // Content/presentation separation contribution
  if (contentVsPresentation.worstOffenders.length === 0) {
    score += 10;
    contributions.push({
      reason: 'Clean content/presentation separation',
      value: 10,
    });
  } else {
    const penalty = Math.min(contentVsPresentation.worstOffenders.length * 5, 15);
    score -= penalty;
    contributions.push({
      reason: `${contentVsPresentation.worstOffenders.length} model(s) mix content with presentation`,
      value: -penalty,
      details: contentVsPresentation.worstOffenders.join(', '),
    });
  }

  return {
    reuseScore: Math.max(0, Math.min(100, score)),
    reuseScoreBreakdown: contributions,
  };
}

// ============================================
// Helper Functions
// ============================================

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

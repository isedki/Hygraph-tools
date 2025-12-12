import type {
  ContentStrategyAnalysis,
  HygraphSchema,
  PermissionModelReview,
} from '../types';

const SENSITIVE_MODEL_REGEX = /(user|account|order|payment|setting|config|secret|token|credential)/i;

/**
 * Provide a qualitative review of the permission model requirements based on schema composition.
 */
export function analyzePermissionModel(
  schema: HygraphSchema,
  contentStrategy: ContentStrategyAnalysis
): PermissionModelReview {
  const sensitiveModels = schema.models
    .filter(model => !model.isSystem && SENSITIVE_MODEL_REGEX.test(model.name))
    .map(model => model.name);

  const highFieldCountModels = schema.models
    .filter(model => model.fields.length >= 30)
    .map(model => model.name);

  const suggestedRoles = buildSuggestedRoles(schema, sensitiveModels);

  const risks = buildRisks(contentStrategy, sensitiveModels, highFieldCountModels);

  const assessment = determineAssessment(sensitiveModels.length, highFieldCountModels.length, risks.length);
  const narrative = buildNarrative(assessment, sensitiveModels.length, highFieldCountModels.length);

  return {
    assessment,
    narrative,
    observations: {
      sensitiveModels,
      highFieldCountModels,
      suggestedRoles,
    },
    risks,
    recommendations: buildRecommendations(assessment, risks.length > 0),
  };
}

function buildSuggestedRoles(schema: HygraphSchema, sensitiveModels: string[]): PermissionModelReview['observations']['suggestedRoles'] {
  const marketingModels = schema.models.filter(model => /campaign|banner|promo|landing/i.test(model.name));
  const productModels = schema.models.filter(model => /product|inventory|sku|price/i.test(model.name));

  return [
    {
      role: 'Content Editor',
      access: 'Create/edit marketing content, read-only for product catalog',
      models: marketingModels.slice(0, 5).map(model => model.name),
    },
    {
      role: 'Product Manager',
      access: 'Full access to product and pricing models',
      models: productModels.slice(0, 5).map(model => model.name),
    },
    {
      role: 'Admin',
      access: 'Full access including sensitive configuration models',
      models: sensitiveModels.slice(0, 5),
    },
  ].filter(entry => entry.models.length > 0);
}

function buildRisks(
  contentStrategy: ContentStrategyAnalysis,
  sensitiveModels: string[],
  highFieldCountModels: string[]
): PermissionModelReview['risks'] {
  const risks: PermissionModelReview['risks'] = [];

  if (sensitiveModels.length > 0 && contentStrategy.editorialExperience.complexModels.length === 0) {
    risks.push({
      risk: 'Sensitive models share same permissions as marketing content',
      impact: 'API keys or configuration could be edited accidentally',
      mitigation: 'Create restricted roles for configuration models',
    });
  }

  if (highFieldCountModels.length > 3) {
    risks.push({
      risk: 'High-field models require power users',
      impact: 'Editors may misconfigure advanced options',
      mitigation: 'Limit access to senior editors or add workflows',
    });
  }

  if (contentStrategy.componentStrategy.missingComponents.length > 5) {
    risks.push({
      risk: 'Lack of reusable components makes permissions broad',
      impact: 'Editors need write access to many models for simple tasks',
      mitigation: 'Use shared components to reduce the number of models per role',
    });
  }

  return risks;
}

function determineAssessment(sensitiveCount: number, highFieldCount: number, riskCount: number): PermissionModelReview['assessment'] {
  if (riskCount >= 3 || sensitiveCount > 5) {
    return 'at-risk';
  }
  if (riskCount > 0 || highFieldCount > 4) {
    return 'needs-attention';
  }
  return 'well-defined';
}

function buildNarrative(
  assessment: PermissionModelReview['assessment'],
  sensitiveCount: number,
  highFieldCount: number
): string {
  if (assessment === 'well-defined') {
    return 'Schema segmentation supports clear permission boundaries with minimal sensitive content.';
  }
  if (assessment === 'needs-attention') {
    return `Permissions work today, but ${sensitiveCount} sensitive and ${highFieldCount} complex models should be restricted before scaling the team.`;
  }
  return 'Several sensitive models lack clear boundaries. Formalize role-based access before onboarding additional editors.';
}

function buildRecommendations(assessment: PermissionModelReview['assessment'], hasRisks: boolean): string[] {
  if (assessment === 'well-defined') {
    return ['Document current role matrix to keep conventions aligned as the team grows.'];
  }
  const recommendations = ['Define restricted roles for configuration, product, and localization models.'];
  if (hasRisks) {
    recommendations.push('Enable Hygraph stage-based workflows so reviewers gate sensitive content.');
  }
  recommendations.push('Audit API tokens and remove unnecessary mutations for read-only roles.');
  return recommendations;
}





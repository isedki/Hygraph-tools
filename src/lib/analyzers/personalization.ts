import type {
  HygraphSchema,
  PersonalizationReadiness,
} from '../types';

const AUDIENCE_REGEX = /(audience|persona|segment|role|tier)/i;
const CONTEXT_REGEX = /(context|placement|channel|device|region)/i;
const AB_TEST_REGEX = /(variant|experiment|abTest|testGroup)/i;

/**
 * Inspect schema for signals that enable personalization capabilities.
 */
export function analyzePersonalization(schema: HygraphSchema): PersonalizationReadiness {
  const capabilities = {
    audienceSegmentation: detectCapability(schema, AUDIENCE_REGEX),
    contextualContent: detectCapability(schema, CONTEXT_REGEX),
    abTesting: detectCapability(schema, AB_TEST_REGEX),
    dynamicContent: detectDynamicCapability(schema),
  };

  const level = determineLevel(capabilities);
  const narrative = buildNarrative(level);

  return {
    level,
    narrative,
    capabilities,
    enablers: buildEnablers(capabilities),
    gaps: buildGaps(capabilities),
    implementationPath: buildImplementationPath(level, capabilities),
  };
}

function detectCapability(schema: HygraphSchema, regex: RegExp) {
  const fields = schema.models.flatMap(model =>
    model.fields
      .filter(field => regex.test(field.name))
      .map(field => `${model.name}.${field.name}`)
  );
  return {
    ready: fields.length > 0,
    fields,
  };
}

function detectDynamicCapability(schema: HygraphSchema) {
  const dynamicFields = schema.components
    .filter(component => component.fields.some(field => field.name === 'component' || field.name === 'type'))
    .map(component => component.name);
  return {
    ready: dynamicFields.length > 0,
    fields: dynamicFields,
  };
}

function determineLevel(capabilities: PersonalizationReadiness['capabilities']): PersonalizationReadiness['level'] {
  const readyCount = Object.values(capabilities).filter(cap => cap.ready).length;
  if (readyCount >= 4) return 'advanced';
  if (readyCount >= 2) return 'intermediate';
  if (readyCount === 1) return 'basic';
  return 'none';
}

function buildNarrative(level: PersonalizationReadiness['level']): string {
  switch (level) {
    case 'advanced':
      return 'Schema supports full-funnel personalization with segmentation, contextual fields, and variant tracking.';
    case 'intermediate':
      return 'Foundational personalization hooks exist. Align them with targeting rules to unlock more value.';
    case 'basic':
      return 'One or two personalization levers exist but need supporting data and workflows.';
    default:
      return 'Content is currently static for all audiences. Introduce segmentation fields to start personalization safely.';
  }
}

function buildEnablers(capabilities: PersonalizationReadiness['capabilities']): string[] {
  const enablers: string[] = [];
  if (capabilities.audienceSegmentation.ready) {
    enablers.push('Audience fields exist to capture personas or customer tiers.');
  }
  if (capabilities.contextualContent.ready) {
    enablers.push('Channel or device context fields enable targeted messaging.');
  }
  if (capabilities.abTesting.ready) {
    enablers.push('Variant tracking fields allow content experiments.');
  }
  if (capabilities.dynamicContent.ready) {
    enablers.push('Component-based content enables runtime assembly.');
  }
  if (enablers.length === 0) {
    enablers.push('Flexible components provide a starting point for future personalization.');
  }
  return enablers;
}

function buildGaps(capabilities: PersonalizationReadiness['capabilities']): string[] {
  const gaps: string[] = [];
  if (!capabilities.audienceSegmentation.ready) {
    gaps.push('Add persona or segment enums to core page models.');
  }
  if (!capabilities.contextualContent.ready) {
    gaps.push('Capture channel or device context to tailor messaging.');
  }
  if (!capabilities.abTesting.ready) {
    gaps.push('Introduce variant fields for running A/B tests at the schema level.');
  }
  if (!capabilities.dynamicContent.ready) {
    gaps.push('Use references to reusable components instead of static fields.');
  }
  return gaps;
}

function buildImplementationPath(
  level: PersonalizationReadiness['level'],
  capabilities: PersonalizationReadiness['capabilities']
): string[] {
  if (level === 'advanced') {
    return ['Connect personalization fields to analytics/CDP to automate targeting.'];
  }
  const steps: string[] = [];
  if (!capabilities.audienceSegmentation.ready) steps.push('Start with high-level audience enum on hero models.');
  if (!capabilities.contextualContent.ready) steps.push('Add channel/device flags to modular content components.');
  if (!capabilities.abTesting.ready) steps.push('Standardize naming for variant fields (variantA, variantB).');
  if (!capabilities.dynamicContent.ready) steps.push('Refactor page layouts to consume component references.');
  return steps.slice(0, 3);
}




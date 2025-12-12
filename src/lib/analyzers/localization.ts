import type {
  HygraphSchema,
  LocalizationAssessment,
} from '../types';

const LOCALIZED_FIELD_REGEX = /(locale|localization|translation|language)/i;

/**
 * Analyze localization readiness by inspecting schema structure.
 */
export function analyzeLocalization(schema: HygraphSchema): LocalizationAssessment {
  const totalContentModels = schema.models.filter(model => !model.isSystem).length;
  const localizedModels = schema.models.filter(model =>
    model.fields.some(field => LOCALIZED_FIELD_REGEX.test(field.name))
  );

  const localizedFields = localizedModels.reduce((count, model) => {
    return count + model.fields.filter(field => LOCALIZED_FIELD_REGEX.test(field.name)).length;
  }, 0);

  const localeEnum = schema.enums.find(en => /locale/i.test(en.name));
  const localeCount = localeEnum ? localeEnum.values.length : 1;
  const localizedFieldsRatio = totalContentModels === 0 ? 0 : localizedFields / (totalContentModels * 5);

  const readiness = determineReadiness(localizedModels.length, localeCount);
  const narrative = buildNarrative(readiness, localizedModels.length, localeCount);

  const gaps = buildGaps(readiness, localizedModels.length, localeCount, schema.models.length);
  const strengths = buildStrengths(localizedModels.length, localeCount);

  return {
    readiness,
    narrative,
    coverage: {
      localizedModels: localizedModels.length,
      totalContentModels,
      localeCount,
      localizedFieldsRatio: Number(localizedFieldsRatio.toFixed(2)),
    },
    gaps,
    strengths,
    workflowConsiderations: buildWorkflowConsiderations(localeCount, localizedModels.length),
  };
}

function determineReadiness(localizedModels: number, localeCount: number): LocalizationAssessment['readiness'] {
  if (localizedModels === 0) return 'none';
  if (localeCount <= 1 || localizedModels <= 2) return 'basic';
  if (localeCount >= 3 && localizedModels >= 4) return 'structured';
  return 'advanced';
}

function buildNarrative(
  readiness: LocalizationAssessment['readiness'],
  localizedModels: number,
  localeCount: number
): string {
  switch (readiness) {
    case 'advanced':
      return `Localization is deeply integrated across the schema with ${localeCount}+ locales supported natively.`;
    case 'structured':
      return `A solid localization foundation exists across ${localizedModels} models. Define workflows to keep locales in sync.`;
    case 'basic':
      return `Localization fields exist but only cover ${localizedModels} model(s). Scale the pattern before adding more locales.`;
    default:
      return 'Content is currently single-locale. Plan now if international expansion is on the roadmap.';
  }
}

function buildGaps(
  readiness: LocalizationAssessment['readiness'],
  localizedModels: number,
  localeCount: number,
  totalModels: number
): LocalizationAssessment['gaps'] {
  const gaps: LocalizationAssessment['gaps'] = [];
  if (readiness === 'none') {
    gaps.push({
      issue: 'No localization-ready models',
      impact: 'Scaling to new regions will require schema surgery',
      recommendation: 'Introduce locale-aware structures for high-priority models first.',
    });
    return gaps;
  }

  if (localizedModels < totalModels / 3) {
    gaps.push({
      issue: 'Limited model coverage',
      impact: 'Only a subset of content can be translated, creating fragmented experiences',
      recommendation: 'Extend localization fields to hero pages, navigation, and SEO metadata.',
    });
  }

  if (localeCount <= 2) {
    gaps.push({
      issue: 'Locale list managed in schema',
      impact: 'Adding new locales requires developers, delaying go-to-market',
      recommendation: 'Store locale configuration in environment variables or dedicated models.',
    });
  }

  return gaps;
}

function buildStrengths(localizedModels: number, localeCount: number): string[] {
  const strengths: string[] = [];
  if (localizedModels >= 3) strengths.push(`${localizedModels} models already support locale-specific fields.`);
  if (localeCount >= 3) strengths.push(`Locale enum tracks ${localeCount}+ languages.`);
  if (strengths.length === 0) strengths.push('Localization groundwork can be introduced without major refactors.');
  return strengths;
}

function buildWorkflowConsiderations(localeCount: number, localizedModels: number): string[] {
  const considerations: string[] = [];
  if (localeCount > 2) {
    considerations.push('Define translation workflow stages to avoid overwriting approved locales.');
  }
  if (localizedModels > 4) {
    considerations.push('Group related translation tasks to prevent partial releases.');
  }
  considerations.push('Clarify fallback locale behavior in the frontend.');
  return considerations;
}





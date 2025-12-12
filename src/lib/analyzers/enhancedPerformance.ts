import { GraphQLClient } from 'graphql-request';
import type { 
  HygraphSchema, 
  HygraphModel,
  CachingReadiness,
  EnumTaxonomyRecommendation,
  EnhancedPerformanceAnalysis
} from '../types';
import { fetchContentSample } from '../hygraph/introspection';
import { filterSystemModels } from './systemFilters';

// System types to exclude
const SYSTEM_TYPES = new Set(['Asset', 'RichText', 'Location', 'Color', 'RGBA']);

// Fields that indicate unique identifiers
const UNIQUE_ID_PATTERNS = [
  /^slug$/i,
  /^id$/i,
  /^uuid$/i,
  /^externalId$/i,
  /^sku$/i,
  /^code$/i,
  /^identifier$/i,
  /Handle$/i,
  /Code$/i,
  /Id$/i,
];

// Fields that are good candidates for enums/taxonomies
const ENUM_CANDIDATE_PATTERNS = [
  /^type$/i,
  /^status$/i,
  /^category$/i,
  /^region$/i,
  /^country$/i,
  /^language$/i,
  /^role$/i,
  /^level$/i,
  /^priority$/i,
  /^style$/i,
  /^variant$/i,
  /^theme$/i,
  /^size$/i,
  /^color$/i,
  /Type$/i,
  /Status$/i,
  /Category$/i,
];

// Thresholds
const MAX_ENUM_VALUES = 20;        // If more than 20 distinct values, might be taxonomy
const MIN_ENTRIES_FOR_ANALYSIS = 10;
const MAX_TAXONOMY_VALUES = 100;   // Beyond this, keep as text

function hasUniqueIdField(model: HygraphModel): { hasUniqueId: boolean; field: string } {
  for (const field of model.fields) {
    // Check if field matches unique ID pattern
    for (const pattern of UNIQUE_ID_PATTERNS) {
      if (pattern.test(field.name)) {
        return { hasUniqueId: true, field: field.name };
      }
    }
    
    // Check for unique constraint
    if (field.isUnique) {
      return { hasUniqueId: true, field: field.name };
    }
  }
  
  return { hasUniqueId: false, field: '' };
}

function isEnumCandidate(fieldName: string): boolean {
  return ENUM_CANDIDATE_PATTERNS.some(pattern => pattern.test(fieldName));
}

function getStringFields(model: HygraphModel): string[] {
  return model.fields
    .filter(f => f.type === 'String' && !f.isList)
    .filter(f => !['id', 'createdAt', 'updatedAt', 'publishedAt', 'slug', 'title', 'name', 'description', 'content', 'body', 'text', 'html', 'url', 'email', 'phone'].includes(f.name.toLowerCase()))
    .map(f => f.name);
}

export function analyzeCachingReadiness(schema: HygraphSchema): CachingReadiness {
  const models = filterSystemModels(schema.models).filter(m => !SYSTEM_TYPES.has(m.name));
  
  const modelsWithUniqueId: { model: string; field: string }[] = [];
  const modelsWithoutUniqueId: string[] = [];
  const cacheKeyRecommendations: { model: string; suggestion: string }[] = [];
  
  for (const model of models) {
    const { hasUniqueId, field } = hasUniqueIdField(model);
    
    if (hasUniqueId) {
      modelsWithUniqueId.push({ model: model.name, field });
    } else {
      modelsWithoutUniqueId.push(model.name);
      
      // Generate recommendation
      const hasTitle = model.fields.some(f => /^(title|name)$/i.test(f.name));
      const hasSlugLike = model.fields.some(f => f.name.toLowerCase().includes('slug') || f.name.toLowerCase().includes('handle'));
      
      if (hasSlugLike) {
        cacheKeyRecommendations.push({
          model: model.name,
          suggestion: 'Consider making the slug/handle field unique for better cache key support'
        });
      } else if (hasTitle) {
        cacheKeyRecommendations.push({
          model: model.name,
          suggestion: 'Add a unique slug or identifier field for URL-based caching'
        });
      } else {
        cacheKeyRecommendations.push({
          model: model.name,
          suggestion: 'Add a unique identifier field (e.g., slug, code, externalId) for cache key generation'
        });
      }
    }
  }
  
  // Calculate score
  const totalModels = models.length;
  const withUniqueCount = modelsWithUniqueId.length;
  const coverageRatio = totalModels > 0 ? withUniqueCount / totalModels : 1;
  
  const overallScore = Math.round(coverageRatio * 100);
  
  return {
    modelsWithUniqueId,
    modelsWithoutUniqueId,
    cacheKeyRecommendations,
    overallScore
  };
}

export async function analyzeEnumTaxonomyOpportunities(
  client: GraphQLClient,
  schema: HygraphSchema,
  entryCounts: Record<string, { draft: number; published: number }>
): Promise<EnumTaxonomyRecommendation[]> {
  const recommendations: EnumTaxonomyRecommendation[] = [];
  const models = filterSystemModels(schema.models).filter(m => !SYSTEM_TYPES.has(m.name));
  
  for (const model of models) {
    // Skip models with few entries
    const counts = entryCounts[model.name];
    if (!counts || counts.draft < MIN_ENTRIES_FOR_ANALYSIS) continue;
    
    // Get string fields that might be enum candidates
    const stringFields = getStringFields(model);
    
    // Prioritize fields matching enum patterns
    const candidateFields = stringFields.filter(f => isEnumCandidate(f));
    
    // Also check other string fields for low cardinality
    const otherFields = stringFields.filter(f => !isEnumCandidate(f));
    
    try {
      // Fetch sample content
      const allFieldsToCheck = [...candidateFields, ...otherFields.slice(0, 5)];
      if (allFieldsToCheck.length === 0) continue;
      
      const samples = await fetchContentSample(client, model, allFieldsToCheck, 100);
      
      if (samples.length < MIN_ENTRIES_FOR_ANALYSIS) continue;
      
      for (const fieldName of allFieldsToCheck) {
        // Collect distinct values
        const values = new Set<string>();
        let nonEmptyCount = 0;
        
        for (const sample of samples) {
          const value = sample[fieldName];
          if (typeof value === 'string' && value.trim() !== '') {
            values.add(value.trim());
            nonEmptyCount++;
          }
        }
        
        // Skip if field is mostly empty
        if (nonEmptyCount < samples.length * 0.3) continue;
        
        const distinctCount = values.size;
        const distinctValues = Array.from(values).slice(0, 20);
        
        // Determine recommendation
        if (distinctCount <= MAX_ENUM_VALUES && distinctCount > 1) {
          // Good candidate for enum
          recommendations.push({
            model: model.name,
            field: fieldName,
            currentType: 'String',
            distinctValues,
            recommendation: 'enum',
            reason: `Only ${distinctCount} distinct value(s) found. Convert to enum for validation and UI dropdowns.`
          });
        } else if (distinctCount > MAX_ENUM_VALUES && distinctCount <= MAX_TAXONOMY_VALUES) {
          // Good candidate for taxonomy
          recommendations.push({
            model: model.name,
            field: fieldName,
            currentType: 'String',
            distinctValues,
            recommendation: 'taxonomy',
            reason: `${distinctCount} distinct values - too many for enum but structured enough for taxonomy model.`
          });
        }
        // If more than MAX_TAXONOMY_VALUES, keep as text (probably free-form)
      }
    } catch {
      // Skip on error
    }
  }
  
  // Sort recommendations by model and recommendation type
  recommendations.sort((a, b) => {
    if (a.model !== b.model) return a.model.localeCompare(b.model);
    if (a.recommendation !== b.recommendation) {
      return a.recommendation === 'enum' ? -1 : 1;
    }
    return a.field.localeCompare(b.field);
  });
  
  return recommendations;
}

export async function analyzeEnhancedPerformance(
  client: GraphQLClient,
  schema: HygraphSchema,
  entryCounts: Record<string, { draft: number; published: number }>
): Promise<EnhancedPerformanceAnalysis> {
  const cachingReadiness = analyzeCachingReadiness(schema);
  const enumTaxonomyRecommendations = await analyzeEnumTaxonomyOpportunities(
    client,
    schema,
    entryCounts
  );
  
  return {
    cachingReadiness,
    enumTaxonomyRecommendations
  };
}

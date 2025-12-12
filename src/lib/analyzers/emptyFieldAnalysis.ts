import { GraphQLClient } from 'graphql-request';
import type { HygraphSchema, HygraphModel, EmptyFieldAnalysis, FieldFillRate } from '../types';
import { fetchFieldValues } from '../hygraph/introspection';

// System types to exclude
const SYSTEM_TYPES = new Set(['Asset', 'RichText', 'Location', 'Color', 'RGBA']);

// System fields to exclude from analysis
const SYSTEM_FIELDS = new Set([
  'id', 'createdAt', 'updatedAt', 'publishedAt', 'createdBy', 'updatedBy', 
  'publishedBy', 'stage', 'documentInStages', 'history', 'scheduledIn', '__typename'
]);

// Sampling limits for scalability
const MAX_MODELS_TO_ANALYZE = 15;
const MAX_ENTRIES_PER_MODEL = 50;

function isValueEmpty(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string' && value.trim() === '') return true;
  if (Array.isArray(value) && value.length === 0) return true;
  if (typeof value === 'object' && value !== null) {
    // Handle Rich Text { text: "" } case
    const obj = value as Record<string, unknown>;
    if ('text' in obj && (obj.text === null || obj.text === '' || obj.text === undefined)) {
      return true;
    }
  }
  return false;
}

function getAnalyzableFields(model: HygraphModel): { name: string; isRequired: boolean }[] {
  return model.fields
    .filter(f => !SYSTEM_FIELDS.has(f.name))
    .map(f => ({
      name: f.name,
      isRequired: f.isRequired || false
    }));
}

export async function analyzeEmptyFields(
  client: GraphQLClient,
  schema: HygraphSchema,
  entryCounts: Record<string, { draft: number; published: number }>
): Promise<EmptyFieldAnalysis> {
  const fieldFillRates: FieldFillRate[] = [];
  const rarelyUsedFields: { model: string; field: string; fillRate: number }[] = [];
  const dataQualityIssues: { model: string; field: string; fillRate: number }[] = [];
  const unusedOptionalFields: { model: string; field: string }[] = [];
  const modelSummary: { model: string; avgFillRate: number; fieldCount: number }[] = [];
  const recommendations: string[] = [];
  
  // Filter and limit models for scalability
  const modelsToAnalyze = schema.models
    .filter(m => !m.isSystem && !SYSTEM_TYPES.has(m.name))
    .filter(m => {
      const entryCount = entryCounts[m.name];
      return entryCount && entryCount.draft > 0;
    })
    .slice(0, MAX_MODELS_TO_ANALYZE);
  
  // Analyze each model
  for (const model of modelsToAnalyze) {
    const analyzableFields = getAnalyzableFields(model);
    if (analyzableFields.length === 0) continue;
    
    try {
      // Fetch sample content (limited)
      const samples = await fetchFieldValues(client, model, MAX_ENTRIES_PER_MODEL);
      const sampleSize = samples.length;
      
      if (sampleSize === 0) continue;
      
      const modelFillRates: number[] = [];
      
      for (const fieldInfo of analyzableFields) {
        const { name: fieldName, isRequired } = fieldInfo;
        
        // Count filled vs empty
        let filledCount = 0;
        let emptyCount = 0;
        
        for (const sample of samples) {
          const value = sample[fieldName];
          if (isValueEmpty(value)) {
            emptyCount++;
          } else {
            filledCount++;
          }
        }
        
        const fillRate = Math.round((filledCount / sampleSize) * 100);
        
        fieldFillRates.push({
          model: model.name,
          field: fieldName,
          fillRate,
          sampleSize,
          isEmpty: emptyCount,
          isFilled: filledCount,
          isRequired
        });
        
        modelFillRates.push(fillRate);
        
        // Categorize issues
        if (fillRate === 0 && !isRequired) {
          unusedOptionalFields.push({ model: model.name, field: fieldName });
        } else if (fillRate < 20) {
          rarelyUsedFields.push({ model: model.name, field: fieldName, fillRate });
        }
        
        if (isRequired && fillRate < 80) {
          dataQualityIssues.push({ model: model.name, field: fieldName, fillRate });
        }
      }
      
      // Calculate model summary
      const avgFillRate = modelFillRates.length > 0
        ? Math.round(modelFillRates.reduce((a, b) => a + b, 0) / modelFillRates.length)
        : 0;
      
      modelSummary.push({
        model: model.name,
        avgFillRate,
        fieldCount: analyzableFields.length
      });
      
    } catch {
      // Skip models we can't analyze
    }
  }
  
  // Sort summaries
  modelSummary.sort((a, b) => a.avgFillRate - b.avgFillRate);
  rarelyUsedFields.sort((a, b) => a.fillRate - b.fillRate);
  dataQualityIssues.sort((a, b) => a.fillRate - b.fillRate);
  
  // Generate recommendations
  if (unusedOptionalFields.length > 0) {
    const count = unusedOptionalFields.length;
    const examples = unusedOptionalFields.slice(0, 3).map(f => `${f.model}.${f.field}`).join(', ');
    recommendations.push(
      `${count} optional field(s) are completely unused (${examples}${count > 3 ? '...' : ''}). Consider removing them to simplify the schema.`
    );
  }
  
  if (rarelyUsedFields.length > 0) {
    const count = rarelyUsedFields.length;
    recommendations.push(
      `${count} field(s) have less than 20% fill rate. Review if they are necessary or if editors need guidance on when to use them.`
    );
  }
  
  if (dataQualityIssues.length > 0) {
    const count = dataQualityIssues.length;
    const examples = dataQualityIssues.slice(0, 3).map(f => `${f.model}.${f.field} (${f.fillRate}%)`).join(', ');
    recommendations.push(
      `${count} required field(s) have low fill rates: ${examples}. This may indicate data quality issues or that fields shouldn't be required.`
    );
  }
  
  const lowFillModels = modelSummary.filter(m => m.avgFillRate < 50);
  if (lowFillModels.length > 0) {
    const examples = lowFillModels.slice(0, 3).map(m => `${m.model} (${m.avgFillRate}%)`).join(', ');
    recommendations.push(
      `${lowFillModels.length} model(s) have average fill rates below 50%: ${examples}. Consider content audit or schema simplification.`
    );
  }
  
  if (fieldFillRates.length === 0) {
    recommendations.push('No content available to analyze field fill rates.');
  }
  
  // Calculate overall data quality score
  let overallDataQuality = 100;
  
  // Penalize for unused fields (schema bloat)
  overallDataQuality -= Math.min(20, unusedOptionalFields.length * 2);
  
  // Penalize for rarely used fields
  overallDataQuality -= Math.min(15, rarelyUsedFields.length);
  
  // Penalize for data quality issues (required fields not filled)
  overallDataQuality -= Math.min(25, dataQualityIssues.length * 5);
  
  // Penalize for low-fill models
  const avgModelFillRate = modelSummary.length > 0
    ? modelSummary.reduce((a, b) => a + b.avgFillRate, 0) / modelSummary.length
    : 100;
  
  if (avgModelFillRate < 70) {
    overallDataQuality -= Math.round((70 - avgModelFillRate) / 2);
  }
  
  return {
    fieldFillRates,
    rarelyUsedFields,
    dataQualityIssues,
    unusedOptionalFields,
    modelSummary,
    overallDataQuality: Math.max(0, overallDataQuality),
    recommendations
  };
}

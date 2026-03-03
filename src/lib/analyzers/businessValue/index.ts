import type { HygraphSchema, BusinessValueData, EditorExperienceData, ContentCostData, ModelEditorExperienceData, ModelCostData } from '../../types';

// Field time weights in seconds
const FIELD_TIME_WEIGHTS: Record<string, number> = {
  String: 15,
  Int: 5,
  Float: 5,
  Boolean: 3,
  Date: 8,
  DateTime: 8,
  Json: 30,
  RichText: 120,  // Rich text is complex
  Asset: 45,      // Uploading/selecting assets
  Location: 20,
  Color: 10,
};

// Click estimates per field type
const FIELD_CLICK_WEIGHTS: Record<string, number> = {
  String: 2,
  Int: 2,
  Float: 2,
  Boolean: 1,
  Date: 3,
  DateTime: 3,
  Json: 5,
  RichText: 10,
  Asset: 4,
  Location: 5,
  Color: 3,
};

function getFieldTimeSeconds(fieldType: string, isRequired: boolean, isList: boolean): number {
  const baseTime = FIELD_TIME_WEIGHTS[fieldType] || 15;
  let time = baseTime;
  
  if (isRequired) time += 5; // Extra time for required fields
  if (isList) time *= 1.5;   // Lists take more time
  
  return time;
}

function getFieldClicks(fieldType: string, isList: boolean): number {
  const baseClicks = FIELD_CLICK_WEIGHTS[fieldType] || 2;
  return isList ? baseClicks * 2 : baseClicks;
}

function getCognitiveLoad(fieldCount: number, requiredCount: number, relationCount: number): number {
  // Cognitive load score: 0-100 (lower is better)
  const fieldPenalty = Math.min(fieldCount * 2, 40);
  const requiredPenalty = Math.min(requiredCount * 3, 30);
  const relationPenalty = Math.min(relationCount * 5, 30);
  
  return Math.min(100, fieldPenalty + requiredPenalty + relationPenalty);
}

function getComplexity(score: number): 'simple' | 'moderate' | 'complex' | 'very-complex' {
  if (score >= 80) return 'simple';
  if (score >= 60) return 'moderate';
  if (score >= 40) return 'complex';
  return 'very-complex';
}

// Visual anchor field names (fields that help identify content at a glance)
const VISUAL_ANCHOR_FIELDS = ['title', 'name', 'heading', 'headline', 'label', 'displayName', 'slug'];

// Analyze naming clarity for a field name
function getFieldNamingScore(fieldName: string): number {
  // Good naming: camelCase or snake_case with meaningful words
  // Bad naming: single letters, cryptic abbreviations
  if (fieldName.length <= 2) return 30;
  if (/^[a-z]+[A-Z]/.test(fieldName) || fieldName.includes('_')) {
    // camelCase or snake_case - good
    const words = fieldName.split(/(?=[A-Z])|_/).filter(w => w.length > 0);
    if (words.length >= 2) return 100; // Multi-word names are clear
    if (words[0].length > 4) return 85; // Single long word
    return 70;
  }
  if (fieldName.length > 6) return 75;
  return 50;
}

function hasVisualAnchorField(fields: { name: string }[]): boolean {
  return fields.some(f => VISUAL_ANCHOR_FIELDS.includes(f.name.toLowerCase()));
}

function calculateNamingClarity(fields: { name: string }[]): number {
  if (fields.length === 0) return 100;
  const userFields = fields.filter(f => 
    !['id', 'createdAt', 'updatedAt', 'publishedAt', 'createdBy', 'updatedBy', 'documentInStages', 'stage'].includes(f.name)
  );
  if (userFields.length === 0) return 100;
  
  const totalScore = userFields.reduce((sum, f) => sum + getFieldNamingScore(f.name), 0);
  return Math.round(totalScore / userFields.length);
}

function calculateDescriptionsPercent(fields: { name: string; description?: string }[]): number {
  // Filter out system fields
  const userFields = fields.filter(f => 
    !['id', 'createdAt', 'updatedAt', 'publishedAt', 'createdBy', 'updatedBy', 'documentInStages', 'stage'].includes(f.name)
  );
  if (userFields.length === 0) return 100;
  
  const withDescriptions = userFields.filter(f => f.description && f.description.length > 0);
  return Math.round((withDescriptions.length / userFields.length) * 100);
}

export function analyzeEditorExperience(schema: HygraphSchema): EditorExperienceData {
  const models: ModelEditorExperienceData[] = [];
  
  for (const model of schema.models) {
    if (model.isSystem) continue;
    
    let totalTimeSeconds = 60; // Base overhead: open form, navigate, save
    let totalClicks = 5;       // Base clicks: navigate, open, fill title, save
    let requiredCount = 0;
    let relationCount = 0;
    
    for (const field of model.fields) {
      // Skip system fields
      if (['id', 'createdAt', 'updatedAt', 'publishedAt', 'createdBy', 'updatedBy', 'documentInStages'].includes(field.name)) {
        continue;
      }
      
      const isRequired = field.isRequired || false;
      const isList = field.isList || false;
      const fieldType = field.type;
      
      if (isRequired) requiredCount++;
      if (field.relatedModel) relationCount++;
      
      totalTimeSeconds += getFieldTimeSeconds(fieldType, isRequired, isList);
      totalClicks += getFieldClicks(fieldType, isList);
      
      // Relations add extra clicks
      if (field.relatedModel) {
        totalClicks += 3;
        totalTimeSeconds += 20;
      }
    }
    
    const timeMinutes = totalTimeSeconds / 60;
    const cognitiveLoad = getCognitiveLoad(model.fields.length, requiredCount, relationCount);
    const overallScore = Math.max(0, 100 - cognitiveLoad);
    
    // Calculate additional metrics
    const hasAnchor = hasVisualAnchorField(model.fields);
    const namingClarity = calculateNamingClarity(model.fields);
    const descriptionsPercent = calculateDescriptionsPercent(model.fields);
    
    models.push({
      modelName: model.name,
      timeMinutes: Math.round(timeMinutes * 10) / 10,
      clicks: totalClicks,
      cognitiveLoad,
      overallScore,
      complexity: getComplexity(overallScore),
      hasVisualAnchor: hasAnchor,
      namingClarity,
      descriptionsPercent,
    });
  }
  
  // Sort by worst score first
  models.sort((a, b) => a.overallScore - b.overallScore);
  
  const avgTime = models.length > 0 
    ? models.reduce((sum, m) => sum + m.timeMinutes, 0) / models.length 
    : 0;
  const avgClicks = models.length > 0 
    ? models.reduce((sum, m) => sum + m.clicks, 0) / models.length 
    : 0;
  const avgCognitiveLoad = models.length > 0 
    ? models.reduce((sum, m) => sum + m.cognitiveLoad, 0) / models.length 
    : 0;
  
  const worstModels = models
    .filter(m => m.overallScore < 50)
    .map(m => m.modelName)
    .slice(0, 5);
  
  const recommendations: string[] = [];
  
  if (avgTime > 10) {
    recommendations.push('Consider breaking down complex models into smaller components to reduce average entry time');
  }
  if (avgClicks > 30) {
    recommendations.push('High click count detected - consider using default values and removing optional fields');
  }
  if (worstModels.length > 0) {
    recommendations.push(`Focus on simplifying these models: ${worstModels.join(', ')}`);
  }
  if (avgCognitiveLoad > 50) {
    recommendations.push('Add field descriptions and group related fields to reduce cognitive load');
  }
  
  return {
    models,
    averageTimeMinutes: Math.round(avgTime * 10) / 10,
    averageClicks: Math.round(avgClicks),
    averageCognitiveLoad: Math.round(avgCognitiveLoad),
    worstModels,
    recommendations,
  };
}

export function analyzeContentCost(
  schema: HygraphSchema,
  entryCounts: Record<string, { draft: number; published: number }>,
  hourlyRate: number = 50
): ContentCostData {
  const editorExperience = analyzeEditorExperience(schema);
  const costPerModel: ModelCostData[] = [];
  let totalEntries = 0;
  let totalCost = 0;
  
  for (const modelExp of editorExperience.models) {
    const counts = entryCounts[modelExp.modelName] || { draft: 0, published: 0 };
    const entryCount = counts.draft; // draft includes all entries
    
    if (entryCount === 0) continue;
    
    totalEntries += entryCount;
    const costPerEntry = (modelExp.timeMinutes / 60) * hourlyRate;
    const modelTotalCost = costPerEntry * entryCount;
    totalCost += modelTotalCost;
    
    costPerModel.push({
      modelName: modelExp.modelName,
      entryCount,
      timePerEntryMinutes: modelExp.timeMinutes,
      costPerEntry: Math.round(costPerEntry * 100) / 100,
      totalCost: Math.round(modelTotalCost),
      complexity: modelExp.complexity,
    });
  }
  
  // Sort by total cost descending
  costPerModel.sort((a, b) => b.totalCost - a.totalCost);
  
  const recommendations: string[] = [];
  
  if (totalCost > 10000) {
    recommendations.push('Significant content investment detected - ensure content governance processes are in place');
  }
  
  const highCostModels = costPerModel.filter(m => m.totalCost > 1000);
  if (highCostModels.length > 0) {
    recommendations.push(`High-cost models: ${highCostModels.map(m => m.modelName).join(', ')} - consider optimizing these first`);
  }
  
  const complexModels = costPerModel.filter(m => m.complexity === 'very-complex' || m.complexity === 'complex');
  if (complexModels.length > 0) {
    recommendations.push(`Complex models increase content cost - simplify ${complexModels.map(m => m.modelName).join(', ')}`);
  }
  
  return {
    hourlyRate,
    totalModels: costPerModel.length,
    totalEntries,
    estimatedTotalCost: Math.round(totalCost),
    costPerModel,
    recommendations,
  };
}

export function analyzeBusinessValue(
  schema: HygraphSchema,
  entryCounts: Record<string, { draft: number; published: number }>,
  hourlyRate: number = 50
): BusinessValueData {
  const editorExperience = analyzeEditorExperience(schema);
  const contentCost = analyzeContentCost(schema, entryCounts, hourlyRate);
  
  // Overall score based on editor experience and cost efficiency
  const avgScore = editorExperience.models.length > 0
    ? editorExperience.models.reduce((sum, m) => sum + m.overallScore, 0) / editorExperience.models.length
    : 100;
  
  const recommendations: string[] = [
    ...editorExperience.recommendations.slice(0, 2),
    ...contentCost.recommendations.slice(0, 2),
  ];
  
  return {
    editorExperience,
    contentCost,
    overallScore: Math.round(avgScore),
    recommendations,
  };
}

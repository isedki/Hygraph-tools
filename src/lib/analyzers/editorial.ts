import type { HygraphSchema, EditorialAnalysis, AuditIssue } from '../types';

interface ModelComplexity {
  model: string;
  fieldCount: number;
  requiredFields: number;
  relationCount: number;
  complexityScore: number;
}

function calculateModelComplexity(schema: HygraphSchema): ModelComplexity[] {
  return schema.models.map(model => {
    const fieldCount = model.fields.length;
    const requiredFields = model.fields.filter(f => f.isRequired).length;
    const relationCount = model.fields.filter(f => f.relatedModel).length;
    
    // Complexity formula: fields + (required * 0.5) + (relations * 1.5)
    const complexityScore = fieldCount + (requiredFields * 0.5) + (relationCount * 1.5);
    
    return {
      model: model.name,
      fieldCount,
      requiredFields,
      relationCount,
      complexityScore: Math.round(complexityScore * 10) / 10,
    };
  }).sort((a, b) => b.complexityScore - a.complexityScore);
}

function analyzeLocalizationBurden(schema: HygraphSchema): {
  model: string;
  localizedFields: number;
  localeCount: number;
  totalFieldsToManage: number;
}[] {
  // Estimate localized fields based on field names
  const localizedFieldPatterns = ['title', 'name', 'description', 'content', 'text', 'label', 'caption'];
  
  // Assume a typical Hygraph setup has 2-5 locales
  const estimatedLocaleCount = 3;
  
  return schema.models.map(model => {
    const localizedFields = model.fields.filter(f => 
      localizedFieldPatterns.some(pattern => 
        f.name.toLowerCase().includes(pattern) && f.type === 'String'
      )
    ).length;
    
    return {
      model: model.name,
      localizedFields,
      localeCount: estimatedLocaleCount,
      totalFieldsToManage: localizedFields * estimatedLocaleCount,
    };
  }).filter(m => m.localizedFields > 0)
    .sort((a, b) => b.totalFieldsToManage - a.totalFieldsToManage);
}

export function analyzeEditorial(schema: HygraphSchema): EditorialAnalysis {
  const modelComplexity = calculateModelComplexity(schema);
  
  // Calculate averages
  const totalFields = modelComplexity.reduce((sum, m) => sum + m.fieldCount, 0);
  const totalRequired = modelComplexity.reduce((sum, m) => sum + m.requiredFields, 0);
  
  const averageFieldsPerModel = schema.models.length > 0 
    ? totalFields / schema.models.length 
    : 0;
  
  const averageRequiredRatio = totalFields > 0 
    ? (totalRequired / totalFields) * 100 
    : 0;
  
  const localizationBurden = analyzeLocalizationBurden(schema);
  
  return {
    modelComplexity,
    averageFieldsPerModel: Math.round(averageFieldsPerModel * 10) / 10,
    averageRequiredRatio: Math.round(averageRequiredRatio * 10) / 10,
    localizationBurden,
  };
}

export function generateEditorialIssues(analysis: EditorialAnalysis): AuditIssue[] {
  const issues: AuditIssue[] = [];
  
  // Complex models (too many fields)
  for (const model of analysis.modelComplexity) {
    if (model.fieldCount > 25) {
      issues.push({
        id: `complex-model-${model.model}`,
        severity: model.fieldCount > 35 ? 'warning' : 'info',
        category: 'editorial',
        title: 'Complex Model',
        description: `"${model.model}" has ${model.fieldCount} fields`,
        impact: 'Complex models overwhelm editors and slow down the UI',
        recommendation: 'Split into components or create model variants',
        affectedItems: [model.model],
      });
    }
  }
  
  // High required field ratio
  for (const model of analysis.modelComplexity) {
    if (model.fieldCount >= 5 && model.requiredFields / model.fieldCount > 0.8) {
      issues.push({
        id: `high-required-${model.model}`,
        severity: 'info',
        category: 'editorial',
        title: 'High Required Field Ratio',
        description: `"${model.model}" requires ${model.requiredFields}/${model.fieldCount} fields (${Math.round(model.requiredFields / model.fieldCount * 100)}%)`,
        impact: 'Too many required fields can frustrate content editors',
        recommendation: 'Review if all fields truly need to be required',
        affectedItems: [model.model],
      });
    }
  }
  
  // High relation count
  for (const model of analysis.modelComplexity) {
    if (model.relationCount > 5) {
      issues.push({
        id: `many-relations-${model.model}`,
        severity: 'info',
        category: 'editorial',
        title: 'Many Relations',
        description: `"${model.model}" has ${model.relationCount} relation fields`,
        impact: 'Many relations increase complexity of content entry',
        recommendation: 'Consider grouping related content into components',
        affectedItems: [model.model],
      });
    }
  }
  
  // Localization burden
  for (const burden of analysis.localizationBurden) {
    if (burden.totalFieldsToManage > 15) {
      issues.push({
        id: `localization-burden-${burden.model}`,
        severity: burden.totalFieldsToManage > 25 ? 'warning' : 'info',
        category: 'editorial',
        title: 'High Localization Burden',
        description: `"${burden.model}": ${burden.localizedFields} fields × ${burden.localeCount} locales = ${burden.totalFieldsToManage} fields to manage`,
        impact: 'High localization burden increases translation effort',
        recommendation: 'Consider reducing localizable fields or using translation services',
        affectedItems: [burden.model],
      });
    }
  }
  
  // Average complexity check
  if (analysis.averageFieldsPerModel > 15) {
    issues.push({
      id: 'high-avg-fields',
      severity: 'info',
      category: 'editorial',
      title: 'High Average Field Count',
      description: `Average of ${analysis.averageFieldsPerModel} fields per model`,
      impact: 'Overall schema may be too complex for efficient editing',
      recommendation: 'Use components to reduce field count per model',
      affectedItems: [],
    });
  }
  
  // Good structure recognition
  const simpleModels = analysis.modelComplexity.filter(m => 
    m.fieldCount <= 10 && m.complexityScore < 15
  );
  if (simpleModels.length >= 3) {
    issues.push({
      id: 'good-simple-models',
      severity: 'info',
      category: 'editorial',
      title: 'Well-Structured Models',
      description: `${simpleModels.length} model(s) have clean, simple structure`,
      impact: 'Simple models provide better editorial experience',
      recommendation: 'Follow this pattern for new models',
      affectedItems: simpleModels.map(m => m.model),
      score: 5,
    });
  }
  
  return issues;
}

export function calculateEditorialScore(analysis: EditorialAnalysis, issues: AuditIssue[]): number {
  let score = 100;
  
  // Deduct for complex models
  const complexModels = analysis.modelComplexity.filter(m => m.fieldCount > 25);
  score -= complexModels.length * 5;
  
  // Extra deduction for very complex models
  const veryComplex = analysis.modelComplexity.filter(m => m.fieldCount > 35);
  score -= veryComplex.length * 5;
  
  // Deduct for high average fields
  if (analysis.averageFieldsPerModel > 15) score -= 5;
  if (analysis.averageFieldsPerModel > 20) score -= 5;
  
  // Deduct for high required ratio
  if (analysis.averageRequiredRatio > 70) score -= 5;
  if (analysis.averageRequiredRatio > 85) score -= 5;
  
  // Deduct for localization burden
  const heavyLocalization = analysis.localizationBurden.filter(l => l.totalFieldsToManage > 15);
  score -= Math.min(heavyLocalization.length * 3, 10);
  
  // Bonus for well-structured models
  const simpleModels = analysis.modelComplexity.filter(m => m.fieldCount <= 10);
  const simpleRatio = simpleModels.length / Math.max(analysis.modelComplexity.length, 1);
  if (simpleRatio > 0.5) score += 5;
  
  return Math.max(0, Math.min(100, score));
}





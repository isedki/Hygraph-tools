import type { HygraphSchema, EditorialAnalysis, AuditIssue } from '../types';

interface ModelComplexity {
  model: string;
  fieldCount: number;
  requiredFields: number;
  relationCount: number;
  multiRelationCount: number;  // Relations with "Allow multiple values"
  richTextCount: number;
  enumCount: number;
  componentCount: number;
  multiComponentCount: number; // Components with "Allow multiple values"
  assetCount: number;
  complexityScore: number;
}

function calculateModelComplexity(schema: HygraphSchema): ModelComplexity[] {
  // Build a set of component names for quick lookup
  const componentNames = new Set(schema.components?.map(c => c.name) || []);
  // Build a set of enum names for quick lookup
  const enumNames = new Set(schema.enums?.map(e => e.name) || []);
  // Build a set of model names for identifying true relations
  const modelNames = new Set(schema.models?.map(m => m.name) || []);
  
  // System/non-relation types that should not be counted as relations
  const nonRelationTypes = new Set([
    'String', 'Int', 'Float', 'Boolean', 'ID', 'DateTime', 'Date', 'Json', 'Long',
    'RichText', 'RichTextAST', 'Location', 'Color', 'RGBA', 'Hex',
    'RGBAHue', 'RGBATransparency', 'Geometry', 'Json'
  ]);
  
  return schema.models.map(model => {
    const fieldCount = model.fields.length;
    
    // Count ONLY truly required fields from editor perspective:
    // - Must be marked required (NON_NULL in GraphQL)
    // - Must NOT be a list (lists can be empty, so not truly "required" to fill)
    // - Must NOT be a relation to other models (relations can often be empty or auto-populated)
    // - Must NOT be a reverse relation or connection field
    const requiredFields = model.fields.filter(f => {
      if (!f.isRequired) return false;
      
      // Skip list fields - they're NON_NULL as empty arrays, not requiring input
      if (f.isList) return false;
      
      // Skip relation fields (they can be optional/empty in editor)
      if (f.relatedModel && modelNames.has(f.relatedModel)) return false;
      
      // Skip Asset relations
      if (f.relatedModel === 'Asset' || f.type === 'Asset') return false;
      
      // Skip component fields (often optional in UI even if NON_NULL)
      if (componentNames.has(f.type) || f.type === 'Component') return false;
      
      // This is a truly required scalar/value field
      return true;
    }).length;
    
    // Count RichText fields (type contains 'RichText' or 'richtext')
    const richTextCount = model.fields.filter(f => 
      f.type.toLowerCase().includes('richtext')
    ).length;
    
    // Count Enum fields (type matches an enum name or type is 'Enumeration')
    const enumCount = model.fields.filter(f => 
      enumNames.has(f.type) || f.enumValues !== undefined
    ).length;
    
    // Count Component fields (type matches a component name or is a union containing components)
    const componentCount = model.fields.filter(f => 
      componentNames.has(f.type) || f.type === 'Component'
    ).length;
    
    // Count Asset fields separately
    const assetCount = model.fields.filter(f => 
      f.relatedModel === 'Asset' || f.type === 'Asset'
    ).length;
    
    // Count ONLY true relations: fields pointing to other models (not components, enums, assets, or system types)
    // A relation is a field with relatedModel that:
    // 1. Points to another model (in modelNames)
    // 2. Does NOT point to a component
    // 3. Does NOT point to an enum
    // 4. Does NOT point to Asset (counted separately)
    // 5. Does NOT point to a system/non-relation type
    const relationFields = model.fields.filter(f => {
      if (!f.relatedModel) return false;
      const targetType = f.relatedModel;
      
      // Skip if it's Asset (counted separately)
      if (targetType === 'Asset') return false;
      
      // Skip if it's a component
      if (componentNames.has(targetType)) return false;
      
      // Skip if it's an enum
      if (enumNames.has(targetType)) return false;
      
      // Skip if it's a non-relation type (RichText, etc.)
      if (nonRelationTypes.has(targetType)) return false;
      
      // Skip if the type name contains common non-relation patterns
      if (targetType.toLowerCase().includes('richtext')) return false;
      
      // It's a relation if it points to another model
      return modelNames.has(targetType);
    });
    const relationCount = relationFields.length;
    
    // Count multi-relations (relations with "Allow multiple values" / isList: true)
    const multiRelationCount = relationFields.filter(f => f.isList).length;
    
    // Count multi-components (components with "Allow multiple values" / isList: true)
    const componentFields = model.fields.filter(f => 
      componentNames.has(f.type) || f.type === 'Component'
    );
    const multiComponentCount = componentFields.filter(f => f.isList).length;
    
    // Complexity formula: fields + (required * 0.5) + (relations * 1.5) + (multi-fields * 1)
    const complexityScore = fieldCount + (requiredFields * 0.5) + (relationCount * 1.5) + (multiRelationCount * 1) + (multiComponentCount * 1);
    
    return {
      model: model.name,
      fieldCount,
      requiredFields,
      relationCount,
      multiRelationCount,
      richTextCount,
      enumCount,
      componentCount,
      multiComponentCount,
      assetCount,
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





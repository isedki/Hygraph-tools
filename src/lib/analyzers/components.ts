import type { HygraphSchema, HygraphModel, ComponentAnalysis, AuditIssue } from '../types';
import { filterSystemComponents, filterSystemModels } from './systemFilters';

// Find which models use which components
function findComponentUsage(customModels: HygraphModel[], customComponents: HygraphModel[]): Map<string, string[]> {
  const usage = new Map<string, string[]>();
  
  for (const component of customComponents) {
    usage.set(component.name, []);
  }
  
  for (const model of customModels) {
    for (const field of model.fields) {
      if (field.relatedModel && usage.has(field.relatedModel)) {
        usage.get(field.relatedModel)!.push(model.name);
      }
    }
  }
  
  // Also check component-to-component usage
  for (const component of customComponents) {
    for (const field of component.fields) {
      if (field.relatedModel && usage.has(field.relatedModel)) {
        usage.get(field.relatedModel)!.push(component.name);
      }
    }
  }
  
  return usage;
}

// Calculate component nesting depth
// SAFEGUARD: Added max depth limit to prevent deep recursion
function calculateComponentNesting(customComponents: HygraphModel[]): Map<string, number> {
  const depths = new Map<string, number>();
  const componentNames = new Set(customComponents.map(c => c.name));
  const MAX_DEPTH = 10;
  
  function getDepth(componentName: string, visited: Set<string>, currentDepth: number = 0): number {
    if (currentDepth >= MAX_DEPTH) return currentDepth; // Cap depth
    if (visited.has(componentName)) return 0; // Circular reference
    if (depths.has(componentName)) return depths.get(componentName)!;
    
    visited.add(componentName);
    const component = customComponents.find(c => c.name === componentName);
    if (!component) return 0;
    
    let maxChildDepth = 0;
    for (const field of component.fields) {
      if (field.relatedModel && componentNames.has(field.relatedModel)) {
        const childDepth = getDepth(field.relatedModel, new Set(visited), currentDepth + 1);
        maxChildDepth = Math.max(maxChildDepth, childDepth);
      }
    }
    
    const depth = maxChildDepth + 1;
    depths.set(componentName, depth);
    return depth;
  }
  
  for (const component of customComponents) {
    getDepth(component.name, new Set(), 0);
  }
  
  return depths;
}

// Find duplicate field patterns across models
function findDuplicateFieldPatterns(schema: HygraphSchema): {
  fields: string[];
  foundInModels: string[];
  recommendation: string;
}[] {
  const duplicates: { fields: string[]; foundInModels: string[]; recommendation: string }[] = [];
  
  // Create field signatures for each model
  const modelSignatures = new Map<string, Set<string>>();
  
  for (const model of schema.models) {
    const fieldNames = new Set(model.fields.map(f => f.name));
    modelSignatures.set(model.name, fieldNames);
  }
  
  // Common field patterns to look for
  const commonPatterns = [
    { fields: ['title', 'description', 'image'], name: 'Content Card' },
    { fields: ['metaTitle', 'metaDescription', 'ogImage'], name: 'SEO' },
    { fields: ['title', 'slug'], name: 'Sluggable Content' },
    { fields: ['name', 'email', 'phone'], name: 'Contact Info' },
    { fields: ['street', 'city', 'country', 'postalCode'], name: 'Address' },
    { fields: ['label', 'url', 'icon'], name: 'Link/CTA' },
    { fields: ['heading', 'subheading', 'body'], name: 'Text Block' },
  ];
  
  for (const pattern of commonPatterns) {
    const modelsWithPattern: string[] = [];
    
    for (const [modelName, fields] of modelSignatures) {
      const hasPattern = pattern.fields.every(f => 
        fields.has(f) || fields.has(f.toLowerCase()) || fields.has(f.charAt(0).toUpperCase() + f.slice(1))
      );
      
      if (hasPattern) {
        modelsWithPattern.push(modelName);
      }
    }
    
    if (modelsWithPattern.length >= 2) {
      duplicates.push({
        fields: pattern.fields,
        foundInModels: modelsWithPattern,
        recommendation: `Extract these fields to a reusable "${pattern.name}" component`,
      });
    }
  }
  
  // Look for custom duplicates (3+ identical fields across 2+ models)
  const fieldCombinations = new Map<string, string[]>();
  
  for (const model of schema.models) {
    const scalarFields = model.fields
      .filter(f => !f.relatedModel)
      .map(f => f.name)
      .sort();
    
    // Check all combinations of 3 fields
    for (let i = 0; i < scalarFields.length - 2; i++) {
      for (let j = i + 1; j < scalarFields.length - 1; j++) {
        for (let k = j + 1; k < scalarFields.length; k++) {
          const combo = [scalarFields[i], scalarFields[j], scalarFields[k]].join('|');
          if (!fieldCombinations.has(combo)) {
            fieldCombinations.set(combo, []);
          }
          fieldCombinations.get(combo)!.push(model.name);
        }
      }
    }
  }
  
  // Find combinations that appear in multiple models
  for (const [combo, models] of fieldCombinations) {
    if (models.length >= 3) {
      const fields = combo.split('|');
      // Check if this wasn't already covered by common patterns
      const alreadyCovered = duplicates.some(d => 
        d.fields.every(f => fields.includes(f))
      );
      
      if (!alreadyCovered) {
        duplicates.push({
          fields,
          foundInModels: models,
          recommendation: `Consider extracting [${fields.join(', ')}] to a reusable component`,
        });
      }
    }
  }
  
  return duplicates;
}

export function analyzeComponents(schema: HygraphSchema): ComponentAnalysis {
  const customModels = filterSystemModels(schema.models);
  const customComponents = filterSystemComponents(schema.components || []);
  
  const usage = findComponentUsage(customModels, customComponents);
  const nestingDepths = calculateComponentNesting(customComponents);
  const duplicatePatterns = findDuplicateFieldPatterns(schema);
  
  const components = customComponents.map(component => ({
    name: component.name,
    usedInModels: usage.get(component.name) || [],
    fieldCount: component.fields.length,
    nestingDepth: nestingDepths.get(component.name) || 1,
  }));
  
  const unusedComponents = components
    .filter(c => c.usedInModels.length === 0)
    .map(c => c.name);
  
  // Calculate reuse score (0-100)
  const totalUsage = components.reduce((sum, c) => sum + c.usedInModels.length, 0);
  const avgUsage = customComponents.length > 0 ? totalUsage / customComponents.length : 0;
  const reuseScore = Math.min(100, avgUsage * 25); // Max score at 4+ avg uses
  
  return {
    components,
    unusedComponents,
    duplicateFieldPatterns: duplicatePatterns,
    reuseScore,
  };
}

export function generateComponentIssues(analysis: ComponentAnalysis): AuditIssue[] {
  const issues: AuditIssue[] = [];
  
  // Unused components
  for (const component of analysis.unusedComponents) {
    issues.push({
      id: `unused-component-${component}`,
      severity: 'info',
      category: 'component',
      title: 'Unused Component',
      description: `Component "${component}" is not used in any model`,
      impact: 'Unused components add schema complexity without providing value',
      recommendation: 'Remove the component if it\'s no longer needed',
      affectedItems: [component],
    });
  }
  
  // Duplicate field patterns
  for (const pattern of analysis.duplicateFieldPatterns) {
    issues.push({
      id: `duplicate-pattern-${pattern.fields.join('-')}`,
      severity: 'warning',
      category: 'component',
      title: 'Duplicate Field Pattern',
      description: `Fields [${pattern.fields.join(', ')}] appear in ${pattern.foundInModels.length} models`,
      impact: 'Duplicated fields increase maintenance burden and inconsistency risk',
      recommendation: pattern.recommendation,
      affectedItems: pattern.foundInModels,
    });
  }
  
  // Deep component nesting
  for (const component of analysis.components) {
    if (component.nestingDepth > 3) {
      issues.push({
        id: `deep-component-${component.name}`,
        severity: 'warning',
        category: 'component',
        title: 'Deep Component Nesting',
        description: `Component "${component.name}" has ${component.nestingDepth} levels of nesting`,
        impact: 'Deep nesting complicates the editorial experience and query structure',
        recommendation: 'Consider flattening the component structure',
        affectedItems: [component.name],
      });
    }
  }
  
  // Well-reused components (positive)
  const wellReused = analysis.components.filter(c => c.usedInModels.length >= 3);
  if (wellReused.length > 0) {
    issues.push({
      id: 'good-reuse',
      severity: 'info',
      category: 'component',
      title: 'Good Component Reuse',
      description: `${wellReused.length} component(s) are well-reused across multiple models`,
      impact: 'Well-reused components promote consistency and reduce maintenance',
      recommendation: 'Continue this pattern for new shared functionality',
      affectedItems: wellReused.map(c => c.name),
      score: 10, // Bonus score
    });
  }
  
  // Low component usage overall
  if (analysis.components.length === 0 && analysis.duplicateFieldPatterns.length > 0) {
    issues.push({
      id: 'no-components',
      severity: 'warning',
      category: 'component',
      title: 'No Components Defined',
      description: 'Schema has no reusable components but has duplicate field patterns',
      impact: 'Missing an opportunity for consistency and reduced maintenance',
      recommendation: 'Create components for the identified duplicate patterns',
      affectedItems: [],
    });
  }
  
  return issues;
}

export function calculateComponentScore(analysis: ComponentAnalysis, issues: AuditIssue[]): number {
  let score = 100;
  
  // Deduct for unused components
  score -= analysis.unusedComponents.length * 3;
  
  // Deduct for duplicate patterns
  score -= analysis.duplicateFieldPatterns.length * 8;
  
  // Deduct for deep nesting
  const deepNested = analysis.components.filter(c => c.nestingDepth > 3);
  score -= deepNested.length * 5;
  
  // Bonus for good reuse
  const wellReused = analysis.components.filter(c => c.usedInModels.length >= 3);
  score += wellReused.length * 2;
  
  // Bonus for having components when patterns exist
  if (analysis.components.length > 0 && analysis.duplicateFieldPatterns.length > 0) {
    score += 5;
  }
  
  return Math.max(0, Math.min(100, score));
}




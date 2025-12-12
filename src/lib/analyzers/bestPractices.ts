import type { HygraphSchema, BestPracticesAnalysis, AuditIssue } from '../types';

// Naming convention patterns
const CAMEL_CASE_REGEX = /^[a-z][a-zA-Z0-9]*$/;
const PASCAL_CASE_REGEX = /^[A-Z][a-zA-Z0-9]*$/;
const SNAKE_CASE_REGEX = /^[a-z][a-z0-9_]*$/;

function analyzeNaming(schema: HygraphSchema): {
  item: string;
  currentName: string;
  issue: string;
  suggestion: string;
}[] {
  const issues: {
    item: string;
    currentName: string;
    issue: string;
    suggestion: string;
  }[] = [];
  
  // Check model names (should be PascalCase)
  for (const model of schema.models) {
    if (!PASCAL_CASE_REGEX.test(model.name)) {
      issues.push({
        item: 'Model',
        currentName: model.name,
        issue: 'Model names should be PascalCase',
        suggestion: model.name.charAt(0).toUpperCase() + model.name.slice(1).replace(/_([a-z])/g, (_, c) => c.toUpperCase()),
      });
    }
  }
  
  // Check field names (should be camelCase)
  for (const model of schema.models) {
    for (const field of model.fields) {
      if (!CAMEL_CASE_REGEX.test(field.name) && field.name !== 'id') {
        // Check if it's snake_case
        if (SNAKE_CASE_REGEX.test(field.name)) {
          issues.push({
            item: `${model.name}.${field.name}`,
            currentName: field.name,
            issue: 'Field uses snake_case instead of camelCase',
            suggestion: field.name.replace(/_([a-z])/g, (_, c) => c.toUpperCase()),
          });
        } else if (field.name.includes('-')) {
          issues.push({
            item: `${model.name}.${field.name}`,
            currentName: field.name,
            issue: 'Field uses kebab-case instead of camelCase',
            suggestion: field.name.replace(/-([a-z])/g, (_, c) => c.toUpperCase()),
          });
        }
      }
    }
  }
  
  return issues;
}

// Find fields that should have unique constraints
function findMissingUniqueConstraints(schema: HygraphSchema): {
  model: string;
  field: string;
  reason: string;
}[] {
  const suggestions: { model: string; field: string; reason: string }[] = [];
  
  const uniqueCandidatePatterns = [
    { pattern: /^slug$/i, reason: 'Slug fields should be unique for URL routing' },
    { pattern: /^sku$/i, reason: 'SKU should be unique for product identification' },
    { pattern: /^email$/i, reason: 'Email addresses should typically be unique' },
    { pattern: /^code$/i, reason: 'Codes are often unique identifiers' },
    { pattern: /^handle$/i, reason: 'Handles should be unique like slugs' },
    { pattern: /^permalink$/i, reason: 'Permalinks should be unique' },
  ];
  
  for (const model of schema.models) {
    for (const field of model.fields) {
      if (field.isUnique) continue; // Already unique
      
      for (const candidate of uniqueCandidatePatterns) {
        if (candidate.pattern.test(field.name)) {
          suggestions.push({
            model: model.name,
            field: field.name,
            reason: candidate.reason,
          });
          break;
        }
      }
    }
  }
  
  return suggestions;
}

// Find string fields that might be better as enums
function findEnumSuggestions(schema: HygraphSchema): {
  model: string;
  field: string;
  distinctValues: string[];
  suggestion: string;
}[] {
  const suggestions: {
    model: string;
    field: string;
    distinctValues: string[];
    suggestion: string;
  }[] = [];
  
  // Common enum candidate patterns
  const enumCandidatePatterns = [
    /^status$/i,
    /^type$/i,
    /^category$/i,
    /^state$/i,
    /^priority$/i,
    /^visibility$/i,
    /^role$/i,
    /^gender$/i,
    /^size$/i,
    /^color$/i,
    /^layout$/i,
    /^alignment$/i,
    /^position$/i,
    /^theme$/i,
    /^variant$/i,
  ];
  
  for (const model of schema.models) {
    for (const field of model.fields) {
      if (field.type !== 'String') continue;
      if (field.relatedModel) continue; // It's actually a relation
      
      for (const pattern of enumCandidatePatterns) {
        if (pattern.test(field.name)) {
          suggestions.push({
            model: model.name,
            field: field.name,
            distinctValues: [], // Would need content analysis
            suggestion: `Consider converting "${field.name}" to an Enumeration for validation`,
          });
          break;
        }
      }
    }
  }
  
  return suggestions;
}

// Find fields that might need validation
function findMissingValidation(schema: HygraphSchema): {
  model: string;
  field: string;
  suggestion: string;
}[] {
  const suggestions: { model: string; field: string; suggestion: string }[] = [];
  
  const validationPatterns = [
    { pattern: /email/i, suggestion: 'Add email format validation' },
    { pattern: /url/i, suggestion: 'Add URL format validation' },
    { pattern: /phone/i, suggestion: 'Add phone number format validation' },
    { pattern: /zip|postal/i, suggestion: 'Add postal code format validation' },
  ];
  
  for (const model of schema.models) {
    for (const field of model.fields) {
      if (field.type !== 'String') continue;
      
      for (const { pattern, suggestion } of validationPatterns) {
        if (pattern.test(field.name)) {
          suggestions.push({
            model: model.name,
            field: field.name,
            suggestion,
          });
          break;
        }
      }
    }
  }
  
  return suggestions;
}

export function analyzeBestPractices(schema: HygraphSchema): BestPracticesAnalysis {
  return {
    namingConventionIssues: analyzeNaming(schema),
    missingUniqueConstraints: findMissingUniqueConstraints(schema),
    enumSuggestions: findEnumSuggestions(schema),
    missingValidation: findMissingValidation(schema),
  };
}

export function generateBestPracticesIssues(analysis: BestPracticesAnalysis): AuditIssue[] {
  const issues: AuditIssue[] = [];
  
  // Naming convention issues
  if (analysis.namingConventionIssues.length > 0) {
    const snakeCaseIssues = analysis.namingConventionIssues.filter(i => i.issue.includes('snake_case'));
    const otherIssues = analysis.namingConventionIssues.filter(i => !i.issue.includes('snake_case'));
    
    if (snakeCaseIssues.length > 0) {
      issues.push({
        id: 'naming-snake-case',
        severity: snakeCaseIssues.length > 5 ? 'warning' : 'info',
        category: 'best-practices',
        title: 'Inconsistent Naming (snake_case)',
        description: `${snakeCaseIssues.length} field(s) use snake_case instead of camelCase`,
        impact: 'Inconsistent naming reduces code predictability',
        recommendation: 'Rename fields to camelCase for consistency',
        affectedItems: snakeCaseIssues.map(i => i.item),
      });
    }
    
    if (otherIssues.length > 0) {
      issues.push({
        id: 'naming-other',
        severity: 'info',
        category: 'best-practices',
        title: 'Naming Convention Issues',
        description: `${otherIssues.length} item(s) don't follow naming conventions`,
        impact: 'Inconsistent naming makes the schema harder to work with',
        recommendation: 'Follow PascalCase for models, camelCase for fields',
        affectedItems: otherIssues.map(i => i.item),
      });
    }
  }
  
  // Missing unique constraints
  if (analysis.missingUniqueConstraints.length > 0) {
    for (const constraint of analysis.missingUniqueConstraints) {
      issues.push({
        id: `missing-unique-${constraint.model}-${constraint.field}`,
        severity: constraint.field.toLowerCase() === 'slug' ? 'warning' : 'info',
        category: 'best-practices',
        title: 'Missing Unique Constraint',
        description: `"${constraint.model}.${constraint.field}" should likely be unique`,
        impact: constraint.reason,
        recommendation: 'Add unique constraint to prevent duplicates',
        affectedItems: [`${constraint.model}.${constraint.field}`],
      });
    }
  }
  
  // Enum suggestions
  if (analysis.enumSuggestions.length > 0) {
    issues.push({
      id: 'enum-suggestions',
      severity: 'info',
      category: 'best-practices',
      title: 'Potential Enum Fields',
      description: `${analysis.enumSuggestions.length} String field(s) might be better as Enumerations`,
      impact: 'Enums provide validation and better editor experience',
      recommendation: 'Convert status/type fields to Enumerations',
      affectedItems: analysis.enumSuggestions.map(s => `${s.model}.${s.field}`),
    });
  }
  
  // Missing validation
  if (analysis.missingValidation.length > 0) {
    issues.push({
      id: 'missing-validation',
      severity: 'info',
      category: 'best-practices',
      title: 'Missing Field Validation',
      description: `${analysis.missingValidation.length} field(s) could benefit from format validation`,
      impact: 'Without validation, invalid data may be stored',
      recommendation: 'Add regex validation for email, URL, phone fields',
      affectedItems: analysis.missingValidation.map(v => `${v.model}.${v.field}`),
    });
  }
  
  // Good naming (positive)
  if (analysis.namingConventionIssues.length === 0) {
    issues.push({
      id: 'good-naming',
      severity: 'info',
      category: 'best-practices',
      title: 'Consistent Naming Conventions',
      description: 'All models and fields follow naming conventions',
      impact: 'Consistent naming improves developer experience',
      recommendation: 'Maintain this standard for new additions',
      affectedItems: [],
      score: 10,
    });
  }
  
  return issues;
}

export function calculateBestPracticesScore(analysis: BestPracticesAnalysis, issues: AuditIssue[]): number {
  let score = 100;
  
  // Deduct for naming issues
  score -= Math.min(analysis.namingConventionIssues.length * 2, 20);
  
  // Deduct for missing unique constraints
  score -= Math.min(analysis.missingUniqueConstraints.length * 3, 15);
  
  // Extra deduction for missing slug uniqueness
  const missingSlugUnique = analysis.missingUniqueConstraints.filter(c => 
    c.field.toLowerCase() === 'slug'
  );
  score -= missingSlugUnique.length * 5;
  
  // Deduct for enum suggestions (lighter penalty)
  score -= Math.min(analysis.enumSuggestions.length * 1, 10);
  
  // Deduct for missing validation
  score -= Math.min(analysis.missingValidation.length * 1, 10);
  
  // Bonus for clean naming
  if (analysis.namingConventionIssues.length === 0) {
    score += 5;
  }
  
  return Math.max(0, Math.min(100, score));
}





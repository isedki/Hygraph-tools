import type { HygraphSchema, GovernanceAnalysis, AuditIssue, ContentAnalysis } from '../types';

// Detect versioned models (e.g., "Home v1", "Home v2", "HomePageOld")
function detectVersionedModels(schema: HygraphSchema): {
  baseName: string;
  versions: string[];
  recommendation: string;
}[] {
  const versionPatterns = [
    /^(.+?)[\s_-]?v(\d+)$/i,           // "Home v1", "home_v2"
    /^(.+?)[\s_-]?(\d+)$/,              // "Home1", "Home2"
    /^(.+?)[\s_-]?(old|new|legacy|backup|copy|test)$/i,  // "HomeOld", "home_legacy"
    /^(old|new|legacy|backup)[\s_-]?(.+)$/i,             // "OldHome", "legacy_home"
  ];
  
  const modelGroups = new Map<string, string[]>();
  
  for (const model of schema.models) {
    for (const pattern of versionPatterns) {
      const match = model.name.match(pattern);
      if (match) {
        const baseName = match[1].toLowerCase().replace(/[\s_-]+$/, '');
        if (!modelGroups.has(baseName)) {
          modelGroups.set(baseName, []);
        }
        modelGroups.get(baseName)!.push(model.name);
        break;
      }
    }
  }
  
  // Also check for models with very similar names
  const modelNames = schema.models.map(m => m.name);
  for (const name of modelNames) {
    const baseName = name.replace(/[\s_-]*(page|model|content|type)$/i, '').toLowerCase();
    const similar = modelNames.filter(n => 
      n !== name && 
      n.toLowerCase().replace(/[\s_-]*(page|model|content|type)$/i, '').toLowerCase() === baseName
    );
    if (similar.length > 0) {
      if (!modelGroups.has(baseName)) {
        modelGroups.set(baseName, [name, ...similar]);
      }
    }
  }
  
  return Array.from(modelGroups.entries())
    .filter(([, versions]) => versions.length > 1)
    .map(([baseName, versions]) => ({
      baseName,
      versions: [...new Set(versions)],
      recommendation: `Merge or deprecate duplicate models. Consider migrating to a single "${baseName}" model with versioning handled via content stages.`,
    }));
}

// Detect one-off numbered fields (e.g., section1Title, section2Title)
function detectOneOffFields(schema: HygraphSchema): {
  model: string;
  totalFields: number;
  oneOffFields: string[];
  repeatingPatterns: string[];
}[] {
  const numberedFieldPattern = /^(.+?)(\d+)(.*)$/;
  
  return schema.models.map(model => {
    const oneOffFields: string[] = [];
    const patternGroups = new Map<string, string[]>();
    
    for (const field of model.fields) {
      const match = field.name.match(numberedFieldPattern);
      if (match) {
        const pattern = `${match[1]}N${match[3]}`;
        if (!patternGroups.has(pattern)) {
          patternGroups.set(pattern, []);
        }
        patternGroups.get(pattern)!.push(field.name);
      }
    }
    
    // Fields that appear in numbered sequences are "one-off"
    for (const [pattern, fields] of patternGroups) {
      if (fields.length >= 2) {
        oneOffFields.push(...fields);
      }
    }
    
    const repeatingPatterns = Array.from(patternGroups.entries())
      .filter(([, fields]) => fields.length >= 2)
      .map(([pattern, fields]) => `${pattern} (${fields.length} instances)`);
    
    return {
      model: model.name,
      totalFields: model.fields.length,
      oneOffFields,
      repeatingPatterns,
    };
  }).filter(m => m.oneOffFields.length > 0 || m.totalFields > 20);
}

// Detect models that could be consolidated (similar structure)
function detectDuplicatePatterns(schema: HygraphSchema): {
  models: string[];
  sharedFields: string[];
  recommendation: string;
}[] {
  const duplicates: { models: string[]; sharedFields: string[]; recommendation: string }[] = [];
  const modelFieldSets = schema.models.map(m => ({
    name: m.name,
    fields: new Set(m.fields.map(f => f.name.toLowerCase())),
    fieldList: m.fields.map(f => f.name),
  }));
  
  // Compare each pair of models
  for (let i = 0; i < modelFieldSets.length; i++) {
    for (let j = i + 1; j < modelFieldSets.length; j++) {
      const a = modelFieldSets[i];
      const b = modelFieldSets[j];
      
      // Find shared fields
      const shared = [...a.fields].filter(f => b.fields.has(f));
      const similarity = shared.length / Math.max(a.fields.size, b.fields.size);
      
      // If >60% similar, they might be duplicates
      if (similarity > 0.6 && shared.length >= 4) {
        duplicates.push({
          models: [a.name, b.name],
          sharedFields: shared,
          recommendation: `Consider consolidating "${a.name}" and "${b.name}" into a single flexible content type with a "type" field to distinguish them.`,
        });
      }
    }
  }
  
  return duplicates;
}

// Detect monolithic models (too many fields, deeply nested)
function detectMonolithicModels(schema: HygraphSchema): string[] {
  return schema.models
    .filter(m => {
      const fieldCount = m.fields.length;
      const relationCount = m.fields.filter(f => f.relatedModel).length;
      // Monolithic if: >30 fields OR >10 relations OR high ratio of relations
      return fieldCount > 30 || relationCount > 10 || (relationCount > 5 && relationCount / fieldCount > 0.5);
    })
    .map(m => m.name);
}

// Analyze template flexibility
function analyzeTemplateFlexibility(schema: HygraphSchema): {
  rigidModels: string[];
  flexibleModels: string[];
  score: number;
} {
  const rigidModels: string[] = [];
  const flexibleModels: string[] = [];
  
  for (const model of schema.models) {
    const hasComponents = model.fields.some(f => 
      f.relatedModel && schema.components.some(c => c.name === f.relatedModel)
    );
    const hasListRelations = model.fields.some(f => f.isList && f.relatedModel);
    const hasRichText = model.fields.some(f => f.type === 'RichText' || f.name.toLowerCase().includes('content'));
    
    // Flexible if has components, list relations, or rich text
    if (hasComponents || hasListRelations || hasRichText) {
      flexibleModels.push(model.name);
    } else {
      rigidModels.push(model.name);
    }
  }
  
  const total = schema.models.length;
  const score = total > 0 ? Math.round((flexibleModels.length / total) * 100) : 100;
  
  return { rigidModels, flexibleModels, score };
}

// Analyze localization setup
function analyzeLocalization(schema: HygraphSchema): {
  hasLocalization: boolean;
  localizedModels: string[];
  localeCount: number;
  inconsistentLocalization: string[];
} {
  // Check for locale-related patterns in field names or model structure
  const localePatterns = [/locale/i, /language/i, /lang/i, /i18n/i, /translation/i];
  const localizedModels: string[] = [];
  const inconsistent: string[] = [];
  
  // Check if any model has localization fields
  for (const model of schema.models) {
    const hasLocaleField = model.fields.some(f => 
      localePatterns.some(p => p.test(f.name))
    );
    
    // Check for typical localized field patterns (e.g., title_en, title_de)
    const hasLocalizedFields = model.fields.some(f => 
      /_[a-z]{2}$/i.test(f.name) || /[A-Z]{2}$/.test(f.name)
    );
    
    if (hasLocaleField || hasLocalizedFields) {
      localizedModels.push(model.name);
    }
  }
  
  // Estimate locale count from field patterns
  const localeFieldSuffixes = new Set<string>();
  for (const model of schema.models) {
    for (const field of model.fields) {
      const match = field.name.match(/_([a-z]{2})$/i);
      if (match) {
        localeFieldSuffixes.add(match[1].toLowerCase());
      }
    }
  }
  
  // Check for inconsistent localization (some models have it, others don't)
  if (localizedModels.length > 0 && localizedModels.length < schema.models.length * 0.5) {
    const contentModels = schema.models.filter(m => 
      !m.name.toLowerCase().includes('setting') &&
      !m.name.toLowerCase().includes('config')
    );
    
    for (const model of contentModels) {
      if (!localizedModels.includes(model.name)) {
        inconsistent.push(model.name);
      }
    }
  }
  
  return {
    hasLocalization: localizedModels.length > 0,
    localizedModels,
    localeCount: Math.max(localeFieldSuffixes.size, localizedModels.length > 0 ? 1 : 0),
    inconsistentLocalization: inconsistent.slice(0, 10),
  };
}

// Analyze editor experience
function analyzeEditorExperience(schema: HygraphSchema): {
  complexModels: string[];
  wellOrganizedModels: string[];
  modelsNeedingHelpText: string[];
  score: number;
} {
  const complexModels: string[] = [];
  const wellOrganizedModels: string[] = [];
  const modelsNeedingHelpText: string[] = [];
  
  for (const model of schema.models) {
    const fieldCount = model.fields.length;
    const hasDescriptions = model.fields.some(f => f.description);
    const hasLogicalGrouping = model.fields.some(f => 
      f.relatedModel && schema.components.some(c => c.name === f.relatedModel)
    );
    
    // Complex if many fields without organization
    if (fieldCount > 15 && !hasLogicalGrouping) {
      complexModels.push(model.name);
    }
    
    // Well organized if has grouping or reasonable field count
    if (fieldCount <= 10 || hasLogicalGrouping) {
      wellOrganizedModels.push(model.name);
    }
    
    // Needs help text if many fields without descriptions
    if (fieldCount > 5 && !hasDescriptions) {
      modelsNeedingHelpText.push(model.name);
    }
  }
  
  const total = schema.models.length;
  const score = total > 0 
    ? Math.round(((wellOrganizedModels.length - complexModels.length * 0.5) / total) * 100)
    : 100;
  
  return {
    complexModels,
    wellOrganizedModels,
    modelsNeedingHelpText,
    score: Math.max(0, Math.min(100, score)),
  };
}

export function analyzeGovernance(
  schema: HygraphSchema,
  contentAnalysis: ContentAnalysis
): GovernanceAnalysis {
  const versionedModels = detectVersionedModels(schema);
  const fieldCountAnalysis = detectOneOffFields(schema);
  const duplicatePatterns = detectDuplicatePatterns(schema);
  const monolithicModels = detectMonolithicModels(schema);
  const templateFlexibility = analyzeTemplateFlexibility(schema);
  const localizationAnalysis = analyzeLocalization(schema);
  const editorExperience = analyzeEditorExperience(schema);
  
  return {
    pageVsContentType: {
      duplicatePatterns,
      monolithicModels,
    },
    fieldCountAnalysis,
    versionedModels,
    templateFlexibility,
    localizationAnalysis,
    stageUsage: {
      usingStages: true, // Hygraph always has stages
      draftCount: Object.values(contentAnalysis.modelEntryCounts).reduce((sum, c) => sum + c.draft, 0),
      publishedCount: Object.values(contentAnalysis.modelEntryCounts).reduce((sum, c) => sum + c.published, 0),
      stageRatio: contentAnalysis.draftRatio,
    },
    editorExperience,
  };
}

export function generateGovernanceIssues(analysis: GovernanceAnalysis): AuditIssue[] {
  const issues: AuditIssue[] = [];
  
  // Page vs Content Type - Duplicate patterns
  for (const pattern of analysis.pageVsContentType.duplicatePatterns) {
    issues.push({
      id: `duplicate-pattern-${pattern.models.join('-')}`,
      severity: 'warning',
      category: 'governance',
      title: 'Similar Models Could Be Consolidated',
      description: `Models "${pattern.models.join('" and "')}" share ${pattern.sharedFields.length} fields (${pattern.sharedFields.slice(0, 5).join(', ')}${pattern.sharedFields.length > 5 ? '...' : ''})`,
      impact: 'Duplicate models increase maintenance burden and risk data inconsistency',
      recommendation: pattern.recommendation,
      affectedItems: pattern.models,
    });
  }
  
  // Monolithic models
  for (const model of analysis.pageVsContentType.monolithicModels) {
    issues.push({
      id: `monolithic-${model}`,
      severity: 'warning',
      category: 'governance',
      title: 'Monolithic Model Structure',
      description: `Model "${model}" has a large, complex structure that could be simplified`,
      impact: 'Large models are harder to maintain, query, and edit',
      recommendation: 'Break down into smaller, linked models or use components for repeatable sections',
      affectedItems: [model],
    });
  }
  
  // One-off numbered fields
  for (const modelAnalysis of analysis.fieldCountAnalysis) {
    if (modelAnalysis.oneOffFields.length >= 4) {
      issues.push({
        id: `oneoff-fields-${modelAnalysis.model}`,
        severity: 'warning',
        category: 'governance',
        title: 'Numbered One-Off Fields Detected',
        description: `"${modelAnalysis.model}" has ${modelAnalysis.oneOffFields.length} numbered fields (${modelAnalysis.repeatingPatterns.join(', ')})`,
        impact: 'Numbered fields (section1, section2, etc.) indicate rigid structure that\'s hard to extend',
        recommendation: 'Replace with a repeatable "sections" or "blocks" component that editors can add/remove',
        affectedItems: modelAnalysis.oneOffFields.slice(0, 10),
      });
    }
  }
  
  // Versioned models
  for (const versioned of analysis.versionedModels) {
    issues.push({
      id: `versioned-${versioned.baseName}`,
      severity: 'warning',
      category: 'governance',
      title: 'Duplicate/Versioned Models',
      description: `Found ${versioned.versions.length} versions of "${versioned.baseName}": ${versioned.versions.join(', ')}`,
      impact: 'Multiple versions of the same model create confusion and duplicate data',
      recommendation: versioned.recommendation,
      affectedItems: versioned.versions,
    });
  }
  
  // Template flexibility
  if (analysis.templateFlexibility.score < 50) {
    issues.push({
      id: 'low-template-flexibility',
      severity: 'info',
      category: 'governance',
      title: 'Limited Template Flexibility',
      description: `Only ${analysis.templateFlexibility.score}% of models have flexible structure (components, list relations, or rich text)`,
      impact: 'Rigid models lock editors into fixed layouts, reducing content reusability',
      recommendation: 'Add flexible components or repeatable blocks to content models',
      affectedItems: analysis.templateFlexibility.rigidModels.slice(0, 5),
    });
  }
  
  // Localization inconsistency
  if (analysis.localizationAnalysis.hasLocalization && analysis.localizationAnalysis.inconsistentLocalization.length > 0) {
    issues.push({
      id: 'inconsistent-localization',
      severity: 'warning',
      category: 'governance',
      title: 'Inconsistent Localization',
      description: `${analysis.localizationAnalysis.inconsistentLocalization.length} content models lack localization while others have it`,
      impact: 'Incomplete localization leads to missing translations and inconsistent multi-language support',
      recommendation: 'Apply localization consistently across all content models that need translation',
      affectedItems: analysis.localizationAnalysis.inconsistentLocalization,
    });
  }
  
  // Stage usage (high draft ratio)
  if (analysis.stageUsage.stageRatio > 60) {
    issues.push({
      id: 'high-draft-ratio-workflow',
      severity: 'info',
      category: 'governance',
      title: 'Review Publishing Workflow',
      description: `${analysis.stageUsage.stageRatio.toFixed(0)}% of content is in draft stage`,
      impact: 'High draft ratio may indicate workflow bottlenecks or lack of editorial process',
      recommendation: 'Review editorial workflow and ensure clear publishing guidelines for editors',
      affectedItems: [],
    });
  }
  
  // Editor experience - complex models
  for (const model of analysis.editorExperience.complexModels.slice(0, 5)) {
    issues.push({
      id: `complex-editor-${model}`,
      severity: 'info',
      category: 'governance',
      title: 'Complex Editor Experience',
      description: `Model "${model}" may be overwhelming for editors`,
      impact: 'Complex models slow down content creation and increase errors',
      recommendation: 'Group fields logically using components, add help text, and consider splitting the model',
      affectedItems: [model],
    });
  }
  
  // Models needing help text
  if (analysis.editorExperience.modelsNeedingHelpText.length > 3) {
    issues.push({
      id: 'missing-help-text',
      severity: 'info',
      category: 'governance',
      title: 'Missing Field Descriptions',
      description: `${analysis.editorExperience.modelsNeedingHelpText.length} models lack field descriptions/help text`,
      impact: 'Editors may not understand how to use fields correctly without guidance',
      recommendation: 'Add helpful descriptions to fields, especially for non-obvious fields',
      affectedItems: analysis.editorExperience.modelsNeedingHelpText.slice(0, 10),
    });
  }
  
  // Good practices (positive)
  if (analysis.templateFlexibility.score >= 70) {
    issues.push({
      id: 'good-flexibility',
      severity: 'info',
      category: 'governance',
      title: 'Good Template Flexibility',
      description: `${analysis.templateFlexibility.score}% of models use flexible structure`,
      impact: 'Flexible models enable editors to create varied content without developer help',
      recommendation: 'Continue this pattern for new models',
      affectedItems: analysis.templateFlexibility.flexibleModels.slice(0, 5),
      score: 5,
    });
  }
  
  if (analysis.localizationAnalysis.hasLocalization && analysis.localizationAnalysis.inconsistentLocalization.length === 0) {
    issues.push({
      id: 'good-localization',
      severity: 'info',
      category: 'governance',
      title: 'Consistent Localization Setup',
      description: `Localization is consistently applied across ${analysis.localizationAnalysis.localizedModels.length} models`,
      impact: 'Consistent localization enables smooth multi-language content management',
      recommendation: 'Maintain this consistency for new models',
      affectedItems: [],
      score: 5,
    });
  }
  
  return issues;
}

export function calculateGovernanceScore(analysis: GovernanceAnalysis, issues: AuditIssue[]): number {
  let score = 100;
  
  // Deduct for duplicate patterns
  score -= analysis.pageVsContentType.duplicatePatterns.length * 8;
  
  // Deduct for monolithic models
  score -= analysis.pageVsContentType.monolithicModels.length * 5;
  
  // Deduct for one-off fields
  const modelsWithOneOff = analysis.fieldCountAnalysis.filter(m => m.oneOffFields.length >= 4);
  score -= modelsWithOneOff.length * 7;
  
  // Deduct for versioned models
  score -= analysis.versionedModels.length * 10;
  
  // Deduct for low template flexibility
  if (analysis.templateFlexibility.score < 50) {
    score -= 15;
  } else if (analysis.templateFlexibility.score < 70) {
    score -= 5;
  }
  
  // Deduct for inconsistent localization
  if (analysis.localizationAnalysis.inconsistentLocalization.length > 0) {
    score -= Math.min(analysis.localizationAnalysis.inconsistentLocalization.length * 2, 10);
  }
  
  // Deduct for poor editor experience
  score -= Math.min(analysis.editorExperience.complexModels.length * 3, 15);
  
  // Bonus for good practices
  if (analysis.templateFlexibility.score >= 70) score += 5;
  if (analysis.localizationAnalysis.hasLocalization && analysis.localizationAnalysis.inconsistentLocalization.length === 0) score += 5;
  if (analysis.editorExperience.modelsNeedingHelpText.length === 0) score += 5;
  
  return Math.max(0, Math.min(100, score));
}





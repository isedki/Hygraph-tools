import type { 
  HygraphSchema, 
  ModelDeepDive, 
  ModelDeepDiveAnalysis,
  ModelFieldRecommendation,
  Priority 
} from '../types';

/**
 * Performs deep analysis on specific models to provide targeted recommendations.
 * Mimics a senior content strategist reviewing each important model.
 */
export function analyzeModelsInDepth(
  schema: HygraphSchema,
  entryCounts: Record<string, { draft: number; published: number }>
): ModelDeepDiveAnalysis {
  const criticalModels: ModelDeepDive[] = [];
  const supportingModels: ModelDeepDive[] = [];
  const configModels: ModelDeepDive[] = [];

  // Categorize models by importance
  for (const model of schema.models) {
    if (model.isSystem) continue;
    
    const entryCount = (entryCounts[model.pluralApiId]?.draft || 0) + 
                       (entryCounts[model.pluralApiId]?.published || 0);
    
    const deepDive = analyzeModel(model, schema, entryCount);
    
    if (deepDive.importance === 'critical') {
      criticalModels.push(deepDive);
    } else if (deepDive.importance === 'supporting') {
      supportingModels.push(deepDive);
    } else {
      configModels.push(deepDive);
    }
  }

  // Sort by entry count and field count
  criticalModels.sort((a, b) => b.entryCount - a.entryCount);
  supportingModels.sort((a, b) => b.entryCount - a.entryCount);

  return {
    criticalModels: criticalModels.slice(0, 5), // Top 5 critical models
    supportingModels: supportingModels.slice(0, 5),
    configModels: configModels.slice(0, 3),
  };
}

function analyzeModel(
  model: HygraphSchema['models'][0],
  schema: HygraphSchema,
  entryCount: number
): ModelDeepDive {
  const strengths: string[] = [];
  const recommendations: ModelFieldRecommendation[] = [];
  const requiredFieldsSuggestions: string[] = [];
  const validationSuggestions: { field: string; validation: string }[] = [];
  const relationshipNotes: string[] = [];

  // Determine model purpose and importance
  const { purpose, importance } = determineModelPurpose(model, entryCount, schema);

  // ============================================
  // Analyze Model Strengths
  // ============================================
  
  // Good content structure indicators
  if (model.fields.some(f => f.name === 'title' || f.name === 'name')) {
    strengths.push('Has clear title/name field for content identification');
  }
  
  if (model.fields.some(f => f.name === 'slug' && f.isUnique)) {
    strengths.push('Slug field with unique constraint for URL routing');
  }
  
  const relationCount = model.fields.filter(f => f.relatedModel).length;
  if (relationCount > 0 && relationCount <= 5) {
    strengths.push(`Well-connected with ${relationCount} relationships`);
  }
  
  if (model.fields.some(f => /seo|meta/i.test(f.name) || /seo/i.test(f.type))) {
    strengths.push('Includes SEO/meta fields');
  }
  
  const requiredFields = model.fields.filter(f => f.isRequired);
  if (requiredFields.length > 0 && requiredFields.length <= model.fields.length * 0.4) {
    strengths.push(`Good required field ratio (${requiredFields.length}/${model.fields.length})`);
  }

  // ============================================
  // Required Field Suggestions
  // ============================================
  
  // Common fields that should typically be required
  const shouldBeRequired = ['title', 'name', 'slug'];
  for (const fieldName of shouldBeRequired) {
    const field = model.fields.find(f => f.name === fieldName);
    if (field && !field.isRequired) {
      requiredFieldsSuggestions.push(fieldName);
      recommendations.push({
        field: fieldName,
        currentState: 'Optional',
        recommendation: `Mark "${fieldName}" as required to ensure content completeness`,
        priority: 'high',
      });
    }
  }

  // Content field should be required for article-like models
  if (isContentModel(model)) {
    const contentField = model.fields.find(f => 
      f.name === 'content' || f.name === 'body' || /richtext/i.test(f.type)
    );
    if (contentField && !contentField.isRequired) {
      requiredFieldsSuggestions.push(contentField.name);
    }
  }

  // ============================================
  // Validation Suggestions
  // ============================================
  
  // Slug validation
  const slugField = model.fields.find(f => f.name === 'slug');
  if (slugField) {
    if (!slugField.isUnique) {
      validationSuggestions.push({
        field: 'slug',
        validation: 'Add unique constraint to prevent URL conflicts',
      });
      recommendations.push({
        field: 'slug',
        currentState: 'No unique constraint',
        recommendation: 'Add unique constraint to prevent URL conflicts',
        priority: 'high',
      });
    }
    validationSuggestions.push({
      field: 'slug',
      validation: 'Pattern: ^[a-z0-9]+(?:-[a-z0-9]+)*$ for URL-safe format',
    });
  }

  // URL field validation
  const urlFields = model.fields.filter(f => 
    /url|link|href/i.test(f.name) && f.type === 'String'
  );
  for (const field of urlFields) {
    validationSuggestions.push({
      field: field.name,
      validation: 'Add URL pattern validation for proper format',
    });
  }

  // Email field validation
  const emailFields = model.fields.filter(f => 
    /email/i.test(f.name) && f.type === 'String'
  );
  for (const field of emailFields) {
    validationSuggestions.push({
      field: field.name,
      validation: 'Add email pattern validation',
    });
  }

  // SEO field character limits
  const metaTitleField = model.fields.find(f => /metatitle|seotitle/i.test(f.name));
  const metaDescField = model.fields.find(f => /metadesc|seodesc/i.test(f.name));
  
  if (metaTitleField) {
    validationSuggestions.push({
      field: metaTitleField.name,
      validation: 'Character limit: 50-60 characters for SEO',
    });
  }
  if (metaDescField) {
    validationSuggestions.push({
      field: metaDescField.name,
      validation: 'Character limit: 150-160 characters for SEO',
    });
  }

  // Excerpt/summary character limits
  const excerptField = model.fields.find(f => /excerpt|summary|description/i.test(f.name));
  if (excerptField && excerptField.type === 'String') {
    validationSuggestions.push({
      field: excerptField.name,
      validation: 'Consider character limit (e.g., 200 chars) for UI consistency',
    });
  }

  // ============================================
  // Deprecated/Migration Fields
  // ============================================
  const deprecatedFields = model.fields.filter(f => 
    f.description?.toLowerCase().includes('deprecated') ||
    /^(old|legacy|migrated|temp)/i.test(f.name) ||
    /migratedpostid|migratedsiteid|migratedurl/i.test(f.name)
  );
  
  if (deprecatedFields.length > 0) {
    recommendations.push({
      field: deprecatedFields.map(f => f.name).join(', '),
      currentState: 'Deprecated/migration fields present',
      recommendation: 'Review and remove migration-specific fields once migration is verified complete',
      priority: 'medium',
    });
  }

  // ============================================
  // Relationship Analysis
  // ============================================
  const manyToManyRels = model.fields.filter(f => f.relatedModel && f.isList);
  const oneToManyRels = model.fields.filter(f => f.relatedModel && !f.isList);
  
  if (manyToManyRels.length > 0) {
    for (const rel of manyToManyRels) {
      relationshipNotes.push(
        `${rel.name} → ${rel.relatedModel} (many-to-many): Verify if multiple selections are needed`
      );
    }
  }

  if (relationCount > 5) {
    relationshipNotes.push(
      `High relation count (${relationCount}): Consider if all relations are necessary`
    );
  }

  // ============================================
  // Field-Specific Recommendations
  // ============================================
  
  // Image field that should be single but is many
  const featureImageField = model.fields.find(f => 
    /featureimage|featuredimage|thumbnail|cover/i.test(f.name) && f.isList
  );
  if (featureImageField) {
    recommendations.push({
      field: featureImageField.name,
      currentState: 'Allows multiple values',
      recommendation: 'Consider changing to single value if only one image is ever used',
      priority: 'low',
    });
  }

  // Missing description
  if (!model.fields.some(f => f.description && f.description.length > 10)) {
    recommendations.push({
      field: '(model fields)',
      currentState: 'Missing field descriptions',
      recommendation: 'Add descriptions to fields explaining purpose, format requirements, and usage context',
      priority: 'medium',
    });
  }

  return {
    modelName: model.name,
    purpose,
    importance,
    entryCount,
    fieldCount: model.fields.length,
    strengths,
    recommendations,
    requiredFieldsSuggestions,
    validationSuggestions,
    relationshipNotes,
  };
}

function determineModelPurpose(
  model: HygraphSchema['models'][0],
  entryCount: number,
  schema: HygraphSchema
): { purpose: string; importance: ModelDeepDive['importance'] } {
  const name = model.name.toLowerCase();
  const fields = model.fields;

  // Page/Article models - critical
  if (/^(page|article|post|blog|news|story)s?$/i.test(name)) {
    return {
      purpose: 'Primary content type for website pages/articles',
      importance: 'critical',
    };
  }

  // Product models - critical for e-commerce
  if (/^(product|item|merchandise|sku)s?$/i.test(name)) {
    return {
      purpose: 'Product catalog content',
      importance: 'critical',
    };
  }

  // Forms - critical for lead generation
  if (/^form$/i.test(name)) {
    return {
      purpose: 'Form definitions for lead capture and user interaction',
      importance: 'critical',
    };
  }

  // Taxonomy models
  if (/^(category|topic|tag|taxonomy|type)s?$/i.test(name)) {
    return {
      purpose: 'Content classification and organization',
      importance: 'supporting',
    };
  }

  // Author/Person models
  if (/^(author|person|team|member|staff|contributor)s?$/i.test(name)) {
    return {
      purpose: 'People/author information',
      importance: 'supporting',
    };
  }

  // Site/Brand models
  if (/^(site|brand|shop|store|tenant)s?$/i.test(name)) {
    return {
      purpose: 'Multi-site/multi-brand configuration',
      importance: 'supporting',
    };
  }

  // Config/Settings models
  if (/^(seo|setting|config|navigation|menu|footer|header|global)s?$/i.test(name)) {
    return {
      purpose: 'Site configuration and global settings',
      importance: 'supporting',
    };
  }

  // Landing page / Marketing
  if (/^(landing|campaign|promo|marketing|hero)s?$/i.test(name)) {
    return {
      purpose: 'Marketing and landing page content',
      importance: 'critical',
    };
  }

  // Events
  if (/^(event|session|webinar|conference)s?$/i.test(name)) {
    return {
      purpose: 'Event management content',
      importance: 'critical',
    };
  }

  // Based on entry count and relations
  const isReferenced = countReferences(model.name, schema) >= 2;
  
  if (entryCount > 50 || isReferenced) {
    return {
      purpose: inferPurposeFromFields(fields),
      importance: 'critical',
    };
  }

  if (entryCount > 10) {
    return {
      purpose: inferPurposeFromFields(fields),
      importance: 'supporting',
    };
  }

  return {
    purpose: inferPurposeFromFields(fields),
    importance: 'supporting',
  };
}

function inferPurposeFromFields(fields: HygraphSchema['models'][0]['fields']): string {
  const hasTitle = fields.some(f => f.name === 'title' || f.name === 'name');
  const hasSlug = fields.some(f => f.name === 'slug');
  const hasContent = fields.some(f => 
    f.name === 'content' || f.name === 'body' || /richtext/i.test(f.type)
  );
  const hasImage = fields.some(f => /image|asset|media/i.test(f.type));

  if (hasTitle && hasSlug && hasContent) {
    return 'Page or article content type';
  }
  if (hasTitle && hasImage) {
    return 'Visual content or media-focused type';
  }
  if (hasTitle && hasSlug) {
    return 'Structured content with URL support';
  }
  if (hasTitle) {
    return 'Named content entity';
  }
  
  return 'Supporting content type';
}

function countReferences(modelName: string, schema: HygraphSchema): number {
  let count = 0;
  for (const model of schema.models) {
    if (model.fields.some(f => f.relatedModel === modelName)) {
      count++;
    }
  }
  return count;
}

function isContentModel(model: HygraphSchema['models'][0]): boolean {
  return /^(article|post|blog|news|page|story|content)s?$/i.test(model.name) ||
    model.fields.some(f => f.name === 'content' || f.name === 'body');
}



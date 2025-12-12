import type { HygraphSchema, HygraphModel, AuditIssue } from '../types';

// Architecture Types
export type ArchitectureType = 
  | 'ecommerce'
  | 'marketing-site'
  | 'multi-brand'
  | 'multi-tenant'
  | 'multi-region'
  | 'blog-publication'
  | 'saas-docs'
  | 'portfolio-showcase'
  | 'event-platform'
  | 'mixed-unknown';

export interface ArchitectureSignal {
  type: ArchitectureType;
  confidence: number; // 0-1
  signals: string[];
}

export interface ContentStrategyAnalysis {
  // Detected architecture
  detectedArchitecture: {
    primary: ArchitectureType;
    confidence: number;
    signals: string[];
    allDetected: ArchitectureSignal[];
  };
  
  // Architecture fit assessment
  architectureFit: {
    score: number;
    strengths: string[];
    issues: { issue: string; recommendation: string; priority: 'high' | 'medium' | 'low' }[];
  };
  
  // Model usage analysis (FIXED - based on actual references)
  modelUsage: {
    activeModels: { name: string; usage: string; entryCount: number }[];
    underutilizedModels: { name: string; reason: string; suggestion: string }[];
    overloadedModels: { name: string; fieldCount: number; suggestion: string }[];
    duplicateModels: { models: string[]; sharedFields: string[]; recommendation: string }[];
  };
  
  // Component strategy
  componentStrategy: {
    wellDesigned: string[];
    missingComponents: { description: string; affectedModels: string[]; recommendation: string }[];
    overEngineered: { name: string; reason: string; suggestion: string }[];
    componentReuseRate: number;
  };
  
  // Editorial experience assessment
  editorialExperience: {
    score: number;
    editorFriendlyModels: string[];
    complexModels: { name: string; issues: string[]; simplification: string }[];
    contentDiscoverability: 'excellent' | 'good' | 'needs-work' | 'poor';
    recommendations: string[];
  };
  
  // Deep nesting analysis
  deepNesting: {
    problematicPaths: { path: string[]; depth: number; issue: string; solution: string }[];
    recommendedFlattening: { current: string; proposed: string; benefit: string }[];
  };
  
  // Content duplication patterns
  duplicationPatterns: {
    fieldDuplication: { fields: string[]; foundIn: string[]; recommendation: string }[];
    modelDuplication: { models: string[]; sharedFields: string[]; recommendation: string }[];
    enumDuplication: { enums: string[]; recommendation: string }[];
  };
}

// Architecture detection patterns
const ARCHITECTURE_PATTERNS: Record<ArchitectureType, { 
  modelPatterns: RegExp[];
  fieldPatterns: RegExp[];
  enumPatterns: RegExp[];
  weight: number;
}> = {
  'ecommerce': {
    modelPatterns: [/product/i, /cart/i, /order/i, /checkout/i, /catalog/i, /inventory/i, /shipping/i, /payment/i, /customer/i, /review/i, /wishlist/i, /price/i, /discount/i, /coupon/i, /sku/i],
    fieldPatterns: [/price/i, /sku/i, /quantity/i, /stock/i, /currency/i, /tax/i, /discount/i, /shipping/i],
    enumPatterns: [/currency/i, /orderStatus/i, /paymentMethod/i, /shippingMethod/i],
    weight: 1.2,
  },
  'marketing-site': {
    modelPatterns: [/page/i, /landing/i, /hero/i, /banner/i, /cta/i, /testimonial/i, /feature/i, /pricing/i, /faq/i, /contact/i, /newsletter/i, /campaign/i],
    fieldPatterns: [/headline/i, /cta/i, /buttonText/i, /backgroundImage/i, /subtitle/i],
    enumPatterns: [/pageType/i, /ctaStyle/i, /theme/i],
    weight: 1.0,
  },
  'multi-brand': {
    modelPatterns: [/brand/i, /partner/i, /vendor/i, /supplier/i, /merchant/i],
    fieldPatterns: [/brandId/i, /brandName/i, /brandLogo/i, /brandColor/i],
    enumPatterns: [/brand/i, /brands/i],
    weight: 1.3,
  },
  'multi-tenant': {
    modelPatterns: [/tenant/i, /organization/i, /workspace/i, /company/i, /account/i, /client/i],
    fieldPatterns: [/tenantId/i, /organizationId/i, /workspaceId/i, /clientId/i],
    enumPatterns: [/tenant/i, /client/i],
    weight: 1.3,
  },
  'multi-region': {
    modelPatterns: [/region/i, /country/i, /market/i, /territory/i, /locale/i, /site/i],
    fieldPatterns: [/region/i, /country/i, /market/i, /locale/i, /language/i, /timezone/i],
    enumPatterns: [/region/i, /country/i, /market/i, /locale/i, /language/i],
    weight: 1.2,
  },
  'blog-publication': {
    modelPatterns: [/post/i, /article/i, /author/i, /category/i, /tag/i, /comment/i, /blog/i, /publication/i, /editorial/i, /news/i, /story/i],
    fieldPatterns: [/excerpt/i, /body/i, /author/i, /publishedAt/i, /readTime/i, /featured/i],
    enumPatterns: [/postStatus/i, /category/i],
    weight: 1.0,
  },
  'saas-docs': {
    modelPatterns: [/doc/i, /documentation/i, /guide/i, /tutorial/i, /api/i, /reference/i, /changelog/i, /version/i, /release/i],
    fieldPatterns: [/version/i, /deprecated/i, /apiEndpoint/i, /codeExample/i],
    enumPatterns: [/docType/i, /version/i],
    weight: 1.0,
  },
  'portfolio-showcase': {
    modelPatterns: [/project/i, /portfolio/i, /case.*study/i, /work/i, /client/i, /gallery/i, /showcase/i],
    fieldPatterns: [/projectImage/i, /clientName/i, /deliverables/i, /outcome/i],
    enumPatterns: [/projectType/i, /industry/i],
    weight: 1.0,
  },
  'event-platform': {
    modelPatterns: [/event/i, /conference/i, /session/i, /speaker/i, /venue/i, /schedule/i, /ticket/i, /registration/i, /attendee/i, /webinar/i],
    fieldPatterns: [/startDate/i, /endDate/i, /venue/i, /capacity/i, /registrationUrl/i],
    enumPatterns: [/eventType/i, /ticketType/i, /eventStatus/i],
    weight: 1.1,
  },
  'mixed-unknown': {
    modelPatterns: [],
    fieldPatterns: [],
    enumPatterns: [],
    weight: 0.5,
  },
};

// Detect architecture type from schema
function detectArchitectureType(schema: HygraphSchema): ArchitectureSignal[] {
  const signals: ArchitectureSignal[] = [];
  
  for (const [archType, patterns] of Object.entries(ARCHITECTURE_PATTERNS)) {
    if (archType === 'mixed-unknown') continue;
    
    const detectedSignals: string[] = [];
    let matchCount = 0;
    
    // Check model names
    for (const model of schema.models) {
      for (const pattern of patterns.modelPatterns) {
        if (pattern.test(model.name)) {
          detectedSignals.push(`Model "${model.name}" matches ${archType} pattern`);
          matchCount += 2; // Models are weighted higher
        }
      }
      
      // Check field names
      for (const field of model.fields) {
        for (const pattern of patterns.fieldPatterns) {
          if (pattern.test(field.name)) {
            if (detectedSignals.length < 10) { // Limit signals
              detectedSignals.push(`Field "${model.name}.${field.name}" matches ${archType} pattern`);
            }
            matchCount += 1;
          }
        }
      }
    }
    
    // Check enums
    for (const enumType of schema.enums) {
      for (const pattern of patterns.enumPatterns) {
        if (pattern.test(enumType.name)) {
          detectedSignals.push(`Enum "${enumType.name}" matches ${archType} pattern`);
          matchCount += 1.5;
        }
      }
    }
    
    if (matchCount > 0) {
      // Calculate confidence based on match density
      const totalItems = schema.models.length + schema.enums.length;
      const confidence = Math.min(1, (matchCount / totalItems) * patterns.weight);
      
      signals.push({
        type: archType as ArchitectureType,
        confidence,
        signals: detectedSignals.slice(0, 5), // Top 5 signals
      });
    }
  }
  
  // Sort by confidence
  signals.sort((a, b) => b.confidence - a.confidence);
  
  // If no clear architecture, mark as mixed
  if (signals.length === 0 || signals[0].confidence < 0.15) {
    signals.unshift({
      type: 'mixed-unknown',
      confidence: 1,
      signals: ['No clear architecture pattern detected - schema may be custom or mixed-purpose'],
    });
  }
  
  return signals;
}

// Assess how well the schema fits the detected architecture
function assessArchitectureFit(
  schema: HygraphSchema, 
  archType: ArchitectureType,
  entryCounts: Record<string, { draft: number; published: number }>
): {
  score: number;
  strengths: string[];
  issues: { issue: string; recommendation: string; priority: 'high' | 'medium' | 'low' }[];
} {
  const strengths: string[] = [];
  const issues: { issue: string; recommendation: string; priority: 'high' | 'medium' | 'low' }[] = [];
  let score = 70; // Start at 70, adjust based on findings
  
  // Common best practices for all architectures
  const hasComponents = schema.components.length > 0;
  const avgFieldsPerModel = schema.models.reduce((sum, m) => sum + m.fields.length, 0) / Math.max(schema.models.length, 1);
  
  if (hasComponents) {
    strengths.push('Using components for reusable content blocks');
    score += 5;
  } else {
    issues.push({
      issue: 'No components defined - all content is in models',
      recommendation: 'Extract repeatable patterns (CTAs, SEO, Media blocks) into Components for better editorial experience',
      priority: 'high',
    });
    score -= 10;
  }
  
  if (avgFieldsPerModel <= 15) {
    strengths.push(`Models are well-scoped (avg ${avgFieldsPerModel.toFixed(1)} fields)`);
    score += 5;
  } else if (avgFieldsPerModel > 25) {
    issues.push({
      issue: `Models are too complex (avg ${avgFieldsPerModel.toFixed(1)} fields per model)`,
      recommendation: 'Break down large models into smaller, focused models or use components',
      priority: 'high',
    });
    score -= 15;
  }
  
  // Architecture-specific assessments
  switch (archType) {
    case 'ecommerce': {
      // E-commerce needs: Product, Category, proper relations
      const hasProductModel = schema.models.some(m => /product/i.test(m.name));
      const hasCategoryModel = schema.models.some(m => /category/i.test(m.name));
      const hasPriceField = schema.models.some(m => m.fields.some(f => /price/i.test(f.name)));
      
      if (hasProductModel && hasPriceField) {
        strengths.push('Has Product model with pricing');
        score += 10;
      } else {
        issues.push({
          issue: 'E-commerce pattern detected but missing core Product/Price structure',
          recommendation: 'Create a dedicated Product model with price, SKU, and inventory fields',
          priority: 'high',
        });
        score -= 10;
      }
      
      if (hasCategoryModel) {
        strengths.push('Has Category model for product organization');
        score += 5;
      }
      break;
    }
    
    case 'marketing-site': {
      // Marketing sites need: Pages, flexible sections, CTAs
      const hasPageModel = schema.models.some(m => /page/i.test(m.name));
      const hasFlexibleSections = schema.models.some(m => 
        m.fields.some(f => f.isList && f.relatedModel)
      );
      
      if (hasPageModel && hasFlexibleSections) {
        strengths.push('Has Page model with flexible section support');
        score += 10;
      } else if (!hasFlexibleSections) {
        issues.push({
          issue: 'Marketing site without flexible page builder pattern',
          recommendation: 'Add a "sections" or "blocks" relation field to pages that references a union of section types or components',
          priority: 'high',
        });
        score -= 10;
      }
      break;
    }
    
    case 'multi-brand':
    case 'multi-tenant': {
      // Multi-tenant needs: proper isolation, not enums
      const usingEnumsForTenants = schema.enums.some(e => 
        /brand|tenant|client|site/i.test(e.name)
      );
      const hasTenantModel = schema.models.some(m => 
        /brand|tenant|organization|client|site/i.test(m.name)
      );
      
      if (usingEnumsForTenants && !hasTenantModel) {
        issues.push({
          issue: 'Using enums for multi-tenant/brand separation - this doesn\'t scale',
          recommendation: 'Create a proper Brand/Tenant model with references. Consider separate Hygraph environments for true isolation.',
          priority: 'high',
        });
        score -= 20;
      } else if (hasTenantModel) {
        strengths.push('Has proper tenant/brand model for content separation');
        score += 10;
      }
      break;
    }
    
    case 'multi-region': {
      // Multi-region needs: locale handling, regional content
      const hasLocaleField = schema.models.some(m => 
        m.fields.some(f => /locale|language|region/i.test(f.name))
      );
      const hasRegionModel = schema.models.some(m => /region|country|market/i.test(m.name));
      
      if (hasLocaleField || hasRegionModel) {
        strengths.push('Has regional/locale content structure');
        score += 10;
      } else {
        issues.push({
          issue: 'Multi-region pattern detected but no locale handling',
          recommendation: 'Use Hygraph\'s built-in localization feature or create Region model for market-specific content',
          priority: 'medium',
        });
        score -= 10;
      }
      break;
    }
    
    case 'blog-publication': {
      // Blogs need: Author, Categories, proper content model
      const hasAuthor = schema.models.some(m => /author/i.test(m.name));
      const hasCategory = schema.models.some(m => /category|tag/i.test(m.name));
      const hasArticle = schema.models.some(m => /post|article|blog/i.test(m.name));
      
      if (hasArticle) {
        strengths.push('Has Article/Post content model');
        score += 5;
      }
      if (hasAuthor) {
        strengths.push('Has Author model for attribution');
        score += 5;
      }
      if (hasCategory) {
        strengths.push('Has categorization for content organization');
        score += 5;
      }
      
      if (!hasAuthor) {
        issues.push({
          issue: 'Publication without Author model',
          recommendation: 'Add Author model to properly attribute content and enable author pages',
          priority: 'medium',
        });
      }
      break;
    }
  }
  
  // Check for duplicate model patterns (affects all architectures)
  const modelFieldSignatures = new Map<string, string[]>();
  for (const model of schema.models) {
    const signature = model.fields
      .map(f => f.name.toLowerCase())
      .sort()
      .join(',');
    if (!modelFieldSignatures.has(signature)) {
      modelFieldSignatures.set(signature, []);
    }
    modelFieldSignatures.get(signature)!.push(model.name);
  }
  
  for (const [, models] of modelFieldSignatures) {
    if (models.length > 1) {
      issues.push({
        issue: `Duplicate model structure: ${models.join(', ')} have identical fields`,
        recommendation: `Consolidate into a single model with a "type" field, or extract shared fields into a component`,
        priority: 'high',
      });
      score -= 10;
    }
  }
  
  return {
    score: Math.max(0, Math.min(100, score)),
    strengths,
    issues,
  };
}

// Analyze model usage (FIXED - better detection)
function analyzeModelUsage(
  schema: HygraphSchema,
  entryCounts: Record<string, { draft: number; published: number }>
): ContentStrategyAnalysis['modelUsage'] {
  const activeModels: { name: string; usage: string; entryCount: number }[] = [];
  const underutilizedModels: { name: string; reason: string; suggestion: string }[] = [];
  const overloadedModels: { name: string; fieldCount: number; suggestion: string }[] = [];
  const duplicateModels: { models: string[]; sharedFields: string[]; recommendation: string }[] = [];
  
  // Track which models are referenced by others
  const referencedModels = new Set<string>();
  for (const model of schema.models) {
    for (const field of model.fields) {
      if (field.relatedModel) {
        referencedModels.add(field.relatedModel);
      }
    }
  }
  // Components also reference models
  for (const component of schema.components) {
    for (const field of component.fields) {
      if (field.relatedModel) {
        referencedModels.add(field.relatedModel);
      }
    }
  }
  
  for (const model of schema.models) {
    const counts = entryCounts[model.name];
    const totalEntries = counts ? counts.draft + counts.published : 0;
    const isReferenced = referencedModels.has(model.name);
    
    // Categorize models
    if (totalEntries > 0) {
      let usage = 'Active';
      if (totalEntries > 100) usage = 'High usage';
      if (totalEntries > 1000) usage = 'Heavy usage';
      
      activeModels.push({
        name: model.name,
        usage,
        entryCount: totalEntries,
      });
    } else if (isReferenced) {
      // Model has no entries but IS referenced - it's a valid structural model
      activeModels.push({
        name: model.name,
        usage: 'Structural (referenced but no direct entries)',
        entryCount: 0,
      });
    } else {
      // Model has no entries AND is not referenced - truly underutilized
      underutilizedModels.push({
        name: model.name,
        reason: 'No content entries and not referenced by other models',
        suggestion: `Either add content to "${model.name}", connect it to other models, or remove if no longer needed`,
      });
    }
    
    // Check for overloaded models
    if (model.fields.length > 20) {
      overloadedModels.push({
        name: model.name,
        fieldCount: model.fields.length,
        suggestion: `Split "${model.name}" into smaller models or extract field groups into components`,
      });
    }
  }
  
  // Find duplicate models (similar field patterns)
  const modelSignatures = schema.models.map(m => ({
    name: m.name,
    fields: new Set(m.fields.map(f => f.name.toLowerCase())),
  }));
  
  for (let i = 0; i < modelSignatures.length; i++) {
    for (let j = i + 1; j < modelSignatures.length; j++) {
      const m1 = modelSignatures[i];
      const m2 = modelSignatures[j];
      
      const shared = [...m1.fields].filter(f => m2.fields.has(f));
      const similarity = shared.length / Math.min(m1.fields.size, m2.fields.size);
      
      if (similarity >= 0.7 && shared.length >= 4) {
        duplicateModels.push({
          models: [m1.name, m2.name],
          sharedFields: shared.slice(0, 6),
          recommendation: `"${m1.name}" and "${m2.name}" are ${Math.round(similarity * 100)}% similar - consider merging into one model with a "type" discriminator`,
        });
      }
    }
  }
  
  return { activeModels, underutilizedModels, overloadedModels, duplicateModels };
}

// Analyze component strategy
function analyzeComponentStrategy(schema: HygraphSchema): ContentStrategyAnalysis['componentStrategy'] {
  const wellDesigned: string[] = [];
  const missingComponents: { description: string; affectedModels: string[]; recommendation: string }[] = [];
  const overEngineered: { name: string; reason: string; suggestion: string }[] = [];
  
  // Identify well-designed components (used in multiple places)
  const componentUsage = new Map<string, string[]>();
  for (const component of schema.components) {
    componentUsage.set(component.name, []);
  }
  
  for (const model of schema.models) {
    for (const field of model.fields) {
      if (field.relatedModel && componentUsage.has(field.relatedModel)) {
        componentUsage.get(field.relatedModel)!.push(model.name);
      }
    }
  }
  
  for (const [compName, usedIn] of componentUsage) {
    if (usedIn.length >= 2) {
      wellDesigned.push(`${compName} (used in ${usedIn.length} models)`);
    } else if (usedIn.length === 0) {
      const comp = schema.components.find(c => c.name === compName);
      if (comp && comp.fields.length < 3) {
        overEngineered.push({
          name: compName,
          reason: 'Small component with no usage',
          suggestion: `Remove "${compName}" or integrate its fields directly into parent models`,
        });
      }
    }
  }
  
  // Detect missing components (repeated field patterns across models)
  const commonPatterns: { pattern: string[]; models: string[] }[] = [
    { pattern: ['seoTitle', 'seoDescription', 'ogImage'], models: [] },
    { pattern: ['metaTitle', 'metaDescription'], models: [] },
    { pattern: ['buttonText', 'buttonLink', 'buttonStyle'], models: [] },
    { pattern: ['title', 'subtitle', 'image', 'description'], models: [] },
  ];
  
  // Check for SEO fields that should be a component
  const modelsWithSeoFields: string[] = [];
  const modelsWithCtaFields: string[] = [];
  
  for (const model of schema.models) {
    const fieldNames = model.fields.map(f => f.name.toLowerCase());
    
    // Check for SEO pattern
    const hasSeoFields = fieldNames.some(f => f.includes('seo') || f.includes('meta'));
    if (hasSeoFields) {
      modelsWithSeoFields.push(model.name);
    }
    
    // Check for CTA pattern
    const hasCtaFields = fieldNames.some(f => f.includes('button') || f.includes('cta'));
    if (hasCtaFields) {
      modelsWithCtaFields.push(model.name);
    }
  }
  
  // If SEO fields are duplicated without a component
  const hasSeoComponent = schema.components.some(c => /seo/i.test(c.name));
  if (modelsWithSeoFields.length > 2 && !hasSeoComponent) {
    missingComponents.push({
      description: 'SEO fields duplicated across multiple models',
      affectedModels: modelsWithSeoFields,
      recommendation: 'Create an "SEO" component with metaTitle, metaDescription, ogImage, etc., and reference it from content models',
    });
  }
  
  // If CTA fields are duplicated
  const hasCtaComponent = schema.components.some(c => /cta|button/i.test(c.name));
  if (modelsWithCtaFields.length > 2 && !hasCtaComponent) {
    missingComponents.push({
      description: 'CTA/Button fields duplicated across models',
      affectedModels: modelsWithCtaFields,
      recommendation: 'Create a "CTA" or "Button" component for consistent call-to-action elements',
    });
  }
  
  // Calculate reuse rate
  const totalComponentUsage = Array.from(componentUsage.values()).reduce((sum, arr) => sum + arr.length, 0);
  const componentReuseRate = schema.components.length > 0 
    ? Math.round((totalComponentUsage / schema.components.length) * 100) / 100
    : 0;
  
  return {
    wellDesigned,
    missingComponents,
    overEngineered,
    componentReuseRate,
  };
}

// Analyze editorial experience
function analyzeEditorialExperience(schema: HygraphSchema): ContentStrategyAnalysis['editorialExperience'] {
  const editorFriendlyModels: string[] = [];
  const complexModels: { name: string; issues: string[]; simplification: string }[] = [];
  const recommendations: string[] = [];
  
  for (const model of schema.models) {
    const issues: string[] = [];
    
    // Check field count
    if (model.fields.length > 20) {
      issues.push(`Too many fields (${model.fields.length})`);
    }
    
    // Check for too many required fields
    const requiredCount = model.fields.filter(f => f.isRequired).length;
    if (requiredCount > 8) {
      issues.push(`Too many required fields (${requiredCount}) - burdens editors`);
    }
    
    // Check for confusing field names (exclude standard system fields)
    const systemFields = ['id', 'createdAt', 'updatedAt', 'publishedAt', 'stage', 'documentInStages'];
    const unclearFields = model.fields.filter(f => 
      !systemFields.includes(f.name) &&
      (f.name.length < 3 || /^(val|tmp|x|y|z|data|info|stuff)$/i.test(f.name))
    );
    if (unclearFields.length > 0) {
      issues.push(`Unclear field names: ${unclearFields.map(f => f.name).join(', ')}`);
    }
    
    // Check for too many relations (overwhelming)
    const relationCount = model.fields.filter(f => f.relatedModel).length;
    if (relationCount > 8) {
      issues.push(`Too many relations (${relationCount}) - complex to navigate`);
    }
    
    if (issues.length === 0) {
      editorFriendlyModels.push(model.name);
    } else {
      complexModels.push({
        name: model.name,
        issues,
        simplification: issues.length > 2 
          ? `Consider breaking "${model.name}" into smaller, focused models or using field groups/tabs`
          : `Address the ${issues.length} issue(s) to improve editor experience`,
      });
    }
  }
  
  // Calculate discoverability
  const hasDescriptions = schema.models.some(m => m.fields.some(f => f.description));
  const avgFieldsPerModel = schema.models.reduce((sum, m) => sum + m.fields.length, 0) / Math.max(schema.models.length, 1);
  
  let contentDiscoverability: 'excellent' | 'good' | 'needs-work' | 'poor' = 'good';
  if (avgFieldsPerModel > 25 || complexModels.length > schema.models.length / 2) {
    contentDiscoverability = 'poor';
  } else if (avgFieldsPerModel > 18 || complexModels.length > schema.models.length / 3) {
    contentDiscoverability = 'needs-work';
  } else if (hasDescriptions && avgFieldsPerModel <= 12) {
    contentDiscoverability = 'excellent';
  }
  
  // Generate recommendations
  if (complexModels.length > 0) {
    recommendations.push(`Simplify ${complexModels.length} complex model(s) for better editor experience`);
  }
  if (!hasDescriptions) {
    recommendations.push('Add field descriptions to guide editors on expected content');
  }
  if (avgFieldsPerModel > 15) {
    recommendations.push('Consider grouping related fields using components to reduce visual clutter');
  }
  
  // Calculate score
  const score = Math.max(0, Math.min(100, 
    100 - (complexModels.length * 10) - (avgFieldsPerModel > 20 ? 15 : 0) - (!hasDescriptions ? 10 : 0)
  ));
  
  return {
    score,
    editorFriendlyModels,
    complexModels,
    contentDiscoverability,
    recommendations,
  };
}

// Analyze deep nesting
function analyzeDeepNesting(schema: HygraphSchema): ContentStrategyAnalysis['deepNesting'] {
  const problematicPaths: { path: string[]; depth: number; issue: string; solution: string }[] = [];
  const recommendedFlattening: { current: string; proposed: string; benefit: string }[] = [];
  
  // Build relation graph
  const graph = new Map<string, string[]>();
  for (const model of schema.models) {
    graph.set(model.name, model.fields
      .filter(f => f.relatedModel && schema.models.some(m => m.name === f.relatedModel))
      .map(f => f.relatedModel!)
    );
  }
  
  // Find deep paths using BFS (with safeguards)
  // SAFEGUARD: Limit queue size and paths to prevent memory issues
  const MAX_QUEUE_SIZE = 300;
  const MAX_PATHS_PER_START = 15;
  const MAX_TOTAL_PATHS = 30;
  
  function findDeepPaths(start: string, maxDepth: number = 5): string[][] {
    const paths: string[][] = [];
    const queue: { node: string; path: string[] }[] = [{ node: start, path: [start] }];
    
    while (queue.length > 0 && paths.length < MAX_PATHS_PER_START && queue.length < MAX_QUEUE_SIZE) {
      const { node, path } = queue.shift()!;
      if (path.length > maxDepth) continue;
      
      const neighbors = (graph.get(node) || []).slice(0, 5); // Limit neighbors
      for (const neighbor of neighbors) {
        if (path.includes(neighbor)) continue; // Avoid cycles
        
        const newPath = [...path, neighbor];
        if (newPath.length >= 4) {
          paths.push(newPath);
          if (paths.length >= MAX_PATHS_PER_START) break;
        }
        if (queue.length < MAX_QUEUE_SIZE) {
          queue.push({ node: neighbor, path: newPath });
        }
      }
    }
    
    return paths;
  }
  
  // Find all deep paths (limited for scalability)
  const allDeepPaths: string[][] = [];
  const modelsToAnalyze = schema.models.slice(0, 20);
  for (const model of modelsToAnalyze) {
    if (allDeepPaths.length >= MAX_TOTAL_PATHS) break;
    const paths = findDeepPaths(model.name);
    allDeepPaths.push(...paths.slice(0, MAX_PATHS_PER_START));
  }
  
  // Sort by depth and take most problematic
  allDeepPaths.sort((a, b) => b.length - a.length);
  const uniquePaths = new Set<string>();
  
  for (const path of allDeepPaths.slice(0, 10)) {
    const pathKey = path.join('→');
    if (uniquePaths.has(pathKey)) continue;
    uniquePaths.add(pathKey);
    
    if (path.length >= 4) {
      problematicPaths.push({
        path,
        depth: path.length,
        issue: `Querying ${path[0]} requires ${path.length - 1} nested levels to reach ${path[path.length - 1]}`,
        solution: path.length >= 5 
          ? `Consider flattening by adding a direct reference from ${path[0]} to ${path[path.length - 1]}, or use denormalization`
          : `Use GraphQL fragments and depth limits when querying this path`,
      });
      
      if (path.length >= 5) {
        recommendedFlattening.push({
          current: path.join(' → '),
          proposed: `${path[0]} → ${path[path.length - 1]} (direct)`,
          benefit: `Reduces query depth from ${path.length - 1} to 1 level`,
        });
      }
    }
  }
  
  return { problematicPaths, recommendedFlattening };
}

// Main analysis function
export function analyzeContentStrategy(
  schema: HygraphSchema,
  entryCounts: Record<string, { draft: number; published: number }>
): ContentStrategyAnalysis {
  // Detect architecture
  const architectureSignals = detectArchitectureType(schema);
  const primaryArch = architectureSignals[0];
  
  // Assess fit
  const architectureFit = assessArchitectureFit(schema, primaryArch.type, entryCounts);
  
  // Analyze model usage (FIXED)
  const modelUsage = analyzeModelUsage(schema, entryCounts);
  
  // Analyze components
  const componentStrategy = analyzeComponentStrategy(schema);
  
  // Analyze editorial experience
  const editorialExperience = analyzeEditorialExperience(schema);
  
  // Analyze deep nesting
  const deepNesting = analyzeDeepNesting(schema);
  
  // Analyze duplication patterns
  const duplicationPatterns = {
    fieldDuplication: componentStrategy.missingComponents.map(mc => ({
      fields: mc.description.split(' ').slice(0, 3),
      foundIn: mc.affectedModels,
      recommendation: mc.recommendation,
    })),
    modelDuplication: modelUsage.duplicateModels,
    enumDuplication: [], // Would need enum analysis
  };
  
  return {
    detectedArchitecture: {
      primary: primaryArch.type,
      confidence: primaryArch.confidence,
      signals: primaryArch.signals,
      allDetected: architectureSignals,
    },
    architectureFit,
    modelUsage,
    componentStrategy,
    editorialExperience,
    deepNesting,
    duplicationPatterns,
  };
}

// Generate issues from content strategy analysis
export function generateContentStrategyIssues(analysis: ContentStrategyAnalysis): AuditIssue[] {
  const issues: AuditIssue[] = [];
  
  // Architecture detection info
  issues.push({
    id: 'detected-architecture',
    severity: 'info',
    category: 'governance',
    title: `Detected Architecture: ${formatArchitectureType(analysis.detectedArchitecture.primary)}`,
    description: `Confidence: ${Math.round(analysis.detectedArchitecture.confidence * 100)}%. ${analysis.detectedArchitecture.signals.slice(0, 3).join('; ')}`,
    impact: 'Understanding your architecture type helps identify specific best practices',
    recommendation: analysis.detectedArchitecture.primary === 'mixed-unknown' 
      ? 'Consider adopting a clearer content architecture pattern for better maintainability'
      : `Apply ${formatArchitectureType(analysis.detectedArchitecture.primary)} best practices`,
    affectedItems: [],
    score: analysis.detectedArchitecture.confidence > 0.5 ? 5 : 0,
  });
  
  // Architecture fit issues
  for (const issue of analysis.architectureFit.issues) {
    issues.push({
      id: `arch-fit-${issue.issue.substring(0, 20).replace(/\s/g, '-')}`,
      severity: issue.priority === 'high' ? 'critical' : issue.priority === 'medium' ? 'warning' : 'info',
      category: 'governance',
      title: 'Architecture Fit Issue',
      description: issue.issue,
      impact: `Affects how well your schema supports ${formatArchitectureType(analysis.detectedArchitecture.primary)} use cases`,
      recommendation: issue.recommendation,
      affectedItems: [],
    });
  }
  
  // Underutilized models (FIXED - more accurate)
  for (const model of analysis.modelUsage.underutilizedModels) {
    issues.push({
      id: `underutilized-${model.name}`,
      severity: 'warning',
      category: 'content',
      title: 'Underutilized Model',
      description: `"${model.name}": ${model.reason}`,
      impact: 'Unused models add schema complexity without providing value',
      recommendation: model.suggestion,
      affectedItems: [model.name],
    });
  }
  
  // Duplicate models
  for (const dup of analysis.modelUsage.duplicateModels) {
    issues.push({
      id: `duplicate-models-${dup.models.join('-')}`,
      severity: 'critical',
      category: 'schema',
      title: 'Duplicate Model Structure',
      description: `Models ${dup.models.join(' and ')} share fields: ${dup.sharedFields.join(', ')}`,
      impact: 'Duplicate models complicate maintenance and confuse editors',
      recommendation: dup.recommendation,
      affectedItems: dup.models,
    });
  }
  
  // Overloaded models
  for (const model of analysis.modelUsage.overloadedModels) {
    issues.push({
      id: `overloaded-${model.name}`,
      severity: 'warning',
      category: 'editorial',
      title: 'Overloaded Model',
      description: `"${model.name}" has ${model.fieldCount} fields - too complex for editors`,
      impact: 'Complex models slow down editors and increase errors',
      recommendation: model.suggestion,
      affectedItems: [model.name],
    });
  }
  
  // Missing components
  for (const mc of analysis.componentStrategy.missingComponents) {
    issues.push({
      id: `missing-component-${mc.description.substring(0, 15).replace(/\s/g, '-')}`,
      severity: 'warning',
      category: 'component',
      title: 'Missing Component',
      description: mc.description,
      impact: 'Field duplication increases maintenance burden and inconsistency risk',
      recommendation: mc.recommendation,
      affectedItems: mc.affectedModels,
    });
  }
  
  // Deep nesting issues
  for (const path of analysis.deepNesting.problematicPaths.slice(0, 5)) {
    issues.push({
      id: `deep-nesting-${path.path.join('-')}`,
      severity: path.depth >= 5 ? 'critical' : 'warning',
      category: 'performance',
      title: 'Deep Relation Nesting',
      description: path.issue,
      impact: 'Deep nesting increases query complexity and response time',
      recommendation: path.solution,
      affectedItems: path.path,
    });
  }
  
  // Editorial experience issues
  for (const model of analysis.editorialExperience.complexModels.slice(0, 5)) {
    issues.push({
      id: `complex-editorial-${model.name}`,
      severity: 'warning',
      category: 'editorial',
      title: 'Complex Editorial Experience',
      description: `"${model.name}": ${model.issues.join('; ')}`,
      impact: 'Complex models slow down content creation and increase errors',
      recommendation: model.simplification,
      affectedItems: [model.name],
    });
  }
  
  // Positive findings
  if (analysis.architectureFit.strengths.length > 0) {
    issues.push({
      id: 'architecture-strengths',
      severity: 'info',
      category: 'governance',
      title: 'Architecture Strengths',
      description: analysis.architectureFit.strengths.join('; '),
      impact: 'These patterns contribute to a well-designed schema',
      recommendation: 'Continue these practices',
      affectedItems: [],
      score: 10,
    });
  }
  
  if (analysis.componentStrategy.wellDesigned.length > 0) {
    issues.push({
      id: 'well-designed-components',
      severity: 'info',
      category: 'component',
      title: 'Well-Designed Components',
      description: `Reusable components: ${analysis.componentStrategy.wellDesigned.join(', ')}`,
      impact: 'Good component reuse improves consistency and editor experience',
      recommendation: 'Maintain this pattern for new content types',
      affectedItems: [],
      score: 5,
    });
  }
  
  return issues;
}

function formatArchitectureType(type: ArchitectureType): string {
  const labels: Record<ArchitectureType, string> = {
    'ecommerce': 'E-Commerce',
    'marketing-site': 'Marketing Website',
    'multi-brand': 'Multi-Brand',
    'multi-tenant': 'Multi-Tenant',
    'multi-region': 'Multi-Region',
    'blog-publication': 'Blog/Publication',
    'saas-docs': 'SaaS Documentation',
    'portfolio-showcase': 'Portfolio/Showcase',
    'event-platform': 'Event Platform',
    'mixed-unknown': 'Mixed/Custom',
  };
  return labels[type] || type;
}

export function calculateContentStrategyScore(analysis: ContentStrategyAnalysis): number {
  let score = analysis.architectureFit.score;
  
  // Adjust for editorial experience
  score = (score + analysis.editorialExperience.score) / 2;
  
  // Penalize for issues
  score -= analysis.modelUsage.underutilizedModels.length * 3;
  score -= analysis.modelUsage.duplicateModels.length * 10;
  score -= analysis.componentStrategy.missingComponents.length * 5;
  score -= analysis.deepNesting.problematicPaths.filter(p => p.depth >= 5).length * 8;
  
  // Bonus for good practices
  score += Math.min(analysis.componentStrategy.wellDesigned.length * 2, 10);
  score += analysis.detectedArchitecture.confidence > 0.5 ? 5 : 0;
  
  return Math.max(0, Math.min(100, Math.round(score)));
}


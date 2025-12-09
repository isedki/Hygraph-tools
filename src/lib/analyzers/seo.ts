import type { HygraphSchema, SEOAnalysis, AuditIssue, CheckpointResult, CheckpointStatus } from '../types';
import { filterSystemModels, filterSystemComponents } from './systemFilters';

// SEO-related field patterns
const SEO_FIELD_PATTERNS = [
  'seo',
  'meta',
  'metaTitle',
  'metaDescription',
  'metaKeywords',
  'ogTitle',
  'ogDescription',
  'ogImage',
  'twitterTitle',
  'twitterDescription',
  'twitterImage',
  'canonicalUrl',
  'canonical',
];

const SLUG_FIELD_PATTERNS = ['slug', 'handle', 'urlPath', 'path', 'permalink'];

const OG_FIELD_PATTERNS = [
  'ogTitle',
  'ogDescription',
  'ogImage',
  'openGraph',
  'socialImage',
  'shareImage',
];

function hasSEOFields(fieldNames: string[]): boolean {
  const lowerNames = fieldNames.map(n => n.toLowerCase());
  return SEO_FIELD_PATTERNS.some(pattern => 
    lowerNames.some(name => name.includes(pattern.toLowerCase()))
  );
}

function findSlugField(fieldNames: string[]): string | undefined {
  const lowerNames = fieldNames.map(n => n.toLowerCase());
  for (const pattern of SLUG_FIELD_PATTERNS) {
    const idx = lowerNames.findIndex(n => n === pattern.toLowerCase());
    if (idx !== -1) return fieldNames[idx];
  }
  return undefined;
}

function hasOGFields(fieldNames: string[]): boolean {
  const lowerNames = fieldNames.map(n => n.toLowerCase());
  return OG_FIELD_PATTERNS.some(pattern => 
    lowerNames.some(name => name.includes(pattern.toLowerCase()))
  );
}

export function analyzeSEO(
  schema: HygraphSchema,
  assetStats: { total: number; withoutAlt: number; largeAssets: number }
): SEOAnalysis {
  const modelsWithSEO: string[] = [];
  const modelsWithoutSEO: string[] = [];
  const slugFieldPresence: { model: string; hasSlug: boolean; slugField?: string }[] = [];
  
  // Content models (exclude utility models)
  const contentModels = schema.models.filter(m => 
    !m.name.toLowerCase().includes('setting') &&
    !m.name.toLowerCase().includes('config') &&
    !m.name.toLowerCase().includes('navigation')
  );
  
  for (const model of contentModels) {
    const fieldNames = model.fields.map(f => f.name);
    
    // Check for SEO fields
    if (hasSEOFields(fieldNames)) {
      modelsWithSEO.push(model.name);
    } else {
      modelsWithoutSEO.push(model.name);
    }
    
    // Check for slug field
    const slugField = findSlugField(fieldNames);
    slugFieldPresence.push({
      model: model.name,
      hasSlug: !!slugField,
      slugField,
    });
  }
  
  // Calculate SEO field coverage
  const seoFieldCoverage = contentModels.length > 0
    ? (modelsWithSEO.length / contentModels.length) * 100
    : 0;
  
  // Check for OG fields in any model or component
  const allFieldNames = [
    ...schema.models.flatMap(m => m.fields.map(f => f.name)),
    ...schema.components.flatMap(c => c.fields.map(f => f.name)),
  ];
  const ogFieldsPresent = hasOGFields(allFieldNames);
  
  // Alt text coverage
  const altTextCoverage = assetStats.total > 0
    ? ((assetStats.total - assetStats.withoutAlt) / assetStats.total) * 100
    : 100;
  
  return {
    modelsWithSEO,
    modelsWithoutSEO,
    seoFieldCoverage,
    slugFieldPresence,
    duplicateSlugs: [], // Would require content analysis
    assetsWithoutAlt: assetStats.withoutAlt,
    totalAssets: assetStats.total,
    altTextCoverage,
    ogFieldsPresent,
    richTextHeadingIssues: [], // Would require content analysis
  };
}

export function generateSEOIssues(analysis: SEOAnalysis): AuditIssue[] {
  const issues: AuditIssue[] = [];
  
  // Models without SEO fields
  if (analysis.modelsWithoutSEO.length > 0) {
    issues.push({
      id: 'missing-seo-fields',
      severity: analysis.modelsWithoutSEO.length > 3 ? 'warning' : 'info',
      category: 'seo',
      title: 'Missing SEO Fields',
      description: `${analysis.modelsWithoutSEO.length} content model(s) lack SEO fields`,
      impact: 'Content without SEO fields may not be properly indexed by search engines',
      recommendation: 'Add SEO component with metaTitle, metaDescription to content models',
      affectedItems: analysis.modelsWithoutSEO,
    });
  }
  
  // Low SEO field coverage
  if (analysis.seoFieldCoverage < 50) {
    issues.push({
      id: 'low-seo-coverage',
      severity: 'warning',
      category: 'seo',
      title: 'Low SEO Field Coverage',
      description: `Only ${analysis.seoFieldCoverage.toFixed(0)}% of content models have SEO fields`,
      impact: 'Most content cannot be optimized for search engines',
      recommendation: 'Create a reusable SEO component and add it to all content models',
      affectedItems: analysis.modelsWithoutSEO,
    });
  }
  
  // Missing slug fields
  const modelsWithoutSlug = analysis.slugFieldPresence.filter(s => !s.hasSlug);
  if (modelsWithoutSlug.length > 0) {
    issues.push({
      id: 'missing-slug-fields',
      severity: 'warning',
      category: 'seo',
      title: 'Missing Slug Fields',
      description: `${modelsWithoutSlug.length} model(s) lack slug fields`,
      impact: 'Content without slugs cannot have SEO-friendly URLs',
      recommendation: 'Add slug field with unique constraint to content models',
      affectedItems: modelsWithoutSlug.map(s => s.model),
    });
  }
  
  // Missing OG fields
  if (!analysis.ogFieldsPresent) {
    issues.push({
      id: 'missing-og-fields',
      severity: 'info',
      category: 'seo',
      title: 'No Open Graph Fields',
      description: 'Schema lacks Open Graph (og:) fields for social sharing',
      impact: 'Shared content may not display properly on social media',
      recommendation: 'Add ogTitle, ogDescription, ogImage fields to SEO component',
      affectedItems: [],
    });
  }
  
  // Low alt text coverage
  if (analysis.altTextCoverage < 80 && analysis.totalAssets > 0) {
    issues.push({
      id: 'low-alt-coverage',
      severity: analysis.altTextCoverage < 50 ? 'warning' : 'info',
      category: 'seo',
      title: 'Low Alt Text Coverage',
      description: `Only ${analysis.altTextCoverage.toFixed(0)}% of assets have alt text (${analysis.assetsWithoutAlt} missing)`,
      impact: 'Missing alt text hurts accessibility and image SEO',
      recommendation: 'Add alt text to all images, make alt field required for new assets',
      affectedItems: [],
    });
  }
  
  // Duplicate slugs
  if (analysis.duplicateSlugs.length > 0) {
    for (const dup of analysis.duplicateSlugs) {
      issues.push({
        id: `duplicate-slug-${dup.model}-${dup.slug}`,
        severity: 'critical',
        category: 'seo',
        title: 'Duplicate Slug',
        description: `Slug "${dup.slug}" used ${dup.count} times in ${dup.model}`,
        impact: 'Duplicate slugs cause routing conflicts and SEO issues',
        recommendation: 'Add unique constraint to slug field and fix duplicates',
        affectedItems: [dup.model],
      });
    }
  }
  
  // Good SEO coverage (positive)
  if (analysis.seoFieldCoverage >= 80) {
    issues.push({
      id: 'good-seo-coverage',
      severity: 'info',
      category: 'seo',
      title: 'Good SEO Field Coverage',
      description: `${analysis.seoFieldCoverage.toFixed(0)}% of content models have SEO fields`,
      impact: 'Most content can be optimized for search engines',
      recommendation: 'Maintain this coverage for new models',
      affectedItems: analysis.modelsWithSEO,
      score: 10, // Bonus
    });
  }
  
  return issues;
}

export function calculateSEOScore(analysis: SEOAnalysis, issues: AuditIssue[]): number {
  let score = 100;
  
  // Deduct for missing SEO fields
  score -= Math.min(analysis.modelsWithoutSEO.length * 5, 25);
  
  // Deduct for low coverage
  if (analysis.seoFieldCoverage < 50) score -= 20;
  else if (analysis.seoFieldCoverage < 80) score -= 10;
  
  // Deduct for missing slugs
  const missingSlugCount = analysis.slugFieldPresence.filter(s => !s.hasSlug).length;
  score -= Math.min(missingSlugCount * 5, 15);
  
  // Deduct for missing OG fields
  if (!analysis.ogFieldsPresent) score -= 10;
  
  // Deduct for low alt text coverage
  if (analysis.altTextCoverage < 50) score -= 15;
  else if (analysis.altTextCoverage < 80) score -= 7;
  
  // Deduct for duplicate slugs (critical)
  score -= analysis.duplicateSlugs.length * 10;
  
  return Math.max(0, Math.min(100, score));
}

// ============================================
// NEW: Checkpoint-Style SEO Readiness Assessment
// ============================================

// Twitter Card field patterns
const TWITTER_FIELD_PATTERNS = [
  'twitterTitle',
  'twitterDescription', 
  'twitterImage',
  'twitterCard',
  'twitter',
];

// Canonical URL patterns
const CANONICAL_PATTERNS = ['canonical', 'canonicalUrl', 'canonicalURL'];

// Schema.org friendly model patterns
const SCHEMA_ORG_PATTERNS: { pattern: RegExp; type: string }[] = [
  { pattern: /article|post|blog|news/i, type: 'Article' },
  { pattern: /product/i, type: 'Product' },
  { pattern: /faq/i, type: 'FAQPage' },
  { pattern: /event/i, type: 'Event' },
  { pattern: /person|author|team/i, type: 'Person' },
  { pattern: /organization|company/i, type: 'Organization' },
  { pattern: /review|testimonial/i, type: 'Review' },
  { pattern: /recipe/i, type: 'Recipe' },
  { pattern: /video/i, type: 'VideoObject' },
  { pattern: /job|career|position/i, type: 'JobPosting' },
  { pattern: /course|class/i, type: 'Course' },
  { pattern: /book/i, type: 'Book' },
];

export interface SEOReadinessAssessment {
  metaFieldCoverage: CheckpointResult;
  slugConsistency: CheckpointResult;
  socialSharing: CheckpointResult;
  structuredData: CheckpointResult;
  altTextCoverage: CheckpointResult;
  overallScore: number;
}

function hasTwitterFields(fieldNames: string[]): boolean {
  const lowerNames = fieldNames.map(n => n.toLowerCase());
  return TWITTER_FIELD_PATTERNS.some(pattern =>
    lowerNames.some(name => name.includes(pattern.toLowerCase()))
  );
}

function hasCanonicalField(fieldNames: string[]): boolean {
  const lowerNames = fieldNames.map(n => n.toLowerCase());
  return CANONICAL_PATTERNS.some(pattern =>
    lowerNames.some(name => name.includes(pattern.toLowerCase()))
  );
}

function detectStructuredDataSupport(modelName: string): string | null {
  for (const { pattern, type } of SCHEMA_ORG_PATTERNS) {
    if (pattern.test(modelName)) {
      return type;
    }
  }
  return null;
}

/**
 * Generate checkpoint-style SEO readiness assessment
 */
export function analyzeSEOReadiness(
  schema: HygraphSchema,
  assetStats: { total: number; withoutAlt: number; largeAssets: number }
): SEOReadinessAssessment {
  const customModels = filterSystemModels(schema.models);
  const customComponents = filterSystemComponents(schema.components || []);
  
  // Filter to content models (exclude utility models)
  const contentModels = customModels.filter(m =>
    !m.name.toLowerCase().includes('setting') &&
    !m.name.toLowerCase().includes('config') &&
    !m.name.toLowerCase().includes('navigation') &&
    !m.name.toLowerCase().includes('menu')
  );
  
  // ==========================================
  // 1. Meta Field Coverage
  // ==========================================
  const modelsWithMeta: string[] = [];
  const modelsWithoutMeta: string[] = [];
  
  for (const model of contentModels) {
    const fieldNames = model.fields.map(f => f.name);
    if (hasSEOFields(fieldNames)) {
      modelsWithMeta.push(model.name);
    } else {
      modelsWithoutMeta.push(model.name);
    }
  }
  
  const metaCoverage = contentModels.length > 0
    ? (modelsWithMeta.length / contentModels.length) * 100
    : 100;
  
  let metaStatus: CheckpointStatus = 'good';
  if (metaCoverage < 50) metaStatus = 'issue';
  else if (metaCoverage < 80) metaStatus = 'warning';
  
  const metaFieldCoverage: CheckpointResult = {
    status: metaStatus,
    title: 'Meta Field Coverage',
    findings: metaStatus === 'good'
      ? [`${Math.round(metaCoverage)}% of content models have SEO meta fields`]
      : [
          `Only ${Math.round(metaCoverage)}% of content models have SEO meta fields`,
          `${modelsWithoutMeta.length} model(s) missing meta fields`,
        ],
    examples: modelsWithoutMeta.length > 0
      ? [{ items: modelsWithoutMeta.slice(0, 5), details: 'Models without metaTitle/metaDescription' }]
      : [],
    actionItems: metaStatus !== 'good'
      ? ['Create reusable SEO component with metaTitle, metaDescription', 'Add SEO component to all content models']
      : ['Maintain meta field coverage for new models'],
  };
  
  // ==========================================
  // 2. Slug Consistency
  // ==========================================
  const modelsWithSlug: string[] = [];
  const modelsWithoutSlug: string[] = [];
  const slugFieldNames: string[] = [];
  
  for (const model of contentModels) {
    const fieldNames = model.fields.map(f => f.name);
    const slugField = findSlugField(fieldNames);
    if (slugField) {
      modelsWithSlug.push(model.name);
      if (!slugFieldNames.includes(slugField)) {
        slugFieldNames.push(slugField);
      }
    } else {
      modelsWithoutSlug.push(model.name);
    }
  }
  
  const slugCoverage = contentModels.length > 0
    ? (modelsWithSlug.length / contentModels.length) * 100
    : 100;
  
  let slugStatus: CheckpointStatus = 'good';
  const findings: string[] = [];
  
  if (slugCoverage < 50) {
    slugStatus = 'issue';
    findings.push(`Only ${Math.round(slugCoverage)}% of models have slug fields`);
  } else if (slugCoverage < 80) {
    slugStatus = 'warning';
    findings.push(`${Math.round(slugCoverage)}% of models have slug fields`);
  } else {
    findings.push(`${Math.round(slugCoverage)}% of models have slug fields`);
  }
  
  // Check slug naming consistency
  if (slugFieldNames.length > 1) {
    findings.push(`Inconsistent slug field names: ${slugFieldNames.join(', ')}`);
    if (slugStatus === 'good') slugStatus = 'warning';
  }
  
  const slugConsistency: CheckpointResult = {
    status: slugStatus,
    title: 'URL Slug Consistency',
    findings,
    examples: modelsWithoutSlug.length > 0
      ? [{ items: modelsWithoutSlug.slice(0, 5), details: 'Models without slug field' }]
      : [],
    actionItems: slugStatus !== 'good'
      ? ['Add slug field to content models for SEO-friendly URLs', 'Standardize slug field naming (recommend: "slug")']
      : ['Maintain slug field coverage'],
  };
  
  // ==========================================
  // 3. Social Sharing (OG + Twitter)
  // ==========================================
  const allFieldNames = [
    ...customModels.flatMap(m => m.fields.map(f => f.name)),
    ...customComponents.flatMap(c => c.fields.map(f => f.name)),
  ];
  
  const hasOG = hasOGFields(allFieldNames);
  const hasTwitter = hasTwitterFields(allFieldNames);
  const hasCanonical = hasCanonicalField(allFieldNames);
  
  let socialStatus: CheckpointStatus = 'good';
  const socialFindings: string[] = [];
  const socialActions: string[] = [];
  
  if (hasOG && hasTwitter) {
    socialFindings.push('Open Graph and Twitter Card fields present');
  } else if (hasOG) {
    socialStatus = 'warning';
    socialFindings.push('Open Graph fields present');
    socialFindings.push('Twitter Card fields missing');
    socialActions.push('Add twitterTitle, twitterDescription, twitterImage fields');
  } else if (hasTwitter) {
    socialStatus = 'warning';
    socialFindings.push('Twitter Card fields present');
    socialFindings.push('Open Graph fields missing');
    socialActions.push('Add ogTitle, ogDescription, ogImage fields');
  } else {
    socialStatus = 'issue';
    socialFindings.push('No social sharing fields found');
    socialActions.push('Add Open Graph fields: ogTitle, ogDescription, ogImage');
    socialActions.push('Add Twitter Card fields for better social previews');
  }
  
  if (hasCanonical) {
    socialFindings.push('Canonical URL field present');
  } else {
    if (socialStatus === 'good') socialStatus = 'warning';
    socialFindings.push('Canonical URL field missing');
    socialActions.push('Add canonicalUrl field to prevent duplicate content issues');
  }
  
  const socialSharing: CheckpointResult = {
    status: socialStatus,
    title: 'Social Sharing Support',
    findings: socialFindings,
    examples: [],
    actionItems: socialActions.length > 0 ? socialActions : ['Maintain social sharing field coverage'],
  };
  
  // ==========================================
  // 4. Structured Data (Schema.org Support)
  // ==========================================
  const structuredDataModels: { model: string; schemaType: string }[] = [];
  
  for (const model of contentModels) {
    const schemaType = detectStructuredDataSupport(model.name);
    if (schemaType) {
      structuredDataModels.push({ model: model.name, schemaType });
    }
  }
  
  let structuredStatus: CheckpointStatus = 'good';
  const structuredFindings: string[] = [];
  
  if (structuredDataModels.length > 0) {
    structuredFindings.push(`${structuredDataModels.length} model(s) support Schema.org structured data`);
    
    // Check if they have the right fields for rich results
    const modelTypes = structuredDataModels.map(s => s.schemaType);
    if (modelTypes.includes('Article')) {
      structuredFindings.push('Article schema support detected (good for Google News)');
    }
    if (modelTypes.includes('Product')) {
      structuredFindings.push('Product schema support detected (good for shopping results)');
    }
    if (modelTypes.includes('FAQPage')) {
      structuredFindings.push('FAQ schema support detected (good for featured snippets)');
    }
  } else {
    structuredStatus = 'warning';
    structuredFindings.push('No models detected that map to Schema.org types');
  }
  
  const structuredData: CheckpointResult = {
    status: structuredStatus,
    title: 'Structured Data Support',
    findings: structuredFindings,
    examples: structuredDataModels.length > 0
      ? [{
          items: structuredDataModels.slice(0, 5).map(s => `${s.model} → ${s.schemaType}`),
          details: 'Models with Schema.org potential',
        }]
      : [],
    actionItems: structuredStatus !== 'good'
      ? ['Consider naming content models to align with Schema.org types', 'Add structured data fields (datePublished, author, etc.)']
      : ['Implement Schema.org JSON-LD in frontend using these models'],
  };
  
  // ==========================================
  // 5. Alt Text Coverage
  // ==========================================
  const altCoverage = assetStats.total > 0
    ? ((assetStats.total - assetStats.withoutAlt) / assetStats.total) * 100
    : 100;
  
  let altStatus: CheckpointStatus = 'good';
  if (altCoverage < 50) altStatus = 'issue';
  else if (altCoverage < 80) altStatus = 'warning';
  
  const altTextCoverage: CheckpointResult = {
    status: altStatus,
    title: 'Image Alt Text Coverage',
    findings: assetStats.total > 0
      ? [
          `${Math.round(altCoverage)}% of assets have alt text`,
          assetStats.withoutAlt > 0 ? `${assetStats.withoutAlt} assets missing alt text` : 'All assets have alt text',
        ]
      : ['No assets to analyze'],
    examples: [],
    actionItems: altStatus !== 'good'
      ? ['Add alt text to existing images', 'Make alt field required for new uploads', 'Include alt text in content guidelines']
      : ['Maintain alt text coverage for accessibility and SEO'],
  };
  
  // ==========================================
  // Calculate Overall Score
  // ==========================================
  let overallScore = 100;
  
  // Meta coverage (25 points)
  if (metaStatus === 'issue') overallScore -= 25;
  else if (metaStatus === 'warning') overallScore -= 12;
  
  // Slug consistency (20 points)
  if (slugStatus === 'issue') overallScore -= 20;
  else if (slugStatus === 'warning') overallScore -= 10;
  
  // Social sharing (20 points)
  if (socialStatus === 'issue') overallScore -= 20;
  else if (socialStatus === 'warning') overallScore -= 10;
  
  // Structured data (15 points)
  // Note: structuredStatus is only 'good' or 'warning' in current logic
  if (structuredStatus === 'warning') overallScore -= 7;
  
  // Alt text (20 points)
  if (altStatus === 'issue') overallScore -= 20;
  else if (altStatus === 'warning') overallScore -= 10;
  
  return {
    metaFieldCoverage,
    slugConsistency,
    socialSharing,
    structuredData,
    altTextCoverage,
    overallScore: Math.max(0, overallScore),
  };
}


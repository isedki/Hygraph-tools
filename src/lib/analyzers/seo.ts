import type { HygraphSchema, SEOAnalysis, AuditIssue } from '../types';

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



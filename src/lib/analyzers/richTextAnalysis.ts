import { GraphQLClient } from 'graphql-request';
import type { HygraphSchema, HygraphModel, RichTextUsageAnalysis } from '../types';
import { fetchRichTextContent } from '../hygraph/introspection';

// Regex patterns for Rich Text analysis
const ABSOLUTE_URL_PATTERN = /https?:\/\/[^\s<>"']+/g;
const EMBEDDED_IMAGE_PATTERN = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
const STATIC_LINK_PATTERN = /<a[^>]+href=["']([^"']+)["'][^>]*>/gi;
const BUTTON_CTA_PATTERN = /<(button|a[^>]*class=["'][^"']*(?:btn|button|cta)[^"']*["'])[^>]*>/gi;

// System types to exclude
const SYSTEM_TYPES = new Set(['Asset', 'RichText', 'Location', 'Color', 'RGBA']);

function isRichTextField(field: { name: string; type: string }): boolean {
  return (
    field.type === 'RichText' ||
    field.type.includes('RichText') ||
    field.name.toLowerCase().includes('richtext') ||
    field.name.toLowerCase().includes('content') && field.type === 'String'
  );
}

function findRichTextFields(model: HygraphModel): string[] {
  return model.fields
    .filter(f => isRichTextField(f))
    .map(f => f.name);
}

function extractAbsoluteUrls(html: string): string[] {
  const urls: string[] = [];
  let match;
  
  while ((match = ABSOLUTE_URL_PATTERN.exec(html)) !== null) {
    // Filter out common safe domains (like asset CDNs)
    const url = match[0];
    if (!url.includes('media.graphassets.com') && !url.includes('graphcms.com')) {
      urls.push(url);
    }
  }
  
  return [...new Set(urls)]; // Dedupe
}

function countEmbeddedImages(html: string): number {
  const matches = html.match(EMBEDDED_IMAGE_PATTERN);
  return matches ? matches.length : 0;
}

function analyzeLinks(html: string): { staticCount: number; hasReferences: boolean } {
  const staticMatches = html.match(STATIC_LINK_PATTERN);
  const staticCount = staticMatches ? staticMatches.length : 0;
  
  // Check for reference-style links (Hygraph embeds or references)
  const hasReferences = html.includes('data-gcms') || 
                        html.includes('data-hygraph') ||
                        html.includes('__typename');
  
  return { staticCount, hasReferences };
}

function detectCtaPatterns(html: string): string[] {
  const patterns: string[] = [];
  
  if (BUTTON_CTA_PATTERN.test(html)) {
    patterns.push('button-elements');
  }
  if (html.includes('class="btn') || html.includes("class='btn")) {
    patterns.push('btn-class');
  }
  if (html.includes('class="cta') || html.includes("class='cta")) {
    patterns.push('cta-class');
  }
  if (/<a[^>]+href=["'][^"']+["'][^>]*>[^<]*(?:Learn More|Read More|Get Started|Contact|Buy|Shop|Subscribe)/i.test(html)) {
    patterns.push('cta-text-pattern');
  }
  
  return patterns;
}

export async function analyzeRichTextUsage(
  client: GraphQLClient,
  schema: HygraphSchema
): Promise<RichTextUsageAnalysis> {
  const modelsWithRichText: { model: string; fields: string[] }[] = [];
  const absoluteUrls: { model: string; field: string; urls: string[]; count: number }[] = [];
  const embeddedImages: { model: string; field: string; count: number; recommendation: string }[] = [];
  const staticLinks: { model: string; field: string; count: number }[] = [];
  const referenceLinks: { model: string; field: string; count: number }[] = [];
  const ctaPatterns: { model: string; field: string; pattern: string }[] = [];
  const recommendations: string[] = [];
  
  // Find all models with Rich Text fields
  for (const model of schema.models) {
    if (model.isSystem || SYSTEM_TYPES.has(model.name)) continue;
    
    const richTextFields = findRichTextFields(model);
    if (richTextFields.length > 0) {
      modelsWithRichText.push({ model: model.name, fields: richTextFields });
    }
  }
  
  // Analyze content for each Rich Text field
  for (const { model: modelName, fields } of modelsWithRichText) {
    const model = schema.models.find(m => m.name === modelName);
    if (!model) continue;
    
    for (const fieldName of fields) {
      try {
        const content = await fetchRichTextContent(client, model, fieldName, 50);
        
        let totalAbsoluteUrls: string[] = [];
        let totalEmbeddedImages = 0;
        let totalStaticLinks = 0;
        let totalReferenceLinks = 0;
        const foundCtaPatterns = new Set<string>();
        
        for (const entry of content) {
          if (!entry.content?.html) continue;
          
          const html = entry.content.html;
          
          // Extract absolute URLs
          const urls = extractAbsoluteUrls(html);
          totalAbsoluteUrls.push(...urls);
          
          // Count embedded images
          totalEmbeddedImages += countEmbeddedImages(html);
          
          // Analyze links
          const linkAnalysis = analyzeLinks(html);
          totalStaticLinks += linkAnalysis.staticCount;
          if (linkAnalysis.hasReferences) {
            totalReferenceLinks++;
          }
          
          // Detect CTA patterns
          const patterns = detectCtaPatterns(html);
          patterns.forEach(p => foundCtaPatterns.add(p));
        }
        
        // Record findings
        if (totalAbsoluteUrls.length > 0) {
          const uniqueUrls = [...new Set(totalAbsoluteUrls)].slice(0, 10); // Limit to 10 examples
          absoluteUrls.push({
            model: modelName,
            field: fieldName,
            urls: uniqueUrls,
            count: totalAbsoluteUrls.length
          });
        }
        
        if (totalEmbeddedImages > 0) {
          embeddedImages.push({
            model: modelName,
            field: fieldName,
            count: totalEmbeddedImages,
            recommendation: 'Consider using Asset references instead of embedding images directly in Rich Text'
          });
        }
        
        if (totalStaticLinks > 0) {
          staticLinks.push({
            model: modelName,
            field: fieldName,
            count: totalStaticLinks
          });
        }
        
        if (totalReferenceLinks > 0) {
          referenceLinks.push({
            model: modelName,
            field: fieldName,
            count: totalReferenceLinks
          });
        }
        
        foundCtaPatterns.forEach(pattern => {
          ctaPatterns.push({
            model: modelName,
            field: fieldName,
            pattern
          });
        });
        
      } catch {
        // Skip if we can't fetch content
      }
    }
  }
  
  // Generate recommendations
  if (absoluteUrls.length > 0) {
    const totalUrls = absoluteUrls.reduce((sum, a) => sum + a.count, 0);
    recommendations.push(
      `Found ${totalUrls} absolute URL(s) in Rich Text across ${absoluteUrls.length} field(s). Consider using relative URLs or reference fields for internal links.`
    );
  }
  
  if (embeddedImages.length > 0) {
    const totalImages = embeddedImages.reduce((sum, e) => sum + e.count, 0);
    recommendations.push(
      `Found ${totalImages} embedded image(s) in Rich Text across ${embeddedImages.length} field(s). Use Asset references for better media management and optimization.`
    );
  }
  
  if (staticLinks.length > 0 && referenceLinks.length === 0) {
    recommendations.push(
      'All links appear to be static HTML. Consider using Hygraph\'s reference embeds for better content relationships and link management.'
    );
  }
  
  if (ctaPatterns.length > 0) {
    recommendations.push(
      'CTA/button patterns detected in Rich Text. Consider creating dedicated CTA components for better reusability and styling control.'
    );
  }
  
  if (modelsWithRichText.length === 0) {
    recommendations.push('No Rich Text fields found in the schema.');
  }
  
  // Calculate score
  let score = 100;
  
  // Penalize for absolute URLs (major issue)
  const urlPenalty = Math.min(30, absoluteUrls.reduce((sum, a) => sum + a.count, 0) * 2);
  score -= urlPenalty;
  
  // Penalize for embedded images (moderate issue)
  const imagePenalty = Math.min(20, embeddedImages.reduce((sum, e) => sum + e.count, 0));
  score -= imagePenalty;
  
  // Penalize for static-only links (minor issue)
  if (staticLinks.length > 0 && referenceLinks.length === 0) {
    score -= 10;
  }
  
  // Bonus for using reference-based links
  if (referenceLinks.length > 0) {
    score = Math.min(100, score + 5);
  }
  
  return {
    modelsWithRichText,
    absoluteUrls,
    embeddedImages,
    linkAnalysis: {
      staticLinks,
      referenceLinks,
      ctaPatterns
    },
    recommendations,
    overallScore: Math.max(0, score)
  };
}

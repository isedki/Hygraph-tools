/**
 * System Filters for Hygraph Schema Audit
 * 
 * These functions identify system components, models, and enums that should be
 * excluded from audit analysis. System items are Hygraph-internal types that
 * users don't create or manage directly.
 */

// ============================================
// System Component Detection
// ============================================

// Exact system component names
const SYSTEM_COMPONENTS = new Set([
  'AssetUpload',
  'AssetUploadError',
  'AssetUploadRequestPostData',
  'AssetUploadWhereInput',
  'BatchPayload',
  'Color',
  'ColorInput',
  'ConnectPositionInput',
  'DocumentOutputInput',
  'DocumentTransformationInput',
  'DocumentVersion',
  'ImageResizeInput',
  'ImageTransformationInput',
  'Location',
  'LocationInput',
  'PageInfo',
  'RGBA',
  'RGBAInput',
  'RichText',
  'RichTextAST',
  'Version',
  'VersionWhereInput',
]);

/**
 * Check if a component is a system component that should be excluded from audit
 */
export function isSystemComponent(name: string): boolean {
  // Exact matches
  if (SYSTEM_COMPONENTS.has(name)) return true;

  // Patterns for system components
  if (name.startsWith('Asset') && (
    name.includes('Upload') ||
    name.includes('Transform') ||
    name.includes('Output')
  )) return true;

  // RichText variations (except base RichText which is already in the set)
  if (name.endsWith('RichText') && name !== 'RichText') return true;

  // Input types (auto-generated for mutations)
  if (name.includes('WhereInput')) return true;
  if (name.includes('OrderByInput')) return true;
  if (name.includes('CreateInput')) return true;
  if (name.includes('UpdateInput')) return true;
  if (name.includes('ConnectInput')) return true;
  if (name.includes('UpsertInput')) return true;
  if (name.includes('ManyInlineInput')) return true;

  // System suffixes for auto-generated relation/system types
  const systemSuffixes = [
    'ScheduledRelease',
    'ScheduledOperation',
    'User',
    'Version',
    'Asset',
    'Connection',
    'Edge',
    'Aggregate',
  ];

  for (const suffix of systemSuffixes) {
    if (name === suffix) return true;
    if (name.endsWith(`_${suffix}`)) return true;
    if (name.endsWith(`${suffix}Connection`)) return true;
    if (name.endsWith(`${suffix}Edge`)) return true;
  }

  // Remote field components
  if (name.includes('FromAnotherProject_')) return true;

  return false;
}

// ============================================
// System Enum Detection
// ============================================

// Exact system enum names (Hygraph internal enums)
const SYSTEM_ENUMS = new Set([
  'DocumentFileTypes',
  'ImageFit',
  'Locale',
  'Stage',
  'ScheduledOperationStatus',
  'ScheduledReleaseStatus',
  'SystemDateTimeFieldVariation',
  // Internal Hygraph enums not shown in Schema editor
  'EntityTypeName',
  'UserKind',
  'BatchPayloadType',
  'ColorInput',
  'ConnectPositionInput',
  'DocumentOutputInput',
  'DocumentTransformationInput',
  'ImageResizeInput',
  'ImageTransformationInput',
  'LocationInput',
  'PublishLocaleInput',
  'RGBAInput',
  'RGBAHue',
  'RGBATransparency',
  'UnpublishLocaleInput',
]);

/**
 * Check if an enum is a system enum that should be excluded from audit
 */
export function isSystemEnum(name: string): boolean {
  // Enums starting with underscore are system enums
  if (name.startsWith('_')) return true;

  // Exact system enum matches
  if (SYSTEM_ENUMS.has(name)) return true;

  // Check if ends with _SystemEnumName (remote field enums)
  for (const sysEnum of SYSTEM_ENUMS) {
    if (name.endsWith(`_${sysEnum}`)) return true;
  }

  // Filter out anything ending with "Variation" (system date/time fields)
  if (name.endsWith('Variation')) return true;

  // Filter out remote field enums (prefixed project enums)
  if (name.includes('FromAnotherProject_')) return true;

  // Filter out ordering enums
  if (name.endsWith('OrderByInput')) return true;

  return false;
}

// ============================================
// System Model Detection
// ============================================

// System models that are part of Hygraph's core
const SYSTEM_MODEL_NAMES = new Set([
  'Asset',
  'User',
  'ScheduledOperation',
  'ScheduledRelease',
]);

/**
 * Check if a model is a system model that should be excluded from audit
 * Note: Most models have an `isSystem` flag, but this catches edge cases
 */
export function isSystemModel(name: string): boolean {
  // Core system models
  if (SYSTEM_MODEL_NAMES.has(name)) return true;
  
  // Auto-generated RichText embedded models (e.g., "PageContentRichText", "ArticleBodyRichText")
  // These are created automatically for each RichText field
  if (name.endsWith('RichText') && name.length > 8) return true;
  
  // Auto-generated embedded asset types
  if (name.endsWith('EmbeddedAsset') && name.length > 13) return true;
  
  return false;
}

// ============================================
// Helper Types and Functions
// ============================================

import type { HygraphModel } from '../types';

/**
 * Filter an array of components to exclude system components
 */
export function filterSystemComponents(components: HygraphModel[]): HygraphModel[] {
  return components.filter(c => !isSystemComponent(c.name));
}

/**
 * Filter an array of enums to exclude system enums
 */
export function filterSystemEnums(enums: { name: string; values: string[] }[]): { name: string; values: string[] }[] {
  return enums.filter(e => !isSystemEnum(e.name));
}

/**
 * Filter an array of models to exclude system models
 * Uses both the isSystem flag and name-based detection
 */
export function filterSystemModels(models: HygraphModel[]): HygraphModel[] {
  return models.filter(m => !m.isSystem && !isSystemModel(m.name));
}

import { GraphQLClient } from 'graphql-request';
import type { HygraphModel, DuplicateGroup, DuplicateCheckResult, DuplicateEntry } from '../types';

// Key fields to check for duplicates (in order of priority)
const KEY_FIELD_PATTERNS = [
  /^title$/i,
  /^name$/i,
  /^headline$/i,
  /^heading$/i,
  /^slug$/i,
  /^label$/i,
];

// Maximum entries to fetch for duplicate checking
const MAX_ENTRIES_TO_FETCH = 200;

/**
 * Identify key fields in a model that should be used for duplicate detection
 */
export function identifyKeyFields(model: HygraphModel): string[] {
  const keyFields: string[] = [];
  
  for (const field of model.fields) {
    // Only check string fields
    if (field.type !== 'String') continue;
    
    for (const pattern of KEY_FIELD_PATTERNS) {
      if (pattern.test(field.name)) {
        keyFields.push(field.name);
        break;
      }
    }
  }
  
  // If no key fields found, try to use the first string field
  if (keyFields.length === 0) {
    const firstStringField = model.fields.find(f => f.type === 'String' && !f.isList);
    if (firstStringField) {
      keyFields.push(firstStringField.name);
    }
  }
  
  return keyFields;
}

/**
 * Fetch entries from a model for duplicate checking
 */
export async function fetchEntriesForDuplicateCheck(
  client: GraphQLClient,
  model: HygraphModel,
  keyFields: string[],
  limit: number = MAX_ENTRIES_TO_FETCH
): Promise<DuplicateEntry[]> {
  if (keyFields.length === 0) {
    return [];
  }
  
  try {
    // Build query with key fields
    const fieldsToFetch = ['id', ...keyFields];
    
    const query = `
      query FetchForDuplicates {
        ${model.pluralApiId}(first: ${limit}, stage: DRAFT) {
          ${fieldsToFetch.join('\n          ')}
        }
      }
    `;
    
    const result = await client.request<Record<string, DuplicateEntry[]>>(query);
    return result[model.pluralApiId] || [];
  } catch (error) {
    console.error(`Failed to fetch entries for ${model.name}:`, error);
    return [];
  }
}

/**
 * Normalize a value for comparison (lowercase, trim whitespace)
 */
function normalizeValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value).toLowerCase().trim();
}

/**
 * Create a match key from entry fields
 */
function createMatchKey(entry: DuplicateEntry, keyFields: string[]): string {
  return keyFields
    .map(field => normalizeValue(entry[field]))
    .filter(v => v.length > 0)
    .join('|||');
}

/**
 * Find duplicate groups in a list of entries
 */
export function findDuplicateGroups(
  entries: DuplicateEntry[],
  keyFields: string[]
): DuplicateGroup[] {
  if (entries.length === 0 || keyFields.length === 0) {
    return [];
  }
  
  // Group entries by their match key
  const groups = new Map<string, DuplicateEntry[]>();
  
  for (const entry of entries) {
    const matchKey = createMatchKey(entry, keyFields);
    
    // Skip empty match keys
    if (matchKey.length === 0) continue;
    
    if (!groups.has(matchKey)) {
      groups.set(matchKey, []);
    }
    groups.get(matchKey)!.push(entry);
  }
  
  // Filter to only groups with duplicates (2+ entries)
  const duplicateGroups: DuplicateGroup[] = [];
  
  for (const [matchKey, groupEntries] of groups) {
    if (groupEntries.length >= 2) {
      // Find which fields actually matched (non-empty values)
      const matchedFields = keyFields.filter(field => {
        const values = groupEntries.map(e => normalizeValue(e[field]));
        return values.every(v => v.length > 0 && v === values[0]);
      });
      
      duplicateGroups.push({
        matchKey,
        matchedFields,
        entries: groupEntries,
      });
    }
  }
  
  // Sort by number of duplicates (most first)
  duplicateGroups.sort((a, b) => b.entries.length - a.entries.length);
  
  return duplicateGroups;
}

/**
 * Perform full duplicate check for a model
 */
export async function checkForDuplicates(
  client: GraphQLClient,
  model: HygraphModel
): Promise<DuplicateCheckResult> {
  // Identify key fields to check
  const keyFields = identifyKeyFields(model);
  
  if (keyFields.length === 0) {
    return {
      model: model.name,
      totalEntries: 0,
      duplicateGroups: [],
      analyzedFields: [],
      timestamp: new Date(),
    };
  }
  
  // Fetch entries
  const entries = await fetchEntriesForDuplicateCheck(client, model, keyFields);
  
  // Find duplicates
  const duplicateGroups = findDuplicateGroups(entries, keyFields);
  
  return {
    model: model.name,
    totalEntries: entries.length,
    duplicateGroups,
    analyzedFields: keyFields,
    timestamp: new Date(),
  };
}

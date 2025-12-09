import type { 
  HygraphSchema, 
  RelationshipGraphAnalysis, 
  RelationshipNode, 
  RelationshipEdge,
  RelationshipCluster 
} from '../types';

/**
 * Analyzes schema to build a relationship graph for visualization.
 * Identifies model clusters, hub models, and orphaned models.
 */
export function analyzeRelationshipGraph(
  schema: HygraphSchema,
  entryCounts: Record<string, { draft: number; published: number }>
): RelationshipGraphAnalysis {
  const nodes: RelationshipNode[] = [];
  const edges: RelationshipEdge[] = [];
  const connectionCounts: Record<string, number> = {};

  // Build nodes from models
  for (const model of schema.models) {
    if (model.isSystem) continue;
    
    const entryCount = (entryCounts[model.pluralApiId]?.draft || 0) + 
                       (entryCounts[model.pluralApiId]?.published || 0);
    
    nodes.push({
      id: model.name,
      name: model.name,
      type: 'model',
      entryCount,
      fieldCount: model.fields.length,
      importance: determineNodeImportance(model, entryCount, schema),
      description: inferModelDescription(model),
    });
    
    connectionCounts[model.name] = 0;
  }

  // Build nodes from components (only important ones)
  for (const component of schema.components) {
    const usageCount = countComponentUsage(component.name, schema);
    if (usageCount >= 2) { // Only include components used in 2+ places
      nodes.push({
        id: `comp:${component.name}`,
        name: component.name,
        type: 'component',
        fieldCount: component.fields.length,
        importance: usageCount >= 5 ? 'core' : 'supporting',
        description: `Used in ${usageCount} models`,
      });
    }
  }

  // Build nodes from important enums
  for (const enumDef of schema.enums) {
    const usageCount = countEnumUsage(enumDef.name, schema);
    // Only include enums that are architecture-significant
    if (isArchitecturalEnum(enumDef.name, enumDef.values) || usageCount >= 3) {
      nodes.push({
        id: `enum:${enumDef.name}`,
        name: enumDef.name,
        type: 'enum',
        fieldCount: enumDef.values.length,
        importance: isArchitecturalEnum(enumDef.name, enumDef.values) ? 'core' : 'config',
        description: `${enumDef.values.length} values`,
      });
    }
  }

  // Build edges from model relationships
  for (const model of schema.models) {
    if (model.isSystem) continue;
    
    for (const field of model.fields) {
      if (field.relatedModel && nodes.some(n => n.id === field.relatedModel)) {
        // Check if reverse relation exists (bidirectional)
        const relatedModel = schema.models.find(m => m.name === field.relatedModel);
        const isBidirectional = relatedModel?.fields.some(f => f.relatedModel === model.name);
        
        // Avoid duplicate edges for bidirectional
        const existingEdge = edges.find(e => 
          (e.from === model.name && e.to === field.relatedModel) ||
          (e.from === field.relatedModel && e.to === model.name)
        );
        
        if (!existingEdge) {
          edges.push({
            from: model.name,
            to: field.relatedModel,
            type: isBidirectional ? 'bidirectional' : 'reference',
            fieldName: field.name,
            cardinality: field.isList ? 'one-to-many' : 'one-to-one',
          });
          
          connectionCounts[model.name] = (connectionCounts[model.name] || 0) + 1;
          connectionCounts[field.relatedModel] = (connectionCounts[field.relatedModel] || 0) + 1;
        }
      }
      
      // Component usage edges
      if (field.type && schema.components.some(c => c.name === field.type)) {
        const compNodeId = `comp:${field.type}`;
        if (nodes.some(n => n.id === compNodeId)) {
          const existingEdge = edges.find(e => e.from === model.name && e.to === compNodeId);
          if (!existingEdge) {
            edges.push({
              from: model.name,
              to: compNodeId,
              type: 'component',
              fieldName: field.name,
              cardinality: field.isList ? 'one-to-many' : 'one-to-one',
            });
          }
        }
      }
    }
  }

  // Identify clusters
  const clusters = identifyClusters(nodes, edges, schema);

  // Find core models (high connectivity + high entry count)
  const coreModels = nodes
    .filter(n => n.type === 'model' && (n.importance === 'core' || (connectionCounts[n.id] || 0) >= 3))
    .map(n => n.id);

  // Find orphaned models (no connections, low entry count)
  const orphanedModels = nodes
    .filter(n => n.type === 'model' && 
                 (connectionCounts[n.id] || 0) === 0 && 
                 (n.entryCount || 0) < 5)
    .map(n => n.id);

  // Find hub models (highest connectivity)
  const hubModels = Object.entries(connectionCounts)
    .filter(([, count]) => count >= 3)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([model, connectionCount]) => ({ model, connectionCount }));

  return {
    nodes,
    edges,
    clusters,
    coreModels,
    orphanedModels,
    hubModels,
  };
}

function determineNodeImportance(
  model: HygraphSchema['models'][0],
  entryCount: number,
  schema: HygraphSchema
): RelationshipNode['importance'] {
  const name = model.name.toLowerCase();
  
  // Core content models
  if (/^(page|article|post|product|form|event)s?$/i.test(name) && entryCount > 0) {
    return 'core';
  }
  
  // Config/utility models
  if (/^(seo|setting|config|navigation|menu|footer|header|global)s?$/i.test(name)) {
    return 'config';
  }
  
  // High entry count = important
  if (entryCount > 20) {
    return 'core';
  }
  
  // Referenced by many = important
  const referenceCount = countReferences(model.name, schema);
  if (referenceCount >= 3) {
    return 'core';
  }
  
  if (entryCount > 0 || referenceCount >= 1) {
    return 'supporting';
  }
  
  return 'utility';
}

function inferModelDescription(model: HygraphSchema['models'][0]): string {
  const name = model.name.toLowerCase();
  
  if (/^(page)s?$/i.test(name)) return 'Website pages';
  if (/^(article|post|blog)s?$/i.test(name)) return 'Blog/article content';
  if (/^(product)s?$/i.test(name)) return 'Product catalog';
  if (/^(category|topic|tag)s?$/i.test(name)) return 'Content classification';
  if (/^(author|person|team)s?$/i.test(name)) return 'People/authors';
  if (/^(site|brand|shop)s?$/i.test(name)) return 'Site/brand config';
  if (/^(form)s?$/i.test(name)) return 'Form definitions';
  if (/^(event|session)s?$/i.test(name)) return 'Events';
  if (/^(seo|meta)$/i.test(name)) return 'SEO configuration';
  if (/^(navigation|menu)s?$/i.test(name)) return 'Navigation structure';
  
  return `${model.fields.length} fields`;
}

function countComponentUsage(componentName: string, schema: HygraphSchema): number {
  let count = 0;
  for (const model of schema.models) {
    if (model.fields.some(f => f.type === componentName)) {
      count++;
    }
  }
  return count;
}

function countEnumUsage(enumName: string, schema: HygraphSchema): number {
  let count = 0;
  for (const model of [...schema.models, ...schema.components]) {
    if (model.fields.some(f => f.type === enumName || f.enumValues?.length)) {
      count++;
    }
  }
  return count;
}

function countReferences(modelName: string, schema: HygraphSchema): number {
  let count = 0;
  for (const model of schema.models) {
    if (model.name !== modelName && model.fields.some(f => f.relatedModel === modelName)) {
      count++;
    }
  }
  return count;
}

function isArchitecturalEnum(name: string, values: string[]): boolean {
  return /^(shop|brand|store|site|tenant|region|country|locale)s?$/i.test(name) && values.length > 2;
}

function identifyClusters(
  nodes: RelationshipNode[],
  edges: RelationshipEdge[],
  schema: HygraphSchema
): RelationshipCluster[] {
  const clusters: RelationshipCluster[] = [];

  // Content cluster (pages, articles, posts)
  const contentModels = nodes
    .filter(n => n.type === 'model' && /^(page|article|post|blog|news|story|content)s?$/i.test(n.name))
    .map(n => n.id);
  if (contentModels.length > 0) {
    clusters.push({
      name: 'Content',
      description: 'Primary content models for pages and articles',
      models: contentModels,
      centralModel: contentModels[0],
    });
  }

  // Taxonomy cluster
  const taxonomyModels = nodes
    .filter(n => n.type === 'model' && /^(category|topic|tag|taxonomy|type)s?$/i.test(n.name))
    .map(n => n.id);
  if (taxonomyModels.length > 0) {
    clusters.push({
      name: 'Taxonomy',
      description: 'Content classification and organization',
      models: taxonomyModels,
    });
  }

  // Multi-site/brand cluster
  const multiSiteModels = nodes
    .filter(n => n.type === 'model' && /^(site|brand|shop|store|tenant)s?$/i.test(n.name))
    .map(n => n.id);
  if (multiSiteModels.length > 0) {
    clusters.push({
      name: 'Multi-Site/Brand',
      description: 'Site or brand configuration',
      models: multiSiteModels,
    });
  }

  // People cluster
  const peopleModels = nodes
    .filter(n => n.type === 'model' && /^(author|person|team|member|staff|contributor)s?$/i.test(n.name))
    .map(n => n.id);
  if (peopleModels.length > 0) {
    clusters.push({
      name: 'People',
      description: 'Author and team information',
      models: peopleModels,
    });
  }

  // E-commerce cluster
  const ecommerceModels = nodes
    .filter(n => n.type === 'model' && /^(product|item|order|cart|checkout|payment)s?$/i.test(n.name))
    .map(n => n.id);
  if (ecommerceModels.length > 0) {
    clusters.push({
      name: 'E-Commerce',
      description: 'Product and order management',
      models: ecommerceModels,
    });
  }

  // Forms cluster
  const formModels = nodes
    .filter(n => n.type === 'model' && /^(form|submission|lead|contact)s?$/i.test(n.name))
    .map(n => n.id);
  if (formModels.length > 0) {
    clusters.push({
      name: 'Forms',
      description: 'Form definitions and submissions',
      models: formModels,
    });
  }

  // Config cluster
  const configModels = nodes
    .filter(n => n.type === 'model' && /^(seo|setting|config|navigation|menu|footer|header|global)s?$/i.test(n.name))
    .map(n => n.id);
  if (configModels.length > 0) {
    clusters.push({
      name: 'Configuration',
      description: 'Global settings and navigation',
      models: configModels,
    });
  }

  return clusters;
}




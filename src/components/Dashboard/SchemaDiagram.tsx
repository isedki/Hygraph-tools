'use client';

import { useMemo } from 'react';
import type { AuditResult } from '@/lib/types';

interface SchemaDiagramProps {
  result: AuditResult;
}

interface DiagramNode {
  id: string;
  name: string;
  type: 'model' | 'component' | 'enum' | 'utility';
  entryCount?: number;
  usageCount?: number;
  description?: string;
}

interface DiagramEdge {
  from: string;
  to: string;
  label?: string;
  type: 'reference' | 'contains' | 'uses';
}

const nodeColors = {
  model: { bg: 'bg-blue-500', border: 'border-blue-400', text: 'text-blue-100' },
  component: { bg: 'bg-purple-500', border: 'border-purple-400', text: 'text-purple-100' },
  enum: { bg: 'bg-green-500', border: 'border-green-400', text: 'text-green-100' },
  utility: { bg: 'bg-rose-500', border: 'border-rose-400', text: 'text-rose-100' },
};

export default function SchemaDiagram({ result }: SchemaDiagramProps) {
  const { essentialNodes, edges } = useMemo(() => {
    const nodes: DiagramNode[] = [];
    const edges: DiagramEdge[] = [];
    
    // Track reference counts for models
    const modelReferenceCount: Record<string, number> = {};
    const componentUsageCount: Record<string, number> = {};
    
    // Count references to each model
    result.contentStrategy.modelUsage.activeModels.forEach(model => {
      modelReferenceCount[model.name] = model.entryCount || 0;
    });
    
    // Find models that are referenced by other models
    result.schema.twoWayReferences.forEach(([a, b]) => {
      modelReferenceCount[a] = (modelReferenceCount[a] || 0) + 1;
      modelReferenceCount[b] = (modelReferenceCount[b] || 0) + 1;
    });
    
    // Count component usage
    result.contentStrategy.componentStrategy.wellDesigned.forEach(comp => {
      const match = comp.match(/^(.+) \(used in (\d+) models\)$/);
      if (match) {
        componentUsageCount[match[1]] = parseInt(match[2]);
      }
    });
    
    // Determine essential models (have entries or are referenced by 2+ models)
    const essentialModelNames = new Set<string>();
    result.contentStrategy.modelUsage.activeModels.forEach(model => {
      if (model.entryCount > 0 || (modelReferenceCount[model.name] || 0) >= 2) {
        essentialModelNames.add(model.name);
      }
    });
    
    // Identify utility/config models (SEO, Settings, Config patterns)
    const utilityPatterns = /^(seo|settings|config|navigation|menu|footer|header|global)/i;
    const pagePatterns = /^(page|landing|home|about|contact)/i;
    
    // Add essential models to nodes
    essentialModelNames.forEach(name => {
      const model = result.contentStrategy.modelUsage.activeModels.find(m => m.name === name);
      let type: DiagramNode['type'] = 'model';
      
      if (utilityPatterns.test(name)) {
        type = 'utility';
      }
      
      nodes.push({
        id: name,
        name,
        type,
        entryCount: model?.entryCount || 0,
        description: model?.usage,
      });
    });
    
    // Add key components (used in 3+ places)
    Object.entries(componentUsageCount).forEach(([name, count]) => {
      if (count >= 2) {
        nodes.push({
          id: `comp-${name}`,
          name,
          type: 'component',
          usageCount: count,
        });
      }
    });
    
    // Add important enums (those that suggest architecture patterns)
    const architectureEnums = result.architecture.enumAnalysis.enumsAsPageTypes || [];
    const importantEnumPatterns = /^(shop|brand|tenant|region|country|locale|site|type|status|category)/i;
    
    result.schema.enumCount > 0 && result.contentStrategy.detectedArchitecture.signals.forEach(signal => {
      const enumMatch = signal.match(/Enum "([^"]+)"/);
      if (enumMatch && importantEnumPatterns.test(enumMatch[1])) {
        if (!nodes.find(n => n.id === `enum-${enumMatch[1]}`)) {
          nodes.push({
            id: `enum-${enumMatch[1]}`,
            name: enumMatch[1],
            type: 'enum',
          });
        }
      }
    });
    
    // Create edges based on two-way references (only for essential models)
    result.schema.twoWayReferences.forEach(([a, b]) => {
      if (essentialModelNames.has(a) && essentialModelNames.has(b)) {
        edges.push({
          from: a,
          to: b,
          type: 'reference',
        });
      }
    });
    
    // Limit to top nodes for readability
    const sortedNodes = nodes.sort((a, b) => {
      // Prioritize by entry count, then usage count
      const aScore = (a.entryCount || 0) + (a.usageCount || 0) * 10;
      const bScore = (b.entryCount || 0) + (b.usageCount || 0) * 10;
      return bScore - aScore;
    });
    
    return {
      essentialNodes: sortedNodes.slice(0, 15),
      edges: edges.filter(e => 
        sortedNodes.slice(0, 15).some(n => n.id === e.from) &&
        sortedNodes.slice(0, 15).some(n => n.id === e.to)
      ),
    };
  }, [result]);

  // Group nodes by type for layout
  const groupedNodes = useMemo(() => {
    const models = essentialNodes.filter(n => n.type === 'model');
    const components = essentialNodes.filter(n => n.type === 'component');
    const enums = essentialNodes.filter(n => n.type === 'enum');
    const utilities = essentialNodes.filter(n => n.type === 'utility');
    return { models, components, enums, utilities };
  }, [essentialNodes]);

  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="font-semibold text-lg">Schema Structure</h3>
          <p className="text-sm text-muted-foreground">Essential models and their relationships</p>
        </div>
        
        {/* Legend */}
        <div className="flex gap-4 text-xs">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-blue-500"></div>
            <span className="text-muted-foreground">Models</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-purple-500"></div>
            <span className="text-muted-foreground">Components</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-green-500"></div>
            <span className="text-muted-foreground">Enums</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-rose-500"></div>
            <span className="text-muted-foreground">Utilities</span>
          </div>
        </div>
      </div>
      
      {/* Diagram Layout */}
      <div className="space-y-6">
        {/* Content Models Row */}
        {groupedNodes.models.length > 0 && (
          <div>
            <div className="text-xs text-muted-foreground mb-2 uppercase tracking-wider">Content Models</div>
            <div className="flex flex-wrap gap-3">
              {groupedNodes.models.map(node => (
                <div 
                  key={node.id}
                  className={`px-4 py-2 rounded-lg ${nodeColors.model.bg} ${nodeColors.model.text} shadow-lg`}
                >
                  <div className="font-medium text-sm">{node.name}</div>
                  {node.entryCount !== undefined && node.entryCount > 0 && (
                    <div className="text-xs opacity-80">{node.entryCount} entries</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* Components Row */}
        {groupedNodes.components.length > 0 && (
          <div>
            <div className="text-xs text-muted-foreground mb-2 uppercase tracking-wider">Reusable Components</div>
            <div className="flex flex-wrap gap-3">
              {groupedNodes.components.map(node => (
                <div 
                  key={node.id}
                  className={`px-4 py-2 rounded-lg ${nodeColors.component.bg} ${nodeColors.component.text} shadow-lg`}
                >
                  <div className="font-medium text-sm">{node.name}</div>
                  {node.usageCount !== undefined && (
                    <div className="text-xs opacity-80">used in {node.usageCount} models</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* Utilities Row */}
        {groupedNodes.utilities.length > 0 && (
          <div>
            <div className="text-xs text-muted-foreground mb-2 uppercase tracking-wider">Config & Utilities</div>
            <div className="flex flex-wrap gap-3">
              {groupedNodes.utilities.map(node => (
                <div 
                  key={node.id}
                  className={`px-4 py-2 rounded-lg ${nodeColors.utility.bg} ${nodeColors.utility.text} shadow-lg`}
                >
                  <div className="font-medium text-sm">{node.name}</div>
                  {node.entryCount !== undefined && node.entryCount > 0 && (
                    <div className="text-xs opacity-80">{node.entryCount} entries</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* Enums Row */}
        {groupedNodes.enums.length > 0 && (
          <div>
            <div className="text-xs text-muted-foreground mb-2 uppercase tracking-wider">Key Enumerations</div>
            <div className="flex flex-wrap gap-3">
              {groupedNodes.enums.map(node => (
                <div 
                  key={node.id}
                  className={`px-4 py-2 rounded-lg ${nodeColors.enum.bg} ${nodeColors.enum.text} shadow-lg`}
                >
                  <div className="font-medium text-sm">{node.name}</div>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* Relationships Summary */}
        {edges.length > 0 && (
          <div className="mt-4 pt-4 border-t border-border">
            <div className="text-xs text-muted-foreground mb-2 uppercase tracking-wider">Key Relationships</div>
            <div className="flex flex-wrap gap-2">
              {edges.map((edge, i) => (
                <div key={i} className="flex items-center gap-1 text-xs bg-card/50 px-2 py-1 rounded">
                  <span className="text-blue-400">{edge.from}</span>
                  <span className="text-muted-foreground">↔</span>
                  <span className="text-blue-400">{edge.to}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      
      {essentialNodes.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          <p>No essential models detected. Run the audit to see the schema structure.</p>
        </div>
      )}
    </div>
  );
}




'use client';

import { useMemo } from 'react';
import type { HygraphSchema } from '@/lib/types';

interface ComponentHeatmapProps {
  schema: HygraphSchema;
  usageData: Map<string, { count: number; models: string[]; entries: { id: string; model: string }[] }>;
  onSelectElement: (name: string, type: 'component' | 'enum') => void;
}

export default function ComponentHeatmap({ schema, usageData, onSelectElement }: ComponentHeatmapProps) {
  // Build heatmap data
  const heatmapData = useMemo(() => {
    const models = schema.models.map(m => m.name).sort();
    const components = schema.components
      .filter(c => !c.name.includes('WhereInput') && !c.name.includes('OrderByInput'))
      .map(c => c.name)
      .sort();

    // Build usage matrix
    const matrix: Record<string, Record<string, number>> = {};
    
    for (const component of components) {
      matrix[component] = {};
      for (const model of models) {
        matrix[component][model] = 0;
      }
    }

    // Fill in usage data
    for (const component of components) {
      const data = usageData.get(component);
      if (data) {
        for (const entry of data.entries) {
          if (matrix[component][entry.model] !== undefined) {
            matrix[component][entry.model]++;
          }
        }
      }
    }

    // Get max value for color scaling
    let maxValue = 0;
    for (const component of components) {
      for (const model of models) {
        maxValue = Math.max(maxValue, matrix[component][model]);
      }
    }

    return { models, components, matrix, maxValue };
  }, [schema, usageData]);

  const getHeatColor = (value: number, max: number) => {
    if (value === 0) return 'bg-card';
    const intensity = Math.min(value / Math.max(max, 1), 1);
    if (intensity < 0.25) return 'bg-purple-500/20';
    if (intensity < 0.5) return 'bg-purple-500/40';
    if (intensity < 0.75) return 'bg-purple-500/60';
    return 'bg-purple-500/80';
  };

  if (heatmapData.components.length === 0 || heatmapData.models.length === 0) {
    return (
      <div className="card text-center py-12">
        <p className="text-muted-foreground">No data available for heatmap</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Component Usage Heatmap</h3>
          <p className="text-sm text-muted-foreground">
            Shows which components are used in which models
          </p>
        </div>
        
        {/* Legend */}
        <div className="flex items-center gap-2 text-xs">
          <span className="text-muted-foreground">Usage:</span>
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 rounded bg-card border border-border" title="0" />
            <div className="w-4 h-4 rounded bg-purple-500/20" title="Low" />
            <div className="w-4 h-4 rounded bg-purple-500/40" title="Medium" />
            <div className="w-4 h-4 rounded bg-purple-500/60" title="High" />
            <div className="w-4 h-4 rounded bg-purple-500/80" title="Very High" />
          </div>
        </div>
      </div>

      <div className="card overflow-auto max-h-[600px]">
        <table className="w-full border-collapse">
          <thead className="sticky top-0 bg-card z-10">
            <tr>
              <th className="p-2 text-left text-xs font-medium text-muted-foreground border-b border-border min-w-[150px]">
                Component
              </th>
              {heatmapData.models.map(model => (
                <th 
                  key={model}
                  className="p-2 text-center text-xs font-medium text-muted-foreground border-b border-border"
                  style={{ writingMode: 'vertical-rl', minWidth: '40px', height: '120px' }}
                >
                  <span className="transform rotate-180">{model}</span>
                </th>
              ))}
              <th className="p-2 text-center text-xs font-medium text-muted-foreground border-b border-border min-w-[60px]">
                Total
              </th>
            </tr>
          </thead>
          <tbody>
            {heatmapData.components.map(component => {
              const rowTotal = heatmapData.models.reduce(
                (sum, model) => sum + heatmapData.matrix[component][model],
                0
              );
              
              return (
                <tr key={component} className="hover:bg-card/50">
                  <td 
                    className="p-2 text-sm font-medium border-b border-border/50 cursor-pointer hover:text-purple-400"
                    onClick={() => onSelectElement(component, 'component')}
                  >
                    {component}
                  </td>
                  {heatmapData.models.map(model => {
                    const value = heatmapData.matrix[component][model];
                    return (
                      <td 
                        key={model}
                        className={`p-2 text-center border-b border-border/50 ${getHeatColor(value, heatmapData.maxValue)}`}
                        title={`${component} in ${model}: ${value}`}
                      >
                        {value > 0 && (
                          <span className="text-xs font-mono">{value}</span>
                        )}
                      </td>
                    );
                  })}
                  <td className={`p-2 text-center text-xs font-mono border-b border-border/50 ${
                    rowTotal > 0 ? 'text-green-400' : 'text-red-400'
                  }`}>
                    {rowTotal}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}



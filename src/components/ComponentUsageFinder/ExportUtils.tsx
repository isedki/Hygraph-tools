'use client';

import type { HygraphSchema } from '@/lib/types';

interface ExportData {
  schema: HygraphSchema;
  usageData: Map<string, { count: number; models: string[]; entries: { id: string; model: string; createdAt?: string }[] }>;
}

export function exportToCSV(data: ExportData): void {
  const rows: string[][] = [];
  
  // Header
  rows.push(['Element Name', 'Type', 'Total Usages', 'Used In Models', 'Status', 'Entry IDs']);
  
  // Components
  for (const component of data.schema.components) {
    const usage = data.usageData.get(component.name);
    rows.push([
      component.name,
      'Component',
      String(usage?.count || 0),
      usage?.models.join('; ') || '',
      usage && usage.count > 0 ? 'Active' : 'Unused',
      usage?.entries.map(e => e.id).join('; ') || '',
    ]);
  }
  
  // Enums
  for (const enumDef of data.schema.enums) {
    if (enumDef.name.startsWith('_')) continue;
    const usage = data.usageData.get(enumDef.name);
    rows.push([
      enumDef.name,
      'Enum',
      String(usage?.count || 0),
      usage?.models.join('; ') || '',
      usage && usage.count > 0 ? 'Active' : 'Unused',
      usage?.entries.map(e => e.id).join('; ') || '',
    ]);
  }
  
  // Convert to CSV string
  const csvContent = rows.map(row => 
    row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(',')
  ).join('\n');
  
  // Download
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `hygraph-component-usage-${new Date().toISOString().split('T')[0]}.csv`;
  link.click();
}

export function exportToJSON(data: ExportData): void {
  const exportObj = {
    exportDate: new Date().toISOString(),
    summary: {
      totalComponents: data.schema.components.length,
      totalEnums: data.schema.enums.filter(e => !e.name.startsWith('_')).length,
      totalModels: data.schema.models.length,
    },
    components: data.schema.components.map(c => {
      const usage = data.usageData.get(c.name);
      return {
        name: c.name,
        fieldCount: c.fields.length,
        usageCount: usage?.count || 0,
        usedInModels: usage?.models || [],
        isUnused: !usage || usage.count === 0,
        entries: usage?.entries || [],
      };
    }),
    enums: data.schema.enums
      .filter(e => !e.name.startsWith('_'))
      .map(e => {
        const usage = data.usageData.get(e.name);
        return {
          name: e.name,
          values: e.values,
          usageCount: usage?.count || 0,
          usedInModels: usage?.models || [],
          isUnused: !usage || usage.count === 0,
          entries: usage?.entries || [],
        };
      }),
    models: data.schema.models.map(m => ({
      name: m.name,
      fieldCount: m.fields.length,
      fields: m.fields.map(f => ({
        name: f.name,
        type: f.type,
        relatedModel: f.relatedModel,
        isRequired: f.isRequired,
        isList: f.isList,
      })),
    })),
  };
  
  const jsonContent = JSON.stringify(exportObj, null, 2);
  const blob = new Blob([jsonContent], { type: 'application/json' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `hygraph-schema-usage-${new Date().toISOString().split('T')[0]}.json`;
  link.click();
}

interface ExportButtonsProps {
  schema: HygraphSchema;
  usageData: Map<string, { count: number; models: string[]; entries: { id: string; model: string; createdAt?: string }[] }>;
}

export default function ExportButtons({ schema, usageData }: ExportButtonsProps) {
  return (
    <div className="flex gap-2">
      <button
        onClick={() => exportToCSV({ schema, usageData })}
        className="btn-secondary flex items-center gap-2 text-sm"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        Export CSV
      </button>
      <button
        onClick={() => exportToJSON({ schema, usageData })}
        className="btn-secondary flex items-center gap-2 text-sm"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        Export JSON
      </button>
    </div>
  );
}


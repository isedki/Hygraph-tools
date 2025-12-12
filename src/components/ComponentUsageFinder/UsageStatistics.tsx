'use client';

import { useState, useMemo } from 'react';
import type { HygraphSchema, HygraphModel } from '@/lib/types';

interface ComponentUsageStat {
  name: string;
  type: 'component' | 'enum';
  totalUsages: number;
  usedInModels: string[];
  isUnused: boolean;
}

interface UsageStatisticsProps {
  schema: HygraphSchema;
  usageData: Map<string, { count: number; models: string[]; entries: { id: string; model: string; createdAt?: string }[] }>;
  onSelectElement: (name: string, type: 'component' | 'enum') => void;
}

export default function UsageStatistics({ schema, usageData, onSelectElement }: UsageStatisticsProps) {
  const [sortBy, setSortBy] = useState<'name' | 'usage' | 'unused'>('usage');
  const [showType, setShowType] = useState<'all' | 'components' | 'enums'>('all');

  // Build statistics
  const stats = useMemo(() => {
    const allStats: ComponentUsageStat[] = [];

    // Components
    for (const component of schema.components) {
      const data = usageData.get(component.name);
      allStats.push({
        name: component.name,
        type: 'component',
        totalUsages: data?.count || 0,
        usedInModels: data?.models || [],
        isUnused: !data || data.count === 0,
      });
    }

    // Enums (filter out system enums)
    for (const enumDef of schema.enums) {
      if (enumDef.name.startsWith('_')) continue;
      const data = usageData.get(enumDef.name);
      allStats.push({
        name: enumDef.name,
        type: 'enum',
        totalUsages: data?.count || 0,
        usedInModels: data?.models || [],
        isUnused: !data || data.count === 0,
      });
    }

    return allStats;
  }, [schema, usageData]);

  // Filter and sort
  const filteredStats = useMemo(() => {
    let filtered = stats;

    if (showType === 'components') {
      filtered = filtered.filter(s => s.type === 'component');
    } else if (showType === 'enums') {
      filtered = filtered.filter(s => s.type === 'enum');
    }

    if (sortBy === 'name') {
      filtered = [...filtered].sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortBy === 'usage') {
      filtered = [...filtered].sort((a, b) => b.totalUsages - a.totalUsages);
    } else if (sortBy === 'unused') {
      filtered = [...filtered].sort((a, b) => {
        if (a.isUnused && !b.isUnused) return -1;
        if (!a.isUnused && b.isUnused) return 1;
        return a.name.localeCompare(b.name);
      });
    }

    return filtered;
  }, [stats, showType, sortBy]);

  // Summary stats
  const summary = useMemo(() => {
    const total = stats.length;
    const unused = stats.filter(s => s.isUnused).length;
    const totalUsages = stats.reduce((sum, s) => sum + s.totalUsages, 0);
    const mostUsed = [...stats].sort((a, b) => b.totalUsages - a.totalUsages)[0];
    
    return { total, unused, totalUsages, mostUsed };
  }, [stats]);

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4">
        <div className="card p-4">
          <p className="text-xs text-muted-foreground mb-1">Total Elements</p>
          <p className="text-2xl font-bold">{summary.total}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-muted-foreground mb-1">Total Usages</p>
          <p className="text-2xl font-bold text-green-400">{summary.totalUsages}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-muted-foreground mb-1">Unused</p>
          <p className="text-2xl font-bold text-red-400">{summary.unused}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-muted-foreground mb-1">Most Used</p>
          <p className="text-lg font-bold text-purple-400 truncate">{summary.mostUsed?.name || '-'}</p>
          <p className="text-xs text-muted-foreground">{summary.mostUsed?.totalUsages || 0} usages</p>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          {(['all', 'components', 'enums'] as const).map(type => (
            <button
              key={type}
              onClick={() => setShowType(type)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                showType === type
                  ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                  : 'bg-card border border-border text-muted-foreground hover:text-foreground'
              }`}
            >
              {type === 'all' ? 'All' : type.charAt(0).toUpperCase() + type.slice(1)}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Sort by:</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            className="bg-card border border-border rounded-lg px-2 py-1 text-sm"
          >
            <option value="usage">Most Used</option>
            <option value="name">Name</option>
            <option value="unused">Unused First</option>
          </select>
        </div>
      </div>

      {/* Stats Table */}
      <div className="card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left p-3 text-xs font-medium text-muted-foreground">Element</th>
              <th className="text-left p-3 text-xs font-medium text-muted-foreground">Type</th>
              <th className="text-right p-3 text-xs font-medium text-muted-foreground">Usages</th>
              <th className="text-left p-3 text-xs font-medium text-muted-foreground">Used In</th>
              <th className="text-center p-3 text-xs font-medium text-muted-foreground">Status</th>
            </tr>
          </thead>
          <tbody>
            {filteredStats.map((stat) => (
              <tr 
                key={`${stat.type}-${stat.name}`}
                className={`border-b border-border/50 hover:bg-card/50 cursor-pointer transition-colors ${
                  stat.isUnused ? 'bg-red-500/5' : ''
                }`}
                onClick={() => onSelectElement(stat.name, stat.type)}
              >
                <td className="p-3">
                  <span className="font-medium">{stat.name}</span>
                </td>
                <td className="p-3">
                  <span className={`px-2 py-0.5 rounded text-xs ${
                    stat.type === 'component' 
                      ? 'bg-purple-500/10 text-purple-400'
                      : 'bg-cyan-500/10 text-cyan-400'
                  }`}>
                    {stat.type}
                  </span>
                </td>
                <td className="p-3 text-right">
                  <span className={`font-mono ${stat.totalUsages > 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {stat.totalUsages}
                  </span>
                </td>
                <td className="p-3">
                  <div className="flex flex-wrap gap-1">
                    {stat.usedInModels.slice(0, 3).map(model => (
                      <span key={model} className="px-1.5 py-0.5 rounded bg-card border border-border text-xs">
                        {model}
                      </span>
                    ))}
                    {stat.usedInModels.length > 3 && (
                      <span className="text-xs text-muted-foreground">
                        +{stat.usedInModels.length - 3} more
                      </span>
                    )}
                    {stat.usedInModels.length === 0 && (
                      <span className="text-xs text-muted-foreground italic">None</span>
                    )}
                  </div>
                </td>
                <td className="p-3 text-center">
                  {stat.isUnused ? (
                    <span className="px-2 py-0.5 rounded bg-red-500/10 text-red-400 text-xs font-medium">
                      Unused
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded bg-green-500/10 text-green-400 text-xs font-medium">
                      Active
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}




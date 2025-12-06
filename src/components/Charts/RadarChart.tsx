'use client';

import {
  Radar,
  RadarChart as RechartsRadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import type { CategoryScore } from '@/lib/types';

interface RadarChartProps {
  data: CategoryScore[];
}

const categoryLabels: Record<string, string> = {
  schema: 'Schema',
  component: 'Components',
  content: 'Content',
  editorial: 'Editorial',
  seo: 'SEO',
  performance: 'Performance',
  'best-practices': 'Best Practices',
};

export default function RadarChart({ data }: RadarChartProps) {
  const chartData = data.map((item) => ({
    category: categoryLabels[item.category] || item.category,
    score: item.score,
    fullMark: 100,
  }));

  return (
    <ResponsiveContainer width="100%" height={350}>
      <RechartsRadarChart cx="50%" cy="50%" outerRadius="75%" data={chartData}>
        <PolarGrid 
          stroke="var(--border)" 
          strokeDasharray="3 3"
        />
        <PolarAngleAxis 
          dataKey="category" 
          tick={{ 
            fill: 'var(--muted)', 
            fontSize: 12,
            fontWeight: 500,
          }}
          tickLine={false}
        />
        <PolarRadiusAxis 
          angle={30} 
          domain={[0, 100]} 
          tick={{ fill: 'var(--muted-foreground)', fontSize: 10 }}
          tickCount={5}
          axisLine={false}
        />
        <Radar
          name="Score"
          dataKey="score"
          stroke="#8b5cf6"
          fill="#8b5cf6"
          fillOpacity={0.25}
          strokeWidth={2}
          dot={{
            fill: '#8b5cf6',
            strokeWidth: 2,
            r: 4,
          }}
          activeDot={{
            fill: '#a78bfa',
            strokeWidth: 0,
            r: 6,
          }}
        />
        <Tooltip
          contentStyle={{
            background: 'var(--card)',
            border: '1px solid var(--border)',
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
          }}
          labelStyle={{ color: 'var(--foreground)', fontWeight: 600 }}
          itemStyle={{ color: 'var(--muted)' }}
          formatter={(value: number) => [`${value}/100`, 'Score']}
        />
      </RechartsRadarChart>
    </ResponsiveContainer>
  );
}



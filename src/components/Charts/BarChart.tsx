'use client';

import {
  BarChart as RechartsBarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';

interface BarChartProps {
  data: { name: string; value: number; color?: string }[];
  dataKey?: string;
  xAxisKey?: string;
  height?: number;
  showGrid?: boolean;
  horizontal?: boolean;
}

const defaultColors = [
  '#8b5cf6',
  '#06b6d4',
  '#10b981',
  '#f59e0b',
  '#ef4444',
  '#ec4899',
  '#6366f1',
];

export default function BarChart({ 
  data, 
  dataKey = 'value',
  xAxisKey = 'name',
  height = 300,
  showGrid = true,
  horizontal = false,
}: BarChartProps) {
  if (horizontal) {
    return (
      <ResponsiveContainer width="100%" height={height}>
        <RechartsBarChart 
          data={data} 
          layout="vertical"
          margin={{ top: 5, right: 30, left: 80, bottom: 5 }}
        >
          {showGrid && (
            <CartesianGrid 
              strokeDasharray="3 3" 
              stroke="var(--border)" 
              horizontal={true}
              vertical={false}
            />
          )}
          <XAxis 
            type="number"
            tick={{ fill: 'var(--muted)', fontSize: 12 }}
            axisLine={{ stroke: 'var(--border)' }}
            tickLine={{ stroke: 'var(--border)' }}
          />
          <YAxis 
            type="category"
            dataKey={xAxisKey}
            tick={{ fill: 'var(--muted)', fontSize: 12 }}
            axisLine={{ stroke: 'var(--border)' }}
            tickLine={false}
            width={75}
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
            cursor={{ fill: 'rgba(139, 92, 246, 0.1)' }}
          />
          <Bar 
            dataKey={dataKey} 
            radius={[0, 4, 4, 0]}
            maxBarSize={30}
          >
            {data.map((entry, index) => (
              <Cell 
                key={`cell-${index}`} 
                fill={entry.color || defaultColors[index % defaultColors.length]} 
              />
            ))}
          </Bar>
        </RechartsBarChart>
      </ResponsiveContainer>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <RechartsBarChart 
        data={data}
        margin={{ top: 5, right: 30, left: 20, bottom: 60 }}
      >
        {showGrid && (
          <CartesianGrid 
            strokeDasharray="3 3" 
            stroke="var(--border)" 
            vertical={false}
          />
        )}
        <XAxis 
          dataKey={xAxisKey}
          tick={{ fill: 'var(--muted)', fontSize: 11 }}
          axisLine={{ stroke: 'var(--border)' }}
          tickLine={{ stroke: 'var(--border)' }}
          angle={-45}
          textAnchor="end"
          height={60}
          interval={0}
        />
        <YAxis 
          tick={{ fill: 'var(--muted)', fontSize: 12 }}
          axisLine={{ stroke: 'var(--border)' }}
          tickLine={false}
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
          cursor={{ fill: 'rgba(139, 92, 246, 0.1)' }}
        />
        <Bar 
          dataKey={dataKey} 
          radius={[4, 4, 0, 0]}
          maxBarSize={50}
        >
          {data.map((entry, index) => (
            <Cell 
              key={`cell-${index}`} 
              fill={entry.color || defaultColors[index % defaultColors.length]} 
            />
          ))}
        </Bar>
      </RechartsBarChart>
    </ResponsiveContainer>
  );
}



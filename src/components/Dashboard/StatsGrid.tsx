'use client';

interface Stat {
  label: string;
  value: string | number;
  subValue?: string;
  icon: React.ReactNode;
  color?: string;
}

interface StatsGridProps {
  stats: Stat[];
}

export default function StatsGrid({ stats }: StatsGridProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {stats.map((stat, index) => (
        <div 
          key={stat.label}
          className="card p-4 animate-fade-in"
          style={{ animationDelay: `${index * 0.05}s` }}
        >
          <div className="flex items-start justify-between mb-3">
            <div 
              className="p-2 rounded-lg"
              style={{ 
                backgroundColor: stat.color ? `${stat.color}15` : 'rgba(139, 92, 246, 0.15)',
              }}
            >
              <span style={{ color: stat.color || '#8b5cf6' }}>
                {stat.icon}
              </span>
            </div>
          </div>
          <div className="text-2xl font-bold mb-1">{stat.value}</div>
          <div className="text-sm text-muted-foreground">{stat.label}</div>
          {stat.subValue && (
            <div className="text-xs text-muted mt-1">{stat.subValue}</div>
          )}
        </div>
      ))}
    </div>
  );
}

export function StatCard({ stat }: { stat: Stat }) {
  return (
    <div className="card p-4">
      <div className="flex items-center gap-3">
        <div 
          className="p-2 rounded-lg"
          style={{ 
            backgroundColor: stat.color ? `${stat.color}15` : 'rgba(139, 92, 246, 0.15)',
          }}
        >
          <span style={{ color: stat.color || '#8b5cf6' }}>
            {stat.icon}
          </span>
        </div>
        <div>
          <div className="text-lg font-bold">{stat.value}</div>
          <div className="text-sm text-muted-foreground">{stat.label}</div>
        </div>
      </div>
    </div>
  );
}




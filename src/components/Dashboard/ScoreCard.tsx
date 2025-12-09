'use client';

interface ScoreCardProps {
  score: number;
  label: string;
  size?: 'sm' | 'md' | 'lg';
  showTrend?: boolean;
}

function getScoreColor(score: number): string {
  if (score >= 90) return 'var(--score-excellent)';
  if (score >= 75) return 'var(--score-good)';
  if (score >= 60) return 'var(--score-fair)';
  if (score >= 40) return 'var(--score-poor)';
  return 'var(--score-critical)';
}

function getScoreClass(score: number): string {
  if (score >= 90) return 'score-excellent';
  if (score >= 75) return 'score-good';
  if (score >= 60) return 'score-fair';
  if (score >= 40) return 'score-poor';
  return 'score-critical';
}

function getScoreLabel(score: number): string {
  if (score >= 90) return 'Excellent';
  if (score >= 75) return 'Good';
  if (score >= 60) return 'Fair';
  if (score >= 40) return 'Needs Work';
  return 'Critical';
}

export default function ScoreCard({ score, label, size = 'md', showTrend }: ScoreCardProps) {
  const dimensions = {
    sm: { size: 80, stroke: 6, fontSize: 'text-xl' },
    md: { size: 120, stroke: 8, fontSize: 'text-3xl' },
    lg: { size: 180, stroke: 10, fontSize: 'text-5xl' },
  };

  const { size: circleSize, stroke, fontSize } = dimensions[size];
  const radius = (circleSize - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const color = getScoreColor(score);

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative" style={{ width: circleSize, height: circleSize }}>
        {/* Background circle */}
        <svg 
          className="transform -rotate-90" 
          width={circleSize} 
          height={circleSize}
        >
          <circle
            cx={circleSize / 2}
            cy={circleSize / 2}
            r={radius}
            fill="none"
            stroke="var(--border)"
            strokeWidth={stroke}
          />
          <circle
            cx={circleSize / 2}
            cy={circleSize / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            style={{
              transition: 'stroke-dashoffset 1s ease-out, stroke 0.3s',
            }}
          />
        </svg>
        
        {/* Score number */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`font-bold ${fontSize}`} style={{ color }}>
            {score}
          </span>
          {size === 'lg' && (
            <span className={`text-xs mt-1 px-2 py-0.5 rounded-full ${getScoreClass(score)}`}>
              {getScoreLabel(score)}
            </span>
          )}
        </div>
      </div>
      
      <span className="text-sm text-muted font-medium">{label}</span>
      
      {showTrend && (
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <span className="text-green-500">↑</span>
          <span>vs baseline</span>
        </div>
      )}
    </div>
  );
}

export function ScoreCardCompact({ score, label }: { score: number; label: string }) {
  const color = getScoreColor(score);
  
  return (
    <div className="flex items-center justify-between p-4 rounded-lg bg-card border border-border hover:border-muted transition-colors">
      <span className="text-sm font-medium">{label}</span>
      <div className="flex items-center gap-2">
        <div 
          className="w-2 h-2 rounded-full"
          style={{ backgroundColor: color }}
        />
        <span className="font-bold" style={{ color }}>{score}</span>
      </div>
    </div>
  );
}




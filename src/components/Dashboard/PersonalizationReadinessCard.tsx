'use client';

import type { PersonalizationReadiness } from '@/lib/types';

interface PersonalizationReadinessCardProps {
  readiness: PersonalizationReadiness;
}

const capabilityIcons: Record<keyof PersonalizationReadiness['capabilities'], string> = {
  audienceSegmentation: '🎯',
  contextualContent: '🧭',
  abTesting: '🧪',
  dynamicContent: '🧩',
};

export default function PersonalizationReadinessCard({ readiness }: PersonalizationReadinessCardProps) {
  return (
    <section className="rounded-xl border border-border bg-card p-6">
      <header className="flex flex-col gap-2 mb-4">
        <div className="flex items-center gap-2">
          <span className="text-xs uppercase tracking-wide text-muted-foreground">Personalization</span>
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400">
            {readiness.level}
          </span>
        </div>
        <p className="text-sm text-muted-foreground">{readiness.narrative}</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
        {Object.entries(readiness.capabilities).map(([key, capability]) => (
          <div
            key={key}
            className={`p-3 rounded-lg border ${
              capability.ready ? 'border-emerald-500/40 bg-emerald-500/5' : 'border-border/60 bg-background/60'
            }`}
          >
            <div className="flex items-center gap-2">
              <span>{capabilityIcons[key as keyof typeof capabilityIcons]}</span>
              <div className="flex-1">
                <div className="text-sm font-medium capitalize">
                  {formatCapabilityName(key)}
                </div>
                <div className="text-xs text-muted-foreground">
                  {capability.ready ? 'Enabled' : 'Gap'}
                </div>
              </div>
              <span className={`text-xs font-semibold ${capability.ready ? 'text-emerald-500' : 'text-amber-500'}`}>
                {capability.ready ? 'Ready' : 'Add'}
              </span>
            </div>
            {capability.fields.length > 0 && (
              <p className="text-xs text-muted-foreground mt-2 truncate">
                {capability.fields.slice(0, 3).join(', ')}
              </p>
            )}
          </div>
        ))}
      </div>

      {readiness.enablers.length > 0 && (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 mb-4">
          <h4 className="text-xs uppercase tracking-wide text-emerald-400 mb-2">Enablers</h4>
          <ul className="text-sm text-emerald-50 space-y-1">
            {readiness.enablers.map((enabler, index) => (
              <li key={index} className="flex items-start gap-2 text-emerald-100">
                <span>✓</span>
                <span>{enabler}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {readiness.gaps.length > 0 && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 mb-4">
          <h4 className="text-xs uppercase tracking-wide text-amber-500 mb-2">Gaps</h4>
          <ul className="text-sm text-muted-foreground space-y-1">
            {readiness.gaps.map((gap, index) => (
              <li key={index} className="flex items-start gap-2">
                <span className="text-amber-500 mt-1">•</span>
                <span>{gap}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="rounded-lg border border-border/70 p-3">
        <h4 className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Implementation path</h4>
        <ul className="text-sm text-muted-foreground space-y-1.5">
          {readiness.implementationPath.map((step, index) => (
            <li key={index} className="flex items-start gap-2">
              <span className="text-primary mt-1">{index + 1}.</span>
              <span>{step}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function formatCapabilityName(name: string) {
  return name.replace(/([A-Z])/g, ' $1').replace(/^\w/, (c) => c.toUpperCase());
}





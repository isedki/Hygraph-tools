'use client';

import type { LocalizationAssessment } from '@/lib/types';

interface LocalizationAssessmentCardProps {
  assessment: LocalizationAssessment;
}

export default function LocalizationAssessmentCard({ assessment }: LocalizationAssessmentCardProps) {
  return (
    <section className="rounded-xl border border-border bg-card p-6 flex flex-col gap-4">
      <header>
        <div className="flex items-center gap-2">
          <span className="text-xs uppercase tracking-wide text-muted-foreground">Localization</span>
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-500">
            {assessment.readiness}
          </span>
        </div>
        <p className="text-sm text-muted-foreground mt-2">{assessment.narrative}</p>
      </header>

      <div className="grid grid-cols-3 gap-3">
        <Metric label="Localized models" value={assessment.coverage.localizedModels} />
        <Metric label="Total content models" value={assessment.coverage.totalContentModels} />
        <Metric label="Locales tracked" value={assessment.coverage.localeCount} />
      </div>

      {assessment.strengths.length > 0 && (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3">
          <h4 className="text-xs font-semibold uppercase text-emerald-500 mb-2">What&apos;s working</h4>
          <ul className="text-sm text-emerald-100 space-y-1">
            {assessment.strengths.map((strength, index) => (
              <li key={index} className="flex items-start gap-2 text-emerald-200">
                <span>✓</span>
                <span>{strength}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {assessment.gaps.length > 0 && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 space-y-2">
          <h4 className="text-xs font-semibold uppercase text-amber-500">Gaps</h4>
          {assessment.gaps.map((gap, index) => (
            <div key={index} className="text-sm text-muted-foreground">
              <div className="font-medium">{gap.issue}</div>
              <p className="text-xs text-muted-foreground/80">{gap.impact}</p>
              <p className="text-xs text-primary mt-1">{gap.recommendation}</p>
            </div>
          ))}
        </div>
      )}

      <div className="rounded-lg border border-border/70 p-3">
        <h4 className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Workflow considerations</h4>
        <ul className="text-sm text-muted-foreground space-y-1.5">
          {assessment.workflowConsiderations.map((consideration, index) => (
            <li key={index} className="flex items-start gap-2">
              <span className="text-primary mt-1">•</span>
              <span>{consideration}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border/60 p-3 text-center">
      <div className="text-xs text-muted-foreground uppercase tracking-wide">{label}</div>
      <div className="text-lg font-semibold mt-1">{value}</div>
    </div>
  );
}





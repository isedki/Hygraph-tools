'use client';

import type { PermissionModelReview } from '@/lib/types';

interface PermissionModelReviewCardProps {
  review: PermissionModelReview;
}

export default function PermissionModelReviewCard({ review }: PermissionModelReviewCardProps) {
  return (
    <section className="rounded-xl border border-border bg-card p-6">
      <header className="flex flex-col gap-2 mb-4">
        <div className="flex items-center gap-2">
          <span className="text-xs uppercase tracking-wide text-muted-foreground">Permission Model</span>
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${assessmentBadge(review.assessment)}`}>
            {review.assessment.replace('-', ' ')}
          </span>
        </div>
        <p className="text-sm text-muted-foreground">{review.narrative}</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Observations</h4>
          {review.observations.sensitiveModels.length > 0 && (
            <TagList label="Sensitive models" items={review.observations.sensitiveModels} variant="rose" />
          )}
          {review.observations.highFieldCountModels.length > 0 && (
            <TagList label="High-field models" items={review.observations.highFieldCountModels} variant="amber" />
          )}
          {review.observations.suggestedRoles.length > 0 && (
            <div className="space-y-2">
              {review.observations.suggestedRoles.map(role => (
                <div key={role.role} className="rounded-lg border border-border/60 p-3">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm">{role.role}</span>
                    <span className="text-xs text-muted-foreground">{role.access}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">{role.models.join(', ')}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Risks & mitigations</h4>
          {review.risks.length === 0 ? (
            <p className="text-sm text-muted-foreground">No major permission risks detected.</p>
          ) : (
            <div className="space-y-2">
              {review.risks.map(risk => (
                <div key={risk.risk} className="p-3 rounded-lg border border-border/70 bg-background/70">
                  <div className="text-sm font-medium">{risk.risk}</div>
                  <p className="text-xs text-muted-foreground mt-1">{risk.impact}</p>
                  <p className="text-xs text-primary mt-2">{risk.mitigation}</p>
                </div>
              ))}
            </div>
          )}

          <div className="rounded-lg border border-dashed border-border/70 p-3">
            <h5 className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Recommendations</h5>
            <ul className="text-sm text-muted-foreground space-y-1.5">
              {review.recommendations.map((recommendation, index) => (
                <li key={index} className="flex items-start gap-2">
                  <span className="text-primary mt-1">•</span>
                  <span>{recommendation}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

function assessmentBadge(assessment: PermissionModelReview['assessment']) {
  switch (assessment) {
    case 'well-defined':
      return 'bg-emerald-500/10 text-emerald-500';
    case 'needs-attention':
      return 'bg-amber-500/10 text-amber-500';
    default:
      return 'bg-rose-500/10 text-rose-500';
  }
}

function TagList({
  label,
  items,
  variant,
}: {
  label: string;
  items: string[];
  variant: 'rose' | 'amber';
}) {
  const color = variant === 'rose' ? 'text-rose-400 border-rose-400/40' : 'text-amber-500 border-amber-500/40';

  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">{label}</p>
      <div className="flex flex-wrap gap-2">
        {items.map(item => (
          <span key={item} className={`px-2 py-1 text-xs rounded-full border ${color}`}>
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}





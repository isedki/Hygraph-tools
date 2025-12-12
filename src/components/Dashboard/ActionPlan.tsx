'use client';

import type { StrategicAuditReport } from '@/lib/types';

interface ActionPlanProps {
  actionPlan: StrategicAuditReport['actionPlan'];
}

export default function ActionPlan({ actionPlan }: ActionPlanProps) {
  const hasActions = actionPlan.immediate.length > 0 || actionPlan.shortTerm.length > 0 || actionPlan.longTerm.length > 0;
  
  if (!hasActions) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p>No action items needed. Your schema is well-optimized!</p>
      </div>
    );
  }
  
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Immediate Actions */}
      <div className="rounded-xl border border-green-500/30 bg-green-500/5 p-5">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center text-white font-bold text-sm">1</div>
          <div>
            <h3 className="font-semibold text-green-400">Do Now</h3>
            <p className="text-xs text-muted-foreground">Low effort, immediate impact</p>
          </div>
        </div>
        
        {actionPlan.immediate.length > 0 ? (
          <ul className="space-y-3">
            {actionPlan.immediate.map((item, i) => (
              <li key={i} className="bg-card/50 rounded-lg p-3">
                <p className="text-sm mb-1">{item.action}</p>
                <p className="text-xs text-muted-foreground">{item.impact}</p>
                {item.affectedModels && item.affectedModels.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {item.affectedModels.slice(0, 3).map((m, j) => (
                      <span key={j} className="px-1.5 py-0.5 bg-green-500/10 rounded text-xs text-green-400">{m}</span>
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No immediate actions needed</p>
        )}
      </div>
      
      {/* Short Term Actions */}
      <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/5 p-5">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-full bg-yellow-500 flex items-center justify-center text-white font-bold text-sm">2</div>
          <div>
            <h3 className="font-semibold text-yellow-400">This Sprint</h3>
            <p className="text-xs text-muted-foreground">1-2 weeks, medium effort</p>
          </div>
        </div>
        
        {actionPlan.shortTerm.length > 0 ? (
          <ul className="space-y-3">
            {actionPlan.shortTerm.map((item, i) => (
              <li key={i} className="bg-card/50 rounded-lg p-3">
                <p className="text-sm mb-1">{item.action}</p>
                <p className="text-xs text-muted-foreground">{item.impact}</p>
                {item.affectedModels && item.affectedModels.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {item.affectedModels.slice(0, 3).map((m, j) => (
                      <span key={j} className="px-1.5 py-0.5 bg-yellow-500/10 rounded text-xs text-yellow-400">{m}</span>
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No short-term actions identified</p>
        )}
      </div>
      
      {/* Long Term Actions */}
      <div className="rounded-xl border border-cyan-500/30 bg-cyan-500/5 p-5">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-full bg-cyan-500 flex items-center justify-center text-white font-bold text-sm">3</div>
          <div>
            <h3 className="font-semibold text-cyan-400">Roadmap</h3>
            <p className="text-xs text-muted-foreground">Strategic improvements</p>
          </div>
        </div>
        
        {actionPlan.longTerm.length > 0 ? (
          <ul className="space-y-3">
            {actionPlan.longTerm.map((item, i) => (
              <li key={i} className="bg-card/50 rounded-lg p-3">
                <p className="text-sm mb-1">{item.action}</p>
                <p className="text-xs text-muted-foreground">{item.impact}</p>
                {item.affectedModels && item.affectedModels.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {item.affectedModels.slice(0, 3).map((m, j) => (
                      <span key={j} className="px-1.5 py-0.5 bg-cyan-500/10 rounded text-xs text-cyan-400">{m}</span>
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No long-term actions identified</p>
        )}
      </div>
    </div>
  );
}





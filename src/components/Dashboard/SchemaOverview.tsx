'use client';

import type { AuditResult } from '@/lib/types';

interface SchemaOverviewProps {
  result: AuditResult;
}

export default function SchemaOverview({ result }: SchemaOverviewProps) {
  const systemModels = ['Asset', 'User', 'ScheduledRelease', 'ScheduledOperation'];
  const customModelCount = result.schema.modelCount;
  const systemModelCount = 2; // Asset and User are typically shown
  
  // Calculate component modularity assessment
  const componentModularity = result.schema.componentCount > 50 
    ? 'Highly modular' 
    : result.schema.componentCount > 20 
      ? 'Well modular' 
      : result.schema.componentCount > 5 
        ? 'Moderately modular' 
        : 'Limited modularity';
  
  // Assess enum patterns
  const enumAssessment = result.schema.enumCount > 50
    ? 'Comprehensive'
    : result.schema.enumCount > 20
      ? 'Well-defined'
      : result.schema.enumCount > 5
        ? 'Adequate'
        : 'Minimal';
  
  return (
    <div className="rounded-xl border border-border bg-card p-6 mb-6">
      <h3 className="font-semibold text-lg mb-4">Schema Overview</h3>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Models */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-blue-500"></div>
            <h4 className="font-medium">Models: {customModelCount} Total</h4>
          </div>
          <ul className="text-sm text-muted-foreground space-y-1 ml-5">
            <li>• <span className="text-foreground">{customModelCount}</span> Custom Models</li>
            <li>• <span className="text-foreground">{systemModelCount}</span> System Models (Asset, User)</li>
          </ul>
        </div>
        
        {/* Components */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-purple-500"></div>
            <h4 className="font-medium">Components: {result.schema.componentCount} Total</h4>
          </div>
          <ul className="text-sm text-muted-foreground space-y-1 ml-5">
            <li>• {componentModularity} architecture</li>
            <li>• Reusable content blocks for page builders</li>
            <li>• {result.contentStrategy.componentStrategy.wellDesigned.length > 0 
                ? `${result.contentStrategy.componentStrategy.wellDesigned.length} well-designed components`
                : 'Component analysis pending'}</li>
          </ul>
        </div>
        
        {/* Enumerations */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-green-500"></div>
            <h4 className="font-medium">Enumerations: {result.schema.enumCount} Total</h4>
          </div>
          <ul className="text-sm text-muted-foreground space-y-1 ml-5">
            <li>• {enumAssessment} enum definitions</li>
            <li>• Covering styling, layout, and content types</li>
            {result.architecture.enumAnalysis.singleValueEnums.length > 0 && (
              <li className="text-yellow-400">• {result.architecture.enumAnalysis.singleValueEnums.length} single-value enums to review</li>
            )}
          </ul>
        </div>
      </div>
      
      {/* Architecture Detection */}
      <div className="mt-6 pt-6 border-t border-border">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xl">{result.strategicReport.useCaseAnalysis.useCaseIcon}</span>
          <h4 className="font-medium">Detected Architecture: {result.contentStrategy.detectedArchitecture.primary.replace('-', ' ')}</h4>
          <span className={`ml-2 px-2 py-0.5 rounded text-xs ${
            result.contentStrategy.detectedArchitecture.confidence >= 0.7 
              ? 'bg-green-500/20 text-green-400'
              : result.contentStrategy.detectedArchitecture.confidence >= 0.4
                ? 'bg-yellow-500/20 text-yellow-400'
                : 'bg-blue-500/20 text-blue-400'
          }`}>
            {Math.round(result.contentStrategy.detectedArchitecture.confidence * 100)}% confidence
          </span>
        </div>
        <p className="text-sm text-muted-foreground">
          {result.contentStrategy.detectedArchitecture.signals.slice(0, 3).join(' • ')}
        </p>
      </div>
    </div>
  );
}


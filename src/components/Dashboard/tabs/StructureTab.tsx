'use client';

import type { AuditResult } from '@/lib/types';
import { CheckpointGrid } from '../CheckpointCard';

interface StructureTabProps {
  result: AuditResult;
}

export function StructureTab({ result }: StructureTabProps) {
  const { structure } = result.comprehensiveAssessment;

  const coreCheckpoints = [
    structure.distinctContentTypes,
    structure.pageVsContentSeparation,
    structure.redundantModels,
    structure.overlappingModels,
    structure.fieldNaming,
  ];

  const componentCheckpoints = [
    structure.componentUsage,
    structure.componentReordering,
    structure.rteUsage,
  ];

  const advancedCheckpoints = [
    structure.localization,
    structure.recursiveChains,
    structure.assetCentralization,
  ];

  const enumCheckpoints = [
    structure.enumAnalysis.singleValueEnums,
    structure.enumAnalysis.oversizedEnums,
    structure.enumAnalysis.enumBasedTenancy,
    structure.enumAnalysis.duplicateEnums,
    structure.enumAnalysis.unusedEnums,
  ];

  return (
    <div className="space-y-8">
      <CheckpointGrid checkpoints={coreCheckpoints} title="Model Organization" />
      <CheckpointGrid checkpoints={componentCheckpoints} title="Component Usage" />
      <CheckpointGrid checkpoints={advancedCheckpoints} title="Advanced Patterns" />
      <CheckpointGrid checkpoints={enumCheckpoints} title="Enum Analysis" />
    </div>
  );
}

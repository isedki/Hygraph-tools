import type { 
  ImplementationRoadmap, 
  RoadmapPhase, 
  RoadmapTask,
  ModelDeepDiveAnalysis,
  EnumOverviewAnalysis,
  NamingConventionAnalysis,
  ComponentReusabilityAnalysis,
  StrengthsAnalysis,
  EffortLevel,
} from '../types';

/**
 * Generates a phased implementation roadmap based on all analysis results.
 * Organizes tasks into actionable phases with dependencies.
 */
export function generateImplementationRoadmap(
  modelAnalysis: ModelDeepDiveAnalysis,
  enumAnalysis: EnumOverviewAnalysis,
  componentAnalysis?: ComponentReusabilityAnalysis,
  namingAnalysis?: NamingConventionAnalysis,
): ImplementationRoadmap {
  const quickWins: RoadmapTask[] = [];
  const phase1Tasks: RoadmapTask[] = [];
  const phase2Tasks: RoadmapTask[] = [];
  const phase3Tasks: RoadmapTask[] = [];
  const maintenanceTasks: RoadmapTask[] = [];

  let taskId = 0;
  const nextId = () => `task-${++taskId}`;

  // ============================================
  // PHASE 1: Quick Wins (1-2 weeks)
  // ============================================

  // Documentation tasks
  const modelsNeedingDocs = modelAnalysis.criticalModels
    .filter(m => m.recommendations.some(r => r.recommendation.includes('description')));
  
  if (modelsNeedingDocs.length > 0) {
    const task: RoadmapTask = {
      id: nextId(),
      task: 'Add missing model and field descriptions',
      description: `Add documentation to ${modelsNeedingDocs.length} critical models to improve editor guidance`,
      effort: 'low',
      impact: 'Editors understand field purposes; reduces support questions',
      affectedItems: modelsNeedingDocs.map(m => m.modelName),
    };
    quickWins.push(task);
    phase1Tasks.push(task);
  }

  // Required field tasks
  const modelsNeedingRequired = modelAnalysis.criticalModels
    .filter(m => m.requiredFieldsSuggestions.length > 0);
  
  if (modelsNeedingRequired.length > 0) {
    const task: RoadmapTask = {
      id: nextId(),
      task: 'Add required field validations to critical fields',
      description: `Mark essential fields as required in ${modelsNeedingRequired.length} models (title, slug, etc.)`,
      effort: 'low',
      impact: 'Prevents incomplete content; ensures data quality',
      affectedItems: modelsNeedingRequired.map(m => m.modelName),
    };
    quickWins.push(task);
    phase1Tasks.push(task);
  }

  // Naming convention quick fixes
  if (namingAnalysis && namingAnalysis.issues.length > 0) {
    const lowEffortNaming = namingAnalysis.issues.filter(i => 
      i.issue.includes('inconsistent') || i.issue.includes('case')
    );
    if (lowEffortNaming.length > 0) {
      const task: RoadmapTask = {
        id: nextId(),
        task: 'Document naming convention standards',
        description: 'Create naming convention guidelines for models, fields, and components',
        effort: 'low',
        impact: 'Establishes consistency for future development',
        affectedItems: lowEffortNaming.map(i => i.item),
      };
      phase1Tasks.push(task);
    }
  }

  // Single-value enum cleanup
  const singleValueEnums = [
    ...enumAnalysis.enumsByCategory.styling,
    ...enumAnalysis.enumsByCategory.layout,
    ...enumAnalysis.enumsByCategory.other,
  ].filter(e => e.values.length === 1);
  
  if (singleValueEnums.length > 0) {
    const task: RoadmapTask = {
      id: nextId(),
      task: 'Review single-value enums',
      description: `${singleValueEnums.length} enum(s) have only one value and may be unnecessary`,
      effort: 'low',
      impact: 'Simplifies schema; removes confusion for editors',
      affectedItems: singleValueEnums.map(e => e.name),
    };
    phase1Tasks.push(task);
  }

  // ============================================
  // PHASE 2: Medium Efforts (2-4 weeks)
  // ============================================

  // Validation rules
  const modelsNeedingValidation = modelAnalysis.criticalModels
    .filter(m => m.validationSuggestions.length > 0);
  
  if (modelsNeedingValidation.length > 0) {
    const task: RoadmapTask = {
      id: nextId(),
      task: 'Implement field validation rules',
      description: 'Add character limits, pattern validation, and unique constraints to key fields',
      effort: 'medium',
      impact: 'Ensures data quality; prevents invalid content',
      affectedItems: modelsNeedingValidation.flatMap(m => 
        m.validationSuggestions.map(v => `${m.modelName}.${v.field}`)
      ),
    };
    phase2Tasks.push(task);
  }

  // Deprecated field cleanup
  const modelsWithDeprecated = modelAnalysis.criticalModels
    .filter(m => m.recommendations.some(r => r.recommendation.includes('deprecated') || r.recommendation.includes('migration')));
  
  if (modelsWithDeprecated.length > 0) {
    const task: RoadmapTask = {
      id: nextId(),
      task: 'Clean up deprecated/migration fields',
      description: 'Remove migration-specific fields after verifying migration is complete',
      effort: 'medium',
      impact: 'Cleaner schema; less confusion for editors',
      affectedItems: modelsWithDeprecated.map(m => m.modelName),
    };
    phase2Tasks.push(task);
  }

  // Component consolidation
  if (componentAnalysis && componentAnalysis.variantGroups.length > 0) {
    const lowEffortConsolidation = componentAnalysis.variantGroups.filter(g => g.effort === 'medium');
    if (lowEffortConsolidation.length > 0) {
      const task: RoadmapTask = {
        id: nextId(),
        task: 'Evaluate component variant consolidation',
        description: `${lowEffortConsolidation.length} component groups may benefit from consolidation with configuration`,
        effort: 'medium',
        impact: 'Reduces duplication; simplifies component library',
        affectedItems: lowEffortConsolidation.flatMap(g => g.variants),
      };
      phase2Tasks.push(task);
    }
  }

  // Unused components
  if (componentAnalysis && componentAnalysis.unusedComponents.length > 0) {
    const task: RoadmapTask = {
      id: nextId(),
      task: 'Review and remove unused components',
      description: `${componentAnalysis.unusedComponents.length} components are not used in any model`,
      effort: 'low',
      impact: 'Cleaner schema; reduced maintenance burden',
      affectedItems: componentAnalysis.unusedComponents,
    };
    phase2Tasks.push(task);
  }

  // Localization documentation
  const task: RoadmapTask = {
    id: nextId(),
    task: 'Document localization strategy',
    description: 'Create guidelines for which fields to localize and translation workflows',
    effort: 'medium',
    impact: 'Clear guidance for international content management',
    affectedItems: [],
  };
  phase2Tasks.push(task);

  // ============================================
  // PHASE 3: Strategic Improvements (4+ weeks)
  // ============================================

  // Tenancy enum migration
  const criticalTenancyEnums = enumAnalysis.architecturalEnums.filter(e => e.healthStatus === 'critical');
  if (criticalTenancyEnums.length > 0) {
    const migrationTask: RoadmapTask = {
      id: nextId(),
      task: 'Migrate tenancy enums to content models',
      description: `Convert ${criticalTenancyEnums.length} enum-based brand/site/tenant patterns to proper content models`,
      effort: 'high',
      impact: 'Better scalability; enables metadata and relationships per tenant',
      affectedItems: criticalTenancyEnums.map(e => e.name),
    };
    phase3Tasks.push(migrationTask);
  }

  // Component refactoring
  if (componentAnalysis && componentAnalysis.variantGroups.length > 0) {
    const highEffortConsolidation = componentAnalysis.variantGroups.filter(g => g.effort === 'high');
    if (highEffortConsolidation.length > 0) {
      const task: RoadmapTask = {
        id: nextId(),
        task: 'Major component architecture refactoring',
        description: 'Consolidate component variants and implement configuration-based approach',
        effort: 'high',
        impact: 'Significantly reduced duplication; easier maintenance',
        affectedItems: highEffortConsolidation.flatMap(g => g.variants),
      };
      phase3Tasks.push(task);
    }
  }

  // Model restructuring
  const complexModels = modelAnalysis.criticalModels.filter(m => m.fieldCount > 30);
  if (complexModels.length > 0) {
    const task: RoadmapTask = {
      id: nextId(),
      task: 'Restructure complex models',
      description: `${complexModels.length} models may benefit from splitting or componentization`,
      effort: 'high',
      impact: 'Improved editorial experience; better content organization',
      affectedItems: complexModels.map(m => m.modelName),
    };
    phase3Tasks.push(task);
  }

  // Duplication patterns
  if (componentAnalysis && componentAnalysis.duplicationOpportunities.length > 0) {
    const task: RoadmapTask = {
      id: nextId(),
      task: 'Create shared components for duplicate patterns',
      description: `${componentAnalysis.duplicationOpportunities.length} duplication patterns identified`,
      effort: 'high',
      impact: 'Reduces maintenance; improves consistency',
      affectedItems: componentAnalysis.duplicationOpportunities.flatMap(d => d.affectedModels),
    };
    phase3Tasks.push(task);
  }

  // ============================================
  // MAINTENANCE (Ongoing)
  // ============================================

  maintenanceTasks.push({
    id: nextId(),
    task: 'Establish quarterly schema review process',
    description: 'Regular review of schema health, unused fields, and new patterns',
    effort: 'low',
    impact: 'Prevents schema drift; maintains quality',
    affectedItems: [],
  });

  maintenanceTasks.push({
    id: nextId(),
    task: 'Monitor unused fields and components',
    description: 'Periodic cleanup of unused schema elements',
    effort: 'low',
    impact: 'Keeps schema clean and manageable',
    affectedItems: [],
  });

  maintenanceTasks.push({
    id: nextId(),
    task: 'Update documentation as schema evolves',
    description: 'Keep field descriptions and guidelines current',
    effort: 'low',
    impact: 'Ensures editor guidance remains accurate',
    affectedItems: [],
  });

  // ============================================
  // BUILD PHASES
  // ============================================

  const phases: RoadmapPhase[] = [];

  if (phase1Tasks.length > 0) {
    phases.push({
      phase: 1,
      name: 'Quick Wins',
      duration: '1-2 weeks',
      description: 'Low-effort improvements with immediate impact on data quality and documentation',
      tasks: phase1Tasks,
    });
  }

  if (phase2Tasks.length > 0) {
    phases.push({
      phase: 2,
      name: 'Medium Efforts',
      duration: '2-4 weeks',
      description: 'Validation rules, cleanup, and targeted improvements',
      tasks: phase2Tasks,
    });
  }

  if (phase3Tasks.length > 0) {
    phases.push({
      phase: 3,
      name: 'Strategic Improvements',
      duration: '4+ weeks',
      description: 'Major architectural changes and refactoring',
      tasks: phase3Tasks,
    });
  }

  phases.push({
    phase: 4,
    name: 'Maintenance',
    duration: 'Ongoing',
    description: 'Continuous improvement and governance',
    tasks: maintenanceTasks,
  });

  // Calculate total effort
  const allTasks = [...phase1Tasks, ...phase2Tasks, ...phase3Tasks];
  const lowCount = allTasks.filter(t => t.effort === 'low').length;
  const mediumCount = allTasks.filter(t => t.effort === 'medium').length;
  const highCount = allTasks.filter(t => t.effort === 'high').length;
  
  let totalEstimatedEffort = '';
  if (highCount > 3) {
    totalEstimatedEffort = '2-3 months for full implementation';
  } else if (highCount > 0 || mediumCount > 5) {
    totalEstimatedEffort = '4-6 weeks for full implementation';
  } else {
    totalEstimatedEffort = '2-3 weeks for full implementation';
  }

  return {
    phases,
    quickWins,
    maintenanceTasks,
    totalEstimatedEffort,
  };
}



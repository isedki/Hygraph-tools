/**
 * Structural Observations Analyzer
 * 
 * Generates high-level, consultant-style observations about the schema architecture.
 * These are concise bullet points that provide architectural insights.
 */

import type { 
  HygraphSchema, 
  HygraphModel,
  StrategicAuditReport,
  ComprehensiveAssessment 
} from '../types';
import { filterSystemModels, filterSystemComponents, filterSystemEnums } from './systemFilters';

export interface StructuralObservation {
  text: string;
  type: 'architecture' | 'issue' | 'pattern' | 'info';
  severity?: 'high' | 'medium' | 'low';
}

export function analyzeStructuralObservations(
  schema: HygraphSchema,
  strategicReport: StrategicAuditReport,
  comprehensiveAssessment: ComprehensiveAssessment
): StructuralObservation[] {
  const observations: StructuralObservation[] = [];
  
  const customModels = filterSystemModels(schema.models);
  const customComponents = filterSystemComponents(schema.components || []);
  const customEnums = filterSystemEnums(schema.enums || []);

  // 1. Architecture Intent
  const archObs = detectArchitectureIntent(strategicReport);
  if (archObs) observations.push(archObs);

  // 2. Enum Wrapper Models (models that just wrap an enum)
  const enumWrappers = detectEnumWrapperModels(customModels, customEnums);
  observations.push(...enumWrappers);

  // 3. Duplicate Components
  const duplicateObs = detectDuplicatePatterns(comprehensiveAssessment);
  observations.push(...duplicateObs);

  // 4. Block Flexibility Issues
  const flexibilityObs = detectBlockFlexibilityIssues(customModels, customComponents);
  observations.push(...flexibilityObs);

  // 5. Unused Components
  const unusedObs = detectUnusedComponents(customModels, customComponents);
  if (unusedObs) observations.push(unusedObs);

  // 6. Content/Presentation Mixing
  const mixingObs = detectContentPresentationMixing(comprehensiveAssessment);
  if (mixingObs) observations.push(mixingObs);

  // 7. Multi-Site/Multi-Brand Patterns
  const multiSiteObs = detectMultiSitePatterns(customModels, customEnums);
  if (multiSiteObs) observations.push(multiSiteObs);

  // 8. Template Clarity
  const templateObs = detectTemplateClarityIssues(customModels);
  if (templateObs) observations.push(templateObs);

  // 9. Component Summary
  const componentSummary = generateComponentSummary(customComponents);
  if (componentSummary) observations.push(componentSummary);

  return observations;
}

// ============================================
// Detection Functions
// ============================================

function detectArchitectureIntent(report: StrategicAuditReport): StructuralObservation | null {
  const useCase = report.useCaseAnalysis?.detectedUseCase;
  const fitScore = report.useCaseAnalysis?.fitScore || 0;
  
  if (!useCase) return null;

  let text = `Architecture appears built for a **${useCase.toLowerCase()}**`;
  
  if (fitScore < 60) {
    text += `, but current content patterns suggest different needs`;
  }
  
  return {
    text,
    type: 'architecture',
  };
}

function detectEnumWrapperModels(
  models: HygraphModel[],
  enums: { name: string; values: string[] }[]
): StructuralObservation[] {
  const observations: StructuralObservation[] = [];
  const enumNames = new Set(enums.map(e => e.name.toLowerCase()));

  for (const model of models) {
    // Skip if model has more than 3 meaningful fields (excluding id, createdAt, etc.)
    const meaningfulFields = model.fields.filter(f => 
      !['id', 'createdAt', 'updatedAt', 'publishedAt', 'stage'].includes(f.name)
    );
    
    if (meaningfulFields.length <= 2) {
      // Check if the main field is an enum reference
      const enumField = meaningfulFields.find(f => 
        enumNames.has(f.type.toLowerCase()) || 
        f.type.includes('Enum') ||
        enums.some(e => f.type === e.name)
      );
      
      if (enumField) {
        observations.push({
          text: `\`${model.name}\` is just a layer over an enum (**model unnecessary**)`,
          type: 'issue',
          severity: 'medium',
        });
      }
    }
  }

  return observations;
}

function detectDuplicatePatterns(assessment: ComprehensiveAssessment): StructuralObservation[] {
  const observations: StructuralObservation[] = [];
  
  // Component duplicates
  const componentGroups = assessment.duplicates?.components?.groups || [];
  for (const group of componentGroups.slice(0, 2)) {
    if (group.components.length >= 2) {
      const names = group.components.slice(0, 2);
      observations.push({
        text: `\`${names[0]}\` and \`${names[1]}\` appear to be **duplicates**`,
        type: 'issue',
        severity: 'medium',
      });
    }
  }

  // Model duplicates with same purpose
  const modelGroups = assessment.duplicates?.models?.groups || [];
  for (const group of modelGroups.slice(0, 1)) {
    if (group.models.length >= 2 && group.reason) {
      observations.push({
        text: `${group.models[0]} pattern is duplicated in **${group.models.slice(1).join(' and ')}**`,
        type: 'issue',
        severity: 'low',
      });
    }
  }

  return observations;
}

function detectBlockFlexibilityIssues(
  models: HygraphModel[],
  components: HygraphModel[]
): StructuralObservation[] {
  const observations: StructuralObservation[] = [];
  
  // Find Page/Layout models
  const pageModels = models.filter(m => 
    /page|layout|template/i.test(m.name)
  );

  for (const model of pageModels) {
    // Find union/component list fields
    for (const field of model.fields) {
      if (field.isList && field.relatedModel) {
        // Check if it's a component union field with many options
        const relatedComponents = components.filter(c => 
          field.type.includes(c.name) || field.relatedModel?.includes(c.name)
        );
        
        // If field accepts many component types (approximated by field type containing "Block" or "Section")
        if (/block|section|module|component/i.test(field.name) || /block|section|module/i.test(field.type)) {
          // Check component count in the schema
          const blockComponents = components.filter(c => 
            /block|section|hero|banner|cta|card|grid|list|carousel/i.test(c.name)
          );
          
          if (blockComponents.length > 10) {
            observations.push({
              text: `${model.name} accepts **unlimited block types** (${blockComponents.length}+), causing decision fatigue`,
              type: 'issue',
              severity: 'medium',
            });
            break;
          }
        }
      }
    }
  }

  return observations;
}

function detectUnusedComponents(
  models: HygraphModel[],
  components: HygraphModel[]
): StructuralObservation | null {
  // Build set of all referenced component types
  const referencedTypes = new Set<string>();
  
  for (const model of models) {
    for (const field of model.fields) {
      if (field.type) referencedTypes.add(field.type);
      if (field.relatedModel) referencedTypes.add(field.relatedModel);
    }
  }
  
  // Also check components referencing other components
  for (const comp of components) {
    for (const field of comp.fields) {
      if (field.type) referencedTypes.add(field.type);
      if (field.relatedModel) referencedTypes.add(field.relatedModel);
    }
  }

  const unusedComponents = components.filter(c => !referencedTypes.has(c.name));
  
  if (unusedComponents.length > 0) {
    const count = unusedComponents.length;
    const examples = unusedComponents.slice(0, 3).map(c => c.name).join(', ');
    return {
      text: `${count} component${count > 1 ? 's are' : ' is'} created but **never used** (${examples}${count > 3 ? '...' : ''})`,
      type: 'issue',
      severity: 'low',
    };
  }
  
  return null;
}

function detectContentPresentationMixing(assessment: ComprehensiveAssessment): StructuralObservation | null {
  const leakyModels = assessment.reusability?.contentVsPresentation?.leakyModels || [];
  const leakageScore = assessment.reusability?.contentVsPresentation?.overallLeakageScore || 100;
  
  if (leakyModels.length > 0 && leakageScore < 70) {
    const worstOffenders = leakyModels.slice(0, 2).map(m => m.model);
    return {
      text: `Schema mixes content, presentation, and configuration (${worstOffenders.join(', ')})`,
      type: 'pattern',
      severity: 'medium',
    };
  }
  
  return null;
}

function detectMultiSitePatterns(
  models: HygraphModel[],
  enums: { name: string; values: string[] }[]
): StructuralObservation | null {
  // Check for site/brand/tenant enums
  const siteEnum = enums.find(e => 
    /^(site|brand|tenant|market|region|locale|country)s?$/i.test(e.name)
  );
  
  if (siteEnum && siteEnum.values.length > 1) {
    return {
      text: `Multi-site support built into core via **${siteEnum.name}** enumeration (${siteEnum.values.length} sites)`,
      type: 'pattern',
    };
  }
  
  // Check for site fields on models
  const modelsWithSiteField = models.filter(m =>
    m.fields.some(f => /^(site|brand|tenant)s?$/i.test(f.name))
  );
  
  if (modelsWithSiteField.length >= 3) {
    return {
      text: `Multi-site pattern detected across ${modelsWithSiteField.length} models via site/brand fields`,
      type: 'pattern',
    };
  }
  
  return null;
}

function detectTemplateClarityIssues(models: HygraphModel[]): StructuralObservation | null {
  const pageModels = models.filter(m => 
    /^(page|landingpage|homepage|contentpage)s?$/i.test(m.name)
  );
  
  for (const model of pageModels) {
    const requiredFields = model.fields.filter(f => f.isRequired);
    const optionalFields = model.fields.filter(f => !f.isRequired);
    
    // Check if Page model lacks clear structure
    if (requiredFields.length <= 2 && optionalFields.length > 15) {
      return {
        text: `The ${model.name} model lacks a **clear template/structure** (${requiredFields.length} required, ${optionalFields.length} optional fields)`,
        type: 'issue',
        severity: 'medium',
      };
    }
  }
  
  return null;
}

function generateComponentSummary(components: HygraphModel[]): StructuralObservation | null {
  if (components.length === 0) return null;
  
  // Categorize components
  const layoutBlocks = components.filter(c => 
    /block|section|hero|banner|grid|container|wrapper|row|column/i.test(c.name)
  );
  
  const percentage = Math.round((layoutBlocks.length / components.length) * 100);
  
  if (percentage > 60) {
    return {
      text: `${components.length} components, mostly representing **layout/block patterns** (${percentage}%)`,
      type: 'info',
    };
  }
  
  return {
    text: `${components.length} components across content and layout patterns`,
    type: 'info',
  };
}

import type { AuditResult, CheckpointResult } from '../types';

/**
 * Generate Notion-ready Markdown export of the audit report
 */
export function generateMarkdown(result: AuditResult): string {
  const lines: string[] = [];
  const { comprehensiveAssessment, strategicReport } = result;

  // Header
  lines.push(`# Hygraph Schema Audit Report`);
  lines.push(``);
  lines.push(`**Endpoint:** \`${result.connectionInfo.endpoint}\``);
  lines.push(`**Date:** ${result.connectionInfo.connectedAt.toLocaleDateString()}`);
  lines.push(`**Overall Score:** ${result.overallScore}/100`);
  lines.push(``);
  lines.push(`---`);
  lines.push(``);

  // Executive Summary
  lines.push(`## 📊 Executive Summary`);
  lines.push(``);
  lines.push(`| Metric | Value |`);
  lines.push(`|--------|-------|`);
  lines.push(`| Models | ${strategicReport.executiveSummary.metrics.customModels} |`);
  lines.push(`| Components | ${strategicReport.executiveSummary.metrics.components} |`);
  lines.push(`| Enums | ${strategicReport.executiveSummary.metrics.enums} |`);
  lines.push(`| Content Entries | ${strategicReport.executiveSummary.metrics.contentEntries} |`);
  lines.push(`| Reuse Score | ${comprehensiveAssessment.reusability.reuseScore}% |`);
  lines.push(``);

  // Key Findings
  if (strategicReport.executiveSummary.keyFindings.length > 0) {
    lines.push(`### Key Findings`);
    lines.push(``);
    strategicReport.executiveSummary.keyFindings.forEach(f => {
      lines.push(`- ${f}`);
    });
    lines.push(``);
  }

  // Quick Wins
  if (strategicReport.executiveSummary.quickWins.length > 0) {
    lines.push(`### ⚡ Quick Wins`);
    lines.push(``);
    strategicReport.executiveSummary.quickWins.forEach(w => {
      lines.push(`- [ ] ${w}`);
    });
    lines.push(``);
  }

  lines.push(`---`);
  lines.push(``);

  // Structure Assessment
  lines.push(`## 🏗️ Structure & Organization`);
  lines.push(``);
  
  const structureCheckpoints = [
    comprehensiveAssessment.structure.distinctContentTypes,
    comprehensiveAssessment.structure.pageVsContentSeparation,
    comprehensiveAssessment.structure.redundantModels,
    comprehensiveAssessment.structure.overlappingModels,
    comprehensiveAssessment.structure.componentUsage,
  ];
  
  structureCheckpoints.forEach(cp => {
    lines.push(...formatCheckpoint(cp));
  });

  // Enum Analysis
  lines.push(`### Enum Analysis`);
  lines.push(``);
  const enumCheckpoints = [
    comprehensiveAssessment.structure.enumAnalysis.singleValueEnums,
    comprehensiveAssessment.structure.enumAnalysis.oversizedEnums,
    comprehensiveAssessment.structure.enumAnalysis.unusedEnums,
  ];
  enumCheckpoints.forEach(cp => {
    lines.push(...formatCheckpoint(cp));
  });

  lines.push(`---`);
  lines.push(``);

  // Content Architecture
  lines.push(`## 📁 Content Architecture`);
  lines.push(``);
  lines.push(...formatCheckpoint(comprehensiveAssessment.contentArchitecture.taxonomySummary));
  lines.push(...formatCheckpoint(comprehensiveAssessment.contentArchitecture.hierarchySummary));
  lines.push(...formatCheckpoint(comprehensiveAssessment.contentArchitecture.navigationReadiness));

  // Content Distribution
  if (comprehensiveAssessment.contentArchitecture.contentDistribution.length > 0) {
    lines.push(`### Content Distribution`);
    lines.push(``);
    lines.push(`| Model | Draft | Published | Total |`);
    lines.push(`|-------|-------|-----------|-------|`);
    comprehensiveAssessment.contentArchitecture.contentDistribution.slice(0, 10).forEach(d => {
      lines.push(`| ${d.model} | ${d.draft} | ${d.published} | ${d.total} |`);
    });
    lines.push(``);
  }

  lines.push(`---`);
  lines.push(``);

  // Reusability
  lines.push(`## ♻️ Reusability`);
  lines.push(``);
  lines.push(`**Reuse Score:** ${comprehensiveAssessment.reusability.reuseScore}%`);
  lines.push(``);
  
  lines.push(...formatCheckpoint(comprehensiveAssessment.reusability.sharedContent));
  lines.push(...formatCheckpoint(comprehensiveAssessment.reusability.sharedComponents));
  lines.push(...formatCheckpoint(comprehensiveAssessment.reusability.layoutFlexibility));

  // Duplicates
  if (comprehensiveAssessment.duplicates.enums.groups.length > 0 ||
      comprehensiveAssessment.duplicates.components.groups.length > 0 ||
      comprehensiveAssessment.duplicates.models.groups.length > 0) {
    lines.push(`### Potential Duplicates`);
    lines.push(``);
    
    comprehensiveAssessment.duplicates.enums.groups.forEach(g => {
      lines.push(`- **Enums:** ${g.enums.join(', ')} - ${g.recommendation}`);
    });
    comprehensiveAssessment.duplicates.components.groups.forEach(g => {
      lines.push(`- **Components:** ${g.components.join(', ')} - ${g.recommendation}`);
    });
    comprehensiveAssessment.duplicates.models.groups.forEach(g => {
      lines.push(`- **Models:** ${g.models.join(', ')} - ${g.recommendation}`);
    });
    lines.push(``);
  }

  lines.push(`---`);
  lines.push(``);

  // Performance
  lines.push(`## ⚡ Performance`);
  lines.push(``);
  lines.push(`**Performance Score:** ${comprehensiveAssessment.performance.overallScore}%`);
  lines.push(``);

  lines.push(...formatCheckpoint(comprehensiveAssessment.performance.deepQueryPaths));
  lines.push(...formatCheckpoint(comprehensiveAssessment.performance.recursiveChains));

  // Nested Components
  if (comprehensiveAssessment.performance.nestedComponents.items.length > 0) {
    lines.push(`### Nested Components`);
    lines.push(``);
    comprehensiveAssessment.performance.nestedComponents.items.slice(0, 5).forEach(item => {
      lines.push(`- **${item.component}** (depth: ${item.depth}) - ${item.path.join(' → ')}`);
    });
    lines.push(``);
  }

  // Huge Models
  if (comprehensiveAssessment.performance.hugeModels.items.length > 0) {
    lines.push(`### Large Models`);
    lines.push(``);
    comprehensiveAssessment.performance.hugeModels.items.forEach(item => {
      lines.push(`- **${item.model}** - ${item.fieldCount} fields`);
    });
    lines.push(``);
  }

  lines.push(`---`);
  lines.push(``);

  // Relationships
  lines.push(`## 🔗 Relationships`);
  lines.push(``);
  lines.push(...formatCheckpoint(comprehensiveAssessment.relationships.referenceCorrectness));
  lines.push(...formatCheckpoint(comprehensiveAssessment.relationships.circularReferences));
  lines.push(...formatCheckpoint(comprehensiveAssessment.relationships.queryCost));

  lines.push(`---`);
  lines.push(``);

  // Roadmap
  lines.push(`## 🗺️ Action Items`);
  lines.push(``);

  // High Priority
  const highPriorityActions: string[] = [];
  [
    comprehensiveAssessment.structure.redundantModels,
    comprehensiveAssessment.performance.deepQueryPaths,
    comprehensiveAssessment.relationships.circularReferences,
  ].forEach(cp => {
    if (cp.status === 'issue') {
      highPriorityActions.push(...cp.actionItems);
    }
  });

  if (highPriorityActions.length > 0) {
    lines.push(`### 🔴 High Priority`);
    lines.push(``);
    highPriorityActions.slice(0, 5).forEach(a => {
      lines.push(`- [ ] ${a}`);
    });
    lines.push(``);
  }

  // Medium Priority
  const mediumPriorityActions: string[] = [];
  [
    comprehensiveAssessment.structure.componentUsage,
    comprehensiveAssessment.reusability.sharedContent,
    comprehensiveAssessment.contentArchitecture.navigationReadiness,
  ].forEach(cp => {
    if (cp.status === 'warning') {
      mediumPriorityActions.push(...cp.actionItems);
    }
  });

  if (mediumPriorityActions.length > 0) {
    lines.push(`### 🟡 Medium Priority`);
    lines.push(``);
    mediumPriorityActions.slice(0, 5).forEach(a => {
      lines.push(`- [ ] ${a}`);
    });
    lines.push(``);
  }

  // Strategic Recommendations
  if (strategicReport.executiveSummary.strategicRecommendations.length > 0) {
    lines.push(`### 📋 Strategic Recommendations`);
    lines.push(``);
    strategicReport.executiveSummary.strategicRecommendations.forEach(r => {
      lines.push(`- ${r}`);
    });
    lines.push(``);
  }

  lines.push(`---`);
  lines.push(``);
  lines.push(`*Generated by Hygraph Schema Audit Tool*`);

  return lines.join('\n');
}

function formatCheckpoint(checkpoint: CheckpointResult): string[] {
  const lines: string[] = [];
  const statusIcon = checkpoint.status === 'good' ? '✅' : checkpoint.status === 'warning' ? '⚠️' : '❌';
  
  lines.push(`#### ${statusIcon} ${checkpoint.title}`);
  lines.push(``);
  
  checkpoint.findings.forEach(f => {
    lines.push(`- ${f}`);
  });
  
  if (checkpoint.actionItems.length > 0 && checkpoint.status !== 'good') {
    lines.push(``);
    lines.push(`**Actions:**`);
    checkpoint.actionItems.slice(0, 3).forEach(a => {
      lines.push(`- [ ] ${a}`);
    });
  }
  
  lines.push(``);
  return lines;
}

/**
 * Download markdown as a file
 */
export function downloadMarkdown(result: AuditResult, filename?: string): void {
  const markdown = generateMarkdown(result);
  const blob = new Blob([markdown], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || `hygraph-audit-${new Date().toISOString().split('T')[0]}.md`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

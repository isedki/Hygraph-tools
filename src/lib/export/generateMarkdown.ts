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

  // Insights Section
  lines.push(`## 💡 Insights`);
  lines.push(``);
  
  // Content Adoption
  const { contentAdoption, payloadEfficiency, seoReadiness, contentFreshness, emptyFields, richTextUsage, enhancedPerformance } = result.insights;
  
  lines.push(`### Content Adoption`);
  lines.push(``);
  lines.push(`**Adoption Rate:** ${contentAdoption.adoptionRate}% of models have content`);
  lines.push(``);
  lines.push(`| Category | Count |`);
  lines.push(`|----------|-------|`);
  lines.push(`| Ghost Models (0 entries) | ${contentAdoption.distribution.ghost} |`);
  lines.push(`| Underutilized (1-4) | ${contentAdoption.distribution.underutilized} |`);
  lines.push(`| Low Adoption (5-19) | ${contentAdoption.distribution.lowAdoption} |`);
  lines.push(`| Healthy (20-499) | ${contentAdoption.distribution.healthy} |`);
  lines.push(`| High Volume (500+) | ${contentAdoption.distribution.highVolume} |`);
  lines.push(``);
  
  if (contentAdoption.ghostModels.length > 0) {
    lines.push(`**Ghost Models:**`);
    contentAdoption.ghostModels.slice(0, 5).forEach(g => {
      lines.push(`- ${g.model} (${g.fieldCount} fields)${g.createdFor ? ` - ${g.createdFor}` : ''}`);
    });
    lines.push(``);
  }
  
  // Content Freshness
  if (contentFreshness) {
    lines.push(`### Content Freshness`);
    lines.push(``);
    lines.push(`**Freshness Score:** ${contentFreshness.overallFreshness.score}%`);
    lines.push(`**Total Entries Analyzed:** ${contentFreshness.overallFreshness.totalEntries}`);
    lines.push(``);
    lines.push(`| Category | Percentage |`);
    lines.push(`|----------|------------|`);
    lines.push(`| Fresh (<${contentFreshness.thresholds.fresh} days) | ${contentFreshness.overallFreshness.freshPercentage}% |`);
    lines.push(`| Stale (${contentFreshness.thresholds.aging}-${contentFreshness.thresholds.stale} days) | ${contentFreshness.overallFreshness.stalePercentage}% |`);
    lines.push(`| Dormant (>${contentFreshness.thresholds.dormant} days) | ${contentFreshness.overallFreshness.dormantPercentage}% |`);
    lines.push(``);
    
    if (contentFreshness.staleContentAlert.length > 0) {
      lines.push(`**⚠️ Stale Content Alerts:**`);
      contentFreshness.staleContentAlert.slice(0, 5).forEach(a => {
        lines.push(`- **${a.model}** - ${a.percentage}% stale (${a.staleCount} entries)`);
      });
      lines.push(``);
    }
    
    if (contentFreshness.recommendations.length > 0) {
      lines.push(`**Recommendations:**`);
      contentFreshness.recommendations.forEach(r => {
        lines.push(`- ${r}`);
      });
      lines.push(``);
    }
  }
  
  // Data Quality (Empty Fields)
  if (emptyFields) {
    lines.push(`### Data Quality`);
    lines.push(``);
    lines.push(`**Quality Score:** ${emptyFields.overallDataQuality}%`);
    lines.push(``);
    lines.push(`| Issue Type | Count |`);
    lines.push(`|------------|-------|`);
    lines.push(`| Unused Optional Fields | ${emptyFields.unusedOptionalFields.length} |`);
    lines.push(`| Rarely Used Fields (<20%) | ${emptyFields.rarelyUsedFields.length} |`);
    lines.push(`| Data Quality Issues | ${emptyFields.dataQualityIssues.length} |`);
    lines.push(``);
    
    if (emptyFields.dataQualityIssues.length > 0) {
      lines.push(`**⚠️ Required Fields with Low Fill Rate:**`);
      emptyFields.dataQualityIssues.slice(0, 5).forEach(i => {
        lines.push(`- **${i.model}.${i.field}** - ${i.fillRate}% filled`);
      });
      lines.push(``);
    }
    
    if (emptyFields.unusedOptionalFields.length > 0) {
      lines.push(`**🗑️ Unused Fields (consider removing):**`);
      emptyFields.unusedOptionalFields.slice(0, 10).forEach(f => {
        lines.push(`- ${f.model}.${f.field}`);
      });
      lines.push(``);
    }
    
    if (emptyFields.recommendations.length > 0) {
      lines.push(`**Recommendations:**`);
      emptyFields.recommendations.forEach(r => {
        lines.push(`- ${r}`);
      });
      lines.push(``);
    }
  }
  
  // Rich Text Usage
  if (richTextUsage) {
    lines.push(`### Rich Text Analysis`);
    lines.push(``);
    lines.push(`**Score:** ${richTextUsage.overallScore}%`);
    lines.push(`**Models with Rich Text:** ${richTextUsage.modelsWithRichText.length}`);
    lines.push(``);
    
    if (richTextUsage.absoluteUrls.length > 0) {
      const totalUrls = richTextUsage.absoluteUrls.reduce((sum, u) => sum + u.count, 0);
      lines.push(`**🔗 Absolute URLs Found (${totalUrls}):**`);
      richTextUsage.absoluteUrls.slice(0, 5).forEach(u => {
        lines.push(`- **${u.model}.${u.field}** - ${u.count} URL(s): ${u.urls.slice(0, 2).join(', ')}${u.urls.length > 2 ? '...' : ''}`);
      });
      lines.push(``);
    }
    
    if (richTextUsage.embeddedImages.length > 0) {
      const totalImages = richTextUsage.embeddedImages.reduce((sum, e) => sum + e.count, 0);
      lines.push(`**🖼️ Embedded Images (${totalImages}):**`);
      richTextUsage.embeddedImages.slice(0, 5).forEach(e => {
        lines.push(`- **${e.model}.${e.field}** - ${e.count} image(s)`);
      });
      lines.push(``);
    }
    
    if (richTextUsage.linkAnalysis.staticLinks.length > 0) {
      lines.push(`**Static Links:** ${richTextUsage.linkAnalysis.staticLinks.length} field(s) with static HTML links`);
      lines.push(``);
    }
    
    if (richTextUsage.recommendations.length > 0) {
      lines.push(`**Recommendations:**`);
      richTextUsage.recommendations.forEach(r => {
        lines.push(`- ${r}`);
      });
      lines.push(``);
    }
  }
  
  // API Payload Efficiency
  lines.push(`### API Payload Efficiency`);
  lines.push(``);
  lines.push(`**Score:** ${payloadEfficiency.overallScore}%`);
  lines.push(`**Average Payload:** ${payloadEfficiency.avgPayloadKB} KB`);
  lines.push(``);
  
  if (payloadEfficiency.heavyModels.length > 0) {
    lines.push(`**Heavy Models (>50KB):**`);
    payloadEfficiency.heavyModels.forEach(m => {
      lines.push(`- **${m.model}** - ${m.kb} KB (${m.reason})`);
    });
    lines.push(``);
  }
  
  // Caching Readiness
  if (enhancedPerformance?.cachingReadiness) {
    const caching = enhancedPerformance.cachingReadiness;
    lines.push(`### Caching Readiness`);
    lines.push(``);
    lines.push(`**Score:** ${caching.overallScore}%`);
    lines.push(`**Models with Unique ID:** ${caching.modelsWithUniqueId.length}`);
    lines.push(`**Models without Unique ID:** ${caching.modelsWithoutUniqueId.length}`);
    lines.push(``);
    
    if (caching.modelsWithUniqueId.length > 0) {
      lines.push(`**✅ Models with Cache Keys:**`);
      caching.modelsWithUniqueId.slice(0, 10).forEach(m => {
        lines.push(`- ${m.model} (${m.field})`);
      });
      lines.push(``);
    }
    
    if (caching.cacheKeyRecommendations.length > 0) {
      lines.push(`**⚠️ Recommendations:**`);
      caching.cacheKeyRecommendations.slice(0, 5).forEach(r => {
        lines.push(`- **${r.model}** - ${r.suggestion}`);
      });
      lines.push(``);
    }
  }
  
  // Enum/Taxonomy Recommendations
  if (enhancedPerformance?.enumTaxonomyRecommendations && enhancedPerformance.enumTaxonomyRecommendations.length > 0) {
    const enumRecs = enhancedPerformance.enumTaxonomyRecommendations.filter(r => r.recommendation === 'enum');
    const taxonomyRecs = enhancedPerformance.enumTaxonomyRecommendations.filter(r => r.recommendation === 'taxonomy');
    
    lines.push(`### Field Type Recommendations`);
    lines.push(``);
    
    if (enumRecs.length > 0) {
      lines.push(`**Convert to Enum (${enumRecs.length}):**`);
      enumRecs.slice(0, 5).forEach(r => {
        lines.push(`- **${r.model}.${r.field}** - ${r.distinctValues.length} values: ${r.distinctValues.slice(0, 5).join(', ')}${r.distinctValues.length > 5 ? '...' : ''}`);
      });
      lines.push(``);
    }
    
    if (taxonomyRecs.length > 0) {
      lines.push(`**Convert to Taxonomy (${taxonomyRecs.length}):**`);
      taxonomyRecs.slice(0, 3).forEach(r => {
        lines.push(`- **${r.model}.${r.field}** - ${r.distinctValues.length} values (${r.reason})`);
      });
      lines.push(``);
    }
  }
  
  // SEO Readiness
  lines.push(`### SEO Readiness`);
  lines.push(``);
  lines.push(`**Score:** ${seoReadiness.overallScore}%`);
  lines.push(``);
  lines.push(...formatCheckpoint(seoReadiness.metaFieldCoverage));
  lines.push(...formatCheckpoint(seoReadiness.slugConsistency));
  lines.push(...formatCheckpoint(seoReadiness.socialSharing));
  lines.push(...formatCheckpoint(seoReadiness.structuredData));

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

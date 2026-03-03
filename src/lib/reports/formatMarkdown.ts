import type { ExecutiveReport, Finding, WasteCategory, StatusIndicator, TopAction, ModelInvestment, ModelComparison, TheoreticalTarget } from './types';

/**
 * Format a number as currency
 */
function currency(amount: number): string {
  return `$${amount.toLocaleString()}`;
}

/**
 * Format status indicator with emoji
 */
function formatStatus(status: 'met' | 'close' | 'needs-work'): string {
  switch (status) {
    case 'met': return '✓';
    case 'close': return '~';
    case 'needs-work': return '⚠️';
  }
}

/**
 * Format trend arrow
 */
function formatTrend(trend?: 'up' | 'down' | 'stable'): string {
  if (!trend) return '';
  switch (trend) {
    case 'up': return ' ↗️';
    case 'down': return ' ↘️';
    case 'stable': return ' →';
  }
}

/**
 * Generate a progress bar
 */
function progressBar(percent: number, width: number = 10): string {
  const filled = Math.round((percent / 100) * width);
  const empty = width - filled;
  return '█'.repeat(filled) + '░'.repeat(empty);
}

/**
 * Format the executive summary section
 */
function formatExecutiveSummary(report: ExecutiveReport): string {
  const { executiveSummary } = report;
  const { bottomLine, statusIndicators, topActions, narrativeSummary } = executiveSummary;
  
  let md = `# ${report.reportTitle}\n\n`;
  md += `**Prepared:** ${new Date(report.generatedAt).toLocaleDateString('en-US', { 
    year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' 
  })}\n\n`;
  md += `---\n\n`;
  
  // Summary
  md += `## Summary\n\n`;
  md += `| Metric | Value |\n`;
  md += `|--------|-------|\n`;
  md += `| Estimated content investment | **${currency(bottomLine.contentWorth)}** |\n`;
  md += `| Cleanup opportunity | **${currency(bottomLine.recoverable)}** |\n`;
  md += `| Suggested actions | **${bottomLine.actionsToRecover}** |\n\n`;
  md += `> ⚠️ *Dollar values are estimates based on modeled time, not actual measurements.*\n\n`;
  
  // Status Overview
  md += `## Status Overview\n\n`;
  md += `| Metric | Value | Verdict |\n`;
  md += `|--------|-------|--------|\n`;
  statusIndicators.forEach(si => {
    md += `| ${si.metric} | ${si.value}${formatTrend(si.trend)} | ${si.verdict} |\n`;
  });
  md += `\n`;
  
  // Top Actions
  md += `## Top ${topActions.length} Actions\n\n`;
  md += `| # | Action | Impact | Effort |\n`;
  md += `|---|--------|--------|--------|\n`;
  topActions.forEach(action => {
    md += `| ${action.rank} | ${action.action} | ${currency(action.impact)} | ${action.effort} |\n`;
  });
  md += `\n`;
  
  // Narrative Summary
  md += `> ${narrativeSummary}\n\n`;
  
  return md;
}

/**
 * Format findings section
 */
function formatFindings(findings: Finding[]): string {
  if (findings.length === 0) return '';
  
  let md = `---\n\n## Detailed Findings\n\n`;
  
  findings.forEach((finding, index) => {
    md += `### ${index + 1}. ${finding.title}\n\n`;
    
    md += `| | |\n`;
    md += `|---|---|\n`;
    md += `| **Impact** | ${currency(finding.impact)} |\n`;
    if (finding.risk) {
      md += `| **Risk** | ${finding.risk} |\n`;
    }
    md += `| **Confidence** | ${finding.confidence.toUpperCase()} (based on ${finding.dataPoints} data points) |\n\n`;
    
    md += `**What We Found**\n\n`;
    md += `${finding.whatWeFound}\n\n`;
    
    if (finding.whyItHappens) {
      md += `**Why This Happens**\n\n`;
      md += `${finding.whyItHappens}\n\n`;
    }
    
    md += `**Recommendations**\n\n`;
    finding.recommendations.forEach((rec, i) => {
      md += `- Option ${String.fromCharCode(65 + i)}: ${rec.option} (${rec.effort})\n`;
    });
    md += `\n`;
    
    md += `**Evidence**\n\n`;
    finding.evidence.forEach(e => {
      md += `- ${e}\n`;
    });
    md += `\n`;
  });
  
  return md;
}

/**
 * Format investment breakdown section
 */
function formatInvestmentBreakdown(report: ExecutiveReport): string {
  const { investmentBreakdown } = report;
  
  let md = `---\n\n## Content Investment by Model\n\n`;
  
  md += `| Model | Entries | Avg Time | Total Value | % of Total |\n`;
  md += `|-------|---------|----------|-------------|------------|\n`;
  
  // Show top 10 models
  const displayModels = investmentBreakdown.models.slice(0, 10);
  displayModels.forEach(model => {
    const bar = progressBar(model.percentOfTotal, 8);
    md += `| ${model.model} | ${model.entries} | ${model.avgTimeMinutes} min | ${currency(model.totalValue)} | ${model.percentOfTotal}% ${bar} |\n`;
  });
  
  if (investmentBreakdown.models.length > 10) {
    md += `| *...${investmentBreakdown.models.length - 10} more models* | | | | |\n`;
  }
  
  // Totals
  md += `| **TOTAL** | **${investmentBreakdown.totalEntries}** | **${investmentBreakdown.avgTimePerEntry} min** | **${currency(investmentBreakdown.totalValue)}** | **100%** |\n\n`;
  
  md += `*Time is estimated: Base (1 min) + Fields (×12s) + Relations (×20s) + Required (×5s)*\n\n`;
  
  return md;
}

/**
 * Format waste analysis section
 */
function formatWasteAnalysis(report: ExecutiveReport): string {
  const { wasteAnalysis } = report;
  
  if (wasteAnalysis.categories.length === 0) {
    return `---\n\n## Waste Analysis\n\n✅ No significant waste detected.\n\n`;
  }
  
  let md = `---\n\n## Waste Breakdown\n\n`;
  
  md += `| Category | Amount | Items | Recoverable? |\n`;
  md += `|----------|--------|-------|-------------|\n`;
  
  wasteAnalysis.categories.forEach(cat => {
    md += `| **${cat.label}** | ${currency(cat.totalAmount)} | ${cat.items.length} | ${cat.recoverable ? 'Yes' : 'Partially'} |\n`;
    
    // Show individual items indented
    cat.items.slice(0, 3).forEach(item => {
      md += `| • ${item.name} | ${currency(item.amount)} | ${item.details} | |\n`;
    });
    if (cat.items.length > 3) {
      md += `| *...${cat.items.length - 3} more* | | | |\n`;
    }
  });
  
  md += `| **TOTAL WASTE** | **${currency(wasteAnalysis.totalWaste)}** | | **${currency(wasteAnalysis.totalRecoverable)} recoverable** |\n\n`;
  
  return md;
}

/**
 * Format internal comparisons section
 */
function formatInternalComparisons(report: ExecutiveReport): string {
  const { internalComparisons } = report;
  
  let md = `---\n\n## Internal Comparisons\n\n`;
  md += `### Your Models Compared (Best vs Worst)\n\n`;
  
  if (internalComparisons.modelComparisons.length > 0) {
    md += `| Metric | Best | Worst | Gap |\n`;
    md += `|--------|------|-------|-----|\n`;
    
    internalComparisons.modelComparisons.forEach(comp => {
      md += `| ${comp.metric} | ${comp.bestModel} (${comp.bestValue}) | ${comp.worstModel} (${comp.worstValue}) | ${comp.gap} |\n`;
    });
    md += `\n`;
    
    // Show insights
    const insights = internalComparisons.modelComparisons.filter(c => c.insight);
    if (insights.length > 0) {
      md += `**Insights:**\n\n`;
      insights.forEach(c => {
        md += `- ${c.insight}\n`;
      });
      md += `\n`;
    }
  }
  
  md += `### Theoretical Targets\n\n`;
  md += `| Metric | Current | Target | Status |\n`;
  md += `|--------|---------|--------|--------|\n`;
  
  internalComparisons.theoreticalTargets.forEach(target => {
    const status = formatStatus(target.status);
    const note = target.note ? ` (${target.note})` : '';
    md += `| ${target.metric} | ${target.currentValue} | ${target.target} | ${status}${note} |\n`;
  });
  md += `\n`;
  
  md += `*${internalComparisons.disclaimer}*\n\n`;
  
  return md;
}

/**
 * Format methodology section
 */
function formatMethodology(report: ExecutiveReport): string {
  const { methodology } = report;
  
  let md = `---\n\n## Methodology & Data Provenance\n\n`;
  
  md += `### Data Source\n\n`;
  md += `| | |\n`;
  md += `|---|---|\n`;
  md += `| Provider | ${methodology.provenance.provider} |\n`;
  md += `| Endpoint | \`${methodology.provenance.endpoint}\` |\n`;
  md += `| Access | ${methodology.provenance.accessType} |\n`;
  md += `| Scan Time | ${new Date(methodology.provenance.scanTime).toISOString()} |\n\n`;
  
  md += `### Coverage\n\n`;
  md += `| | |\n`;
  md += `|---|---|\n`;
  md += `| Models analyzed | ${methodology.provenance.coverage.modelsAnalyzed} of ${methodology.provenance.coverage.totalModels} (100%) |\n`;
  md += `| Entries analyzed | ${methodology.provenance.coverage.entriesAnalyzed.toLocaleString()} of ${methodology.provenance.coverage.totalEntries.toLocaleString()} (100%) |\n`;
  md += `| Components analyzed | ${methodology.provenance.coverage.componentsAnalyzed} of ${methodology.provenance.coverage.totalComponents} (100%) |\n`;
  md += `| Sampling | ${methodology.provenance.coverage.sampling === 'none' ? 'None (full dataset)' : 'Sampled'} |\n\n`;
  
  md += `### Calculations\n\n`;
  md += `- **Content Value:** ${methodology.calculations.contentValue}\n`;
  md += `- **Time per Entry:** ${methodology.calculations.timePerEntry}\n`;
  md += `- **Waste:** ${methodology.calculations.wasteCalculation}\n\n`;
  
  md += `### Assumptions\n\n`;
  methodology.assumptions.forEach(a => {
    md += `- ${a.description} *(impact: ${a.impact})*\n`;
  });
  md += `\n`;
  
  md += `### Limitations\n\n`;
  methodology.limitations.forEach(l => {
    md += `- ${l.description}`;
    if (l.workaround) {
      md += ` → *${l.workaround}*`;
    }
    md += `\n`;
  });
  md += `\n`;
  
  md += `### Confidence Levels\n\n`;
  md += `- **HIGH:** ${methodology.confidenceLevels.high}\n`;
  md += `- **MEDIUM:** ${methodology.confidenceLevels.medium}\n`;
  md += `- **LOW:** ${methodology.confidenceLevels.low}\n\n`;
  
  return md;
}

/**
 * Main function to format report as Markdown
 */
export function formatAsMarkdown(report: ExecutiveReport): string {
  let markdown = '';
  
  markdown += formatExecutiveSummary(report);
  markdown += formatFindings(report.findings);
  markdown += formatInvestmentBreakdown(report);
  markdown += formatWasteAnalysis(report);
  markdown += formatInternalComparisons(report);
  markdown += formatMethodology(report);
  
  markdown += `---\n\n*Report generated by Hygraph Schema Audit v${report.version}*\n`;
  
  return markdown;
}


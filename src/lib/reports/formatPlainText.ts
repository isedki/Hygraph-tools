import type { ExecutiveReport } from './types';

/**
 * Format a number as currency
 */
function currency(amount: number): string {
  return `$${amount.toLocaleString()}`;
}

/**
 * Create a line of characters
 */
function line(char: string, length: number = 60): string {
  return char.repeat(length);
}

/**
 * Center text within a given width
 */
function center(text: string, width: number = 60): string {
  const padding = Math.max(0, Math.floor((width - text.length) / 2));
  return ' '.repeat(padding) + text;
}

/**
 * Right-align text within a given width
 */
function rightAlign(text: string, width: number): string {
  const padding = Math.max(0, width - text.length);
  return ' '.repeat(padding) + text;
}

/**
 * Pad text to a fixed width
 */
function padRight(text: string, width: number): string {
  return text.slice(0, width).padEnd(width);
}

/**
 * Format the executive summary section
 */
function formatExecutiveSummary(report: ExecutiveReport): string {
  const { executiveSummary } = report;
  const { bottomLine, statusIndicators, topActions, narrativeSummary } = executiveSummary;
  
  let txt = '';
  
  txt += line('=') + '\n';
  txt += center(report.reportTitle.toUpperCase()) + '\n';
  txt += center(`Prepared: ${new Date(report.generatedAt).toLocaleDateString('en-US', { 
    year: 'numeric', month: 'long', day: 'numeric' 
  })}`) + '\n';
  txt += line('=') + '\n\n';
  
  // Summary
  txt += 'SUMMARY\n';
  txt += line('-') + '\n';
  txt += `Estimated investment:     ${rightAlign(currency(bottomLine.contentWorth), 15)}\n`;
  txt += `Cleanup opportunity:      ${rightAlign(currency(bottomLine.recoverable), 15)}\n`;
  txt += `Suggested actions:        ${rightAlign(String(bottomLine.actionsToRecover), 15)}\n`;
  txt += `\n* Dollar values are estimates based on modeled time, not actual measurements.\n\n`;
  
  // Status Overview
  txt += 'STATUS OVERVIEW\n';
  txt += line('-') + '\n';
  statusIndicators.forEach(si => {
    const trend = si.trend === 'up' ? ' ^' : si.trend === 'down' ? ' v' : '';
    txt += `${padRight(si.metric + ':', 20)} ${padRight(si.value + trend, 15)} ${si.verdict}\n`;
  });
  txt += '\n';
  
  // Top Actions
  txt += `TOP ${topActions.length} ACTIONS\n`;
  txt += line('-') + '\n';
  topActions.forEach(action => {
    txt += `${action.rank}. ${action.action}\n`;
    txt += `   Impact: ${currency(action.impact)} | Effort: ${action.effort}\n`;
  });
  txt += '\n';
  
  // Narrative Summary
  txt += line('-') + '\n';
  txt += wrapText(narrativeSummary, 60) + '\n\n';
  
  return txt;
}

/**
 * Wrap text to a maximum width
 */
function wrapText(text: string, maxWidth: number): string {
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';
  
  words.forEach(word => {
    if (currentLine.length + word.length + 1 <= maxWidth) {
      currentLine += (currentLine ? ' ' : '') + word;
    } else {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
    }
  });
  if (currentLine) lines.push(currentLine);
  
  return lines.join('\n');
}

/**
 * Format findings section
 */
function formatFindings(report: ExecutiveReport): string {
  const { findings } = report;
  
  if (findings.length === 0) return '';
  
  let txt = line('=') + '\n';
  txt += 'DETAILED FINDINGS\n';
  txt += line('=') + '\n\n';
  
  findings.forEach((finding, index) => {
    txt += `${index + 1}. ${finding.title}\n`;
    txt += line('-', 40) + '\n';
    txt += `Impact:     ${currency(finding.impact)}\n`;
    if (finding.risk) {
      txt += `Risk:       ${finding.risk}\n`;
    }
    txt += `Confidence: ${finding.confidence.toUpperCase()} (${finding.dataPoints} data points)\n\n`;
    
    txt += 'WHAT WE FOUND:\n';
    txt += wrapText(finding.whatWeFound, 60) + '\n\n';
    
    if (finding.whyItHappens) {
      txt += 'WHY THIS HAPPENS:\n';
      txt += wrapText(finding.whyItHappens, 60) + '\n\n';
    }
    
    txt += 'RECOMMENDATIONS:\n';
    finding.recommendations.forEach((rec, i) => {
      txt += `  ${String.fromCharCode(65 + i)}) ${rec.option} (${rec.effort})\n`;
    });
    txt += '\n';
    
    txt += 'EVIDENCE:\n';
    finding.evidence.forEach(e => {
      txt += `  - ${e}\n`;
    });
    txt += '\n';
  });
  
  return txt;
}

/**
 * Format investment breakdown section
 */
function formatInvestmentBreakdown(report: ExecutiveReport): string {
  const { investmentBreakdown } = report;
  
  let txt = line('=') + '\n';
  txt += 'CONTENT INVESTMENT BY MODEL\n';
  txt += line('=') + '\n\n';
  
  // Header
  txt += padRight('Model', 20) + padRight('Entries', 10) + padRight('Avg Time', 10) + padRight('Value', 12) + '%\n';
  txt += line('-') + '\n';
  
  // Top 10 models
  investmentBreakdown.models.slice(0, 10).forEach(model => {
    txt += padRight(model.model.slice(0, 19), 20);
    txt += padRight(model.entries.toString(), 10);
    txt += padRight(model.avgTimeMinutes + ' min', 10);
    txt += padRight(currency(model.totalValue), 12);
    txt += model.percentOfTotal + '%\n';
  });
  
  if (investmentBreakdown.models.length > 10) {
    txt += `... ${investmentBreakdown.models.length - 10} more models\n`;
  }
  
  txt += line('-') + '\n';
  txt += padRight('TOTAL', 20);
  txt += padRight(investmentBreakdown.totalEntries.toString(), 10);
  txt += padRight(investmentBreakdown.avgTimePerEntry + ' min', 10);
  txt += padRight(currency(investmentBreakdown.totalValue), 12);
  txt += '100%\n\n';
  
  txt += 'Time formula: Base (1min) + Fields (x12s) + Relations (x20s) + Required (x5s)\n';
  txt += `Hourly rate: $${investmentBreakdown.hourlyRate}/hr\n\n`;
  
  return txt;
}

/**
 * Format waste analysis section
 */
function formatWasteAnalysis(report: ExecutiveReport): string {
  const { wasteAnalysis } = report;
  
  let txt = line('=') + '\n';
  txt += 'WASTE BREAKDOWN\n';
  txt += line('=') + '\n\n';
  
  if (wasteAnalysis.categories.length === 0) {
    txt += 'No significant waste detected.\n\n';
    return txt;
  }
  
  wasteAnalysis.categories.forEach(cat => {
    txt += `${cat.label.toUpperCase()} (${currency(cat.totalAmount)})\n`;
    txt += line('-', 40) + '\n';
    
    cat.items.slice(0, 5).forEach(item => {
      txt += `  - ${item.name}: ${currency(item.amount)}\n`;
      txt += `    ${item.details}\n`;
    });
    if (cat.items.length > 5) {
      txt += `  ... ${cat.items.length - 5} more\n`;
    }
    txt += `  Recoverable: ${cat.recoverable ? 'Yes' : 'Partially'} (${currency(cat.recoverableAmount)})\n\n`;
  });
  
  txt += line('-') + '\n';
  txt += `TOTAL WASTE:       ${currency(wasteAnalysis.totalWaste)}\n`;
  txt += `TOTAL RECOVERABLE: ${currency(wasteAnalysis.totalRecoverable)}\n\n`;
  
  return txt;
}

/**
 * Format internal comparisons section
 */
function formatInternalComparisons(report: ExecutiveReport): string {
  const { internalComparisons } = report;
  
  let txt = line('=') + '\n';
  txt += 'INTERNAL COMPARISONS (Best vs Worst)\n';
  txt += line('=') + '\n\n';
  
  if (internalComparisons.modelComparisons.length > 0) {
    internalComparisons.modelComparisons.forEach(comp => {
      txt += `${comp.metric}:\n`;
      txt += `  Best:  ${comp.bestModel} (${comp.bestValue})\n`;
      txt += `  Worst: ${comp.worstModel} (${comp.worstValue})\n`;
      txt += `  Gap:   ${comp.gap}\n`;
      if (comp.insight) {
        txt += `  Note:  ${comp.insight}\n`;
      }
      txt += '\n';
    });
  }
  
  txt += 'THEORETICAL TARGETS\n';
  txt += line('-', 40) + '\n';
  txt += padRight('Metric', 20) + padRight('Current', 15) + padRight('Target', 10) + 'Status\n';
  txt += line('-', 55) + '\n';
  
  internalComparisons.theoreticalTargets.forEach(target => {
    const status = target.status === 'met' ? '[OK]' : target.status === 'close' ? '[~]' : '[!!]';
    txt += padRight(target.metric, 20);
    txt += padRight(target.currentValue, 15);
    txt += padRight(target.target, 10);
    txt += status;
    if (target.note) {
      txt += ` ${target.note}`;
    }
    txt += '\n';
  });
  txt += '\n';
  
  txt += `* ${internalComparisons.disclaimer}\n\n`;
  
  return txt;
}

/**
 * Format methodology section
 */
function formatMethodology(report: ExecutiveReport): string {
  const { methodology } = report;
  
  let txt = line('=') + '\n';
  txt += 'METHODOLOGY & DATA PROVENANCE\n';
  txt += line('=') + '\n\n';
  
  txt += 'DATA SOURCE\n';
  txt += line('-', 40) + '\n';
  txt += `Provider:  ${methodology.provenance.provider}\n`;
  txt += `Endpoint:  ${methodology.provenance.endpoint}\n`;
  txt += `Access:    ${methodology.provenance.accessType}\n`;
  txt += `Scan Time: ${methodology.provenance.scanTime}\n\n`;
  
  txt += 'COVERAGE\n';
  txt += line('-', 40) + '\n';
  txt += `Models:     ${methodology.provenance.coverage.modelsAnalyzed}/${methodology.provenance.coverage.totalModels} (100%)\n`;
  txt += `Entries:    ${methodology.provenance.coverage.entriesAnalyzed}/${methodology.provenance.coverage.totalEntries} (100%)\n`;
  txt += `Components: ${methodology.provenance.coverage.componentsAnalyzed}/${methodology.provenance.coverage.totalComponents} (100%)\n`;
  txt += `Sampling:   ${methodology.provenance.coverage.sampling === 'none' ? 'None (full dataset)' : 'Sampled'}\n\n`;
  
  txt += 'ASSUMPTIONS\n';
  txt += line('-', 40) + '\n';
  methodology.assumptions.forEach(a => {
    txt += `- ${a.description} [${a.impact} impact]\n`;
  });
  txt += '\n';
  
  txt += 'LIMITATIONS\n';
  txt += line('-', 40) + '\n';
  methodology.limitations.forEach(l => {
    txt += `- ${l.description}`;
    if (l.workaround) {
      txt += ` (${l.workaround})`;
    }
    txt += '\n';
  });
  txt += '\n';
  
  txt += 'CONFIDENCE LEVELS\n';
  txt += line('-', 40) + '\n';
  txt += `HIGH:   ${methodology.confidenceLevels.high}\n`;
  txt += `MEDIUM: ${methodology.confidenceLevels.medium}\n`;
  txt += `LOW:    ${methodology.confidenceLevels.low}\n\n`;
  
  return txt;
}

/**
 * Main function to format report as plain text
 */
export function formatAsPlainText(report: ExecutiveReport): string {
  let text = '';
  
  text += formatExecutiveSummary(report);
  text += formatFindings(report);
  text += formatInvestmentBreakdown(report);
  text += formatWasteAnalysis(report);
  text += formatInternalComparisons(report);
  text += formatMethodology(report);
  
  text += line('=') + '\n';
  text += center(`Report generated by Hygraph Schema Audit v${report.version}`) + '\n';
  text += line('=') + '\n';
  
  return text;
}


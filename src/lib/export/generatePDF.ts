import type { AuditResult } from '../types';

// Extract project ID from endpoint URL
function extractProjectInfo(endpoint: string): { projectId: string; region: string } {
  try {
    const urlMatch = endpoint.match(/\/content\/([^/]+)\//);
    const regionMatch = endpoint.match(/api-([^.]+)\./);
    return {
      projectId: urlMatch ? urlMatch[1] : 'Unknown',
      region: regionMatch ? regionMatch[1].toUpperCase() : 'Unknown',
    };
  } catch {
    return { projectId: 'Unknown', region: 'Unknown' };
  }
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function getAssessmentColor(assessment: string): string {
  switch (assessment) {
    case 'excellent': return '#10b981';
    case 'good': return '#3b82f6';
    case 'needs-attention': return '#f59e0b';
    case 'critical': return '#ef4444';
    default: return '#6b7280';
  }
}

function getEffortBadge(effort: string): string {
  switch (effort) {
    case 'low': return '<span style="background: #10b981; color: white; padding: 2px 8px; border-radius: 4px; font-size: 11px;">Low Effort</span>';
    case 'medium': return '<span style="background: #f59e0b; color: white; padding: 2px 8px; border-radius: 4px; font-size: 11px;">Medium Effort</span>';
    case 'high': return '<span style="background: #ef4444; color: white; padding: 2px 8px; border-radius: 4px; font-size: 11px;">High Effort</span>';
    default: return '';
  }
}

function getSeverityBadge(severity: string): string {
  switch (severity) {
    case 'critical': return '<span style="background: #ef4444; color: white; padding: 2px 8px; border-radius: 4px; font-size: 11px;">Critical</span>';
    case 'warning': return '<span style="background: #f59e0b; color: white; padding: 2px 8px; border-radius: 4px; font-size: 11px;">Warning</span>';
    case 'info': return '<span style="background: #3b82f6; color: white; padding: 2px 8px; border-radius: 4px; font-size: 11px;">Info</span>';
    default: return '';
  }
}

export function generatePDFContent(result: AuditResult): string {
  const projectInfo = extractProjectInfo(result.connectionInfo.endpoint);
  const report = result.strategicReport;
  const assessmentColor = getAssessmentColor(report.executiveSummary.overallAssessment);
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Hygraph Schema Audit Report</title>
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
          font-size: 12px;
          line-height: 1.6;
          color: #1f2937;
          padding: 40px;
          max-width: 800px;
          margin: 0 auto;
        }
        .header {
          border-bottom: 3px solid ${assessmentColor};
          padding-bottom: 20px;
          margin-bottom: 30px;
        }
        .header h1 {
          font-size: 24px;
          font-weight: 700;
          color: #111827;
          margin-bottom: 8px;
        }
        .header-meta {
          display: flex;
          justify-content: space-between;
          color: #6b7280;
          font-size: 11px;
        }
        .assessment-badge {
          display: inline-block;
          background: ${assessmentColor};
          color: white;
          padding: 4px 12px;
          border-radius: 20px;
          font-weight: 600;
          font-size: 12px;
          text-transform: capitalize;
          margin-bottom: 12px;
        }
        .section {
          margin-bottom: 30px;
          page-break-inside: avoid;
        }
        .section h2 {
          font-size: 16px;
          font-weight: 600;
          color: #111827;
          margin-bottom: 12px;
          padding-bottom: 8px;
          border-bottom: 1px solid #e5e7eb;
        }
        .section h3 {
          font-size: 13px;
          font-weight: 600;
          color: #374151;
          margin: 16px 0 8px 0;
        }
        .metrics-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 16px;
          margin-bottom: 20px;
        }
        .metric {
          text-align: center;
          padding: 12px;
          background: #f9fafb;
          border-radius: 8px;
        }
        .metric-value {
          font-size: 20px;
          font-weight: 700;
          color: #111827;
        }
        .metric-label {
          font-size: 10px;
          color: #6b7280;
          text-transform: uppercase;
        }
        .summary-text {
          font-size: 14px;
          color: #374151;
          margin-bottom: 8px;
        }
        .summary-subtext {
          font-size: 12px;
          color: #6b7280;
          margin-bottom: 16px;
        }
        .list-item {
          padding: 8px 0;
          border-bottom: 1px solid #f3f4f6;
          display: flex;
          align-items: flex-start;
          gap: 8px;
        }
        .list-bullet {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: ${assessmentColor};
          margin-top: 6px;
          flex-shrink: 0;
        }
        .finding-card {
          background: #f9fafb;
          border-radius: 8px;
          padding: 16px;
          margin-bottom: 12px;
          page-break-inside: avoid;
        }
        .finding-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 8px;
        }
        .finding-title {
          font-weight: 600;
          font-size: 13px;
          color: #111827;
        }
        .finding-content {
          font-size: 11px;
          color: #6b7280;
          margin-bottom: 8px;
        }
        .finding-recommendation {
          font-size: 11px;
          color: #059669;
          background: #ecfdf5;
          padding: 8px;
          border-radius: 4px;
          margin-top: 8px;
        }
        .action-section {
          background: #f0fdf4;
          border-radius: 8px;
          padding: 16px;
          margin-bottom: 12px;
        }
        .action-section.short-term {
          background: #fef3c7;
        }
        .action-section.long-term {
          background: #fef2f2;
        }
        .action-title {
          font-weight: 600;
          font-size: 13px;
          margin-bottom: 8px;
        }
        .action-item {
          padding: 6px 0;
          font-size: 11px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .category-score {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 8px 0;
          border-bottom: 1px solid #f3f4f6;
        }
        .category-name {
          width: 120px;
          font-size: 11px;
          color: #6b7280;
          text-transform: capitalize;
        }
        .score-bar {
          flex: 1;
          height: 8px;
          background: #e5e7eb;
          border-radius: 4px;
          overflow: hidden;
        }
        .score-fill {
          height: 100%;
          border-radius: 4px;
        }
        .score-value {
          width: 40px;
          text-align: right;
          font-weight: 600;
          font-size: 12px;
        }
        .page-break {
          page-break-before: always;
        }
        .footer {
          margin-top: 40px;
          padding-top: 20px;
          border-top: 1px solid #e5e7eb;
          text-align: center;
          font-size: 10px;
          color: #9ca3af;
        }
        @media print {
          body {
            padding: 20px;
          }
          .section {
            page-break-inside: avoid;
          }
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>Hygraph Schema Audit Report</h1>
        <div class="header-meta">
          <div>
            <strong>Project:</strong> ${projectInfo.projectId}<br>
            <strong>Region:</strong> ${projectInfo.region}
          </div>
          <div style="text-align: right;">
            <strong>Generated:</strong> ${formatDate(result.connectionInfo.connectedAt)}<br>
            <strong>Assessment Date:</strong> ${formatDate(new Date())}
          </div>
        </div>
      </div>
      
      <!-- Executive Summary -->
      <div class="section">
        <span class="assessment-badge">${report.executiveSummary.overallAssessment.replace('-', ' ')}</span>
        <h2>Executive Summary</h2>
        <p class="summary-text">${report.executiveSummary.headline}</p>
        <p class="summary-subtext">${report.executiveSummary.subheadline}</p>
        
        <div class="metrics-grid">
          <div class="metric">
            <div class="metric-value">${report.executiveSummary.metrics.models}</div>
            <div class="metric-label">Models</div>
          </div>
          <div class="metric">
            <div class="metric-value">${report.executiveSummary.metrics.components}</div>
            <div class="metric-label">Components</div>
          </div>
          <div class="metric">
            <div class="metric-value">${report.executiveSummary.metrics.contentEntries.toLocaleString()}</div>
            <div class="metric-label">Entries</div>
          </div>
          <div class="metric">
            <div class="metric-value">${report.executiveSummary.metrics.reuseScore}%</div>
            <div class="metric-label">Reuse Score</div>
          </div>
        </div>
        
        <h3>Key Findings</h3>
        ${report.executiveSummary.keyFindings.map(f => `
          <div class="list-item">
            <div class="list-bullet"></div>
            <div>${f}</div>
          </div>
        `).join('')}
        
        ${report.executiveSummary.quickWins.length > 0 ? `
          <h3>Quick Wins</h3>
          ${report.executiveSummary.quickWins.map(w => `
            <div class="list-item">
              <div class="list-bullet" style="background: #10b981;"></div>
              <div>${w}</div>
            </div>
          `).join('')}
        ` : ''}
      </div>
      
      <!-- Schema Overview -->
      <div class="section">
        <h2>Schema Overview</h2>
        <div class="metrics-grid">
          <div class="metric">
            <div class="metric-value">${result.schema.modelCount}</div>
            <div class="metric-label">Custom Models</div>
          </div>
          <div class="metric">
            <div class="metric-value">${result.schema.componentCount}</div>
            <div class="metric-label">Components</div>
          </div>
          <div class="metric">
            <div class="metric-value">${result.schema.enumCount}</div>
            <div class="metric-label">Enumerations</div>
          </div>
          <div class="metric">
            <div class="metric-value">${result.schema.totalFields}</div>
            <div class="metric-label">Total Fields</div>
          </div>
        </div>
        
        <h3>Detected Architecture: ${result.contentStrategy.detectedArchitecture.primary.replace('-', ' ')}</h3>
        <p style="font-size: 11px; color: #6b7280; margin-bottom: 8px;">
          Confidence: ${Math.round(result.contentStrategy.detectedArchitecture.confidence * 100)}%
        </p>
        <p style="font-size: 11px; color: #6b7280;">
          ${result.contentStrategy.detectedArchitecture.signals.slice(0, 3).join(' • ')}
        </p>
      </div>
      
      <!-- Use Case Analysis -->
      <div class="section">
        <h2>Use Case Analysis</h2>
        <div style="display: flex; gap: 20px; margin-bottom: 16px;">
          <div>
            <span style="font-size: 32px;">${report.useCaseAnalysis.useCaseIcon}</span>
          </div>
          <div>
            <div style="font-weight: 600; font-size: 14px;">${report.useCaseAnalysis.detectedUseCase}</div>
            <div style="color: #6b7280; font-size: 11px;">Fit Score: ${report.useCaseAnalysis.fitScore}%</div>
          </div>
        </div>
        <p style="font-size: 11px; color: #6b7280;">${report.useCaseAnalysis.fitAssessment}</p>
        
        ${report.useCaseAnalysis.strengths.length > 0 ? `
          <h3>Strengths</h3>
          ${report.useCaseAnalysis.strengths.slice(0, 3).map(s => `
            <div class="list-item">
              <div class="list-bullet" style="background: #10b981;"></div>
              <div>${s.finding}</div>
            </div>
          `).join('')}
        ` : ''}
        
        ${report.useCaseAnalysis.gaps.length > 0 ? `
          <h3>Gaps & Recommendations</h3>
          ${report.useCaseAnalysis.gaps.slice(0, 3).map(g => `
            <div class="list-item">
              <div class="list-bullet" style="background: #f59e0b;"></div>
              <div><strong>${g.finding}</strong> - ${g.recommendation}</div>
            </div>
          `).join('')}
        ` : ''}
      </div>
      
      <!-- Editorial Experience -->
      <div class="section">
        <h2>Editorial Experience</h2>
        <p class="summary-text">Efficiency: <strong style="text-transform: capitalize;">${report.editorialExperience.efficiency}</strong></p>
        <p class="summary-subtext">${report.editorialExperience.editorPersona}</p>
        
        ${report.editorialExperience.painPoints.length > 0 ? `
          <h3>Pain Points</h3>
          ${report.editorialExperience.painPoints.slice(0, 3).map(p => `
            <div class="finding-card">
              <div class="finding-title">${p.issue}</div>
              <div class="finding-content">${p.impact}</div>
              <div class="finding-recommendation">💡 ${p.solution}</div>
            </div>
          `).join('')}
        ` : ''}
      </div>
      
      <div class="page-break"></div>
      
      <!-- Strategic Findings -->
      <div class="section">
        <h2>Strategic Findings</h2>
        ${report.findings.slice(0, 8).map(f => `
          <div class="finding-card">
            <div class="finding-header">
              <span class="finding-title">${f.headline}</span>
              ${getEffortBadge(f.effort)}
            </div>
            <div class="finding-content">
              <strong>Situation:</strong> ${f.situation}<br>
              <strong>Impact:</strong> ${f.impact}
            </div>
            <div class="finding-recommendation">💡 ${f.recommendation}</div>
          </div>
        `).join('')}
      </div>
      
      <!-- Action Plan -->
      <div class="section">
        <h2>Action Plan</h2>
        
        ${report.actionPlan.immediate.length > 0 ? `
          <div class="action-section">
            <div class="action-title">🚀 Immediate Actions (Quick Wins)</div>
            ${report.actionPlan.immediate.map(a => `
              <div class="action-item">
                <span>${a.action}</span>
                ${getEffortBadge(a.effort)}
              </div>
            `).join('')}
          </div>
        ` : ''}
        
        ${report.actionPlan.shortTerm.length > 0 ? `
          <div class="action-section short-term">
            <div class="action-title">📅 Short-term (Next 2-4 Weeks)</div>
            ${report.actionPlan.shortTerm.map(a => `
              <div class="action-item">
                <span>${a.action}</span>
                ${getEffortBadge(a.effort)}
              </div>
            `).join('')}
          </div>
        ` : ''}
        
        ${report.actionPlan.longTerm.length > 0 ? `
          <div class="action-section long-term">
            <div class="action-title">🎯 Long-term (1-3 Months)</div>
            ${report.actionPlan.longTerm.map(a => `
              <div class="action-item">
                <span>${a.action}</span>
                ${getEffortBadge(a.effort)}
              </div>
            `).join('')}
          </div>
        ` : ''}
      </div>
      
      <!-- Category Scores -->
      <div class="section">
        <h2>Category Scores</h2>
        ${result.categoryScores.map(cat => {
          const color = cat.score >= 70 ? '#10b981' : cat.score >= 50 ? '#f59e0b' : '#ef4444';
          return `
            <div class="category-score">
              <div class="category-name">${cat.category.replace('-', ' ')}</div>
              <div class="score-bar">
                <div class="score-fill" style="width: ${cat.score}%; background: ${color};"></div>
              </div>
              <div class="score-value" style="color: ${color};">${cat.score}%</div>
            </div>
          `;
        }).join('')}
      </div>
      
      <!-- Technical Issues Summary -->
      <div class="section">
        <h2>Technical Issues (${result.allIssues.length} Total)</h2>
        ${result.allIssues.filter(i => i.severity === 'critical').length > 0 ? `
          <h3>Critical Issues (${result.allIssues.filter(i => i.severity === 'critical').length})</h3>
          ${result.allIssues.filter(i => i.severity === 'critical').slice(0, 5).map(issue => `
            <div class="finding-card" style="border-left: 3px solid #ef4444;">
              <div class="finding-header">
                <span class="finding-title">${issue.title}</span>
                ${getSeverityBadge(issue.severity)}
              </div>
              <div class="finding-content">${issue.description}</div>
              <div class="finding-recommendation">💡 ${issue.recommendation}</div>
            </div>
          `).join('')}
        ` : ''}
        
        ${result.allIssues.filter(i => i.severity === 'warning').length > 0 ? `
          <h3>Warnings (${result.allIssues.filter(i => i.severity === 'warning').length})</h3>
          ${result.allIssues.filter(i => i.severity === 'warning').slice(0, 5).map(issue => `
            <div class="finding-card" style="border-left: 3px solid #f59e0b;">
              <div class="finding-header">
                <span class="finding-title">${issue.title}</span>
                ${getSeverityBadge(issue.severity)}
              </div>
              <div class="finding-content">${issue.description}</div>
            </div>
          `).join('')}
        ` : ''}
      </div>
      
      <div class="footer">
        <p>Generated by Hygraph Schema Audit Tool</p>
        <p>Report Date: ${formatDate(new Date())}</p>
      </div>
    </body>
    </html>
  `;
}

export async function downloadPDF(result: AuditResult): Promise<void> {
  const html = generatePDFContent(result);
  
  // Create a new window with the HTML content
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('Please allow pop-ups to download the PDF report');
    return;
  }
  
  printWindow.document.write(html);
  printWindow.document.close();
  
  // Wait for content to load then trigger print
  printWindow.onload = () => {
    setTimeout(() => {
      printWindow.print();
    }, 250);
  };
}





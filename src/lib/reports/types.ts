// Executive Business Report Types
// Designed for credibility, trustworthiness, and executive readability

export interface DataProvenance {
  provider: string;
  endpoint: string;
  accessType: 'read-only' | 'full';
  scanTime: string; // ISO timestamp
  scanDuration: number; // seconds
  coverage: {
    modelsAnalyzed: number;
    totalModels: number;
    entriesAnalyzed: number;
    totalEntries: number;
    componentsAnalyzed: number;
    totalComponents: number;
    sampling: 'none' | 'sampled';
  };
}

export interface Assumption {
  id: string;
  description: string;
  impact: 'low' | 'medium' | 'high';
}

export interface Limitation {
  id: string;
  description: string;
  workaround?: string;
}

export interface Methodology {
  provenance: DataProvenance;
  calculations: {
    contentValue: string;
    timePerEntry: string;
    wasteCalculation: string;
  };
  assumptions: Assumption[];
  limitations: Limitation[];
  confidenceLevels: {
    high: string;
    medium: string;
    low: string;
  };
}

// Finding - A specific issue discovered during the audit
export type FindingSeverity = 'high' | 'medium' | 'low';
export type ConfidenceLevel = 'high' | 'medium' | 'low';

export interface Finding {
  id: string;
  title: string;
  impact: number; // Dollar amount
  risk?: string; // e.g., "Growing at ~$50/month"
  confidence: ConfidenceLevel;
  dataPoints: number; // How many data points this is based on
  
  whatWeFound: string;
  whyItHappens?: string;
  
  recommendations: {
    option: string;
    effort: string;
  }[];
  
  evidence: string[];
}

// Waste Categories
export interface WasteItem {
  name: string;
  amount: number;
  details: string;
}

export interface WasteCategory {
  category: 'ghost-models' | 'test-content' | 'over-engineered' | 'unused-components' | 'draft-backlog';
  label: string;
  totalAmount: number;
  items: WasteItem[];
  recoverable: boolean;
  recoverableAmount: number;
}

export interface WasteAnalysis {
  totalWaste: number;
  totalRecoverable: number;
  categories: WasteCategory[];
}

// Investment Breakdown
export interface ModelInvestment {
  model: string;
  entries: number;
  avgTimeMinutes: number;
  totalValue: number;
  percentOfTotal: number;
}

export interface InvestmentBreakdown {
  models: ModelInvestment[];
  totalEntries: number;
  totalValue: number;
  avgTimePerEntry: number;
  hourlyRate: number;
}

// Internal Comparisons (Credible, data-driven)
export interface ModelComparison {
  metric: string;
  bestModel: string;
  bestValue: string;
  worstModel: string;
  worstValue: string;
  gap: string;
  insight?: string;
}

export interface TheoreticalTarget {
  metric: string;
  currentValue: string;
  target: string;
  status: 'met' | 'close' | 'needs-work';
  note?: string;
}

export interface InternalComparisons {
  modelComparisons: ModelComparison[];
  theoreticalTargets: TheoreticalTarget[];
  disclaimer: string;
}

// Top Actions
export interface TopAction {
  rank: number;
  action: string;
  impact: number; // Dollar amount
  effort: string;
  model?: string;
}

// Status Indicators
export interface StatusIndicator {
  metric: string;
  value: string;
  trend?: 'up' | 'down' | 'stable';
  verdict: string;
  targetNote?: string;
}

// Executive Summary
export interface ExecutiveSummary {
  bottomLine: {
    contentWorth: number;
    wasting: number;
    wastePercentage: number;
    recoverable: number;
    actionsToRecover: number;
  };
  statusIndicators: StatusIndicator[];
  topActions: TopAction[];
  narrativeSummary: string;
}

// The Complete Executive Report
export interface ExecutiveReport {
  // Metadata
  reportTitle: string;
  generatedAt: string;
  version: string;
  
  // Page 1: Executive Summary
  executiveSummary: ExecutiveSummary;
  
  // Page 2: Detailed Findings
  findings: Finding[];
  
  // Page 3: Investment Breakdown
  investmentBreakdown: InvestmentBreakdown;
  
  // Page 4: Waste Analysis
  wasteAnalysis: WasteAnalysis;
  
  // Page 5: Methodology
  methodology: Methodology;
  
  // Page 6: Internal Comparisons
  internalComparisons: InternalComparisons;
}

// Export format options
export type ExportFormat = 'markdown' | 'plaintext' | 'json';


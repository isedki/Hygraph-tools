/**
 * Statistical Sampling Utilities
 * 
 * Provides functions for statistically valid sampling of large datasets:
 * - Sample size calculation
 * - Confidence interval calculation
 * - Stratified random sampling
 */

import { SampledMetric, ConfidenceLevel } from './types';

// Z-scores for common confidence levels
const Z_SCORES: Record<number, number> = {
  0.90: 1.645,
  0.95: 1.96,
  0.99: 2.576,
};

/**
 * Calculate required sample size for a proportion estimate
 * 
 * Uses the formula: n = (Z² × p × (1-p)) / E²
 * With finite population correction when applicable
 * 
 * @param population - Total population size
 * @param marginOfError - Desired margin of error (e.g., 0.05 for ±5%)
 * @param confidenceLevel - Confidence level (e.g., 0.95 for 95%)
 * @param expectedProportion - Expected proportion (default 0.5 for max sample size)
 */
export function calculateSampleSize(
  population: number,
  marginOfError: number = 0.10,
  confidenceLevel: number = 0.95,
  expectedProportion: number = 0.5
): number {
  // For small populations, just sample everything
  if (population <= 30) {
    return population;
  }
  
  const z = Z_SCORES[confidenceLevel] || 1.96;
  const p = expectedProportion;
  const e = marginOfError;
  
  // Calculate ideal sample size (infinite population)
  const idealSample = Math.ceil((z * z * p * (1 - p)) / (e * e));
  
  // Apply finite population correction
  const adjustedSample = Math.ceil(
    idealSample / (1 + (idealSample - 1) / population)
  );
  
  // Minimum 30 for statistical validity (Central Limit Theorem)
  return Math.max(30, Math.min(adjustedSample, population));
}

/**
 * Calculate confidence interval for a proportion
 * 
 * @param proportion - Observed proportion (0-1)
 * @param sampleSize - Number of samples
 * @param confidenceLevel - Confidence level (e.g., 0.95)
 */
export function calculateConfidenceInterval(
  proportion: number,
  sampleSize: number,
  confidenceLevel: number = 0.95
): { lower: number; upper: number; marginOfError: number } {
  const z = Z_SCORES[confidenceLevel] || 1.96;
  
  // Standard error of proportion
  const se = Math.sqrt((proportion * (1 - proportion)) / sampleSize);
  
  // Margin of error
  const moe = z * se;
  
  return {
    lower: Math.max(0, proportion - moe),
    upper: Math.min(1, proportion + moe),
    marginOfError: moe,
  };
}

/**
 * Create a sampled metric with confidence info
 */
export function createSampledMetric<T>(
  value: T,
  sampleSize: number,
  populationSize: number,
  confidenceLevel: number = 0.95
): SampledMetric<T> {
  const isExact = sampleSize >= populationSize;
  
  // Calculate margin of error (assuming proportion-based metric)
  let marginOfError = 0;
  if (!isExact && typeof value === 'number' && value >= 0 && value <= 1) {
    const ci = calculateConfidenceInterval(value, sampleSize, confidenceLevel);
    marginOfError = ci.marginOfError;
  } else if (!isExact) {
    // For non-proportion metrics, estimate based on sample ratio
    marginOfError = 1 - (sampleSize / populationSize);
  }
  
  return {
    value,
    sampleSize,
    populationSize,
    marginOfError: Math.round(marginOfError * 100) / 100,
    confidenceLevel,
    isExact,
  };
}

/**
 * Determine confidence level label based on margin of error
 */
export function getConfidenceLabel(metric: SampledMetric<unknown>): {
  level: ConfidenceLevel;
  label: string;
} {
  if (metric.isExact) {
    return { level: 'high', label: 'Exact' };
  }
  
  if (metric.marginOfError <= 0.05) {
    return { level: 'high', label: `±${Math.round(metric.marginOfError * 100)}%` };
  }
  
  if (metric.marginOfError <= 0.10) {
    return { level: 'medium', label: `±${Math.round(metric.marginOfError * 100)}%` };
  }
  
  if (metric.marginOfError <= 0.15) {
    return { level: 'low', label: `±${Math.round(metric.marginOfError * 100)}%` };
  }
  
  return { level: 'low', label: 'Indicative only' };
}

/**
 * Generate stratified sample indices
 * 
 * Divides population into segments and samples from each
 * to ensure representative coverage
 * 
 * @param populationSize - Total items
 * @param sampleSize - Desired sample size
 * @param segments - Number of segments to divide into
 */
export function generateStratifiedIndices(
  populationSize: number,
  sampleSize: number,
  segments: number = 5
): number[] {
  if (sampleSize >= populationSize) {
    // Return all indices
    return Array.from({ length: populationSize }, (_, i) => i);
  }
  
  const indices: number[] = [];
  const perSegment = Math.ceil(sampleSize / segments);
  const segmentSize = Math.floor(populationSize / segments);
  
  for (let i = 0; i < segments; i++) {
    const segmentStart = i * segmentSize;
    const segmentEnd = Math.min((i + 1) * segmentSize, populationSize);
    const available = segmentEnd - segmentStart;
    
    if (available <= perSegment) {
      // Take all from this segment
      for (let j = segmentStart; j < segmentEnd; j++) {
        indices.push(j);
      }
    } else {
      // Random sample from segment
      const sampled = new Set<number>();
      while (sampled.size < perSegment && sampled.size < available) {
        const randomIndex = segmentStart + Math.floor(Math.random() * (segmentEnd - segmentStart));
        sampled.add(randomIndex);
      }
      indices.push(...sampled);
    }
  }
  
  return indices.slice(0, sampleSize);
}

/**
 * Check if sample size is sufficient for statistical validity
 */
export function isSampleSufficient(
  sampleSize: number,
  minRequired: number = 30
): { sufficient: boolean; warning?: string } {
  if (sampleSize >= minRequired) {
    return { sufficient: true };
  }
  
  if (sampleSize >= 10) {
    return {
      sufficient: false,
      warning: `Small sample (${sampleSize}) - results are indicative only`,
    };
  }
  
  return {
    sufficient: false,
    warning: `Insufficient data (${sampleSize} samples) - cannot draw reliable conclusions`,
  };
}

/**
 * Calculate skip values for paginated sampling
 * Useful when API only supports skip/limit pagination
 * 
 * @param populationSize - Total items
 * @param sampleSize - Desired samples
 * @param pageSize - Max items per request
 */
export function calculateSamplingSkips(
  populationSize: number,
  sampleSize: number,
  pageSize: number = 100
): { skip: number; take: number }[] {
  if (sampleSize >= populationSize) {
    // Fetch everything with pagination
    const pages: { skip: number; take: number }[] = [];
    for (let skip = 0; skip < populationSize; skip += pageSize) {
      pages.push({ skip, take: Math.min(pageSize, populationSize - skip) });
    }
    return pages;
  }
  
  // Stratified sampling with pagination
  const segments = 5;
  const perSegment = Math.ceil(sampleSize / segments);
  const segmentSize = Math.floor(populationSize / segments);
  
  const pages: { skip: number; take: number }[] = [];
  
  for (let i = 0; i < segments; i++) {
    const segmentStart = i * segmentSize;
    // Random offset within segment
    const randomOffset = Math.floor(Math.random() * Math.max(1, segmentSize - perSegment));
    pages.push({
      skip: segmentStart + randomOffset,
      take: Math.min(perSegment, pageSize),
    });
  }
  
  return pages;
}


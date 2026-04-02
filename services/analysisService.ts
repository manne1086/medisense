
import { TrendPoint, Medication, BiometricMarker, ComparisonResult } from '../types';

/**
 * Standard Medical Baselines (t0) for comparison.
 * These represent the "Ideal" or "Reference" patient state.
 */
export const BASELINE_PROFILE: Record<string, BiometricMarker> = {
  glucose: { 
    key: 'glucose', 
    label: 'Fasting Glucose', 
    value: 90, 
    unit: 'mg/dL', 
    minRange: 70, 
    maxRange: 100, 
    timestamp: 'Baseline', 
    status: 'Normal' 
  },
  cholesterol: { 
    key: 'cholesterol', 
    label: 'Total Cholesterol', 
    value: 180, 
    unit: 'mg/dL', 
    minRange: 0, 
    maxRange: 200, 
    timestamp: 'Baseline', 
    status: 'Normal' 
  },
  hemoglobin: { 
    key: 'hemoglobin', 
    label: 'Hemoglobin', 
    value: 14.5, 
    unit: 'g/dL', 
    minRange: 13.5, 
    maxRange: 17.5, 
    timestamp: 'Baseline', 
    status: 'Normal' 
  },
  creatinine: { 
    key: 'creatinine', 
    label: 'Serum Creatinine', 
    value: 1.0, 
    unit: 'mg/dL', 
    minRange: 0.7, 
    maxRange: 1.3, 
    timestamp: 'Baseline', 
    status: 'Normal' 
  }
};

/**
 * Calculates the percentage variation (Delta) between current and baseline.
 */
export const calculateComparison = (currentMarkers: Record<string, number>): ComparisonResult[] => {
  const results: ComparisonResult[] = [];

  Object.keys(BASELINE_PROFILE).forEach(key => {
    if (currentMarkers[key] !== undefined) {
      const baseline = BASELINE_PROFILE[key].value;
      const current = currentMarkers[key];
      const delta = ((current - baseline) / baseline) * 100;
      
      let status: 'Improved' | 'Stable' | 'Degraded' = 'Stable';
      if (Math.abs(delta) < 5) status = 'Stable';
      else if (delta > 0) status = 'Degraded'; // Simple assumption: Higher is worse for these metrics generally (except Hb sometimes)
      else status = 'Improved';
      
      // Heuristic adjustments
      if (key === 'hemoglobin' && delta < 0) status = 'Degraded'; // Low Hb is bad

      const isUrgent = current > BASELINE_PROFILE[key].maxRange || current < BASELINE_PROFILE[key].minRange;

      results.push({
        markerKey: key,
        currentValue: current,
        baselineValue: baseline,
        variationPercent: parseFloat(delta.toFixed(1)),
        status,
        isUrgent
      });
    }
  });

  return results;
};

/**
 * Generates the 8-10 line comparative summary string.
 */
export const generateComparativeSummary = (comparisons: ComparisonResult[]): string => {
  if (comparisons.length === 0) return "No compatible markers found for baseline comparison.";

  let summary = "Comparative Analysis against Standard Baselines:\n\n";
  
  comparisons.forEach(c => {
    const direction = c.variationPercent > 0 ? "increased" : "decreased";
    const percent = Math.abs(c.variationPercent);
    const label = BASELINE_PROFILE[c.markerKey].label;
    
    if (c.status === 'Stable') {
        summary += `• ${label} remains stable (Variation: ${c.variationPercent > 0 ? '+' : ''}${c.variationPercent}%). Values are consistent with the baseline.\n`;
    } else {
        const severity = c.isUrgent ? "CRITICAL DEVIATION" : "Notable shift";
        summary += `• ${label} has ${direction} by ${percent}% vs baseline. ${severity} observed.\n`;
    }
  });

  return summary;
};


// Legacy functions kept for compatibility
export const calculateTrendSlope = (data: TrendPoint[]): number => {
  if (data.length < 2) return 0;
  const n = data.length;
  let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
  data.forEach((point, index) => {
    const x = index;
    const y = point.value;
    sumX += x; sumY += y; sumXY += (x * y); sumXX += (x * x);
  });
  return (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
};

export const calculateRiskScore = (data: TrendPoint[]): number => {
    const slope = calculateTrendSlope(data);
    const lastValue = data[data.length - 1].value;
    let score = 20; 
    if (slope > 0) score += slope * 15; 
    if (lastValue > 100) score += (lastValue - 100); 
    return Math.min(Math.max(Math.round(score), 0), 100);
};

export const maskPII = (text: string): string => {
  let masked = text;
  masked = masked.replace(/\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/g, '[DATE-REDACTED]');
  masked = masked.replace(/(Name:|Patient:)\s+([A-Z][a-z]+ [A-Z][a-z]+)/g, '$1 [NAME-REDACTED]');
  masked = masked.replace(/\bID:?\s*(\d+)\b/g, 'ID: [REDACTED]');
  return masked;
};

export const generateICS = (meds: Medication[]): string => {
    let icsContent = "BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//MediSense AI//Prescription Reminder//EN\n";
    const now = new Date();
    const startDate = now.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    meds.forEach((med, index) => {
        icsContent += "BEGIN:VEVENT\n";
        icsContent += `UID:${Date.now()}-${index}@medisense.ai\n`;
        icsContent += `DTSTAMP:${startDate}\n`;
        icsContent += `DTSTART:${startDate}\n`;
        icsContent += `SUMMARY:Take ${med.name} (${med.dosage})\n`;
        icsContent += `DESCRIPTION:Prescription Reminder. Frequency: ${med.frequency}. Notes: ${med.notes || ''}\n`;
        icsContent += `RRULE:FREQ=DAILY;COUNT=14\n`; 
        icsContent += "END:VEVENT\n";
    });
    icsContent += "END:VCALENDAR";
    return icsContent;
};

export const downloadICSFile = (content: string, filename: string = 'medisense_reminders.ics') => {
    const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

export const MOCK_HISTORY: TrendPoint[] = [
  { date: 'Baseline', value: 90, unit: 'mg/dL', source: 'Standard' },
  { date: 'Report 1', value: 95, unit: 'mg/dL', source: 'Lab A' },
  { date: 'Report 2', value: 98, unit: 'mg/dL', source: 'Lab A' },
  { date: 'Current', value: 115, unit: 'mg/dL', source: 'Lab B' },
];

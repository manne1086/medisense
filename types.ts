
export enum SeverityLevel {
  LOW = 'Low',
  MODERATE = 'Moderate',
  URGENT = 'Urgent',
  EMERGENCY = 'Emergency'
}

export interface Hospital {
  name: string;
  address?: string;
  rating?: string;
  userRatingCount?: number;
  googleMapsUri: string;
  distance?: string;
}

export interface TriageResult {
  text: string;
  emotion: 'calm' | 'friendly' | 'alert';
  language_code: string;
  severity?: SeverityLevel;
  needsFollowUp?: boolean;
  followUpQuestions?: string[];
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: Date;
}

export interface MedicationAlternative {
  name: string;
  type: 'Generic' | 'Brand';
  description: string;
}

export interface Medication {
  name: string;
  dosage: string;
  frequency: string;
  type: string;
  description: string;
  alternatives: MedicationAlternative[]; // New field for market alternatives
  duration?: string;
  notes?: string;
}

export interface LifestyleIntervention {
  category: 'Diet' | 'Exercise' | 'Habit' | 'Medical';
  title: string;
  description: string;
  impact: 'High' | 'Medium' | 'Low';
}

// --- Longitudinal & Agentic Analysis Types ---

export type BiomarkerCategory = 'Metabolic' | 'Cardiovascular' | 'Hematology' | 'Renal' | 'Other';
export type InsightConfidence = 'High' | 'Medium' | 'Low';
export type PatientOverallStatus = 'Looks Okay' | 'Monitor' | 'Book Doctor Visit' | 'Needs Urgent Review';

export interface Biomarker {
  name: string;
  value: number;
  unit: string;
  category: BiomarkerCategory;
}

export interface AnalysisOverview {
  overallStatus: PatientOverallStatus;
  headline: string;
  keyConcerns: string[];
  stableIndicators: string[];
  nextSteps: string[];
  questionsToAsk: string[];
  confidence: InsightConfidence;
}

export interface AnalysisCategoryBreakdown {
  name: BiomarkerCategory;
  total: number;
  flagged: number;
}

export interface MedicalReport {
  id: string;
  date: string;
  type: string;
  biomarkers: Biomarker[];
  prescriptions?: Medication[];
  interventions?: LifestyleIntervention[];
  analysis?: MedicalReportAnalysis;
}

export interface RiskCondition {
  condition: string;
  probability: 'Low' | 'Medium' | 'High';
  reasoning: string;
  forecastHorizon?: string;
}

export interface ComparativeMetric {
  name: string;
  currentValue: number;
  previousValue: number | null;
  unit: string;
  deltaPercent: number | null;
  velocity: string;
  status: 'Normal' | 'Warning' | 'Critical';
}

export interface MedicalReportAnalysis {
  summary: string;
  plainLanguageSummary?: string;
  overview?: AnalysisOverview;
  reportType?: string;
  reportDate?: string;
  extractionQuality?: InsightConfidence;
  categoryBreakdown?: AnalysisCategoryBreakdown[];
  risks: RiskCondition[];
  preventiveMeasures: LifestyleIntervention[];
}

export interface AIAnalysisResult extends MedicalReportAnalysis {
  reportId: string;
  comparisons: ComparativeMetric[];
}

// --- Legacy / Visualization Types ---

export interface TrendPoint {
  date: string;
  value: number;
  unit: string;
  source: string;
}

export interface BiometricMarker {
  key: string;
  label: string;
  value: number;
  unit: string;
  minRange: number;
  maxRange: number;
  timestamp: string;
  status: string;
}

export interface ComparisonResult {
  markerKey: string;
  currentValue: number;
  baselineValue: number;
  variationPercent: number;
  status: 'Improved' | 'Stable' | 'Degraded';
  isUrgent: boolean;
}

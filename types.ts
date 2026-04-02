
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

export interface Biomarker {
  name: string;
  value: number;
  unit: string;
  category: 'Metabolic' | 'Cardiovascular' | 'Hematology' | 'Renal' | 'Other';
}

export interface MedicalReport {
  id: string;
  date: string;
  type: string;
  biomarkers: Biomarker[];
  prescriptions?: Medication[];
  interventions?: LifestyleIntervention[];
  analysis?: {
    summary: string;
    risks: RiskCondition[];
    preventiveMeasures: LifestyleIntervention[];
  };
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

export interface AIAnalysisResult {
  reportId: string;
  summary: string;
  comparisons: ComparativeMetric[];
  risks: RiskCondition[];
  preventiveMeasures: LifestyleIntervention[];
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

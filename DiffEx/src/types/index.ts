export interface Feature {
  id: string;
  name: string;
  type: 'symptom' | 'vital' | 'history' | 'lab' | 'test';
  weights: Record<string, number>; // diagnosis id -> weight
}

export interface Test {
  id: string;
  name: string;
  rationale: string;
  relevantFor: string[]; // diagnosis ids this helps differentiate
}

export interface Diagnosis {
  id: string;
  name: string;
  baseWeight: number;
  acuteness: number; // 0-1, triggers "High acuity" badge when > 0.7
}

export interface ChangeLogEntry {
  id: string;
  timestamp: Date;
  action: 'add' | 'remove';
  featureName: string;
  topReasons: string[];
}

export interface PatientData {
  story: string;
  age: number;
  sex: 'M' | 'F' | 'Other';
}

export interface SuggestedQuestion {
  id: string;
  title: string;
  rationale: string;
  featureId: string;
}

export interface SuggestedTest {
  id: string;
  title: string;
  rationale: string;
  testId: string;
}

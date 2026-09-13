import type { Diagnosis, Feature, Test } from '@/types';

export const diagnoses: Diagnosis[] = [
  { id: 'pe', name: 'Pulmonary Embolism', baseWeight: 1.2, acuteness: 0.9 },
  { id: 'chf', name: 'Congestive Heart Failure', baseWeight: 1.0, acuteness: 0.6 },
  { id: 'copd', name: 'COPD Exacerbation', baseWeight: 1.1, acuteness: 0.5 },
  { id: 'cad', name: 'Coronary Artery Disease', baseWeight: 1.0, acuteness: 0.75 },
  { id: 'pneumonia', name: 'Community-Acquired Pneumonia', baseWeight: 0.9, acuteness: 0.6 },
  { id: 'asthma', name: 'Asthma Exacerbation', baseWeight: 0.8, acuteness: 0.4 },
  { id: 'gerd', name: 'GERD with Chest Pain', baseWeight: 0.7, acuteness: 0.2 },
  { id: 'anxiety', name: 'Anxiety/Panic Disorder', baseWeight: 0.6, acuteness: 0.15 },
  { id: 'anemia', name: 'Anemia', baseWeight: 0.5, acuteness: 0.3 },
  { id: 'lung_ca', name: 'Lung Cancer', baseWeight: 0.4, acuteness: 0.8 },
  { id: 'ild', name: 'Interstitial Lung Disease', baseWeight: 0.3, acuteness: 0.5 },
  { id: 'pericarditis', name: 'Pericarditis', baseWeight: 0.35, acuteness: 0.65 },
];

export const features: Feature[] = [
  // Symptoms
  { id: 'sob', name: 'Shortness of breath', type: 'symptom', weights: { pe: 2.0, chf: 2.5, copd: 2.2, cad: 1.5, pneumonia: 1.8, asthma: 2.0, anemia: 1.2, lung_ca: 1.5, ild: 2.0 } },
  { id: 'chest_pain', name: 'Chest pain', type: 'symptom', weights: { pe: 1.8, cad: 2.5, gerd: 1.5, anxiety: 1.2, pericarditis: 2.2, pneumonia: 1.0 } },
  { id: 'cough', name: 'Cough', type: 'symptom', weights: { copd: 2.0, pneumonia: 2.2, asthma: 1.8, chf: 1.2, lung_ca: 1.5, ild: 1.8 } },
  { id: 'hemoptysis', name: 'Hemoptysis', type: 'symptom', weights: { pe: 2.5, lung_ca: 2.8, pneumonia: 1.5, copd: 0.8 } },
  { id: 'leg_swelling', name: 'Leg swelling', type: 'symptom', weights: { pe: 2.2, chf: 2.5, cad: 1.0 } },
  { id: 'orthopnea', name: 'Orthopnea', type: 'symptom', weights: { chf: 2.8, copd: 1.5, asthma: 1.2 } },
  { id: 'pnd', name: 'PND (paroxysmal nocturnal dyspnea)', type: 'symptom', weights: { chf: 2.8, asthma: 1.0 } },
  { id: 'palpitations', name: 'Palpitations', type: 'symptom', weights: { anxiety: 2.0, cad: 1.5, anemia: 1.8, pe: 1.2 } },
  { id: 'fatigue', name: 'Fatigue', type: 'symptom', weights: { anemia: 2.5, chf: 1.8, copd: 1.2, lung_ca: 1.5 } },
  { id: 'fever', name: 'Fever', type: 'symptom', weights: { pneumonia: 2.5, pericarditis: 1.8, pe: 0.8 } },
  { id: 'weight_loss', name: 'Unintentional weight loss', type: 'symptom', weights: { lung_ca: 2.8, copd: 1.0, chf: 1.2 } },
  { id: 'pleuritic', name: 'Pleuritic chest pain', type: 'symptom', weights: { pe: 2.5, pericarditis: 2.2, pneumonia: 2.0, pleurisy: 2.0 } },
  
  // History
  { id: 'smoker', name: 'Smoking history', type: 'history', weights: { copd: 2.5, lung_ca: 2.8, cad: 1.8, pe: 1.2 } },
  { id: 'sedentary', name: 'Sedentary lifestyle', type: 'history', weights: { pe: 1.5, cad: 1.8, chf: 1.2 } },
  { id: 'hx_gerd', name: 'History of GERD', type: 'history', weights: { gerd: 2.5, asthma: 0.8 } },
  { id: 'hx_dm', name: 'History of diabetes', type: 'history', weights: { cad: 1.8, chf: 1.5, pneumonia: 1.2 } },
  { id: 'hx_htn', name: 'History of hypertension', type: 'history', weights: { cad: 2.0, chf: 1.8, pe: 1.0 } },
  { id: 'hx_dvt', name: 'History of DVT/PE', type: 'history', weights: { pe: 3.0 } },
  { id: 'recent_surgery', name: 'Recent surgery/immobilization', type: 'history', weights: { pe: 2.8 } },
  { id: 'family_cad', name: 'Family history of CAD', type: 'history', weights: { cad: 2.2 } },
  
  // Vitals
  { id: 'tachycardia', name: 'Tachycardia (HR > 100)', type: 'vital', weights: { pe: 2.0, anxiety: 1.5, anemia: 1.8, pneumonia: 1.5 } },
  { id: 'hypoxia', name: 'Hypoxia (SpO2 < 94%)', type: 'vital', weights: { pe: 2.2, copd: 2.0, pneumonia: 2.0, chf: 1.8, ild: 2.0 } },
  { id: 'tachypnea', name: 'Tachypnea (RR > 20)', type: 'vital', weights: { pe: 1.8, pneumonia: 1.5, chf: 1.5, copd: 1.5 } },
  { id: 'hypertension', name: 'Elevated BP', type: 'vital', weights: { cad: 1.5, chf: 1.2, anxiety: 1.0 } },
  { id: 'hypotension', name: 'Hypotension', type: 'vital', weights: { pe: 2.5, sepsis: 2.0 } },
  
  // Labs
  { id: 'elevated_ddimer', name: 'Elevated D-dimer', type: 'lab', weights: { pe: 2.5, cad: 0.5 } },
  { id: 'elevated_troponin', name: 'Elevated troponin', type: 'lab', weights: { cad: 3.0, pe: 1.5, chf: 1.2 } },
  { id: 'elevated_bnp', name: 'Elevated BNP/NT-proBNP', type: 'lab', weights: { chf: 3.0, pe: 1.2 } },
  { id: 'low_hgb', name: 'Low hemoglobin', type: 'lab', weights: { anemia: 3.0, lung_ca: 1.2 } },
  { id: 'elevated_wbc', name: 'Elevated WBC', type: 'lab', weights: { pneumonia: 2.2, pericarditis: 1.5 } },
  { id: 'elevated_crp', name: 'Elevated CRP/ESR', type: 'lab', weights: { pneumonia: 1.8, pericarditis: 2.0, ild: 1.5 } },
];

export const tests: Test[] = [
  { id: 'cta', name: 'CT Angiography (Chest)', rationale: 'Gold standard for PE diagnosis', relevantFor: ['pe', 'lung_ca', 'ild'] },
  { id: 'ecg', name: 'ECG', rationale: 'Evaluate for ischemia, arrhythmia, pericarditis', relevantFor: ['cad', 'pe', 'pericarditis'] },
  { id: 'echo', name: 'Echocardiogram', rationale: 'Assess cardiac function and structure', relevantFor: ['chf', 'pe', 'cad', 'pericarditis'] },
  { id: 'cxr', name: 'Chest X-ray', rationale: 'Initial imaging for pulmonary pathology', relevantFor: ['pneumonia', 'chf', 'copd', 'lung_ca', 'ild'] },
  { id: 'pft', name: 'Pulmonary Function Tests', rationale: 'Diagnose and stage obstructive/restrictive disease', relevantFor: ['copd', 'asthma', 'ild'] },
  { id: 'bnp', name: 'BNP/NT-proBNP', rationale: 'Biomarker for heart failure', relevantFor: ['chf', 'pe'] },
  { id: 'troponin', name: 'Troponin', rationale: 'Detect myocardial injury', relevantFor: ['cad', 'pe'] },
  { id: 'ddimer', name: 'D-dimer', rationale: 'Rule out VTE when low pretest probability', relevantFor: ['pe'] },
  { id: 'cbc', name: 'Complete Blood Count', rationale: 'Screen for anemia, infection', relevantFor: ['anemia', 'pneumonia', 'lung_ca'] },
  { id: 'stress_test', name: 'Stress Test', rationale: 'Evaluate for inducible ischemia', relevantFor: ['cad'] },
  { id: 'ct_chest', name: 'CT Chest (non-contrast)', rationale: 'Detailed lung parenchyma evaluation', relevantFor: ['lung_ca', 'ild', 'copd'] },
  { id: 'vq_scan', name: 'V/Q Scan', rationale: 'Alternative to CTA for PE', relevantFor: ['pe'] },
];

export const demoPatient = {
  story: `35-year-old male presenting with progressive shortness of breath over the past month. Also reports intermittent chest pain, worse with exertion. The patient has a 20 pack-year smoking history (1 pack/day for 20 years) and leads a sedentary lifestyle. 

Past medical history significant for GERD (on PPI) and Type 2 Diabetes Mellitus (on metformin). No prior cardiac or pulmonary history. No recent travel or immobilization.

Patient appears mildly anxious, in no acute distress at rest.`,
  age: 35,
  sex: 'M' as const,
  initialFeatures: ['sob', 'chest_pain', 'smoker', 'sedentary', 'hx_gerd', 'hx_dm'],
};

// Additional findings that can be progressively added
export const demoFindings = [
  { featureId: 'tachycardia', description: 'HR 108 bpm noted on vitals' },
  { featureId: 'hypoxia', description: 'SpO2 92% on room air' },
  { featureId: 'elevated_ddimer', description: 'D-dimer returns elevated at 1.2 μg/mL' },
  { featureId: 'leg_swelling', description: 'Left calf appears swollen on exam' },
  { featureId: 'pleuritic', description: 'Patient clarifies pain is sharp, worse with deep breath' },
];

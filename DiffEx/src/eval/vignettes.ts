// ---- Clinical vignette evaluation dataset ----
//
// Each vignette maps a classic presentation to the condition the engine
// should rank highly. Labels must exactly match the seeded knowledge base:
// `expected` matches a Condition.label, and every finding label must resolve
// via findFeatureByLabelOrSynonym (the eval fails loudly on any mismatch).
//
// ⚠️ PROVENANCE: these presentations are textbook-classic constructions,
// NOT yet the published Semigran et al. vignette set (BMJ 2015;351:h3480).
// Before quoting accuracy numbers externally (resume, manuscript), replace
// or verify each entry against the published vignettes and update `source`.

export interface VignetteFinding {
  label: string;
  polarity: 'present' | 'absent';
}

export interface Vignette {
  id: string;
  /** Where this presentation comes from — cite the paper once verified */
  source: string;
  /** Must exactly match a seeded Condition.label */
  expected: string;
  ageYears?: number;
  sex?: 'male' | 'female';
  findings: VignetteFinding[];
}

const CLASSIC = 'textbook-classic presentation (UNVERIFIED — replace with published vignette before citing)';

function present(...labels: string[]): VignetteFinding[] {
  return labels.map(label => ({ label, polarity: 'present' as const }));
}

export const VIGNETTES: Vignette[] = [
  // ---- Adult cardiopulmonary ----
  {
    id: 'pe-01', source: CLASSIC, expected: 'Pulmonary Embolism', ageYears: 62, sex: 'female',
    findings: present('Recent surgery', 'Pleuritic chest pain', 'Breathing issues', 'Tachycardia', 'Leg swelling', 'Hypoxia'),
  },
  {
    id: 'mi-01', source: CLASSIC, expected: 'MI / ACS', ageYears: 58, sex: 'male',
    findings: present('Smoking history', 'Chest pain', 'Diaphoresis', 'Breathing issues'),
  },
  {
    id: 'cap-01', source: CLASSIC, expected: 'Community-Acquired Pneumonia', ageYears: 45, sex: 'male',
    findings: present('Fever', 'Cough', 'Pleuritic chest pain', 'Tachypnea', 'Breathing issues'),
  },
  {
    id: 'chf-01', source: CLASSIC, expected: 'Congestive Heart Failure', ageYears: 72, sex: 'male',
    findings: present('Orthopnea', 'PND', 'Leg swelling', 'Breathing issues', 'Fatigue', 'Edema'),
  },
  {
    id: 'copd-01', source: CLASSIC, expected: 'COPD Exacerbation', ageYears: 66, sex: 'male',
    findings: present('Smoking history', 'Breathing issues', 'Wheezing', 'Cough'),
  },
  {
    id: 'asthma-01', source: CLASSIC, expected: 'Asthma Exacerbation', ageYears: 24, sex: 'female',
    findings: [
      ...present('Wheezing', 'Breathing issues', 'Cough', 'Tachypnea'),
      { label: 'Smoking history', polarity: 'absent' },
    ],
  },
  {
    id: 'gerd-01', source: CLASSIC, expected: 'GERD', ageYears: 41, sex: 'male',
    findings: present('Heartburn', 'Chest pain', 'Epigastric pain'),
  },
  {
    id: 'anxiety-01', source: CLASSIC, expected: 'Anxiety / Panic Disorder', ageYears: 28, sex: 'female',
    findings: present('Anxiety', 'Palpitations', 'Chest pain', 'Breathing issues'),
  },
  {
    id: 'tb-01', source: CLASSIC, expected: 'Tuberculosis', ageYears: 35, sex: 'male',
    findings: present('Cough', 'Fever', 'Night sweats', 'Weight loss', 'Hemoptysis'),
  },

  // ---- Adult GI / abdominal ----
  {
    id: 'appy-01', source: CLASSIC, expected: 'Appendicitis', ageYears: 22, sex: 'male',
    findings: present('Abdominal pain', 'RLQ pain', 'Migration of pain', 'Nausea/Vomiting', 'Anorexia', 'Fever', 'Rebound tenderness'),
  },
  {
    id: 'chole-01', source: CLASSIC, expected: 'Cholecystitis', ageYears: 44, sex: 'female',
    findings: present('RUQ pain', 'Murphy sign', 'Nausea/Vomiting', 'Fever', 'History of gallstones'),
  },
  {
    id: 'panc-01', source: CLASSIC, expected: 'Pancreatitis', ageYears: 39, sex: 'male',
    findings: present('Alcohol use', 'Epigastric pain', 'Pain radiating to back', 'Nausea/Vomiting', 'Elevated lipase'),
  },
  {
    id: 'divert-01', source: CLASSIC, expected: 'Diverticulitis', ageYears: 68, sex: 'female',
    findings: present('LLQ pain', 'Fever', 'Constipation', 'Elevated WBC', 'Abdominal pain'),
  },
  {
    id: 'sbo-01', source: CLASSIC, expected: 'Small Bowel Obstruction', ageYears: 71, sex: 'female',
    findings: present('Abdominal pain', 'Abdominal distension', 'Nausea/Vomiting', 'Constipation', 'Recent surgery'),
  },
  {
    id: 'gib-01', source: CLASSIC, expected: 'GI Bleed', ageYears: 60, sex: 'male',
    findings: present('Melena/GI bleeding', 'Fatigue', 'Tachycardia', 'Syncope'),
  },

  // ---- Adult GU / GYN ----
  {
    id: 'stone-01', source: CLASSIC, expected: 'Nephrolithiasis', ageYears: 34, sex: 'male',
    findings: present('Flank pain', 'Hematuria', 'Nausea/Vomiting'),
  },
  {
    id: 'pyelo-01', source: CLASSIC, expected: 'Pyelonephritis', ageYears: 30, sex: 'female',
    findings: present('Fever', 'Flank pain', 'Dysuria', 'Nausea/Vomiting', 'Positive urinalysis'),
  },
  {
    id: 'uti-01', source: CLASSIC, expected: 'UTI', ageYears: 26, sex: 'female',
    findings: [
      ...present('Dysuria', 'Urinary frequency', 'Pelvic pain', 'Positive urinalysis'),
      { label: 'Fever', polarity: 'absent' },
    ],
  },
  {
    id: 'ectopic-01', source: CLASSIC, expected: 'Ectopic Pregnancy', ageYears: 27, sex: 'female',
    findings: present('Pelvic pain', 'Vaginal bleeding', 'Positive pregnancy test', 'Adnexal tenderness'),
  },

  // ---- Pediatric ----
  {
    id: 'croup-01', source: CLASSIC, expected: 'Croup', ageYears: 2, sex: 'male',
    findings: present('Barky cough', 'Stridor', 'Fever', 'Rhinorrhea'),
  },
  {
    id: 'rsv-01', source: CLASSIC, expected: 'RSV Bronchiolitis', ageYears: 0.5, sex: 'male',
    findings: present('Wheezing', 'Cough', 'Tachypnea', 'Rhinorrhea', 'Poor feeding', 'Fever'),
  },
  {
    id: 'strep-01', source: CLASSIC, expected: 'Streptococcal Pharyngitis', ageYears: 8, sex: 'female',
    findings: [
      ...present('Sore throat', 'Fever', 'Pharyngeal exudate', 'Lymphadenopathy'),
      { label: 'Cough', polarity: 'absent' },
      { label: 'Rhinorrhea', polarity: 'absent' },
    ],
  },
  {
    id: 'aom-01', source: CLASSIC, expected: 'Acute Otitis Media', ageYears: 1.5, sex: 'male',
    findings: present('Ear pain', 'Fever', 'Irritability', 'Rhinorrhea'),
  },
  {
    id: 'intus-01', source: CLASSIC, expected: 'Intussusception', ageYears: 0.75, sex: 'male',
    findings: present('Abdominal pain', 'Currant jelly stool', 'Nausea/Vomiting', 'Lethargy', 'Irritability'),
  },
  {
    id: 'pyloric-01', source: CLASSIC, expected: 'Pyloric Stenosis', ageYears: 0.1, sex: 'male',
    findings: present('Projectile vomiting', 'Poor feeding', 'Weight loss'),
  },
  {
    id: 'mening-01', source: CLASSIC, expected: 'Meningitis', ageYears: 0.5, sex: 'female',
    findings: present('Fever', 'Bulging fontanelle', 'Lethargy', 'Irritability'),
  },
  {
    id: 'kawasaki-01', source: CLASSIC, expected: 'Kawasaki Disease', ageYears: 3, sex: 'male',
    findings: present('Fever', 'Conjunctivitis', 'Strawberry tongue', 'Rash', 'Mucosal erythema', 'Extremity swelling', 'Lymphadenopathy'),
  },
  {
    id: 'hfm-01', source: CLASSIC, expected: 'Hand-Foot-Mouth Disease', ageYears: 2, sex: 'female',
    findings: present('Posterior oral vesicles', 'Hand/foot rash', 'Fever', 'Sore throat'),
  },
  {
    id: 'febrile-01', source: CLASSIC, expected: 'Febrile Seizure', ageYears: 1.5, sex: 'male',
    findings: present('Seizure activity', 'Fever'),
  },
  {
    id: 'torsion-01', source: CLASSIC, expected: 'Testicular Torsion', ageYears: 14, sex: 'male',
    findings: present('Testicular pain', 'Nausea/Vomiting'),
  },
  {
    id: 'epiglottitis-01', source: CLASSIC, expected: 'Epiglottitis', ageYears: 4, sex: 'male',
    findings: [
      ...present('Fever', 'Drooling', 'Stridor', 'Sore throat', 'Breathing issues'),
      { label: 'Barky cough', polarity: 'absent' },
    ],
  },
  {
    id: 'pedappy-01', source: CLASSIC, expected: 'Pediatric Appendicitis', ageYears: 12, sex: 'male',
    findings: present('RLQ pain', 'Migration of pain', 'Nausea/Vomiting', 'Anorexia', 'Fever'),
  },
  {
    id: 'hsp-01', source: CLASSIC, expected: 'IgA Vasculitis (HSP)', ageYears: 6, sex: 'male',
    findings: present('Purpura', 'Abdominal pain', 'Arthralgia', 'Hematuria'),
  },
  {
    id: 'scarlet-01', source: CLASSIC, expected: 'Scarlet Fever', ageYears: 7, sex: 'female',
    findings: present('Rash', 'Strawberry tongue', 'Fever', 'Sore throat', 'Pharyngeal exudate'),
  },
];

// ---- Clinical vignette evaluation dataset ----
//
// Source: Semigran HL, Linder JA, Gidengil C, Mehrotra A. "Evaluation of
// symptom checkers for self diagnosis and triage: audit study."
// BMJ 2015;351:h3480 — Supplemental Table 2 (supplementary appendix),
// which lists 45 standardized patient vignettes with a "simplified"
// (condensed) symptom format designed for symptom checker input.
//
// This file contains the 23 of those 45 vignettes whose target diagnosis
// exists in the DiffEx knowledge base. Findings are transcribed from each
// vignette's published simplified symptom list, restricted to labels that
// resolve in the DiffEx feature registry (symptoms outside the registry
// vocabulary, e.g. headache or sputum color, are necessarily dropped).
//
// The 22 excluded vignettes target diagnoses absent from the KB:
// acute liver failure, DVT, hemolytic uremic syndrome, malaria, Rocky
// Mountain spotted fever, stroke, tetanus, acute sinusitis, back pain (x2),
// cellulitis, mononucleosis, shingles, vertigo, acute bronchitis (x2),
// allergic rhinitis, bee sting, canker sore, candidal yeast infection,
// eczema, stye.
//
// Interpretive mappings (flagged with `mappedDiagnosis`):
// - "Acute conjunctivitis" → Adenovirus Infection (vignette describes
//   classic adenoviral conjunctivitis: day-camp outbreak, URI symptoms)
// - "Vomiting" (2yo, fever) → Viral Gastroenteritis / Gastroenteritis
// - "Salmonella" → Gastroenteritis (bacterial gastroenteritis)
// - Appendicitis (12yo) accepts both KB appendicitis labels
//
// Published comparison point (same paper, full 45-vignette set, averaged
// across 23 symptom checkers): top-1 34% (95% CI 31-37%), top-3 51%.

export type Triage = 'emergent' | 'non-emergent' | 'self-care';

export interface VignetteFinding {
  label: string;
  polarity: 'present' | 'absent';
}

export interface Vignette {
  id: string;
  /** Diagnosis name as written in Semigran et al. Supplemental Table 2 */
  publishedDiagnosis: string;
  /** Accepted KB condition labels (first is primary); rank = best among these */
  expected: string[];
  /** True when publishedDiagnosis → KB label required clinical interpretation */
  mappedDiagnosis?: boolean;
  triage: Triage;
  ageYears?: number;
  sex?: 'male' | 'female';
  findings: VignetteFinding[];
}

function present(...labels: string[]): VignetteFinding[] {
  return labels.map(label => ({ label, polarity: 'present' as const }));
}

function absent(...labels: string[]): VignetteFinding[] {
  return labels.map(label => ({ label, polarity: 'absent' as const }));
}

export const VIGNETTES: Vignette[] = [
  // ---- Requires emergent care ----
  {
    id: 'sg-appendicitis', publishedDiagnosis: 'Appendicitis',
    expected: ['Pediatric Appendicitis', 'Appendicitis'], triage: 'emergent',
    ageYears: 12, sex: 'female',
    // "12 y/o f, sudden onset severe abdominal pain, nausea, vomiting, diarrhea, T=104"
    findings: present('Abdominal pain', 'Nausea/Vomiting', 'Diarrhea', 'Fever'),
  },
  {
    id: 'sg-asthma', publishedDiagnosis: 'Asthma',
    expected: ['Asthma Exacerbation'], triage: 'emergent',
    ageYears: 27, sex: 'female',
    // "27 y/o f, Hx of asthma, mild shortness of breath, wheezing, 3 days cough,
    //  symptoms not responsive to inhalers, recent cold"
    findings: present('Breathing issues', 'Wheezing', 'Cough'),
  },
  {
    id: 'sg-copd-severe', publishedDiagnosis: 'COPD flare (more severe)',
    expected: ['COPD Exacerbation'], triage: 'emergent',
    ageYears: 67, sex: 'female',
    // "67 y/o f, Hx of COPD, 3 days worsening shortness of breath, increase coughing,
    //  green sputum, low grade fever, increase use of rescue bronchodilator therapy"
    // (100-pack-year smoking history from full vignette)
    findings: present('Breathing issues', 'Cough', 'Fever', 'Smoking history'),
  },
  {
    id: 'sg-heart-attack', publishedDiagnosis: 'Heart Attack',
    expected: ['MI / ACS'], triage: 'emergent',
    ageYears: 64, sex: 'male',
    // "64 y/o m, 1 day chest pain (8/10), non-radiating substernal chest pressure,
    //  sweating, shortness of breath, (chest tightness)"
    findings: present('Chest pain', 'Diaphoresis', 'Breathing issues'),
  },
  {
    id: 'sg-kidney-stones', publishedDiagnosis: 'Kidney stones',
    expected: ['Nephrolithiasis'], triage: 'emergent',
    ageYears: 45, sex: 'male',
    // "45 y/o m, 1 hour severe left-sided flank pain radiating into groin, nausea,
    //  vomiting, pain unrelieved by position"
    findings: present('Flank pain', 'Nausea/Vomiting'),
  },
  {
    id: 'sg-meningitis', publishedDiagnosis: 'Meningitis',
    expected: ['Meningitis'], triage: 'emergent',
    ageYears: 18, sex: 'male',
    // "18 y/o m, 3 days severe headache, fever, photophobia, neck stiffness"
    findings: present('Headache', 'Fever', 'Photophobia', 'Neck stiffness'),
  },
  {
    id: 'sg-pneumonia-adult', publishedDiagnosis: 'Pneumonia',
    expected: ['Community-Acquired Pneumonia'], triage: 'emergent',
    ageYears: 65, sex: 'male',
    // "65 y/o m, Hx of hypertension and degenerative joint disease, 3 day Hx of
    //  productive cough and fever (101)"
    findings: present('Cough', 'Fever'),
  },
  {
    id: 'sg-pe', publishedDiagnosis: 'Pulmonary embolism',
    expected: ['Pulmonary Embolism'], triage: 'emergent',
    ageYears: 65, sex: 'male',
    // "65 y/o m, shortness of breath for 30 min, chest pain that worsens with
    //  inspiration, recent surgery, recent bed rest, swelling in left calf,
    //  which is tender, fever"
    findings: present('Breathing issues', 'Pleuritic chest pain', 'Recent surgery', 'Leg swelling', 'Fever'),
  },

  // ---- Requires non-emergent care ----
  {
    id: 'sg-aom', publishedDiagnosis: 'Acute otitis media',
    expected: ['Acute Otitis Media'], triage: 'non-emergent',
    ageYears: 1.5, sex: 'female',
    // "18 mo f, 1 week rhinorrhea, cough, congestion, irritable, lack of appetite,
    //  fever, in daycare" — note: no ear findings in the simplified format
    findings: present('Rhinorrhea', 'Cough', 'Irritability', 'Poor feeding', 'Fever'),
  },
  {
    id: 'sg-strep-child', publishedDiagnosis: 'Acute pharyngitis (streptococcal)',
    expected: ['Streptococcal Pharyngitis'], triage: 'non-emergent',
    ageYears: 7, sex: 'female',
    // "7 y/o f, fever (101), nausea, vomiting, sore throat, swollen lymph nodes,
    //  tonsilar exudate; no cough, rhinorrhea, or nasal congestion"
    findings: [
      ...present('Fever', 'Nausea/Vomiting', 'Sore throat', 'Lymphadenopathy', 'Pharyngeal exudate'),
      ...absent('Cough', 'Rhinorrhea'),
    ],
  },
  {
    id: 'sg-strep-adult', publishedDiagnosis: 'Acute pharyngitis (streptococcal)',
    expected: ['Streptococcal Pharyngitis'], triage: 'non-emergent',
    ageYears: 24, sex: 'male',
    // "24 y/o m, sore throat, fever (102.2), headache, no cough, tonsilar exudates"
    findings: [
      ...present('Sore throat', 'Fever', 'Headache', 'Pharyngeal exudate'),
      ...absent('Cough'),
    ],
  },
  {
    id: 'sg-copd-mild', publishedDiagnosis: 'COPD flare (milder)',
    expected: ['COPD Exacerbation'], triage: 'non-emergent',
    ageYears: 56, sex: 'female',
    // "56 y/o f, Hx of smoking, shortness of breath and cough for several days,
    //  rhinorrhea 3 days ago, white sputum, no chills"
    findings: present('Smoking history', 'Breathing issues', 'Cough', 'Rhinorrhea'),
  },
  {
    id: 'sg-influenza', publishedDiagnosis: 'Influenza',
    expected: ['Influenza'], triage: 'non-emergent',
    ageYears: 30, sex: 'female',
    // "30 y/o f, 2 day fever, cough, headache, weakness, did not get flu shot"
    findings: present('Fever', 'Cough', 'Headache', 'Fatigue'),
  },
  {
    id: 'sg-pud', publishedDiagnosis: 'Peptic Ulcer Disease',
    expected: ['Peptic Ulcer Disease'], triage: 'non-emergent',
    ageYears: 40, sex: 'male',
    // "40 y/o m, 2 month Hx of intermittent upper abdominal pain, dulling and
    //  gnawing ache, wakes at night and is relieved by food/drinking milk/ranitidine"
    findings: present('Epigastric pain', 'Abdominal pain'),
  },
  {
    id: 'sg-pneumonia-child', publishedDiagnosis: 'Pneumonia (pediatric)',
    expected: ['Pediatric Pneumonia'], triage: 'non-emergent',
    ageYears: 6, sex: 'male',
    // "6 y/o m, Hx of asthma, 5 days cough, fever, appetite good, yellow sputum, t 101.6"
    findings: [
      ...present('Cough', 'Fever'),
      ...absent('Poor feeding'),
    ],
  },
  {
    id: 'sg-salmonella', publishedDiagnosis: 'Salmonella',
    expected: ['Gastroenteritis', 'Viral Gastroenteritis'], mappedDiagnosis: true,
    triage: 'non-emergent',
    ageYears: 14, sex: 'male',
    // "14 y/o m, nausea, vomiting, non-bloody diarrhea, mild abdominal cramps
    //  (T=100.1), mild abdominal tenderness, diarrhea after attending a picnic
    //  and eating undercooked chicken"
    findings: present('Nausea/Vomiting', 'Diarrhea', 'Abdominal pain', 'Fever'),
  },
  {
    id: 'sg-uti', publishedDiagnosis: 'Urinary tract infection',
    expected: ['UTI'], triage: 'non-emergent',
    ageYears: 26, sex: 'female',
    // "26 y/o f, painful urination, urgent need to urinate, more frequent urination
    //  for 2 days, sexually active; no fever, chills, nausea, vomiting, back pain,
    //  vaginal discharge, vaginal pruritus"
    findings: [
      ...present('Dysuria', 'Urinary frequency', 'Sexually active'),
      ...absent('Fever', 'Nausea/Vomiting'),
    ],
  },

  // ---- Self-care appropriate ----
  {
    id: 'sg-conjunctivitis', publishedDiagnosis: 'Acute conjunctivitis',
    expected: ['Adenovirus Infection'], mappedDiagnosis: true, triage: 'self-care',
    ageYears: 14, sex: 'male',
    // "14 y/o m, 3 days red, irritated eye (spread from right to left), discharge,
    //  URI symptoms, no pain or light sensitivity"
    findings: present('Conjunctivitis', 'Rhinorrhea'),
  },
  {
    id: 'sg-viral-pharyngitis', publishedDiagnosis: 'Acute pharyngitis (viral)',
    expected: ['Viral Pharyngitis'], triage: 'self-care',
    ageYears: 26, sex: 'male',
    // "26 y/o m, 2 day sore throat, headache, cough, no fever" (pharyngeal erythema on exam)
    findings: [
      ...present('Sore throat', 'Headache', 'Cough', 'Mucosal erythema'),
      ...absent('Fever'),
    ],
  },
  {
    id: 'sg-constipation', publishedDiagnosis: 'Constipation',
    expected: ['Pediatric Constipation'], triage: 'self-care',
    ageYears: 0.42, sex: 'male',
    // "5 mo m, difficulty/delay in passing hard stools, strains for hours, may miss
    //  a day, screams when passes stool and occasional spots of blood"
    findings: present('Constipation', 'Irritability'),
  },
  {
    id: 'sg-uri-56', publishedDiagnosis: 'Viral upper respiratory illness',
    expected: ['Viral URI'], triage: 'self-care',
    ageYears: 56, sex: 'male',
    // "56 y/o m, 6 day cough, nasal congestion, green nasal discharge, fever (100.8),
    //  rhinorrhea"
    findings: present('Cough', 'Rhinorrhea', 'Fever'),
  },
  {
    id: 'sg-uri-30', publishedDiagnosis: 'Viral upper respiratory illness',
    expected: ['Viral URI'], triage: 'self-care',
    ageYears: 30, sex: 'male',
    // "30 y/o m, 2 day Hx of runny nose, sore throat, hot, sweaty, mild headache,
    //  cough with clear sputum, muscle aches, no fever or neck stiffness" (smokes 10/day)
    findings: [
      ...present('Rhinorrhea', 'Sore throat', 'Headache', 'Cough', 'Smoking history'),
      ...absent('Fever', 'Neck stiffness'),
    ],
  },
  {
    id: 'sg-vomiting', publishedDiagnosis: 'Vomiting',
    expected: ['Viral Gastroenteritis', 'Gastroenteritis'], mappedDiagnosis: true,
    triage: 'self-care',
    ageYears: 2, sex: 'male',
    // "2 y/o m, low grade fever (T = 100.5), vomited twice, vomits up juice"
    findings: present('Fever', 'Nausea/Vomiting'),
  },
];

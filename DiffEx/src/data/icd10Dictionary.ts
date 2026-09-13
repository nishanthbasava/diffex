// ICD-10-CM starter subset for DiffEx seeded conditions
// Maps condition labels to their primary ICD-10 codes

export interface Icd10Entry {
  code: string;
  title: string;
}

export const icd10Dictionary: Record<string, Icd10Entry> = {
  // Cardiopulm
  'I26.99': { code: 'I26.99', title: 'Other pulmonary embolism without acute cor pulmonale' },
  'I26.09': { code: 'I26.09', title: 'Other pulmonary embolism with acute cor pulmonale' },
  'J44.1': { code: 'J44.1', title: 'Chronic obstructive pulmonary disease with acute exacerbation' },
  'J44.0': { code: 'J44.0', title: 'COPD with acute lower respiratory infection' },
  'I50.9': { code: 'I50.9', title: 'Heart failure, unspecified' },
  'I50.20': { code: 'I50.20', title: 'Unspecified systolic (congestive) heart failure' },
  'I50.30': { code: 'I50.30', title: 'Unspecified diastolic (congestive) heart failure' },
  'J18.9': { code: 'J18.9', title: 'Pneumonia, unspecified organism' },
  'J15.9': { code: 'J15.9', title: 'Unspecified bacterial pneumonia' },
  'J45.21': { code: 'J45.21', title: 'Mild intermittent asthma with acute exacerbation' },
  'J45.41': { code: 'J45.41', title: 'Moderate persistent asthma with acute exacerbation' },
  'F41.0': { code: 'F41.0', title: 'Panic disorder [episodic paroxysmal anxiety]' },
  'F41.1': { code: 'F41.1', title: 'Generalized anxiety disorder' },
  'D64.9': { code: 'D64.9', title: 'Anemia, unspecified' },
  'D50.9': { code: 'D50.9', title: 'Iron deficiency anemia, unspecified' },
  'K21.0': { code: 'K21.0', title: 'Gastro-esophageal reflux disease with esophagitis' },
  'K21.9': { code: 'K21.9', title: 'Gastro-esophageal reflux disease without esophagitis' },
  'I30.9': { code: 'I30.9', title: 'Acute pericarditis, unspecified' },
  'I30.0': { code: 'I30.0', title: 'Acute nonspecific idiopathic pericarditis' },
  'C34.90': { code: 'C34.90', title: 'Malignant neoplasm of unspecified part of bronchus or lung' },
  'C34.10': { code: 'C34.10', title: 'Malignant neoplasm of upper lobe, bronchus or lung' },
  'J84.9': { code: 'J84.9', title: 'Interstitial pulmonary disease, unspecified' },
  'J84.10': { code: 'J84.10', title: 'Pulmonary fibrosis, unspecified' },
  'I21.9': { code: 'I21.9', title: 'Acute myocardial infarction, unspecified' },
  'I20.0': { code: 'I20.0', title: 'Unstable angina' },
  'I24.9': { code: 'I24.9', title: 'Acute ischemic heart disease, unspecified' },
  'J93.9': { code: 'J93.9', title: 'Pneumothorax, unspecified' },
  'J93.0': { code: 'J93.0', title: 'Spontaneous tension pneumothorax' },
  'J90': { code: 'J90', title: 'Pleural effusion, not elsewhere classified' },
  'J91.8': { code: 'J91.8', title: 'Pleural effusion in other conditions classified elsewhere' },
  'I71.00': { code: 'I71.00', title: 'Dissection of unspecified site of aorta' },
  'I71.01': { code: 'I71.01', title: 'Dissection of thoracic aorta' },
  'I27.0': { code: 'I27.0', title: 'Primary pulmonary hypertension' },
  'I27.20': { code: 'I27.20', title: 'Pulmonary hypertension, unspecified' },
  'I40.9': { code: 'I40.9', title: 'Acute myocarditis, unspecified' },
  'M94.0': { code: 'M94.0', title: 'Chondrocostal junction syndrome [Tietze]' },
  'R07.1': { code: 'R07.1', title: 'Chest pain on breathing (costochondritis)' },
  'A15.0': { code: 'A15.0', title: 'Tuberculosis of lung' },
  'D86.0': { code: 'D86.0', title: 'Sarcoidosis of lung' },
  'D86.9': { code: 'D86.9', title: 'Sarcoidosis, unspecified' },
  'I48.91': { code: 'I48.91', title: 'Unspecified atrial fibrillation' },
  'I48.0': { code: 'I48.0', title: 'Paroxysmal atrial fibrillation' },
  'I35.9': { code: 'I35.9', title: 'Aortic valve disorder, unspecified' },
  'I34.0': { code: 'I34.0', title: 'Nonrheumatic mitral (valve) insufficiency' },
  'J47.9': { code: 'J47.9', title: 'Bronchiectasis, uncomplicated' },
  'J47.1': { code: 'J47.1', title: 'Bronchiectasis with acute exacerbation' },
  'G47.33': { code: 'G47.33', title: 'Obstructive sleep apnea (adult) (pediatric)' },
  'Z72.3': { code: 'Z72.3', title: 'Lack of physical exercise' },
  'R53.1': { code: 'R53.1', title: 'Weakness' },

  // GI pack
  'K35.80': { code: 'K35.80', title: 'Unspecified acute appendicitis' },
  'K35.89': { code: 'K35.89', title: 'Other acute appendicitis' },
  'K81.0': { code: 'K81.0', title: 'Acute cholecystitis' },
  'K80.00': { code: 'K80.00', title: 'Calculus of gallbladder with acute cholecystitis' },
  'K85.9': { code: 'K85.9', title: 'Acute pancreatitis, unspecified' },
  'K85.90': { code: 'K85.90', title: 'Acute pancreatitis without necrosis or infection, unspecified' },
  'K56.60': { code: 'K56.60', title: 'Unspecified intestinal obstruction' },
  'K56.69': { code: 'K56.69', title: 'Other intestinal obstruction' },
  'A09': { code: 'A09', title: 'Infectious gastroenteritis and colitis, unspecified' },
  'K52.9': { code: 'K52.9', title: 'Noninfective gastroenteritis and colitis, unspecified' },
  'K57.32': { code: 'K57.32', title: 'Diverticulitis of large intestine without perforation or abscess' },
  'K57.30': { code: 'K57.30', title: 'Diverticulosis of large intestine without perforation or abscess' },
  'K25.9': { code: 'K25.9', title: 'Gastric ulcer, unspecified' },
  'K26.9': { code: 'K26.9', title: 'Duodenal ulcer, unspecified' },
  'K92.2': { code: 'K92.2', title: 'Gastrointestinal hemorrhage, unspecified' },
  'K92.0': { code: 'K92.0', title: 'Hematemesis' },
  'K55.069': { code: 'K55.069', title: 'Acute (reversible) ischemia of small intestine' },
  'K63.1': { code: 'K63.1', title: 'Perforation of intestine (nontraumatic)' },
  'B19.9': { code: 'B19.9', title: 'Unspecified viral hepatitis without hepatic coma' },
  'K75.9': { code: 'K75.9', title: 'Inflammatory liver disease, unspecified' },
  'K50.90': { code: 'K50.90', title: 'Crohn disease, unspecified' },
  'K51.90': { code: 'K51.90', title: 'Ulcerative colitis, unspecified' },

  // GU pack
  'N20.0': { code: 'N20.0', title: 'Calculus of kidney' },
  'N20.1': { code: 'N20.1', title: 'Calculus of ureter' },
  'N10': { code: 'N10', title: 'Acute tubulo-interstitial nephritis (pyelonephritis)' },
  'N12': { code: 'N12', title: 'Tubulo-interstitial nephritis, not specified as acute or chronic' },
  'N39.0': { code: 'N39.0', title: 'Urinary tract infection, site not specified' },

  // GYN pack
  'N83.51': { code: 'N83.51', title: 'Torsion of right ovary and ovarian pedicle' },
  'N83.52': { code: 'N83.52', title: 'Torsion of left ovary and ovarian pedicle' },
  'O00.90': { code: 'O00.90', title: 'Unspecified ectopic pregnancy without intrauterine pregnancy' },
  'O00.91': { code: 'O00.91', title: 'Unspecified ectopic pregnancy with intrauterine pregnancy' },
  'N73.0': { code: 'N73.0', title: 'Acute parametritis and pelvic cellulitis' },
  'N70.01': { code: 'N70.01', title: 'Acute salpingitis' },
  'N83.20': { code: 'N83.20', title: 'Unspecified ovarian cysts' },
  'N80.0': { code: 'N80.0', title: 'Endometriosis of uterus' },

  // Sepsis
  'A41.9': { code: 'A41.9', title: 'Sepsis, unspecified organism' },
  'R65.20': { code: 'R65.20', title: 'Severe sepsis without septic shock' },

  // Pediatric pack
  'B08.5': { code: 'B08.5', title: 'Enteroviral vesicular pharyngitis [herpangina]' },
  'B08.4': { code: 'B08.4', title: 'Enteroviral vesicular stomatitis with exanthem [HFMD]' },
  'J06.9': { code: 'J06.9', title: 'Acute upper respiratory infection, unspecified' },
  'J11.1': { code: 'J11.1', title: 'Influenza due to unidentified influenza virus with other respiratory manifestations' },
  'J10.1': { code: 'J10.1', title: 'Influenza due to other identified influenza virus with other respiratory manifestations' },
  'J21.0': { code: 'J21.0', title: 'Acute bronchiolitis due to respiratory syncytial virus' },
  'B97.0': { code: 'B97.0', title: 'Adenovirus as the cause of diseases classified elsewhere' },
  'B08.20': { code: 'B08.20', title: 'Exanthema subitum [roseola], unspecified' },
  'B08.3': { code: 'B08.3', title: 'Erythema infectiosum [fifth disease]' },
  'J05.0': { code: 'J05.0', title: 'Acute obstructive laryngitis [croup]' },
  'J45.20': { code: 'J45.20', title: 'Mild intermittent asthma, uncomplicated' },
  'J18.1': { code: 'J18.1', title: 'Lobar pneumonia, unspecified organism' },
  'A37.90': { code: 'A37.90', title: 'Whooping cough, unspecified species without pneumonia' },
  'T17.9': { code: 'T17.9', title: 'Foreign body in respiratory tract, part unspecified' },
  'J05.10': { code: 'J05.10', title: 'Acute epiglottitis without obstruction' },
  'J05.11': { code: 'J05.11', title: 'Acute epiglottitis with obstruction' },
  'H66.90': { code: 'H66.90', title: 'Otitis media, unspecified, unspecified ear' },
  'J02.0': { code: 'J02.0', title: 'Streptococcal pharyngitis' },
  'J02.9': { code: 'J02.9', title: 'Acute pharyngitis, unspecified' },
  'J36': { code: 'J36', title: 'Peritonsillar abscess' },
  'J39.0': { code: 'J39.0', title: 'Retropharyngeal and parapharyngeal abscess' },
  'A08.39': { code: 'A08.39', title: 'Other viral enteritis' },
  'K59.00': { code: 'K59.00', title: 'Constipation, unspecified' },
  'K38.9': { code: 'K38.9', title: 'Disease of appendix, unspecified' },
  'K56.1': { code: 'K56.1', title: 'Intussusception' },
  'K31.1': { code: 'K31.1', title: 'Adult hypertrophic pyloric stenosis' },
  'Q40.0': { code: 'Q40.0', title: 'Congenital hypertrophic pyloric stenosis' },
  'Q43.3': { code: 'Q43.3', title: 'Congenital malformations of intestinal fixation' },
  'K55.0': { code: 'K55.0', title: 'Acute vascular disorders of intestine' },
  'I88.0': { code: 'I88.0', title: 'Nonspecific mesenteric lymphadenitis' },
  'D69.0': { code: 'D69.0', title: 'Allergic purpura [Henoch-Schönlein]' },
  'N39.0P': { code: 'N39.0', title: 'Urinary tract infection, site not specified' },
  'N10P': { code: 'N10', title: 'Acute tubulo-interstitial nephritis (pyelonephritis)' },
  'N44.0': { code: 'N44.0', title: 'Torsion of testis' },
  'N44.00': { code: 'N44.00', title: 'Torsion of testis, unspecified' },
  'R56.00': { code: 'R56.00', title: 'Simple febrile convulsions' },
  'R56.01': { code: 'R56.01', title: 'Complex febrile convulsions' },
  'G40.909': { code: 'G40.909', title: 'Epilepsy, unspecified, not intractable, without status epilepticus' },
  'G03.9': { code: 'G03.9', title: 'Meningitis, unspecified' },
  'G04.90': { code: 'G04.90', title: 'Encephalitis and encephalomyelitis, unspecified' },
  'P36.9': { code: 'P36.9', title: 'Bacterial sepsis of newborn, unspecified' },
  'P59.9': { code: 'P59.9', title: 'Neonatal jaundice, unspecified' },
  'R68.13': { code: 'R68.13', title: 'Apparent life threatening event in infant (ALTE/BRUE)' },
  'A38.9': { code: 'A38.9', title: 'Scarlet fever, uncomplicated' },
  'M30.3': { code: 'M30.3', title: 'Mucocutaneous lymph node syndrome [Kawasaki]' },
  'M35.81': { code: 'M35.81', title: 'Multisystem inflammatory syndrome (MIS)' },
};

// Condition label -> ICD-10 code mapping
export const conditionIcd10Map: Record<string, string[]> = {
  // Cardiopulm
  'Pulmonary Embolism': ['I26.99', 'I26.09'],
  'COPD Exacerbation': ['J44.1', 'J44.0'],
  'Congestive Heart Failure': ['I50.9', 'I50.20', 'I50.30'],
  'Community-Acquired Pneumonia': ['J18.9', 'J15.9'],
  'Asthma Exacerbation': ['J45.21', 'J45.41'],
  'Anxiety / Panic Disorder': ['F41.0', 'F41.1'],
  'Anemia': ['D64.9', 'D50.9'],
  'GERD': ['K21.0', 'K21.9'],
  'Pericarditis': ['I30.9', 'I30.0'],
  'Lung Cancer': ['C34.90', 'C34.10'],
  'Interstitial Lung Disease': ['J84.9', 'J84.10'],
  'MI / ACS': ['I21.9', 'I20.0', 'I24.9'],
  'Pneumothorax': ['J93.9', 'J93.0'],
  'Pleural Effusion': ['J90', 'J91.8'],
  'Aortic Dissection': ['I71.00', 'I71.01'],
  'Pulmonary Hypertension': ['I27.0', 'I27.20'],
  'Myocarditis': ['I40.9'],
  'Costochondritis': ['M94.0', 'R07.1'],
  'Tuberculosis': ['A15.0'],
  'Sarcoidosis': ['D86.0', 'D86.9'],
  'Atrial Fibrillation': ['I48.91', 'I48.0'],
  'Valvular Heart Disease': ['I35.9', 'I34.0'],
  'Bronchiectasis': ['J47.9', 'J47.1'],
  'Obstructive Sleep Apnea': ['G47.33'],
  'Deconditioning': ['Z72.3', 'R53.1'],

  // GI
  'Appendicitis': ['K35.80', 'K35.89'],
  'Cholecystitis': ['K81.0', 'K80.00'],
  'Pancreatitis': ['K85.9', 'K85.90'],
  'Small Bowel Obstruction': ['K56.60', 'K56.69'],
  'Gastroenteritis': ['A09', 'K52.9'],
  'Diverticulitis': ['K57.32', 'K57.30'],
  'Peptic Ulcer Disease': ['K25.9', 'K26.9'],
  'GI Bleed': ['K92.2', 'K92.0'],
  'Mesenteric Ischemia': ['K55.069'],
  'Bowel Perforation': ['K63.1'],
  'Hepatitis': ['B19.9', 'K75.9'],
  'Inflammatory Bowel Disease': ['K50.90', 'K51.90'],

  // GU
  'Nephrolithiasis': ['N20.0', 'N20.1'],
  'Pyelonephritis': ['N10', 'N12'],
  'UTI': ['N39.0'],

  // GYN
  'Ovarian Torsion': ['N83.51', 'N83.52'],
  'Ectopic Pregnancy': ['O00.90', 'O00.91'],
  'PID': ['N73.0', 'N70.01'],
  'Ruptured Ovarian Cyst': ['N83.20'],
  'Endometriosis': ['N80.0'],

  // Sepsis
  'Sepsis': ['A41.9', 'R65.20'],

  // Pediatric pack
  'Herpangina': ['B08.5'],
  'Hand-Foot-Mouth Disease': ['B08.4'],
  'Viral URI': ['J06.9'],
  'Influenza': ['J11.1', 'J10.1'],
  'RSV Bronchiolitis': ['J21.0'],
  'Adenovirus Infection': ['B97.0'],
  'Roseola': ['B08.20'],
  'Fifth Disease': ['B08.3'],
  'Croup': ['J05.0'],
  'Pediatric Asthma Exacerbation': ['J45.20', 'J45.41'],
  'Pediatric Pneumonia': ['J18.9', 'J18.1'],
  'Pertussis': ['A37.90'],
  'Foreign Body Aspiration': ['T17.9'],
  'Epiglottitis': ['J05.10', 'J05.11'],
  'Acute Otitis Media': ['H66.90'],
  'Streptococcal Pharyngitis': ['J02.0'],
  'Viral Pharyngitis': ['J02.9'],
  'Peritonsillar Abscess': ['J36'],
  'Retropharyngeal Abscess': ['J39.0'],
  'Viral Gastroenteritis': ['A08.39'],
  'Pediatric Constipation': ['K59.00'],
  'Pediatric Appendicitis': ['K35.80', 'K35.89'],
  'Intussusception': ['K56.1'],
  'Pyloric Stenosis': ['Q40.0', 'K31.1'],
  'Malrotation with Volvulus': ['Q43.3', 'K55.0'],
  'Mesenteric Adenitis': ['I88.0'],
  'IgA Vasculitis (HSP)': ['D69.0'],
  'Pediatric UTI': ['N39.0'],
  'Pediatric Pyelonephritis': ['N10'],
  'Testicular Torsion': ['N44.00'],
  'Febrile Seizure': ['R56.00', 'R56.01'],
  'Pediatric Epilepsy': ['G40.909'],
  'Meningitis': ['G03.9'],
  'Encephalitis': ['G04.90'],
  'Neonatal Sepsis': ['P36.9'],
  'Hyperbilirubinemia': ['P59.9'],
  'BRUE': ['R68.13'],
  'Scarlet Fever': ['A38.9'],
  'Kawasaki Disease': ['M30.3'],
  'MIS-C': ['M35.81'],
};

export function lookupIcd10Title(code: string): string | null {
  return icd10Dictionary[code]?.title ?? null;
}

export function searchIcd10(query: string): Icd10Entry[] {
  const q = query.toLowerCase().trim();
  if (!q) return [];
  return Object.values(icd10Dictionary).filter(
    e => e.code.toLowerCase().startsWith(q) || e.title.toLowerCase().includes(q)
  );
}

export function getIcd10CodesForCondition(conditionLabel: string): string[] {
  return conditionIcd10Map[conditionLabel] ?? [];
}

export function getIcd10TitlesForCondition(conditionLabel: string): string[] {
  const codes = getIcd10CodesForCondition(conditionLabel);
  return codes.map(c => icd10Dictionary[c]?.title ?? c);
}

export function looksLikeIcd10(query: string): boolean {
  return /^[A-Za-z]\d{1,2}/.test(query.trim());
}

export function findConditionsByIcd10(query: string): string[] {
  const q = query.toUpperCase().trim();
  const matches: string[] = [];
  for (const [label, codes] of Object.entries(conditionIcd10Map)) {
    if (codes.some(c => c.toUpperCase().startsWith(q) || c.toUpperCase() === q)) {
      matches.push(label);
    }
  }
  return matches;
}

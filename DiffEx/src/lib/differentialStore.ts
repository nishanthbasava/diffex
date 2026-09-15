import { upsertFeature, findFeatureByLabelOrSynonym } from './evidenceStore';
import { isCacheReady, getCachedConditions, getCachedEdges } from './knowledgeCache';
import { remapPriorConditionIds } from './priorsStore';

const CONDITIONS_KEY = 'diffex_conditions';
const EDGES_KEY = 'diffex_condition_feature_edges';
// v7: added Headache and Photophobia features with edges (meningitis,
// encephalitis, influenza, URI, pharyngitis). Reseeding regenerates condition
// ids; existing prior rows are remapped by label via remapPriorConditionIds.
const SEEDED_KEY = 'diffex_differential_seeded_v7';

// ---- Types ----

export interface Condition {
  id: string;
  label: string;
  category: string | null;
  acuteness: number;
  prior_base: number;
}

export interface ConditionFeatureEdge {
  condition_id: string;
  feature_id: string;
  lr_present: number;
  lr_absent: number;
}

// ---- Helpers ----

function generateId(): string {
  return `cond_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function loadConditions(): Condition[] {
  if (typeof window === 'undefined') return [];
  try {
    const stored = localStorage.getItem(CONDITIONS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch { return []; }
}

function saveConditions(conditions: Condition[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(CONDITIONS_KEY, JSON.stringify(conditions));
}

function loadEdges(): ConditionFeatureEdge[] {
  if (typeof window === 'undefined') return [];
  try {
    const stored = localStorage.getItem(EDGES_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch { return []; }
}

function saveEdges(edges: ConditionFeatureEdge[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(EDGES_KEY, JSON.stringify(edges));
}

// ---- Public API ----

export function getConditions(): Condition[] {
  if (isCacheReady()) return getCachedConditions() as Condition[];
  return loadConditions();
}

export function getEdgesForCondition(conditionId: string): ConditionFeatureEdge[] {
  if (isCacheReady()) return getCachedEdges().filter(e => e.condition_id === conditionId) as ConditionFeatureEdge[];
  return loadEdges().filter(e => e.condition_id === conditionId);
}

export function getAllEdges(): ConditionFeatureEdge[] {
  if (isCacheReady()) return getCachedEdges() as ConditionFeatureEdge[];
  return loadEdges();
}

// ---- Ensure a feature exists in registry, return its id ----

function ensureFeature(
  label: string,
  type: 'symptom' | 'vital' | 'history' | 'lab' | 'test' | 'other',
  valueType: 'boolean' | 'numeric' | 'categorical' | 'text',
  synonyms: string[] = []
): string {
  const existing = findFeatureByLabelOrSynonym(label);
  if (existing) return existing.id;
  const created = upsertFeature({
    canonical_label: label,
    feature_type: type,
    value_type: valueType,
    synonyms,
  });
  return created.id;
}

// ---- Seed data ----

export function seedIfEmpty(): void {
  if (localStorage.getItem(SEEDED_KEY)) return;

  // Clear old seed data to re-seed
  localStorage.removeItem('diffex_differential_seeded_v2');
  localStorage.removeItem('diffex_differential_seeded_v6');

  // Capture the outgoing conditions so prior rows can be remapped to the
  // regenerated condition ids after seeding.
  const previousConditions = loadConditions();

  // ---- Shared features (cardiopulm) ----
  const fBreathing = ensureFeature('Breathing issues', 'symptom', 'boolean', ['shortness of breath', 'sob', 'dyspnea', 'trouble breathing']);
  const fChestPain = ensureFeature('Chest pain', 'symptom', 'boolean', ['chest pain', 'chest tightness']);
  const fCough = ensureFeature('Cough', 'symptom', 'boolean', ['cough', 'coughing']);
  const fFever = ensureFeature('Fever', 'symptom', 'boolean', ['fever', 'febrile', 'temperature']);
  const fHemoptysis = ensureFeature('Hemoptysis', 'symptom', 'boolean', ['hemoptysis', 'coughing blood']);
  const fLegSwelling = ensureFeature('Leg swelling', 'symptom', 'boolean', ['leg swelling', 'lower extremity edema', 'pedal edema']);
  const fOrthopnea = ensureFeature('Orthopnea', 'symptom', 'boolean', ['orthopnea']);
  const fPND = ensureFeature('PND', 'symptom', 'boolean', ['paroxysmal nocturnal dyspnea', 'pnd']);
  const fTachycardia = ensureFeature('Tachycardia', 'vital', 'boolean', ['tachycardia', 'rapid heart rate']);
  const fHypoxia = ensureFeature('Hypoxia', 'vital', 'boolean', ['hypoxia', 'low oxygen', 'desaturation']);
  const fTachypnea = ensureFeature('Tachypnea', 'vital', 'boolean', ['tachypnea', 'rapid breathing']);
  const fSmokingHistory = ensureFeature('Smoking history', 'history', 'boolean', ['smoking', 'smoker', 'tobacco', 'pack-year']);
  const fDVTPE = ensureFeature('History of DVT/PE', 'history', 'boolean', ['dvt', 'deep vein thrombosis', 'prior pe', 'history of pe']);
  const fWheezing = ensureFeature('Wheezing', 'symptom', 'boolean', ['wheezing', 'wheeze']);
  const fWeightLoss = ensureFeature('Weight loss', 'symptom', 'boolean', ['weight loss', 'unintentional weight loss']);
  const fFatigue = ensureFeature('Fatigue', 'symptom', 'boolean', ['fatigue', 'tired', 'malaise']);
  const fPalpitations = ensureFeature('Palpitations', 'symptom', 'boolean', ['palpitations', 'racing heart']);
  const fPleuriticPain = ensureFeature('Pleuritic chest pain', 'symptom', 'boolean', ['pleuritic', 'sharp chest pain worse with breathing']);
  const fAnxiety = ensureFeature('Anxiety', 'symptom', 'boolean', ['anxiety', 'anxious', 'panic']);
  const fHeartburn = ensureFeature('Heartburn', 'symptom', 'boolean', ['heartburn', 'acid reflux', 'gerd']);
  const fRecentSurgery = ensureFeature('Recent surgery', 'history', 'boolean', ['recent surgery', 'immobilization', 'post-operative']);
  const fObesity = ensureFeature('Obesity', 'history', 'boolean', ['obesity', 'obese', 'bmi > 30']);
  const fEdema = ensureFeature('Edema', 'symptom', 'boolean', ['edema', 'swelling']);
  const fNightSweats = ensureFeature('Night sweats', 'symptom', 'boolean', ['night sweats']);
  const fSyncope = ensureFeature('Syncope', 'symptom', 'boolean', ['syncope', 'fainting', 'loss of consciousness']);
  const fDiaphoresis = ensureFeature('Diaphoresis', 'symptom', 'boolean', ['diaphoresis', 'sweating']);

  // ---- GI / Abdominal / GU features ----
  const fAbdPain = ensureFeature('Abdominal pain', 'symptom', 'boolean', ['abdominal pain', 'belly pain', 'stomach ache', 'abd pain']);
  const fRLQPain = ensureFeature('RLQ pain', 'symptom', 'boolean', ['right lower quadrant pain', 'rlq pain', 'rlq tenderness']);
  const fRUQPain = ensureFeature('RUQ pain', 'symptom', 'boolean', ['right upper quadrant pain', 'ruq pain', 'ruq tenderness']);
  const fLLQPain = ensureFeature('LLQ pain', 'symptom', 'boolean', ['left lower quadrant pain', 'llq pain', 'llq tenderness']);
  const fEpigastricPain = ensureFeature('Epigastric pain', 'symptom', 'boolean', ['epigastric pain', 'upper abdominal pain', 'epigastrium']);
  const fFlankPain = ensureFeature('Flank pain', 'symptom', 'boolean', ['flank pain', 'costovertebral angle tenderness', 'cva tenderness']);
  const fNausea = ensureFeature('Nausea/Vomiting', 'symptom', 'boolean', ['nausea', 'vomiting', 'emesis', 'n/v']);
  const fAnorexia = ensureFeature('Anorexia', 'symptom', 'boolean', ['anorexia', 'loss of appetite', 'poor appetite', 'decreased appetite']);
  const fDiarrhea = ensureFeature('Diarrhea', 'symptom', 'boolean', ['diarrhea', 'loose stools', 'watery stools']);
  const fConstipation = ensureFeature('Constipation', 'symptom', 'boolean', ['constipation', 'no bowel movement', 'obstipation']);
  const fAbdDistension = ensureFeature('Abdominal distension', 'symptom', 'boolean', ['abdominal distension', 'bloating', 'distended abdomen']);
  const fRebound = ensureFeature('Rebound tenderness', 'symptom', 'boolean', ['rebound tenderness', 'peritoneal signs', 'guarding']);
  const fMigrationPain = ensureFeature('Migration of pain', 'symptom', 'boolean', ['pain migration', 'periumbilical to rlq', 'migrating pain']);
  const fMurphySign = ensureFeature('Murphy sign', 'symptom', 'boolean', ['murphy sign', 'positive murphy', 'inspiratory arrest']);
  const fJaundice = ensureFeature('Jaundice', 'symptom', 'boolean', ['jaundice', 'icterus', 'yellow skin', 'scleral icterus']);
  const fDysuria = ensureFeature('Dysuria', 'symptom', 'boolean', ['dysuria', 'painful urination', 'burning urination']);
  const fHematuria = ensureFeature('Hematuria', 'symptom', 'boolean', ['hematuria', 'blood in urine', 'gross hematuria']);
  const fUrinaryFrequency = ensureFeature('Urinary frequency', 'symptom', 'boolean', ['urinary frequency', 'frequent urination', 'urgency']);
  const fVaginalBleeding = ensureFeature('Vaginal bleeding', 'symptom', 'boolean', ['vaginal bleeding', 'pv bleeding', 'abnormal uterine bleeding']);
  const fPregnancyTest = ensureFeature('Positive pregnancy test', 'lab', 'boolean', ['positive pregnancy test', 'hcg positive', 'beta hcg elevated']);
  const fPelvicPain = ensureFeature('Pelvic pain', 'symptom', 'boolean', ['pelvic pain', 'suprapubic pain', 'lower pelvic']);
  const fAdnexalTenderness = ensureFeature('Adnexal tenderness', 'symptom', 'boolean', ['adnexal tenderness', 'ovarian tenderness', 'adnexal mass']);
  const fElevatedLipase = ensureFeature('Elevated lipase', 'lab', 'boolean', ['elevated lipase', 'high lipase', 'elevated amylase']);
  const fElevatedWBC = ensureFeature('Elevated WBC', 'lab', 'boolean', ['elevated wbc', 'leukocytosis', 'high white count']);
  const fElevatedLactate = ensureFeature('Elevated lactate', 'lab', 'boolean', ['elevated lactate', 'lactic acidosis', 'high lactate']);
  const fPositiveUA = ensureFeature('Positive urinalysis', 'lab', 'boolean', ['positive ua', 'pyuria', 'bacteriuria', 'positive urinalysis']);
  const fAbdRigidity = ensureFeature('Abdominal rigidity', 'symptom', 'boolean', ['abdominal rigidity', 'board-like abdomen', 'rigid abdomen']);
  const fRadiatingToBack = ensureFeature('Pain radiating to back', 'symptom', 'boolean', ['radiating to back', 'back pain', 'pain to back']);
  const fMelena = ensureFeature('Melena/GI bleeding', 'symptom', 'boolean', ['melena', 'black stool', 'gi bleeding', 'hematemesis', 'bloody stool']);
  const fTenesmus = ensureFeature('Tenesmus', 'symptom', 'boolean', ['tenesmus', 'rectal urgency']);
  const fAlcoholHistory = ensureFeature('Alcohol use', 'history', 'boolean', ['alcohol use', 'alcohol history', 'heavy drinking', 'etoh']);
  const fGallstoneHistory = ensureFeature('History of gallstones', 'history', 'boolean', ['gallstones', 'cholelithiasis', 'biliary colic history']);
  const fSexuallyActive = ensureFeature('Sexually active', 'history', 'boolean', ['sexually active', 'sexual activity']);

  // ---- Pediatric features ----
  const fPosteriorOralVesicles = ensureFeature('Posterior oral vesicles', 'symptom', 'boolean', ['posterior oral vesicles', 'pharyngeal vesicles', 'oral ulcers', 'oral vesicles', 'vesicular lesions on soft palate', 'vesicular lesions soft palate', 'posterior oropharyngeal ulcers', 'oropharyngeal vesicles', 'soft palate vesicles', 'soft palate vesicular lesions', 'shallow ulcers soft palate', 'vesicles posterior oropharynx', 'herpangina vesicles']);
  const fHandFootRash = ensureFeature('Hand/foot rash', 'symptom', 'boolean', ['hand foot rash', 'palmar rash', 'vesicular rash hands feet', 'hand foot mouth rash']);
  const fBarkyCough = ensureFeature('Barky cough', 'symptom', 'boolean', ['barky cough', 'seal-like cough', 'croupy cough']);
  const fStridor = ensureFeature('Stridor', 'symptom', 'boolean', ['stridor', 'inspiratory stridor']);
  const fDrooling = ensureFeature('Drooling', 'symptom', 'boolean', ['drooling', 'sialorrhea', 'inability to swallow', 'difficulty swallowing', 'dysphagia']);
  const fTrismuss = ensureFeature('Trismus', 'symptom', 'boolean', ['trismus', 'lockjaw', 'difficulty opening mouth']);
  const fCurrantJellyStool = ensureFeature('Currant jelly stool', 'symptom', 'boolean', ['currant jelly stool', 'bloody mucoid stool']);
  const fProjectileVomiting = ensureFeature('Projectile vomiting', 'symptom', 'boolean', ['projectile vomiting', 'forceful vomiting']);
  const fBiliousVomiting = ensureFeature('Bilious vomiting', 'symptom', 'boolean', ['bilious vomiting', 'green vomiting', 'bile-stained vomiting']);
  const fTesticularPain = ensureFeature('Testicular pain', 'symptom', 'boolean', ['testicular pain', 'scrotal pain', 'scrotal swelling']);
  const fSeizureActivity = ensureFeature('Seizure activity', 'symptom', 'boolean', ['seizure', 'convulsion', 'seizure activity', 'tonic clonic']);
  const fNeckStiffness = ensureFeature('Neck stiffness', 'symptom', 'boolean', ['neck stiffness', 'nuchal rigidity', 'meningismus']);
  const fHeadache = ensureFeature('Headache', 'symptom', 'boolean', ['headache', 'head pain', 'cephalgia']);
  const fPhotophobia = ensureFeature('Photophobia', 'symptom', 'boolean', ['photophobia', 'light sensitivity', 'sensitivity to light']);
  const fBulgingFontanelle = ensureFeature('Bulging fontanelle', 'symptom', 'boolean', ['bulging fontanelle', 'tense fontanelle', 'full fontanelle']);
  const fConjunctivitis = ensureFeature('Conjunctivitis', 'symptom', 'boolean', ['conjunctivitis', 'red eyes', 'bilateral conjunctival injection']);
  const fStrawberryTongue = ensureFeature('Strawberry tongue', 'symptom', 'boolean', ['strawberry tongue', 'red tongue with papillae']);
  const fMucosalErythema = ensureFeature('Mucosal erythema', 'symptom', 'boolean', ['mucosal erythema', 'oral erythema', 'lip cracking', 'cracked lips', 'oropharyngeal erythema', 'surrounding erythema', 'pharyngeal erythema']);
  const fExtremitySwelling = ensureFeature('Extremity swelling', 'symptom', 'boolean', ['extremity swelling', 'hand swelling', 'foot swelling', 'peripheral edema']);
  const fRhinorrhea = ensureFeature('Rhinorrhea', 'symptom', 'boolean', ['rhinorrhea', 'runny nose', 'nasal congestion', 'nasal discharge']);
  const fSoreThroat = ensureFeature('Sore throat', 'symptom', 'boolean', ['sore throat', 'pharyngitis', 'throat pain', 'odynophagia', 'difficulty swallowing']);
  const fEarPain = ensureFeature('Ear pain', 'symptom', 'boolean', ['ear pain', 'otalgia', 'ear tugging']);
  const fRash = ensureFeature('Rash', 'symptom', 'boolean', ['rash', 'exanthem', 'skin eruption']);
  const fLymphadenopathy = ensureFeature('Lymphadenopathy', 'symptom', 'boolean', ['lymphadenopathy', 'swollen lymph nodes', 'cervical adenopathy']);
  const fPharyngealExudate = ensureFeature('Pharyngeal exudate', 'symptom', 'boolean', ['pharyngeal exudate', 'tonsillar exudate', 'white patches on tonsils']);
  const fAbdMass = ensureFeature('Abdominal mass', 'symptom', 'boolean', ['abdominal mass', 'palpable mass', 'sausage shaped mass']);
  const fIrritability = ensureFeature('Irritability', 'symptom', 'boolean', ['irritability', 'fussiness', 'inconsolable crying', 'irritable', 'fussy']);
  const fLethargy = ensureFeature('Lethargy', 'symptom', 'boolean', ['lethargy', 'decreased activity', 'listlessness']);
  const fPoorFeeding = ensureFeature('Poor feeding', 'symptom', 'boolean', ['poor feeding', 'feeding difficulty', 'decreased intake']);
  const fDesquamation = ensureFeature('Desquamation', 'symptom', 'boolean', ['desquamation', 'peeling skin', 'periungual peeling']);
  const fApnea = ensureFeature('Apnea', 'symptom', 'boolean', ['apnea', 'apneic episode', 'breath holding']);
  const fParoxysmalCough = ensureFeature('Paroxysmal cough', 'symptom', 'boolean', ['paroxysmal cough', 'whooping cough', 'post-tussive vomiting', 'inspiratory whoop']);
  const fPurpura = ensureFeature('Purpura', 'symptom', 'boolean', ['purpura', 'palpable purpura', 'petechiae', 'non-blanching rash']);
  const fArthralgia = ensureFeature('Arthralgia', 'symptom', 'boolean', ['arthralgia', 'joint pain', 'arthritis']);
  const fChoking = ensureFeature('Choking episode', 'history', 'boolean', ['choking', 'choking episode', 'witnessed aspiration']);

  // ---- Conditions ----
  const conditions: Condition[] = [
    // Original cardiopulm pack
    { id: generateId(), label: 'Pulmonary Embolism', category: 'Vascular', acuteness: 0.9, prior_base: 1.0 },
    { id: generateId(), label: 'COPD Exacerbation', category: 'Pulmonary', acuteness: 0.5, prior_base: 1.0 },
    { id: generateId(), label: 'Congestive Heart Failure', category: 'Cardiac', acuteness: 0.6, prior_base: 1.0 },
    { id: generateId(), label: 'Community-Acquired Pneumonia', category: 'Infectious', acuteness: 0.6, prior_base: 1.0 },
    { id: generateId(), label: 'Asthma Exacerbation', category: 'Pulmonary', acuteness: 0.4, prior_base: 1.0 },
    { id: generateId(), label: 'Anxiety / Panic Disorder', category: 'Psychiatric', acuteness: 0.15, prior_base: 1.0 },
    { id: generateId(), label: 'Anemia', category: 'Hematologic', acuteness: 0.3, prior_base: 1.0 },
    { id: generateId(), label: 'GERD', category: 'GI', acuteness: 0.2, prior_base: 1.0 },
    { id: generateId(), label: 'Pericarditis', category: 'Cardiac', acuteness: 0.65, prior_base: 1.0 },
    { id: generateId(), label: 'Lung Cancer', category: 'Oncologic', acuteness: 0.8, prior_base: 1.0 },
    { id: generateId(), label: 'Interstitial Lung Disease', category: 'Pulmonary', acuteness: 0.5, prior_base: 1.0 },
    { id: generateId(), label: 'MI / ACS', category: 'Cardiac', acuteness: 0.95, prior_base: 1.0 },
    { id: generateId(), label: 'Pneumothorax', category: 'Pulmonary', acuteness: 0.85, prior_base: 1.0 },
    { id: generateId(), label: 'Pleural Effusion', category: 'Pulmonary', acuteness: 0.5, prior_base: 1.0 },
    { id: generateId(), label: 'Aortic Dissection', category: 'Vascular', acuteness: 0.98, prior_base: 1.0 },
    { id: generateId(), label: 'Pulmonary Hypertension', category: 'Vascular', acuteness: 0.6, prior_base: 1.0 },
    { id: generateId(), label: 'Myocarditis', category: 'Cardiac', acuteness: 0.7, prior_base: 1.0 },
    { id: generateId(), label: 'Costochondritis', category: 'MSK', acuteness: 0.1, prior_base: 1.0 },
    { id: generateId(), label: 'Tuberculosis', category: 'Infectious', acuteness: 0.6, prior_base: 1.0 },
    { id: generateId(), label: 'Sarcoidosis', category: 'Pulmonary', acuteness: 0.4, prior_base: 1.0 },
    { id: generateId(), label: 'Atrial Fibrillation', category: 'Cardiac', acuteness: 0.5, prior_base: 1.0 },
    { id: generateId(), label: 'Valvular Heart Disease', category: 'Cardiac', acuteness: 0.5, prior_base: 1.0 },
    { id: generateId(), label: 'Bronchiectasis', category: 'Pulmonary', acuteness: 0.35, prior_base: 1.0 },
    { id: generateId(), label: 'Obstructive Sleep Apnea', category: 'Pulmonary', acuteness: 0.2, prior_base: 1.0 },
    { id: generateId(), label: 'Deconditioning', category: 'Other', acuteness: 0.05, prior_base: 1.0 },

    // GI / Abdominal pack
    { id: generateId(), label: 'Appendicitis', category: 'GI', acuteness: 0.85, prior_base: 1.0 },
    { id: generateId(), label: 'Cholecystitis', category: 'GI', acuteness: 0.75, prior_base: 1.0 },
    { id: generateId(), label: 'Pancreatitis', category: 'GI', acuteness: 0.8, prior_base: 1.0 },
    { id: generateId(), label: 'Small Bowel Obstruction', category: 'GI', acuteness: 0.85, prior_base: 1.0 },
    { id: generateId(), label: 'Gastroenteritis', category: 'GI', acuteness: 0.3, prior_base: 1.0 },
    { id: generateId(), label: 'Diverticulitis', category: 'GI', acuteness: 0.6, prior_base: 1.0 },
    { id: generateId(), label: 'Peptic Ulcer Disease', category: 'GI', acuteness: 0.5, prior_base: 1.0 },
    { id: generateId(), label: 'GI Bleed', category: 'GI', acuteness: 0.85, prior_base: 1.0 },
    { id: generateId(), label: 'Mesenteric Ischemia', category: 'GI', acuteness: 0.95, prior_base: 1.0 },
    { id: generateId(), label: 'Bowel Perforation', category: 'GI', acuteness: 0.95, prior_base: 1.0 },
    { id: generateId(), label: 'Hepatitis', category: 'GI', acuteness: 0.5, prior_base: 1.0 },
    { id: generateId(), label: 'Inflammatory Bowel Disease', category: 'GI', acuteness: 0.5, prior_base: 1.0 },

    // GU pack
    { id: generateId(), label: 'Nephrolithiasis', category: 'GU', acuteness: 0.6, prior_base: 1.0 },
    { id: generateId(), label: 'Pyelonephritis', category: 'GU', acuteness: 0.7, prior_base: 1.0 },
    { id: generateId(), label: 'UTI', category: 'GU', acuteness: 0.3, prior_base: 1.0 },

    // GYN pack
    { id: generateId(), label: 'Ovarian Torsion', category: 'GYN', acuteness: 0.9, prior_base: 1.0 },
    { id: generateId(), label: 'Ectopic Pregnancy', category: 'GYN', acuteness: 0.95, prior_base: 1.0 },
    { id: generateId(), label: 'PID', category: 'GYN', acuteness: 0.6, prior_base: 1.0 },
    { id: generateId(), label: 'Ruptured Ovarian Cyst', category: 'GYN', acuteness: 0.7, prior_base: 1.0 },
    { id: generateId(), label: 'Endometriosis', category: 'GYN', acuteness: 0.3, prior_base: 1.0 },

    // Sepsis (always-include safety net)
    { id: generateId(), label: 'Sepsis', category: 'Infectious', acuteness: 0.95, prior_base: 1.0 },

    // ======== PEDIATRIC CORE PACK (40 conditions) ========
    // Common viral febrile
    { id: generateId(), label: 'Herpangina', category: 'Pediatric', acuteness: 0.2, prior_base: 1.0 },
    { id: generateId(), label: 'Hand-Foot-Mouth Disease', category: 'Pediatric', acuteness: 0.2, prior_base: 1.0 },
    { id: generateId(), label: 'Viral URI', category: 'Pediatric', acuteness: 0.1, prior_base: 1.0 },
    { id: generateId(), label: 'Influenza', category: 'Pediatric', acuteness: 0.3, prior_base: 1.0 },
    { id: generateId(), label: 'RSV Bronchiolitis', category: 'Pediatric', acuteness: 0.5, prior_base: 1.0 },
    { id: generateId(), label: 'Adenovirus Infection', category: 'Pediatric', acuteness: 0.25, prior_base: 1.0 },
    { id: generateId(), label: 'Roseola', category: 'Pediatric', acuteness: 0.15, prior_base: 1.0 },
    { id: generateId(), label: 'Fifth Disease', category: 'Pediatric', acuteness: 0.1, prior_base: 1.0 },
    // Respiratory
    { id: generateId(), label: 'Croup', category: 'Pediatric', acuteness: 0.4, prior_base: 1.0 },
    { id: generateId(), label: 'Pediatric Asthma Exacerbation', category: 'Pediatric', acuteness: 0.5, prior_base: 1.0 },
    { id: generateId(), label: 'Pediatric Pneumonia', category: 'Pediatric', acuteness: 0.6, prior_base: 1.0 },
    { id: generateId(), label: 'Pertussis', category: 'Pediatric', acuteness: 0.5, prior_base: 1.0 },
    { id: generateId(), label: 'Foreign Body Aspiration', category: 'Pediatric', acuteness: 0.8, prior_base: 1.0 },
    { id: generateId(), label: 'Epiglottitis', category: 'Pediatric', acuteness: 0.95, prior_base: 1.0 },
    // ENT/oral
    { id: generateId(), label: 'Acute Otitis Media', category: 'Pediatric', acuteness: 0.2, prior_base: 1.0 },
    { id: generateId(), label: 'Streptococcal Pharyngitis', category: 'Pediatric', acuteness: 0.25, prior_base: 1.0 },
    { id: generateId(), label: 'Viral Pharyngitis', category: 'Pediatric', acuteness: 0.1, prior_base: 1.0 },
    { id: generateId(), label: 'Peritonsillar Abscess', category: 'Pediatric', acuteness: 0.7, prior_base: 1.0 },
    { id: generateId(), label: 'Retropharyngeal Abscess', category: 'Pediatric', acuteness: 0.85, prior_base: 1.0 },
    // GI/abdominal
    { id: generateId(), label: 'Viral Gastroenteritis', category: 'Pediatric', acuteness: 0.25, prior_base: 1.0 },
    { id: generateId(), label: 'Pediatric Constipation', category: 'Pediatric', acuteness: 0.1, prior_base: 1.0 },
    { id: generateId(), label: 'Pediatric Appendicitis', category: 'Pediatric', acuteness: 0.85, prior_base: 1.0 },
    { id: generateId(), label: 'Intussusception', category: 'Pediatric', acuteness: 0.9, prior_base: 1.0 },
    { id: generateId(), label: 'Pyloric Stenosis', category: 'Pediatric', acuteness: 0.75, prior_base: 1.0 },
    { id: generateId(), label: 'Malrotation with Volvulus', category: 'Pediatric', acuteness: 0.95, prior_base: 1.0 },
    { id: generateId(), label: 'Mesenteric Adenitis', category: 'Pediatric', acuteness: 0.2, prior_base: 1.0 },
    { id: generateId(), label: 'IgA Vasculitis (HSP)', category: 'Pediatric', acuteness: 0.5, prior_base: 1.0 },
    // GU
    { id: generateId(), label: 'Pediatric UTI', category: 'Pediatric', acuteness: 0.35, prior_base: 1.0 },
    { id: generateId(), label: 'Pediatric Pyelonephritis', category: 'Pediatric', acuteness: 0.7, prior_base: 1.0 },
    { id: generateId(), label: 'Testicular Torsion', category: 'Pediatric', acuteness: 0.95, prior_base: 1.0 },
    // Neurologic/infectious
    { id: generateId(), label: 'Febrile Seizure', category: 'Pediatric', acuteness: 0.6, prior_base: 1.0 },
    { id: generateId(), label: 'Pediatric Epilepsy', category: 'Pediatric', acuteness: 0.5, prior_base: 1.0 },
    { id: generateId(), label: 'Meningitis', category: 'Pediatric', acuteness: 0.95, prior_base: 1.0 },
    { id: generateId(), label: 'Encephalitis', category: 'Pediatric', acuteness: 0.9, prior_base: 1.0 },
    // Neonatal/infant
    { id: generateId(), label: 'Neonatal Sepsis', category: 'Pediatric', acuteness: 0.95, prior_base: 1.0 },
    { id: generateId(), label: 'Hyperbilirubinemia', category: 'Pediatric', acuteness: 0.5, prior_base: 1.0 },
    { id: generateId(), label: 'BRUE', category: 'Pediatric', acuteness: 0.7, prior_base: 1.0 },
    // Inflammatory/rash
    { id: generateId(), label: 'Scarlet Fever', category: 'Pediatric', acuteness: 0.35, prior_base: 1.0 },
    { id: generateId(), label: 'Kawasaki Disease', category: 'Pediatric', acuteness: 0.85, prior_base: 1.0 },
    { id: generateId(), label: 'MIS-C', category: 'Pediatric', acuteness: 0.9, prior_base: 1.0 },
  ];

  saveConditions(conditions);

  const cMap = new Map(conditions.map(c => [c.label, c.id]));
  const c = (label: string) => cMap.get(label)!;

  // ---- Edges ----
  const edges: ConditionFeatureEdge[] = [
    // ======== CARDIOPULM PACK (unchanged) ========

    // Pulmonary Embolism
    { condition_id: c('Pulmonary Embolism'), feature_id: fBreathing, lr_present: 3.0, lr_absent: 0.6 },
    { condition_id: c('Pulmonary Embolism'), feature_id: fChestPain, lr_present: 2.0, lr_absent: 0.7 },
    { condition_id: c('Pulmonary Embolism'), feature_id: fPleuriticPain, lr_present: 3.5, lr_absent: 0.7 },
    { condition_id: c('Pulmonary Embolism'), feature_id: fTachycardia, lr_present: 2.5, lr_absent: 0.7 },
    { condition_id: c('Pulmonary Embolism'), feature_id: fHypoxia, lr_present: 3.0, lr_absent: 0.6 },
    { condition_id: c('Pulmonary Embolism'), feature_id: fLegSwelling, lr_present: 4.0, lr_absent: 0.5 },
    { condition_id: c('Pulmonary Embolism'), feature_id: fDVTPE, lr_present: 5.0, lr_absent: 0.5 },
    { condition_id: c('Pulmonary Embolism'), feature_id: fHemoptysis, lr_present: 3.0, lr_absent: 0.8 },
    { condition_id: c('Pulmonary Embolism'), feature_id: fRecentSurgery, lr_present: 3.5, lr_absent: 0.7 },
    { condition_id: c('Pulmonary Embolism'), feature_id: fSyncope, lr_present: 2.5, lr_absent: 0.8 },

    // COPD Exacerbation
    { condition_id: c('COPD Exacerbation'), feature_id: fBreathing, lr_present: 3.0, lr_absent: 0.3 },
    { condition_id: c('COPD Exacerbation'), feature_id: fCough, lr_present: 2.5, lr_absent: 0.5 },
    { condition_id: c('COPD Exacerbation'), feature_id: fWheezing, lr_present: 3.5, lr_absent: 0.5 },
    { condition_id: c('COPD Exacerbation'), feature_id: fSmokingHistory, lr_present: 4.0, lr_absent: 0.3 },
    { condition_id: c('COPD Exacerbation'), feature_id: fTachypnea, lr_present: 2.0, lr_absent: 0.7 },
    { condition_id: c('COPD Exacerbation'), feature_id: fHypoxia, lr_present: 2.5, lr_absent: 0.6 },

    // CHF
    { condition_id: c('Congestive Heart Failure'), feature_id: fBreathing, lr_present: 3.0, lr_absent: 0.4 },
    { condition_id: c('Congestive Heart Failure'), feature_id: fOrthopnea, lr_present: 4.5, lr_absent: 0.5 },
    { condition_id: c('Congestive Heart Failure'), feature_id: fPND, lr_present: 4.0, lr_absent: 0.6 },
    { condition_id: c('Congestive Heart Failure'), feature_id: fLegSwelling, lr_present: 3.5, lr_absent: 0.5 },
    { condition_id: c('Congestive Heart Failure'), feature_id: fEdema, lr_present: 3.0, lr_absent: 0.6 },
    { condition_id: c('Congestive Heart Failure'), feature_id: fFatigue, lr_present: 2.0, lr_absent: 0.7 },
    { condition_id: c('Congestive Heart Failure'), feature_id: fTachycardia, lr_present: 1.8, lr_absent: 0.8 },

    // Pneumonia
    { condition_id: c('Community-Acquired Pneumonia'), feature_id: fFever, lr_present: 3.5, lr_absent: 0.4 },
    { condition_id: c('Community-Acquired Pneumonia'), feature_id: fCough, lr_present: 3.0, lr_absent: 0.4 },
    { condition_id: c('Community-Acquired Pneumonia'), feature_id: fBreathing, lr_present: 2.0, lr_absent: 0.6 },
    { condition_id: c('Community-Acquired Pneumonia'), feature_id: fTachypnea, lr_present: 2.5, lr_absent: 0.6 },
    { condition_id: c('Community-Acquired Pneumonia'), feature_id: fHypoxia, lr_present: 2.5, lr_absent: 0.7 },
    { condition_id: c('Community-Acquired Pneumonia'), feature_id: fPleuriticPain, lr_present: 2.0, lr_absent: 0.8 },
    { condition_id: c('Community-Acquired Pneumonia'), feature_id: fChestPain, lr_present: 1.5, lr_absent: 0.8 },

    // Asthma
    { condition_id: c('Asthma Exacerbation'), feature_id: fBreathing, lr_present: 3.0, lr_absent: 0.3 },
    { condition_id: c('Asthma Exacerbation'), feature_id: fWheezing, lr_present: 4.5, lr_absent: 0.3 },
    { condition_id: c('Asthma Exacerbation'), feature_id: fCough, lr_present: 2.5, lr_absent: 0.5 },
    { condition_id: c('Asthma Exacerbation'), feature_id: fTachypnea, lr_present: 2.0, lr_absent: 0.7 },

    // Anxiety
    { condition_id: c('Anxiety / Panic Disorder'), feature_id: fBreathing, lr_present: 2.0, lr_absent: 0.6 },
    { condition_id: c('Anxiety / Panic Disorder'), feature_id: fChestPain, lr_present: 1.8, lr_absent: 0.7 },
    { condition_id: c('Anxiety / Panic Disorder'), feature_id: fPalpitations, lr_present: 3.0, lr_absent: 0.5 },
    { condition_id: c('Anxiety / Panic Disorder'), feature_id: fAnxiety, lr_present: 5.0, lr_absent: 0.3 },
    { condition_id: c('Anxiety / Panic Disorder'), feature_id: fDiaphoresis, lr_present: 1.5, lr_absent: 0.8 },

    // Anemia
    { condition_id: c('Anemia'), feature_id: fBreathing, lr_present: 2.0, lr_absent: 0.6 },
    { condition_id: c('Anemia'), feature_id: fFatigue, lr_present: 3.5, lr_absent: 0.4 },
    { condition_id: c('Anemia'), feature_id: fTachycardia, lr_present: 2.5, lr_absent: 0.6 },
    { condition_id: c('Anemia'), feature_id: fPalpitations, lr_present: 2.0, lr_absent: 0.7 },
    { condition_id: c('Anemia'), feature_id: fSyncope, lr_present: 2.0, lr_absent: 0.8 },

    // GERD
    { condition_id: c('GERD'), feature_id: fChestPain, lr_present: 2.5, lr_absent: 0.5 },
    { condition_id: c('GERD'), feature_id: fHeartburn, lr_present: 5.0, lr_absent: 0.3 },
    { condition_id: c('GERD'), feature_id: fCough, lr_present: 1.5, lr_absent: 0.8 },
    { condition_id: c('GERD'), feature_id: fEpigastricPain, lr_present: 2.5, lr_absent: 0.6 },
    { condition_id: c('GERD'), feature_id: fNausea, lr_present: 1.5, lr_absent: 0.8 },

    // Pericarditis
    { condition_id: c('Pericarditis'), feature_id: fChestPain, lr_present: 3.0, lr_absent: 0.4 },
    { condition_id: c('Pericarditis'), feature_id: fPleuriticPain, lr_present: 3.5, lr_absent: 0.5 },
    { condition_id: c('Pericarditis'), feature_id: fFever, lr_present: 2.5, lr_absent: 0.6 },

    // Lung Cancer
    { condition_id: c('Lung Cancer'), feature_id: fSmokingHistory, lr_present: 4.0, lr_absent: 0.4 },
    { condition_id: c('Lung Cancer'), feature_id: fWeightLoss, lr_present: 4.0, lr_absent: 0.5 },
    { condition_id: c('Lung Cancer'), feature_id: fHemoptysis, lr_present: 3.5, lr_absent: 0.7 },
    { condition_id: c('Lung Cancer'), feature_id: fCough, lr_present: 2.0, lr_absent: 0.7 },
    { condition_id: c('Lung Cancer'), feature_id: fBreathing, lr_present: 1.5, lr_absent: 0.8 },
    { condition_id: c('Lung Cancer'), feature_id: fNightSweats, lr_present: 2.5, lr_absent: 0.8 },

    // ILD
    { condition_id: c('Interstitial Lung Disease'), feature_id: fBreathing, lr_present: 3.0, lr_absent: 0.3 },
    { condition_id: c('Interstitial Lung Disease'), feature_id: fCough, lr_present: 2.5, lr_absent: 0.5 },
    { condition_id: c('Interstitial Lung Disease'), feature_id: fHypoxia, lr_present: 3.0, lr_absent: 0.5 },
    { condition_id: c('Interstitial Lung Disease'), feature_id: fFatigue, lr_present: 2.0, lr_absent: 0.7 },

    // MI / ACS
    { condition_id: c('MI / ACS'), feature_id: fChestPain, lr_present: 4.0, lr_absent: 0.3 },
    { condition_id: c('MI / ACS'), feature_id: fBreathing, lr_present: 2.0, lr_absent: 0.7 },
    { condition_id: c('MI / ACS'), feature_id: fDiaphoresis, lr_present: 3.0, lr_absent: 0.6 },
    { condition_id: c('MI / ACS'), feature_id: fTachycardia, lr_present: 2.0, lr_absent: 0.7 },
    { condition_id: c('MI / ACS'), feature_id: fSyncope, lr_present: 2.0, lr_absent: 0.7 },

    // Pneumothorax
    { condition_id: c('Pneumothorax'), feature_id: fBreathing, lr_present: 3.5, lr_absent: 0.3 },
    { condition_id: c('Pneumothorax'), feature_id: fChestPain, lr_present: 3.0, lr_absent: 0.4 },
    { condition_id: c('Pneumothorax'), feature_id: fPleuriticPain, lr_present: 3.0, lr_absent: 0.5 },
    { condition_id: c('Pneumothorax'), feature_id: fTachycardia, lr_present: 2.0, lr_absent: 0.7 },
    { condition_id: c('Pneumothorax'), feature_id: fHypoxia, lr_present: 2.5, lr_absent: 0.6 },

    // Pleural Effusion
    { condition_id: c('Pleural Effusion'), feature_id: fBreathing, lr_present: 3.0, lr_absent: 0.4 },
    { condition_id: c('Pleural Effusion'), feature_id: fCough, lr_present: 1.8, lr_absent: 0.7 },
    { condition_id: c('Pleural Effusion'), feature_id: fPleuriticPain, lr_present: 2.0, lr_absent: 0.7 },
    { condition_id: c('Pleural Effusion'), feature_id: fFever, lr_present: 1.5, lr_absent: 0.8 },

    // Aortic Dissection
    { condition_id: c('Aortic Dissection'), feature_id: fChestPain, lr_present: 4.5, lr_absent: 0.2 },
    { condition_id: c('Aortic Dissection'), feature_id: fSyncope, lr_present: 3.0, lr_absent: 0.7 },
    { condition_id: c('Aortic Dissection'), feature_id: fDiaphoresis, lr_present: 2.5, lr_absent: 0.7 },
    { condition_id: c('Aortic Dissection'), feature_id: fRadiatingToBack, lr_present: 4.0, lr_absent: 0.5 },

    // Pulmonary Hypertension
    { condition_id: c('Pulmonary Hypertension'), feature_id: fBreathing, lr_present: 3.0, lr_absent: 0.3 },
    { condition_id: c('Pulmonary Hypertension'), feature_id: fFatigue, lr_present: 2.0, lr_absent: 0.7 },
    { condition_id: c('Pulmonary Hypertension'), feature_id: fSyncope, lr_present: 2.5, lr_absent: 0.7 },
    { condition_id: c('Pulmonary Hypertension'), feature_id: fEdema, lr_present: 2.5, lr_absent: 0.6 },

    // Myocarditis
    { condition_id: c('Myocarditis'), feature_id: fChestPain, lr_present: 3.0, lr_absent: 0.5 },
    { condition_id: c('Myocarditis'), feature_id: fFever, lr_present: 2.5, lr_absent: 0.5 },
    { condition_id: c('Myocarditis'), feature_id: fBreathing, lr_present: 2.0, lr_absent: 0.7 },
    { condition_id: c('Myocarditis'), feature_id: fFatigue, lr_present: 2.0, lr_absent: 0.7 },

    // Costochondritis
    { condition_id: c('Costochondritis'), feature_id: fChestPain, lr_present: 3.5, lr_absent: 0.3 },

    // Tuberculosis
    { condition_id: c('Tuberculosis'), feature_id: fCough, lr_present: 3.0, lr_absent: 0.4 },
    { condition_id: c('Tuberculosis'), feature_id: fFever, lr_present: 2.5, lr_absent: 0.5 },
    { condition_id: c('Tuberculosis'), feature_id: fNightSweats, lr_present: 4.0, lr_absent: 0.5 },
    { condition_id: c('Tuberculosis'), feature_id: fWeightLoss, lr_present: 3.5, lr_absent: 0.5 },
    { condition_id: c('Tuberculosis'), feature_id: fHemoptysis, lr_present: 3.0, lr_absent: 0.7 },

    // Sarcoidosis
    { condition_id: c('Sarcoidosis'), feature_id: fCough, lr_present: 2.5, lr_absent: 0.6 },
    { condition_id: c('Sarcoidosis'), feature_id: fBreathing, lr_present: 2.0, lr_absent: 0.6 },
    { condition_id: c('Sarcoidosis'), feature_id: fFatigue, lr_present: 2.0, lr_absent: 0.7 },

    // Atrial Fibrillation
    { condition_id: c('Atrial Fibrillation'), feature_id: fPalpitations, lr_present: 4.0, lr_absent: 0.4 },
    { condition_id: c('Atrial Fibrillation'), feature_id: fBreathing, lr_present: 2.0, lr_absent: 0.7 },
    { condition_id: c('Atrial Fibrillation'), feature_id: fTachycardia, lr_present: 2.5, lr_absent: 0.6 },
    { condition_id: c('Atrial Fibrillation'), feature_id: fFatigue, lr_present: 1.8, lr_absent: 0.8 },

    // Valvular Heart Disease
    { condition_id: c('Valvular Heart Disease'), feature_id: fBreathing, lr_present: 2.5, lr_absent: 0.5 },
    { condition_id: c('Valvular Heart Disease'), feature_id: fFatigue, lr_present: 2.0, lr_absent: 0.7 },
    { condition_id: c('Valvular Heart Disease'), feature_id: fSyncope, lr_present: 2.5, lr_absent: 0.7 },
    { condition_id: c('Valvular Heart Disease'), feature_id: fEdema, lr_present: 2.0, lr_absent: 0.7 },

    // Bronchiectasis
    { condition_id: c('Bronchiectasis'), feature_id: fCough, lr_present: 3.5, lr_absent: 0.3 },
    { condition_id: c('Bronchiectasis'), feature_id: fHemoptysis, lr_present: 3.0, lr_absent: 0.6 },
    { condition_id: c('Bronchiectasis'), feature_id: fBreathing, lr_present: 2.0, lr_absent: 0.7 },

    // OSA
    { condition_id: c('Obstructive Sleep Apnea'), feature_id: fBreathing, lr_present: 1.5, lr_absent: 0.7 },
    { condition_id: c('Obstructive Sleep Apnea'), feature_id: fFatigue, lr_present: 2.5, lr_absent: 0.5 },
    { condition_id: c('Obstructive Sleep Apnea'), feature_id: fObesity, lr_present: 3.5, lr_absent: 0.5 },

    // Deconditioning
    { condition_id: c('Deconditioning'), feature_id: fBreathing, lr_present: 1.5, lr_absent: 0.6 },
    { condition_id: c('Deconditioning'), feature_id: fFatigue, lr_present: 2.0, lr_absent: 0.6 },
    { condition_id: c('Deconditioning'), feature_id: fObesity, lr_present: 2.0, lr_absent: 0.7 },

    // ======== GI / ABDOMINAL PACK ========

    // Appendicitis
    { condition_id: c('Appendicitis'), feature_id: fRLQPain, lr_present: 8.0, lr_absent: 0.2 },
    { condition_id: c('Appendicitis'), feature_id: fMigrationPain, lr_present: 6.0, lr_absent: 0.5 },
    { condition_id: c('Appendicitis'), feature_id: fRebound, lr_present: 5.0, lr_absent: 0.4 },
    { condition_id: c('Appendicitis'), feature_id: fFever, lr_present: 2.5, lr_absent: 0.6 },
    { condition_id: c('Appendicitis'), feature_id: fNausea, lr_present: 2.5, lr_absent: 0.5 },
    { condition_id: c('Appendicitis'), feature_id: fAnorexia, lr_present: 3.0, lr_absent: 0.5 },
    { condition_id: c('Appendicitis'), feature_id: fAbdPain, lr_present: 2.0, lr_absent: 0.4 },
    { condition_id: c('Appendicitis'), feature_id: fElevatedWBC, lr_present: 2.5, lr_absent: 0.5 },

    // Cholecystitis
    { condition_id: c('Cholecystitis'), feature_id: fRUQPain, lr_present: 7.0, lr_absent: 0.2 },
    { condition_id: c('Cholecystitis'), feature_id: fMurphySign, lr_present: 6.0, lr_absent: 0.4 },
    { condition_id: c('Cholecystitis'), feature_id: fNausea, lr_present: 2.5, lr_absent: 0.6 },
    { condition_id: c('Cholecystitis'), feature_id: fFever, lr_present: 2.0, lr_absent: 0.6 },
    { condition_id: c('Cholecystitis'), feature_id: fAbdPain, lr_present: 2.0, lr_absent: 0.5 },
    { condition_id: c('Cholecystitis'), feature_id: fGallstoneHistory, lr_present: 3.5, lr_absent: 0.6 },
    { condition_id: c('Cholecystitis'), feature_id: fElevatedWBC, lr_present: 2.0, lr_absent: 0.6 },

    // Pancreatitis
    { condition_id: c('Pancreatitis'), feature_id: fEpigastricPain, lr_present: 6.0, lr_absent: 0.3 },
    { condition_id: c('Pancreatitis'), feature_id: fRadiatingToBack, lr_present: 5.0, lr_absent: 0.5 },
    { condition_id: c('Pancreatitis'), feature_id: fNausea, lr_present: 3.0, lr_absent: 0.5 },
    { condition_id: c('Pancreatitis'), feature_id: fAbdPain, lr_present: 2.5, lr_absent: 0.3 },
    { condition_id: c('Pancreatitis'), feature_id: fElevatedLipase, lr_present: 15.0, lr_absent: 0.1 },
    { condition_id: c('Pancreatitis'), feature_id: fAlcoholHistory, lr_present: 3.0, lr_absent: 0.7 },
    { condition_id: c('Pancreatitis'), feature_id: fGallstoneHistory, lr_present: 3.0, lr_absent: 0.6 },

    // Small Bowel Obstruction
    { condition_id: c('Small Bowel Obstruction'), feature_id: fAbdPain, lr_present: 3.0, lr_absent: 0.3 },
    { condition_id: c('Small Bowel Obstruction'), feature_id: fAbdDistension, lr_present: 6.0, lr_absent: 0.3 },
    { condition_id: c('Small Bowel Obstruction'), feature_id: fNausea, lr_present: 4.0, lr_absent: 0.4 },
    { condition_id: c('Small Bowel Obstruction'), feature_id: fConstipation, lr_present: 4.5, lr_absent: 0.5 },
    { condition_id: c('Small Bowel Obstruction'), feature_id: fRecentSurgery, lr_present: 3.5, lr_absent: 0.6 },
    { condition_id: c('Small Bowel Obstruction'), feature_id: fElevatedLactate, lr_present: 3.0, lr_absent: 0.6 },

    // Gastroenteritis
    { condition_id: c('Gastroenteritis'), feature_id: fDiarrhea, lr_present: 5.0, lr_absent: 0.3 },
    { condition_id: c('Gastroenteritis'), feature_id: fNausea, lr_present: 3.5, lr_absent: 0.4 },
    { condition_id: c('Gastroenteritis'), feature_id: fAbdPain, lr_present: 2.0, lr_absent: 0.6 },
    { condition_id: c('Gastroenteritis'), feature_id: fFever, lr_present: 2.0, lr_absent: 0.6 },

    // Diverticulitis
    { condition_id: c('Diverticulitis'), feature_id: fLLQPain, lr_present: 7.0, lr_absent: 0.3 },
    { condition_id: c('Diverticulitis'), feature_id: fFever, lr_present: 2.5, lr_absent: 0.6 },
    { condition_id: c('Diverticulitis'), feature_id: fAbdPain, lr_present: 2.0, lr_absent: 0.5 },
    { condition_id: c('Diverticulitis'), feature_id: fNausea, lr_present: 1.8, lr_absent: 0.7 },
    { condition_id: c('Diverticulitis'), feature_id: fElevatedWBC, lr_present: 2.5, lr_absent: 0.6 },
    { condition_id: c('Diverticulitis'), feature_id: fConstipation, lr_present: 2.0, lr_absent: 0.7 },

    // Peptic Ulcer Disease
    { condition_id: c('Peptic Ulcer Disease'), feature_id: fEpigastricPain, lr_present: 5.0, lr_absent: 0.3 },
    { condition_id: c('Peptic Ulcer Disease'), feature_id: fNausea, lr_present: 2.0, lr_absent: 0.7 },
    { condition_id: c('Peptic Ulcer Disease'), feature_id: fMelena, lr_present: 4.0, lr_absent: 0.7 },
    { condition_id: c('Peptic Ulcer Disease'), feature_id: fHeartburn, lr_present: 2.5, lr_absent: 0.6 },
    { condition_id: c('Peptic Ulcer Disease'), feature_id: fAbdPain, lr_present: 2.0, lr_absent: 0.5 },

    // GI Bleed
    { condition_id: c('GI Bleed'), feature_id: fMelena, lr_present: 8.0, lr_absent: 0.3 },
    { condition_id: c('GI Bleed'), feature_id: fTachycardia, lr_present: 2.5, lr_absent: 0.6 },
    { condition_id: c('GI Bleed'), feature_id: fSyncope, lr_present: 2.5, lr_absent: 0.7 },
    { condition_id: c('GI Bleed'), feature_id: fAbdPain, lr_present: 1.5, lr_absent: 0.7 },
    { condition_id: c('GI Bleed'), feature_id: fFatigue, lr_present: 2.0, lr_absent: 0.7 },

    // Mesenteric Ischemia
    { condition_id: c('Mesenteric Ischemia'), feature_id: fAbdPain, lr_present: 4.0, lr_absent: 0.2 },
    { condition_id: c('Mesenteric Ischemia'), feature_id: fNausea, lr_present: 2.5, lr_absent: 0.6 },
    { condition_id: c('Mesenteric Ischemia'), feature_id: fElevatedLactate, lr_present: 5.0, lr_absent: 0.4 },
    { condition_id: c('Mesenteric Ischemia'), feature_id: fAbdDistension, lr_present: 2.5, lr_absent: 0.6 },
    { condition_id: c('Mesenteric Ischemia'), feature_id: fDiarrhea, lr_present: 2.0, lr_absent: 0.7 },

    // Bowel Perforation
    { condition_id: c('Bowel Perforation'), feature_id: fAbdPain, lr_present: 4.0, lr_absent: 0.2 },
    { condition_id: c('Bowel Perforation'), feature_id: fAbdRigidity, lr_present: 8.0, lr_absent: 0.3 },
    { condition_id: c('Bowel Perforation'), feature_id: fRebound, lr_present: 5.0, lr_absent: 0.4 },
    { condition_id: c('Bowel Perforation'), feature_id: fFever, lr_present: 2.5, lr_absent: 0.5 },
    { condition_id: c('Bowel Perforation'), feature_id: fTachycardia, lr_present: 2.5, lr_absent: 0.6 },

    // Hepatitis
    { condition_id: c('Hepatitis'), feature_id: fJaundice, lr_present: 7.0, lr_absent: 0.4 },
    { condition_id: c('Hepatitis'), feature_id: fRUQPain, lr_present: 3.0, lr_absent: 0.6 },
    { condition_id: c('Hepatitis'), feature_id: fNausea, lr_present: 2.5, lr_absent: 0.6 },
    { condition_id: c('Hepatitis'), feature_id: fFatigue, lr_present: 2.5, lr_absent: 0.6 },
    { condition_id: c('Hepatitis'), feature_id: fFever, lr_present: 2.0, lr_absent: 0.7 },

    // IBD
    { condition_id: c('Inflammatory Bowel Disease'), feature_id: fDiarrhea, lr_present: 4.0, lr_absent: 0.4 },
    { condition_id: c('Inflammatory Bowel Disease'), feature_id: fAbdPain, lr_present: 3.0, lr_absent: 0.5 },
    { condition_id: c('Inflammatory Bowel Disease'), feature_id: fMelena, lr_present: 3.0, lr_absent: 0.6 },
    { condition_id: c('Inflammatory Bowel Disease'), feature_id: fWeightLoss, lr_present: 3.0, lr_absent: 0.6 },
    { condition_id: c('Inflammatory Bowel Disease'), feature_id: fTenesmus, lr_present: 3.5, lr_absent: 0.6 },
    { condition_id: c('Inflammatory Bowel Disease'), feature_id: fFever, lr_present: 2.0, lr_absent: 0.7 },

    // ======== GU PACK ========

    // Nephrolithiasis
    { condition_id: c('Nephrolithiasis'), feature_id: fFlankPain, lr_present: 7.0, lr_absent: 0.2 },
    { condition_id: c('Nephrolithiasis'), feature_id: fHematuria, lr_present: 5.0, lr_absent: 0.3 },
    { condition_id: c('Nephrolithiasis'), feature_id: fNausea, lr_present: 2.5, lr_absent: 0.6 },
    { condition_id: c('Nephrolithiasis'), feature_id: fAbdPain, lr_present: 2.0, lr_absent: 0.6 },

    // Pyelonephritis
    { condition_id: c('Pyelonephritis'), feature_id: fFlankPain, lr_present: 5.0, lr_absent: 0.3 },
    { condition_id: c('Pyelonephritis'), feature_id: fFever, lr_present: 4.0, lr_absent: 0.3 },
    { condition_id: c('Pyelonephritis'), feature_id: fDysuria, lr_present: 3.5, lr_absent: 0.5 },
    { condition_id: c('Pyelonephritis'), feature_id: fNausea, lr_present: 2.5, lr_absent: 0.6 },
    { condition_id: c('Pyelonephritis'), feature_id: fPositiveUA, lr_present: 5.0, lr_absent: 0.2 },
    { condition_id: c('Pyelonephritis'), feature_id: fElevatedWBC, lr_present: 2.5, lr_absent: 0.5 },

    // UTI
    { condition_id: c('UTI'), feature_id: fDysuria, lr_present: 6.0, lr_absent: 0.3 },
    { condition_id: c('UTI'), feature_id: fUrinaryFrequency, lr_present: 4.0, lr_absent: 0.4 },
    { condition_id: c('UTI'), feature_id: fHematuria, lr_present: 2.5, lr_absent: 0.7 },
    { condition_id: c('UTI'), feature_id: fPositiveUA, lr_present: 6.0, lr_absent: 0.2 },
    { condition_id: c('UTI'), feature_id: fPelvicPain, lr_present: 2.0, lr_absent: 0.7 },

    // ======== GYN PACK ========

    // Ovarian Torsion
    { condition_id: c('Ovarian Torsion'), feature_id: fPelvicPain, lr_present: 5.0, lr_absent: 0.3 },
    { condition_id: c('Ovarian Torsion'), feature_id: fNausea, lr_present: 3.5, lr_absent: 0.5 },
    { condition_id: c('Ovarian Torsion'), feature_id: fAdnexalTenderness, lr_present: 7.0, lr_absent: 0.3 },
    { condition_id: c('Ovarian Torsion'), feature_id: fAbdPain, lr_present: 2.5, lr_absent: 0.5 },

    // Ectopic Pregnancy
    { condition_id: c('Ectopic Pregnancy'), feature_id: fPelvicPain, lr_present: 4.0, lr_absent: 0.3 },
    { condition_id: c('Ectopic Pregnancy'), feature_id: fVaginalBleeding, lr_present: 5.0, lr_absent: 0.4 },
    { condition_id: c('Ectopic Pregnancy'), feature_id: fPregnancyTest, lr_present: 15.0, lr_absent: 0.05 },
    { condition_id: c('Ectopic Pregnancy'), feature_id: fAdnexalTenderness, lr_present: 5.0, lr_absent: 0.4 },
    { condition_id: c('Ectopic Pregnancy'), feature_id: fAbdPain, lr_present: 2.5, lr_absent: 0.5 },
    { condition_id: c('Ectopic Pregnancy'), feature_id: fSyncope, lr_present: 2.5, lr_absent: 0.7 },

    // PID
    { condition_id: c('PID'), feature_id: fPelvicPain, lr_present: 4.5, lr_absent: 0.3 },
    { condition_id: c('PID'), feature_id: fFever, lr_present: 2.5, lr_absent: 0.5 },
    { condition_id: c('PID'), feature_id: fVaginalBleeding, lr_present: 2.0, lr_absent: 0.7 },
    { condition_id: c('PID'), feature_id: fAdnexalTenderness, lr_present: 4.0, lr_absent: 0.4 },
    { condition_id: c('PID'), feature_id: fSexuallyActive, lr_present: 2.5, lr_absent: 0.5 },

    // Ruptured Ovarian Cyst
    { condition_id: c('Ruptured Ovarian Cyst'), feature_id: fPelvicPain, lr_present: 5.0, lr_absent: 0.3 },
    { condition_id: c('Ruptured Ovarian Cyst'), feature_id: fAbdPain, lr_present: 2.5, lr_absent: 0.5 },
    { condition_id: c('Ruptured Ovarian Cyst'), feature_id: fNausea, lr_present: 2.0, lr_absent: 0.7 },
    { condition_id: c('Ruptured Ovarian Cyst'), feature_id: fAdnexalTenderness, lr_present: 4.0, lr_absent: 0.5 },

    // Endometriosis
    { condition_id: c('Endometriosis'), feature_id: fPelvicPain, lr_present: 4.0, lr_absent: 0.4 },
    { condition_id: c('Endometriosis'), feature_id: fDysuria, lr_present: 1.8, lr_absent: 0.8 },

    // ======== SEPSIS (cross-cutting) ========
    { condition_id: c('Sepsis'), feature_id: fFever, lr_present: 3.5, lr_absent: 0.4 },
    { condition_id: c('Sepsis'), feature_id: fTachycardia, lr_present: 3.0, lr_absent: 0.5 },
    { condition_id: c('Sepsis'), feature_id: fTachypnea, lr_present: 2.5, lr_absent: 0.6 },
    { condition_id: c('Sepsis'), feature_id: fHypoxia, lr_present: 2.0, lr_absent: 0.7 },
    { condition_id: c('Sepsis'), feature_id: fElevatedWBC, lr_present: 2.5, lr_absent: 0.5 },
    { condition_id: c('Sepsis'), feature_id: fElevatedLactate, lr_present: 5.0, lr_absent: 0.4 },
    { condition_id: c('Sepsis'), feature_id: fDiaphoresis, lr_present: 2.0, lr_absent: 0.7 },
    // ======== PEDIATRIC CORE PACK ========

    // Herpangina
    { condition_id: c('Herpangina'), feature_id: fFever, lr_present: 3.5, lr_absent: 0.4 },
    { condition_id: c('Herpangina'), feature_id: fPosteriorOralVesicles, lr_present: 12.0, lr_absent: 0.1 },
    { condition_id: c('Herpangina'), feature_id: fSoreThroat, lr_present: 3.0, lr_absent: 0.5 },
    { condition_id: c('Herpangina'), feature_id: fAnorexia, lr_present: 2.5, lr_absent: 0.6 },
    { condition_id: c('Herpangina'), feature_id: fIrritability, lr_present: 2.0, lr_absent: 0.7 },
    { condition_id: c('Herpangina'), feature_id: fDrooling, lr_present: 2.0, lr_absent: 0.8 },

    // Hand-Foot-Mouth Disease
    { condition_id: c('Hand-Foot-Mouth Disease'), feature_id: fFever, lr_present: 3.0, lr_absent: 0.5 },
    { condition_id: c('Hand-Foot-Mouth Disease'), feature_id: fPosteriorOralVesicles, lr_present: 6.0, lr_absent: 0.3 },
    { condition_id: c('Hand-Foot-Mouth Disease'), feature_id: fHandFootRash, lr_present: 15.0, lr_absent: 0.1 },
    { condition_id: c('Hand-Foot-Mouth Disease'), feature_id: fSoreThroat, lr_present: 2.5, lr_absent: 0.6 },
    { condition_id: c('Hand-Foot-Mouth Disease'), feature_id: fAnorexia, lr_present: 2.0, lr_absent: 0.7 },
    { condition_id: c('Hand-Foot-Mouth Disease'), feature_id: fRash, lr_present: 3.0, lr_absent: 0.5 },

    // Viral URI
    { condition_id: c('Viral URI'), feature_id: fRhinorrhea, lr_present: 4.0, lr_absent: 0.3 },
    { condition_id: c('Viral URI'), feature_id: fHeadache, lr_present: 1.5, lr_absent: 0.8 },
    { condition_id: c('Viral URI'), feature_id: fCough, lr_present: 2.5, lr_absent: 0.5 },
    { condition_id: c('Viral URI'), feature_id: fFever, lr_present: 1.8, lr_absent: 0.7 },
    { condition_id: c('Viral URI'), feature_id: fSoreThroat, lr_present: 2.0, lr_absent: 0.7 },
    { condition_id: c('Viral URI'), feature_id: fFatigue, lr_present: 1.5, lr_absent: 0.8 },

    // Influenza
    { condition_id: c('Influenza'), feature_id: fFever, lr_present: 4.0, lr_absent: 0.3 },
    { condition_id: c('Influenza'), feature_id: fHeadache, lr_present: 2.5, lr_absent: 0.6 },
    { condition_id: c('Influenza'), feature_id: fCough, lr_present: 2.5, lr_absent: 0.5 },
    { condition_id: c('Influenza'), feature_id: fFatigue, lr_present: 3.0, lr_absent: 0.5 },
    { condition_id: c('Influenza'), feature_id: fArthralgia, lr_present: 3.0, lr_absent: 0.5 },
    { condition_id: c('Influenza'), feature_id: fRhinorrhea, lr_present: 2.0, lr_absent: 0.7 },
    { condition_id: c('Influenza'), feature_id: fSoreThroat, lr_present: 1.8, lr_absent: 0.8 },

    // RSV Bronchiolitis
    { condition_id: c('RSV Bronchiolitis'), feature_id: fWheezing, lr_present: 5.0, lr_absent: 0.3 },
    { condition_id: c('RSV Bronchiolitis'), feature_id: fCough, lr_present: 3.0, lr_absent: 0.4 },
    { condition_id: c('RSV Bronchiolitis'), feature_id: fTachypnea, lr_present: 3.5, lr_absent: 0.4 },
    { condition_id: c('RSV Bronchiolitis'), feature_id: fHypoxia, lr_present: 3.0, lr_absent: 0.5 },
    { condition_id: c('RSV Bronchiolitis'), feature_id: fFever, lr_present: 2.0, lr_absent: 0.6 },
    { condition_id: c('RSV Bronchiolitis'), feature_id: fRhinorrhea, lr_present: 3.0, lr_absent: 0.5 },
    { condition_id: c('RSV Bronchiolitis'), feature_id: fPoorFeeding, lr_present: 3.0, lr_absent: 0.5 },
    { condition_id: c('RSV Bronchiolitis'), feature_id: fApnea, lr_present: 4.0, lr_absent: 0.8 },

    // Adenovirus Infection
    { condition_id: c('Adenovirus Infection'), feature_id: fFever, lr_present: 3.5, lr_absent: 0.4 },
    { condition_id: c('Adenovirus Infection'), feature_id: fConjunctivitis, lr_present: 5.0, lr_absent: 0.5 },
    { condition_id: c('Adenovirus Infection'), feature_id: fSoreThroat, lr_present: 3.0, lr_absent: 0.5 },
    { condition_id: c('Adenovirus Infection'), feature_id: fRhinorrhea, lr_present: 2.5, lr_absent: 0.6 },
    { condition_id: c('Adenovirus Infection'), feature_id: fDiarrhea, lr_present: 2.0, lr_absent: 0.7 },
    { condition_id: c('Adenovirus Infection'), feature_id: fLymphadenopathy, lr_present: 2.5, lr_absent: 0.7 },

    // Roseola
    { condition_id: c('Roseola'), feature_id: fFever, lr_present: 4.5, lr_absent: 0.2 },
    { condition_id: c('Roseola'), feature_id: fRash, lr_present: 6.0, lr_absent: 0.3 },
    { condition_id: c('Roseola'), feature_id: fIrritability, lr_present: 2.0, lr_absent: 0.7 },
    { condition_id: c('Roseola'), feature_id: fSeizureActivity, lr_present: 2.5, lr_absent: 0.8 },
    { condition_id: c('Roseola'), feature_id: fRhinorrhea, lr_present: 1.5, lr_absent: 0.8 },

    // Fifth Disease
    { condition_id: c('Fifth Disease'), feature_id: fRash, lr_present: 6.0, lr_absent: 0.2 },
    { condition_id: c('Fifth Disease'), feature_id: fFever, lr_present: 2.0, lr_absent: 0.6 },
    { condition_id: c('Fifth Disease'), feature_id: fArthralgia, lr_present: 2.5, lr_absent: 0.7 },
    { condition_id: c('Fifth Disease'), feature_id: fFatigue, lr_present: 1.5, lr_absent: 0.8 },
    { condition_id: c('Fifth Disease'), feature_id: fRhinorrhea, lr_present: 1.5, lr_absent: 0.8 },

    // Croup
    { condition_id: c('Croup'), feature_id: fBarkyCough, lr_present: 15.0, lr_absent: 0.1 },
    { condition_id: c('Croup'), feature_id: fStridor, lr_present: 10.0, lr_absent: 0.2 },
    { condition_id: c('Croup'), feature_id: fFever, lr_present: 2.0, lr_absent: 0.6 },
    { condition_id: c('Croup'), feature_id: fRhinorrhea, lr_present: 2.0, lr_absent: 0.7 },
    { condition_id: c('Croup'), feature_id: fCough, lr_present: 2.5, lr_absent: 0.5 },
    { condition_id: c('Croup'), feature_id: fTachypnea, lr_present: 2.0, lr_absent: 0.7 },

    // Pediatric Asthma Exacerbation
    { condition_id: c('Pediatric Asthma Exacerbation'), feature_id: fWheezing, lr_present: 5.0, lr_absent: 0.2 },
    { condition_id: c('Pediatric Asthma Exacerbation'), feature_id: fBreathing, lr_present: 3.5, lr_absent: 0.3 },
    { condition_id: c('Pediatric Asthma Exacerbation'), feature_id: fCough, lr_present: 3.0, lr_absent: 0.4 },
    { condition_id: c('Pediatric Asthma Exacerbation'), feature_id: fTachypnea, lr_present: 2.5, lr_absent: 0.5 },
    { condition_id: c('Pediatric Asthma Exacerbation'), feature_id: fHypoxia, lr_present: 2.5, lr_absent: 0.6 },

    // Pediatric Pneumonia
    { condition_id: c('Pediatric Pneumonia'), feature_id: fFever, lr_present: 4.0, lr_absent: 0.3 },
    { condition_id: c('Pediatric Pneumonia'), feature_id: fCough, lr_present: 3.0, lr_absent: 0.4 },
    { condition_id: c('Pediatric Pneumonia'), feature_id: fTachypnea, lr_present: 3.5, lr_absent: 0.4 },
    { condition_id: c('Pediatric Pneumonia'), feature_id: fHypoxia, lr_present: 3.0, lr_absent: 0.5 },
    { condition_id: c('Pediatric Pneumonia'), feature_id: fBreathing, lr_present: 2.5, lr_absent: 0.5 },
    { condition_id: c('Pediatric Pneumonia'), feature_id: fWheezing, lr_present: 2.0, lr_absent: 0.7 },

    // Pertussis
    { condition_id: c('Pertussis'), feature_id: fParoxysmalCough, lr_present: 10.0, lr_absent: 0.2 },
    { condition_id: c('Pertussis'), feature_id: fCough, lr_present: 3.0, lr_absent: 0.3 },
    { condition_id: c('Pertussis'), feature_id: fNausea, lr_present: 2.0, lr_absent: 0.7 },
    { condition_id: c('Pertussis'), feature_id: fApnea, lr_present: 3.5, lr_absent: 0.7 },
    { condition_id: c('Pertussis'), feature_id: fRhinorrhea, lr_present: 2.0, lr_absent: 0.7 },

    // Foreign Body Aspiration
    { condition_id: c('Foreign Body Aspiration'), feature_id: fChoking, lr_present: 15.0, lr_absent: 0.2 },
    { condition_id: c('Foreign Body Aspiration'), feature_id: fWheezing, lr_present: 4.0, lr_absent: 0.5 },
    { condition_id: c('Foreign Body Aspiration'), feature_id: fStridor, lr_present: 4.0, lr_absent: 0.6 },
    { condition_id: c('Foreign Body Aspiration'), feature_id: fCough, lr_present: 3.0, lr_absent: 0.4 },
    { condition_id: c('Foreign Body Aspiration'), feature_id: fHypoxia, lr_present: 2.5, lr_absent: 0.7 },

    // Epiglottitis
    { condition_id: c('Epiglottitis'), feature_id: fStridor, lr_present: 8.0, lr_absent: 0.3 },
    { condition_id: c('Epiglottitis'), feature_id: fDrooling, lr_present: 10.0, lr_absent: 0.3 },
    { condition_id: c('Epiglottitis'), feature_id: fFever, lr_present: 3.5, lr_absent: 0.3 },
    { condition_id: c('Epiglottitis'), feature_id: fSoreThroat, lr_present: 3.0, lr_absent: 0.5 },
    { condition_id: c('Epiglottitis'), feature_id: fBreathing, lr_present: 3.5, lr_absent: 0.4 },
    { condition_id: c('Epiglottitis'), feature_id: fTrismuss, lr_present: 3.0, lr_absent: 0.7 },

    // Acute Otitis Media
    { condition_id: c('Acute Otitis Media'), feature_id: fEarPain, lr_present: 8.0, lr_absent: 0.2 },
    { condition_id: c('Acute Otitis Media'), feature_id: fFever, lr_present: 2.5, lr_absent: 0.6 },
    { condition_id: c('Acute Otitis Media'), feature_id: fIrritability, lr_present: 2.5, lr_absent: 0.6 },
    { condition_id: c('Acute Otitis Media'), feature_id: fRhinorrhea, lr_present: 2.0, lr_absent: 0.7 },
    { condition_id: c('Acute Otitis Media'), feature_id: fPoorFeeding, lr_present: 2.0, lr_absent: 0.8 },

    // Streptococcal Pharyngitis
    { condition_id: c('Streptococcal Pharyngitis'), feature_id: fSoreThroat, lr_present: 4.0, lr_absent: 0.3 },
    { condition_id: c('Streptococcal Pharyngitis'), feature_id: fHeadache, lr_present: 1.8, lr_absent: 0.8 },
    { condition_id: c('Streptococcal Pharyngitis'), feature_id: fFever, lr_present: 3.0, lr_absent: 0.4 },
    { condition_id: c('Streptococcal Pharyngitis'), feature_id: fPharyngealExudate, lr_present: 5.0, lr_absent: 0.4 },
    { condition_id: c('Streptococcal Pharyngitis'), feature_id: fLymphadenopathy, lr_present: 3.5, lr_absent: 0.5 },
    { condition_id: c('Streptococcal Pharyngitis'), feature_id: fRash, lr_present: 2.0, lr_absent: 0.8 },

    // Viral Pharyngitis
    // (no headache edge: headache is characteristic of influenza and strep,
    // not of uncomplicated viral pharyngitis)
    { condition_id: c('Viral Pharyngitis'), feature_id: fSoreThroat, lr_present: 3.5, lr_absent: 0.3 },
    { condition_id: c('Viral Pharyngitis'), feature_id: fRhinorrhea, lr_present: 3.0, lr_absent: 0.5 },
    { condition_id: c('Viral Pharyngitis'), feature_id: fCough, lr_present: 2.5, lr_absent: 0.6 },
    { condition_id: c('Viral Pharyngitis'), feature_id: fFever, lr_present: 2.0, lr_absent: 0.6 },
    { condition_id: c('Viral Pharyngitis'), feature_id: fFatigue, lr_present: 1.5, lr_absent: 0.8 },

    // Peritonsillar Abscess
    { condition_id: c('Peritonsillar Abscess'), feature_id: fSoreThroat, lr_present: 4.0, lr_absent: 0.3 },
    { condition_id: c('Peritonsillar Abscess'), feature_id: fTrismuss, lr_present: 8.0, lr_absent: 0.3 },
    { condition_id: c('Peritonsillar Abscess'), feature_id: fFever, lr_present: 3.0, lr_absent: 0.4 },
    { condition_id: c('Peritonsillar Abscess'), feature_id: fDrooling, lr_present: 4.0, lr_absent: 0.6 },
    { condition_id: c('Peritonsillar Abscess'), feature_id: fLymphadenopathy, lr_present: 3.0, lr_absent: 0.6 },

    // Retropharyngeal Abscess
    { condition_id: c('Retropharyngeal Abscess'), feature_id: fFever, lr_present: 3.5, lr_absent: 0.3 },
    { condition_id: c('Retropharyngeal Abscess'), feature_id: fNeckStiffness, lr_present: 6.0, lr_absent: 0.4 },
    { condition_id: c('Retropharyngeal Abscess'), feature_id: fDrooling, lr_present: 5.0, lr_absent: 0.5 },
    { condition_id: c('Retropharyngeal Abscess'), feature_id: fStridor, lr_present: 4.0, lr_absent: 0.6 },
    { condition_id: c('Retropharyngeal Abscess'), feature_id: fSoreThroat, lr_present: 3.0, lr_absent: 0.5 },

    // Viral Gastroenteritis
    { condition_id: c('Viral Gastroenteritis'), feature_id: fDiarrhea, lr_present: 5.0, lr_absent: 0.3 },
    { condition_id: c('Viral Gastroenteritis'), feature_id: fNausea, lr_present: 4.0, lr_absent: 0.4 },
    { condition_id: c('Viral Gastroenteritis'), feature_id: fFever, lr_present: 2.0, lr_absent: 0.6 },
    { condition_id: c('Viral Gastroenteritis'), feature_id: fAbdPain, lr_present: 2.0, lr_absent: 0.6 },
    { condition_id: c('Viral Gastroenteritis'), feature_id: fPoorFeeding, lr_present: 2.5, lr_absent: 0.7 },

    // Pediatric Constipation
    { condition_id: c('Pediatric Constipation'), feature_id: fConstipation, lr_present: 8.0, lr_absent: 0.1 },
    { condition_id: c('Pediatric Constipation'), feature_id: fAbdPain, lr_present: 3.0, lr_absent: 0.5 },
    { condition_id: c('Pediatric Constipation'), feature_id: fAbdDistension, lr_present: 2.5, lr_absent: 0.6 },
    { condition_id: c('Pediatric Constipation'), feature_id: fAnorexia, lr_present: 2.0, lr_absent: 0.7 },
    { condition_id: c('Pediatric Constipation'), feature_id: fNausea, lr_present: 1.5, lr_absent: 0.8 },

    // Pediatric Appendicitis
    { condition_id: c('Pediatric Appendicitis'), feature_id: fRLQPain, lr_present: 7.0, lr_absent: 0.2 },
    { condition_id: c('Pediatric Appendicitis'), feature_id: fMigrationPain, lr_present: 5.0, lr_absent: 0.5 },
    { condition_id: c('Pediatric Appendicitis'), feature_id: fRebound, lr_present: 4.5, lr_absent: 0.4 },
    { condition_id: c('Pediatric Appendicitis'), feature_id: fFever, lr_present: 2.5, lr_absent: 0.6 },
    { condition_id: c('Pediatric Appendicitis'), feature_id: fNausea, lr_present: 2.5, lr_absent: 0.5 },
    { condition_id: c('Pediatric Appendicitis'), feature_id: fAnorexia, lr_present: 3.0, lr_absent: 0.5 },
    { condition_id: c('Pediatric Appendicitis'), feature_id: fAbdPain, lr_present: 2.0, lr_absent: 0.4 },

    // Intussusception
    { condition_id: c('Intussusception'), feature_id: fCurrantJellyStool, lr_present: 15.0, lr_absent: 0.3 },
    { condition_id: c('Intussusception'), feature_id: fAbdPain, lr_present: 3.5, lr_absent: 0.4 },
    { condition_id: c('Intussusception'), feature_id: fNausea, lr_present: 3.0, lr_absent: 0.5 },
    { condition_id: c('Intussusception'), feature_id: fAbdMass, lr_present: 8.0, lr_absent: 0.5 },
    { condition_id: c('Intussusception'), feature_id: fLethargy, lr_present: 3.5, lr_absent: 0.5 },
    { condition_id: c('Intussusception'), feature_id: fIrritability, lr_present: 3.0, lr_absent: 0.6 },

    // Pyloric Stenosis
    { condition_id: c('Pyloric Stenosis'), feature_id: fProjectileVomiting, lr_present: 12.0, lr_absent: 0.1 },
    { condition_id: c('Pyloric Stenosis'), feature_id: fPoorFeeding, lr_present: 3.0, lr_absent: 0.5 },
    { condition_id: c('Pyloric Stenosis'), feature_id: fAbdMass, lr_present: 6.0, lr_absent: 0.5 },
    { condition_id: c('Pyloric Stenosis'), feature_id: fWeightLoss, lr_present: 3.0, lr_absent: 0.5 },
    { condition_id: c('Pyloric Stenosis'), feature_id: fIrritability, lr_present: 2.0, lr_absent: 0.7 },

    // Malrotation with Volvulus
    { condition_id: c('Malrotation with Volvulus'), feature_id: fBiliousVomiting, lr_present: 12.0, lr_absent: 0.1 },
    { condition_id: c('Malrotation with Volvulus'), feature_id: fAbdDistension, lr_present: 5.0, lr_absent: 0.4 },
    { condition_id: c('Malrotation with Volvulus'), feature_id: fAbdPain, lr_present: 3.0, lr_absent: 0.4 },
    { condition_id: c('Malrotation with Volvulus'), feature_id: fMelena, lr_present: 4.0, lr_absent: 0.6 },
    { condition_id: c('Malrotation with Volvulus'), feature_id: fLethargy, lr_present: 3.0, lr_absent: 0.6 },

    // Mesenteric Adenitis
    { condition_id: c('Mesenteric Adenitis'), feature_id: fAbdPain, lr_present: 3.0, lr_absent: 0.4 },
    { condition_id: c('Mesenteric Adenitis'), feature_id: fRLQPain, lr_present: 3.0, lr_absent: 0.5 },
    { condition_id: c('Mesenteric Adenitis'), feature_id: fFever, lr_present: 2.5, lr_absent: 0.5 },
    { condition_id: c('Mesenteric Adenitis'), feature_id: fRhinorrhea, lr_present: 2.5, lr_absent: 0.6 },
    { condition_id: c('Mesenteric Adenitis'), feature_id: fNausea, lr_present: 2.0, lr_absent: 0.7 },

    // IgA Vasculitis (HSP)
    { condition_id: c('IgA Vasculitis (HSP)'), feature_id: fPurpura, lr_present: 12.0, lr_absent: 0.1 },
    { condition_id: c('IgA Vasculitis (HSP)'), feature_id: fAbdPain, lr_present: 3.5, lr_absent: 0.5 },
    { condition_id: c('IgA Vasculitis (HSP)'), feature_id: fArthralgia, lr_present: 4.0, lr_absent: 0.5 },
    { condition_id: c('IgA Vasculitis (HSP)'), feature_id: fHematuria, lr_present: 3.0, lr_absent: 0.7 },
    { condition_id: c('IgA Vasculitis (HSP)'), feature_id: fRash, lr_present: 3.5, lr_absent: 0.4 },

    // Pediatric UTI
    { condition_id: c('Pediatric UTI'), feature_id: fDysuria, lr_present: 5.0, lr_absent: 0.4 },
    { condition_id: c('Pediatric UTI'), feature_id: fFever, lr_present: 3.0, lr_absent: 0.5 },
    { condition_id: c('Pediatric UTI'), feature_id: fUrinaryFrequency, lr_present: 3.5, lr_absent: 0.5 },
    { condition_id: c('Pediatric UTI'), feature_id: fPositiveUA, lr_present: 5.0, lr_absent: 0.2 },
    { condition_id: c('Pediatric UTI'), feature_id: fIrritability, lr_present: 2.0, lr_absent: 0.7 },

    // Pediatric Pyelonephritis
    { condition_id: c('Pediatric Pyelonephritis'), feature_id: fFever, lr_present: 4.0, lr_absent: 0.3 },
    { condition_id: c('Pediatric Pyelonephritis'), feature_id: fFlankPain, lr_present: 4.5, lr_absent: 0.4 },
    { condition_id: c('Pediatric Pyelonephritis'), feature_id: fDysuria, lr_present: 3.0, lr_absent: 0.5 },
    { condition_id: c('Pediatric Pyelonephritis'), feature_id: fNausea, lr_present: 2.5, lr_absent: 0.6 },
    { condition_id: c('Pediatric Pyelonephritis'), feature_id: fPositiveUA, lr_present: 5.0, lr_absent: 0.2 },
    { condition_id: c('Pediatric Pyelonephritis'), feature_id: fElevatedWBC, lr_present: 2.5, lr_absent: 0.5 },

    // Testicular Torsion
    { condition_id: c('Testicular Torsion'), feature_id: fTesticularPain, lr_present: 15.0, lr_absent: 0.05 },
    { condition_id: c('Testicular Torsion'), feature_id: fNausea, lr_present: 3.5, lr_absent: 0.5 },
    { condition_id: c('Testicular Torsion'), feature_id: fAbdPain, lr_present: 2.0, lr_absent: 0.7 },

    // Febrile Seizure
    { condition_id: c('Febrile Seizure'), feature_id: fSeizureActivity, lr_present: 10.0, lr_absent: 0.1 },
    { condition_id: c('Febrile Seizure'), feature_id: fFever, lr_present: 5.0, lr_absent: 0.1 },
    { condition_id: c('Febrile Seizure'), feature_id: fIrritability, lr_present: 2.0, lr_absent: 0.7 },
    { condition_id: c('Febrile Seizure'), feature_id: fLethargy, lr_present: 2.0, lr_absent: 0.7 },

    // Pediatric Epilepsy
    { condition_id: c('Pediatric Epilepsy'), feature_id: fSeizureActivity, lr_present: 12.0, lr_absent: 0.1 },
    { condition_id: c('Pediatric Epilepsy'), feature_id: fLethargy, lr_present: 2.0, lr_absent: 0.7 },
    { condition_id: c('Pediatric Epilepsy'), feature_id: fFatigue, lr_present: 1.5, lr_absent: 0.8 },

    // Meningitis
    { condition_id: c('Meningitis'), feature_id: fFever, lr_present: 4.0, lr_absent: 0.2 },
    { condition_id: c('Meningitis'), feature_id: fNeckStiffness, lr_present: 8.0, lr_absent: 0.3 },
    { condition_id: c('Meningitis'), feature_id: fHeadache, lr_present: 3.0, lr_absent: 0.4 },
    { condition_id: c('Meningitis'), feature_id: fPhotophobia, lr_present: 4.0, lr_absent: 0.7 },
    { condition_id: c('Meningitis'), feature_id: fLethargy, lr_present: 3.5, lr_absent: 0.4 },
    { condition_id: c('Meningitis'), feature_id: fBulgingFontanelle, lr_present: 10.0, lr_absent: 0.6 },
    { condition_id: c('Meningitis'), feature_id: fSeizureActivity, lr_present: 3.5, lr_absent: 0.7 },
    { condition_id: c('Meningitis'), feature_id: fIrritability, lr_present: 2.5, lr_absent: 0.6 },
    { condition_id: c('Meningitis'), feature_id: fNausea, lr_present: 2.5, lr_absent: 0.6 },
    { condition_id: c('Meningitis'), feature_id: fPurpura, lr_present: 5.0, lr_absent: 0.8 },

    // Encephalitis
    { condition_id: c('Encephalitis'), feature_id: fFever, lr_present: 3.5, lr_absent: 0.3 },
    { condition_id: c('Encephalitis'), feature_id: fHeadache, lr_present: 3.0, lr_absent: 0.5 },
    { condition_id: c('Encephalitis'), feature_id: fPhotophobia, lr_present: 3.0, lr_absent: 0.8 },
    { condition_id: c('Encephalitis'), feature_id: fSeizureActivity, lr_present: 5.0, lr_absent: 0.5 },
    { condition_id: c('Encephalitis'), feature_id: fLethargy, lr_present: 4.0, lr_absent: 0.4 },
    { condition_id: c('Encephalitis'), feature_id: fNeckStiffness, lr_present: 3.0, lr_absent: 0.6 },
    { condition_id: c('Encephalitis'), feature_id: fIrritability, lr_present: 2.5, lr_absent: 0.6 },

    // Neonatal Sepsis
    { condition_id: c('Neonatal Sepsis'), feature_id: fFever, lr_present: 3.5, lr_absent: 0.4 },
    { condition_id: c('Neonatal Sepsis'), feature_id: fLethargy, lr_present: 5.0, lr_absent: 0.3 },
    { condition_id: c('Neonatal Sepsis'), feature_id: fPoorFeeding, lr_present: 5.0, lr_absent: 0.3 },
    { condition_id: c('Neonatal Sepsis'), feature_id: fTachycardia, lr_present: 3.0, lr_absent: 0.5 },
    { condition_id: c('Neonatal Sepsis'), feature_id: fIrritability, lr_present: 2.5, lr_absent: 0.5 },
    { condition_id: c('Neonatal Sepsis'), feature_id: fApnea, lr_present: 4.0, lr_absent: 0.6 },
    { condition_id: c('Neonatal Sepsis'), feature_id: fJaundice, lr_present: 2.5, lr_absent: 0.7 },

    // Hyperbilirubinemia
    { condition_id: c('Hyperbilirubinemia'), feature_id: fJaundice, lr_present: 12.0, lr_absent: 0.05 },
    { condition_id: c('Hyperbilirubinemia'), feature_id: fPoorFeeding, lr_present: 3.0, lr_absent: 0.5 },
    { condition_id: c('Hyperbilirubinemia'), feature_id: fLethargy, lr_present: 3.0, lr_absent: 0.6 },
    { condition_id: c('Hyperbilirubinemia'), feature_id: fIrritability, lr_present: 2.0, lr_absent: 0.7 },

    // BRUE
    { condition_id: c('BRUE'), feature_id: fApnea, lr_present: 10.0, lr_absent: 0.2 },
    { condition_id: c('BRUE'), feature_id: fLethargy, lr_present: 3.0, lr_absent: 0.6 },
    { condition_id: c('BRUE'), feature_id: fPoorFeeding, lr_present: 2.5, lr_absent: 0.7 },
    { condition_id: c('BRUE'), feature_id: fHypoxia, lr_present: 3.0, lr_absent: 0.7 },

    // Scarlet Fever
    { condition_id: c('Scarlet Fever'), feature_id: fRash, lr_present: 5.0, lr_absent: 0.3 },
    { condition_id: c('Scarlet Fever'), feature_id: fStrawberryTongue, lr_present: 10.0, lr_absent: 0.4 },
    { condition_id: c('Scarlet Fever'), feature_id: fFever, lr_present: 3.0, lr_absent: 0.4 },
    { condition_id: c('Scarlet Fever'), feature_id: fSoreThroat, lr_present: 3.5, lr_absent: 0.5 },
    { condition_id: c('Scarlet Fever'), feature_id: fPharyngealExudate, lr_present: 3.0, lr_absent: 0.6 },
    { condition_id: c('Scarlet Fever'), feature_id: fDesquamation, lr_present: 4.0, lr_absent: 0.7 },

    // Kawasaki Disease
    { condition_id: c('Kawasaki Disease'), feature_id: fFever, lr_present: 5.0, lr_absent: 0.1 },
    { condition_id: c('Kawasaki Disease'), feature_id: fConjunctivitis, lr_present: 6.0, lr_absent: 0.3 },
    { condition_id: c('Kawasaki Disease'), feature_id: fMucosalErythema, lr_present: 6.0, lr_absent: 0.3 },
    { condition_id: c('Kawasaki Disease'), feature_id: fRash, lr_present: 4.0, lr_absent: 0.4 },
    { condition_id: c('Kawasaki Disease'), feature_id: fExtremitySwelling, lr_present: 5.0, lr_absent: 0.5 },
    { condition_id: c('Kawasaki Disease'), feature_id: fLymphadenopathy, lr_present: 3.5, lr_absent: 0.5 },
    { condition_id: c('Kawasaki Disease'), feature_id: fStrawberryTongue, lr_present: 5.0, lr_absent: 0.6 },
    { condition_id: c('Kawasaki Disease'), feature_id: fDesquamation, lr_present: 4.0, lr_absent: 0.6 },
    { condition_id: c('Kawasaki Disease'), feature_id: fIrritability, lr_present: 2.5, lr_absent: 0.7 },

    // MIS-C
    { condition_id: c('MIS-C'), feature_id: fFever, lr_present: 5.0, lr_absent: 0.1 },
    { condition_id: c('MIS-C'), feature_id: fConjunctivitis, lr_present: 4.0, lr_absent: 0.4 },
    { condition_id: c('MIS-C'), feature_id: fMucosalErythema, lr_present: 4.0, lr_absent: 0.4 },
    { condition_id: c('MIS-C'), feature_id: fRash, lr_present: 3.5, lr_absent: 0.5 },
    { condition_id: c('MIS-C'), feature_id: fAbdPain, lr_present: 3.5, lr_absent: 0.5 },
    { condition_id: c('MIS-C'), feature_id: fDiarrhea, lr_present: 2.5, lr_absent: 0.6 },
    { condition_id: c('MIS-C'), feature_id: fTachycardia, lr_present: 3.0, lr_absent: 0.5 },
    { condition_id: c('MIS-C'), feature_id: fHypoxia, lr_present: 2.5, lr_absent: 0.7 },
    { condition_id: c('MIS-C'), feature_id: fExtremitySwelling, lr_present: 3.0, lr_absent: 0.7 },
    { condition_id: c('MIS-C'), feature_id: fLethargy, lr_present: 3.0, lr_absent: 0.6 },
  ];

  saveEdges(edges);

  // Remap existing prior rows (incl. user edits) to the regenerated condition
  // ids; clears the priors seeded flag so seedPriorsIfEmpty() fills any gaps.
  remapPriorConditionIds(previousConditions, conditions);

  if (typeof window !== 'undefined') localStorage.setItem(SEEDED_KEY, 'true');
  console.log(`[DiffEx] Seeded ${conditions.length} conditions and ${edges.length} edges`);
}

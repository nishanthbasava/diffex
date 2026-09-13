import type { PatientData } from '@/types';
import { features } from '@/data/knowledgeBase';

interface ExportableDiagnosis {
  name: string;
  probability: number;
  acuteness: number;
  contributingFactors: string[];
  icd10_codes?: string[];
}

interface ExportOptions {
  diagnoses: ExportableDiagnosis[];
  patientData: PatientData;
  selectedFeatureIds: string[];
  testResultIds: string[];
}

function getTimestampParts() {
  const now = new Date();
  const timestamp = now.toISOString().replace('T', ' ').split('.')[0];
  const fileDate = now.toISOString().split('T')[0];
  const fileTime = now.toTimeString().slice(0, 5).replace(':', '');
  return { timestamp, fileDate, fileTime };
}

function getFindings(selectedFeatureIds: string[], testResultIds: string[]) {
  const findings = selectedFeatureIds
    .map(id => features.find(f => f.id === id))
    .filter(Boolean)
    .map(f => ({ name: f!.name, type: f!.type }));
  const testResults = testResultIds
    .map(id => features.find(f => f.id === id))
    .filter(Boolean)
    .map(f => f!.name);
  return { findings, testResults };
}

function formatDiagnosis(d: ExportableDiagnosis, i: number) {
  const acuity = d.acuteness > 0.7 ? ' — High acuity' : '';
  return `${i + 1}. ${d.name} — ${d.probability.toFixed(1)}%${acuity}`;
}

export function downloadTxt(opts: ExportOptions) {
  const { timestamp, fileDate, fileTime } = getTimestampParts();
  const { findings, testResults } = getFindings(opts.selectedFeatureIds, opts.testResultIds);
  const lines: string[] = [
    'DiffEx — Differential Export',
    `Generated: ${timestamp}`,
    '',
    `Patient: ${opts.patientData.age || '?'}yo ${opts.patientData.sex}`,
    '',
    '── Findings ──',
    ...findings.map(f => `• ${f.name} [${f.type}]`),
    '',
    ...(testResults.length > 0 ? ['── Test Results ──', ...testResults.map(t => `• ${t}`), ''] : []),
    '── Differential ──',
    ...opts.diagnoses.map((d, i) => formatDiagnosis(d, i)),
    ...(opts.diagnoses.some(d => d.icd10_codes?.length) ? ['', '── ICD-10 Codes ──', ...opts.diagnoses.filter(d => d.icd10_codes?.length).map(d => `• ${d.name}: ${d.icd10_codes!.join(', ')}`)] : []),
    '',
    'EDUCATIONAL USE ONLY.',
  ];
  download(lines.join('\n'), `diffex_${fileDate}_${fileTime}.txt`, 'text/plain');
}

export function downloadCsv(opts: ExportOptions) {
  const { fileDate, fileTime } = getTimestampParts();
  const rows = [
    ['Rank', 'Name', 'Probability %', 'Acuteness', 'High Acuity', 'ICD-10 Codes', 'Contributing Factors'].join(','),
    ...opts.diagnoses.map((d, i) =>
      [i + 1, `"${d.name}"`, d.probability.toFixed(2), d.acuteness.toFixed(2), d.acuteness > 0.7 ? 'Yes' : 'No', `"${(d.icd10_codes ?? []).join('; ')}"`, `"${d.contributingFactors.join('; ')}"`].join(',')
    ),
  ];
  download(rows.join('\n'), `diffex_${fileDate}_${fileTime}.csv`, 'text/csv');
}

export function downloadJson(opts: ExportOptions) {
  const { timestamp, fileDate, fileTime } = getTimestampParts();
  const { findings, testResults } = getFindings(opts.selectedFeatureIds, opts.testResultIds);
  const data = {
    generated: timestamp,
    patient: { age: opts.patientData.age, sex: opts.patientData.sex },
    findings,
    testResults,
    differential: opts.diagnoses.map((d, i) => ({
      rank: i + 1,
      name: d.name,
      probability: +d.probability.toFixed(2),
      acuteness: d.acuteness,
      highAcuity: d.acuteness > 0.7,
      icd10_codes: d.icd10_codes ?? [],
      contributingFactors: d.contributingFactors,
    })),
  };
  download(JSON.stringify(data, null, 2), `diffex_${fileDate}_${fileTime}.json`, 'application/json');
}

function download(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

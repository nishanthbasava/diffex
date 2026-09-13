/**
 * CDC WONDER API client for Underlying Cause of Death (UCD) dataset D76.
 * 
 * NOTE: CDC WONDER does not support CORS for browser-direct calls.
 * This client will attempt the fetch but gracefully falls back to embedded data.
 * For production use, proxy through an edge function.
 */

const WONDER_ENDPOINT = 'https://wonder.cdc.gov/controller/datarequest/D76';
const CACHE_PREFIX = 'wonder:';
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// ---- Simple hash for cache keys ----

function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + ch;
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

// ---- Cache helpers ----

interface CacheEntry {
  data: string;
  timestamp: number;
}

function getCached(dataset: string, xml: string): string | null {
  try {
    const key = CACHE_PREFIX + dataset + ':' + simpleHash(xml);
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const entry: CacheEntry = JSON.parse(raw);
    if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
      localStorage.removeItem(key);
      return null;
    }
    return entry.data;
  } catch {
    return null;
  }
}

function setCache(dataset: string, xml: string, data: string): void {
  try {
    const key = CACHE_PREFIX + dataset + ':' + simpleHash(xml);
    const entry: CacheEntry = { data, timestamp: Date.now() };
    localStorage.setItem(key, JSON.stringify(entry));
  } catch {
    // storage full — ignore
  }
}

// ---- API call ----

export async function postWonderXML(xml: string): Promise<string> {
  // Check cache first
  const cached = getCached('D76', xml);
  if (cached) return cached;

  const response = await fetch(WONDER_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/xml',
    },
    body: xml,
  });

  if (!response.ok) {
    throw new Error(`CDC WONDER API error: ${response.status} ${response.statusText}`);
  }

  const text = await response.text();
  setCache('D76', xml, text);
  return text;
}

// ---- XML builder for UCD queries ----

export interface WonderQueryParams {
  icd10Codes: string[];
  yearStart: number;
  yearEnd: number;
  groupByAgeSex: boolean;
}

/**
 * Builds the XML request body for CDC WONDER UCD dataset (D76).
 * Includes required data-use agreement acceptance.
 */
export function buildUCDQueryXML({ icd10Codes, yearStart, yearEnd, groupByAgeSex }: WonderQueryParams): string {
  const codesStr = icd10Codes.map(c => `<value>${c}</value>`).join('\n');
  
  const yearValues: string[] = [];
  for (let y = yearStart; y <= yearEnd; y++) {
    yearValues.push(`<value>${y}</value>`);
  }

  // Group-by parameters
  const groupByParams = groupByAgeSex
    ? `
    <parameter>
      <name>B_1</name>
      <value>D76.V5</value>
    </parameter>
    <parameter>
      <name>B_2</name>
      <value>D76.V7</value>
    </parameter>`
    : '';

  return `<?xml version="1.0" encoding="utf-8"?>
<request-parameters>
  <parameter>
    <name>accept_datause_restrictions</name>
    <value>true</value>
  </parameter>
  <parameter>
    <name>dataset_code</name>
    <value>D76</value>
  </parameter>
  ${groupByParams}
  <parameter>
    <name>F_D76.V2</name>
    ${codesStr}
  </parameter>
  <parameter>
    <name>F_D76.V1</name>
    ${yearValues.join('\n    ')}
  </parameter>
  <parameter>
    <name>O_V2_fmode</name>
    <value>AND</value>
  </parameter>
  <parameter>
    <name>M_1</name>
    <value>D76.M1</value>
  </parameter>
  <parameter>
    <name>M_2</name>
    <value>D76.M2</value>
  </parameter>
  <parameter>
    <name>O_precision</name>
    <value>6</value>
  </parameter>
</request-parameters>`;
}

// ---- Response parser ----

export interface WonderRow {
  ageGroup?: string;
  sex?: string;
  deaths: number;
  population: number;
  crudeRate: number; // per 100,000
}

/**
 * Parse CDC WONDER tab-delimited response into structured rows.
 * The response format contains header rows and data rows separated by tabs.
 */
export function parseWonderResponse(text: string): WonderRow[] {
  const rows: WonderRow[] = [];
  const lines = text.split('\n');
  
  // Find the data section (after "---" delimiter or header row)
  let dataStart = -1;
  let headers: string[] = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith('"') && (line.includes('Deaths') || line.includes('Crude Rate'))) {
      headers = line.split('\t').map(h => h.replace(/"/g, '').trim());
      dataStart = i + 1;
      break;
    }
  }
  
  if (dataStart < 0) return rows;
  
  const deathsIdx = headers.findIndex(h => h === 'Deaths');
  const popIdx = headers.findIndex(h => h === 'Population');
  const rateIdx = headers.findIndex(h => h.includes('Crude Rate'));
  const ageIdx = headers.findIndex(h => h.includes('Ten-Year Age') || h.includes('Age Group'));
  const sexIdx = headers.findIndex(h => h === 'Gender' || h === 'Sex');
  
  for (let i = dataStart; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line.startsWith('---') || line.startsWith('Total')) break;
    
    const cols = line.split('\t').map(c => c.replace(/"/g, '').trim());
    
    const deaths = parseInt(cols[deathsIdx]) || 0;
    const population = parseInt(cols[popIdx]) || 0;
    const crudeRate = parseFloat(cols[rateIdx]) || 0;
    
    rows.push({
      ageGroup: ageIdx >= 0 ? cols[ageIdx] : undefined,
      sex: sexIdx >= 0 ? cols[sexIdx] : undefined,
      deaths,
      population,
      crudeRate,
    });
  }
  
  return rows;
}

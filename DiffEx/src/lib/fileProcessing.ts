import type { GlobalWorkerOptions as GWO } from 'pdfjs-dist';

export type FileStatus = 'pending' | 'processing' | 'done' | 'failed';

export interface ImportedFile {
  id: string;
  name: string;
  type: string;
  size: number;
  status: FileStatus;
  progress: number;
  extractedText: string;
  error?: string;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function getFileType(file: File): string {
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  if (ext === 'txt') return 'Text';
  if (ext === 'pdf') return 'PDF';
  if (['png', 'jpg', 'jpeg'].includes(ext)) return 'Image';
  return 'Unknown';
}

export async function processTextFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Failed to read text file'));
    reader.readAsText(file);
  });
}

export async function processPdfFile(
  file: File,
  onProgress?: (progress: number) => void
): Promise<string> {
  // Dynamic import to avoid top-level await issue
  const pdfjsLib = await import('pdfjs-dist');
  pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  
  const textParts: string[] = [];
  const totalPages = pdf.numPages;
  
  for (let i = 1; i <= totalPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items
      .map((item) => ('str' in item ? item.str : ''))
      .join(' ');
    textParts.push(pageText);
    
    if (onProgress) {
      onProgress(Math.round((i / totalPages) * 100));
    }
  }
  
  return textParts.join('\n\n');
}

export async function processImageFile(
  file: File,
  onProgress?: (progress: number) => void
): Promise<string> {
  const Tesseract = (await import('tesseract.js')).default;
  const result = await Tesseract.recognize(file, 'eng', {
    logger: (m) => {
      if (m.status === 'recognizing text' && onProgress) {
        onProgress(Math.round(m.progress * 100));
      }
    },
  });
  
  return result.data.text;
}

export async function processFile(
  file: File,
  onProgress?: (progress: number) => void
): Promise<string> {
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  
  if (ext === 'txt') {
    onProgress?.(50);
    const text = await processTextFile(file);
    onProgress?.(100);
    return text;
  }
  
  if (ext === 'pdf') {
    return processPdfFile(file, onProgress);
  }
  
  if (['png', 'jpg', 'jpeg'].includes(ext)) {
    return processImageFile(file, onProgress);
  }
  
  throw new Error(`Unsupported file type: ${ext}`);
}

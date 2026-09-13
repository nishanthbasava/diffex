import { Download, FileText, FileSpreadsheet, FileJson } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { downloadTxt, downloadCsv, downloadJson } from '@/lib/exportDifferential';
import type { PatientData } from '@/types';

interface DownloadDropdownProps {
  diagnoses: { name: string; probability: number; acuteness: number; contributingFactors: string[] }[];
  patientData: PatientData;
  selectedFeatureIds: string[];
  testResultIds: string[];
}

export function DownloadDropdown(props: DownloadDropdownProps) {
  const opts = {
    diagnoses: props.diagnoses,
    patientData: props.patientData,
    selectedFeatureIds: props.selectedFeatureIds,
    testResultIds: props.testResultIds,
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
          <Download className="w-4 h-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        <DropdownMenuItem onClick={() => downloadTxt(opts)}>
          <FileText className="w-3.5 h-3.5 mr-2" />
          Text (.txt)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => downloadCsv(opts)}>
          <FileSpreadsheet className="w-3.5 h-3.5 mr-2" />
          CSV (.csv)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => downloadJson(opts)}>
          <FileJson className="w-3.5 h-3.5 mr-2" />
          JSON (.json)
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

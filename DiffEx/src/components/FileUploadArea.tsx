import { useState, useRef, useCallback } from 'react';
import { Upload, X, FileText, Image, File, Loader2, Check, AlertCircle, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { processFile, formatFileSize, getFileType, type ImportedFile } from '@/lib/fileProcessing';

interface FileUploadAreaProps {
  onTextExtracted: (text: string, filename: string) => void;
  autoAppend: boolean;
  onAutoAppendChange: (value: boolean) => void;
}

const ACCEPTED_TYPES = '.txt,.pdf,.png,.jpg,.jpeg';

export function FileUploadArea({ onTextExtracted, autoAppend, onAutoAppendChange }: FileUploadAreaProps) {
  const [files, setFiles] = useState<ImportedFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(async (fileList: FileList) => {
    const newFiles: ImportedFile[] = Array.from(fileList)
      .filter(file => {
        const ext = file.name.split('.').pop()?.toLowerCase() || '';
        return ['txt', 'pdf', 'png', 'jpg', 'jpeg'].includes(ext);
      })
      .map(file => ({
        id: `${file.name}-${Date.now()}-${Math.random()}`,
        name: file.name,
        type: getFileType(file),
        size: file.size,
        status: 'pending' as const,
        progress: 0,
        extractedText: '',
      }));

    setFiles(prev => [...prev, ...newFiles]);

    // Process each file
    for (const fileInfo of newFiles) {
      const file = Array.from(fileList).find(f => f.name === fileInfo.name);
      if (!file) continue;

      setFiles(prev => prev.map(f => 
        f.id === fileInfo.id ? { ...f, status: 'processing' as const } : f
      ));

      try {
        const text = await processFile(file, (progress) => {
          setFiles(prev => prev.map(f => 
            f.id === fileInfo.id ? { ...f, progress } : f
          ));
        });

        setFiles(prev => prev.map(f => 
          f.id === fileInfo.id ? { ...f, status: 'done' as const, progress: 100, extractedText: text } : f
        ));

        if (autoAppend) {
          onTextExtracted(text, file.name);
        }
      } catch (error) {
        setFiles(prev => prev.map(f => 
          f.id === fileInfo.id ? { 
            ...f, 
            status: 'failed' as const, 
            error: error instanceof Error ? error.message : 'Processing failed' 
          } : f
        ));
      }
    }
  }, [autoAppend, onTextExtracted]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  }, [handleFiles]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const removeFile = (id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id));
  };

  const insertFile = (fileInfo: ImportedFile) => {
    if (fileInfo.extractedText) {
      onTextExtracted(fileInfo.extractedText, fileInfo.name);
    }
  };

  const getStatusIcon = (file: ImportedFile) => {
    switch (file.status) {
      case 'pending':
        return <File className="w-4 h-4 text-muted-foreground" />;
      case 'processing':
        return <Loader2 className="w-4 h-4 text-primary animate-spin" />;
      case 'done':
        return <Check className="w-4 h-4 text-green-600" />;
      case 'failed':
        return <AlertCircle className="w-4 h-4 text-destructive" />;
    }
  };

  const getFileIcon = (type: string) => {
    if (type === 'Image') return <Image className="w-4 h-4" />;
    return <FileText className="w-4 h-4" />;
  };

  return (
    <div className="space-y-3">
      {/* Drop Zone */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={cn(
          "border-2 border-dashed rounded-lg p-4 text-center transition-colors cursor-pointer",
          isDragging 
            ? "border-primary bg-primary/5" 
            : "border-border hover:border-primary/50"
        )}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_TYPES}
          multiple
          className="hidden"
          onChange={(e) => e.target.files && handleFiles(e.target.files)}
        />
        <Upload className="w-6 h-6 mx-auto mb-2 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          Drop files or <span className="text-primary underline">browse</span>
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          .txt, .pdf, .png, .jpg, .jpeg
        </p>
      </div>

      {/* Auto-append Toggle */}
      <div className="flex items-center justify-between">
        <Label htmlFor="auto-append" className="text-xs text-muted-foreground">
          Auto-append imports to Patient Story
        </Label>
        <Switch
          id="auto-append"
          checked={autoAppend}
          onCheckedChange={onAutoAppendChange}
        />
      </div>

      {/* Files List */}
      {files.length > 0 && (
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Imported Files</Label>
          <div className="space-y-2 max-h-40 overflow-auto">
            {files.map(file => (
              <div 
                key={file.id} 
                className="flex items-center gap-2 p-2 bg-muted/50 rounded-md text-sm"
              >
                {getFileIcon(file.type)}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-medium">{file.name}</span>
                    <span className="text-xs text-muted-foreground shrink-0">
                      {file.type} • {formatFileSize(file.size)}
                    </span>
                  </div>
                  {file.status === 'processing' && (
                    <Progress value={file.progress} className="h-1 mt-1" />
                  )}
                  {file.status === 'failed' && (
                    <p className="text-xs text-destructive">{file.error}</p>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {getStatusIcon(file)}
                  {!autoAppend && file.status === 'done' && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 px-2 text-xs"
                      onClick={() => insertFile(file)}
                    >
                      <Plus className="w-3 h-3 mr-1" />
                      Insert
                    </Button>
                  )}
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6"
                    onClick={() => removeFile(file.id)}
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Privacy Note */}
      <p className="text-xs text-muted-foreground italic">
        Files are processed locally in your browser. Avoid real patient identifiers.
      </p>
    </div>
  );
}

import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { CloudUpload, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface FileDropzoneProps {
  onFilesSelected: (files: File[]) => void;
  acceptedTypes?: Record<string, string[]>;
  maxSize?: number;
  multiple?: boolean;
  className?: string;
  icon?: React.ReactNode;
  title?: string;
  description?: string;
}

export default function FileDropzone({
  onFilesSelected,
  acceptedTypes = {
    "application/pdf": [".pdf"],
    "application/msword": [".doc"],
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
    "text/plain": [".txt"],
  },
  maxSize = 10 * 1024 * 1024, // 10MB
  multiple = false,
  className,
  icon,
  title = "Drag and drop assignment files here",
  description = "Supports PDF, DOC, DOCX, TXT files up to 10MB",
}: FileDropzoneProps) {
  const [isDragActive, setIsDragActive] = useState(false);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    setIsDragActive(false);
    onFilesSelected(acceptedFiles);
  }, [onFilesSelected]);

  const onDragEnter = useCallback(() => {
    setIsDragActive(true);
  }, []);

  const onDragLeave = useCallback(() => {
    setIsDragActive(false);
  }, []);

  const { getRootProps, getInputProps, open } = useDropzone({
    onDrop,
    onDragEnter,
    onDragLeave,
    accept: acceptedTypes,
    maxSize,
    multiple,
    noClick: true,
    useFsAccessApi: false,
  });

  return (
    <div
      {...getRootProps()}
      className={cn(
        "upload-zone border-2 border-dashed border-border rounded-lg p-8 text-center transition-all duration-300 cursor-pointer",
        isDragActive && "dragover",
        className
      )}
      data-testid="file-dropzone"
    >
      <input {...getInputProps()} />
      
      {icon || <CloudUpload className="text-4xl text-muted-foreground mb-4 mx-auto" />}
      
      <p className="text-foreground font-medium mb-2">{title}</p>
      <p className="text-muted-foreground text-sm mb-4">{description}</p>
      
      <div className="flex justify-center space-x-2">
        <Button 
          onClick={open}
          variant="default"
          size="sm"
          data-testid="button-select-files"
        >
          Select Files
        </Button>
        {multiple && (
          <Button 
            onClick={open}
            variant="secondary"
            size="sm"
            data-testid="button-select-folder"
          >
            Select Folder
          </Button>
        )}
      </div>
    </div>
  );
}

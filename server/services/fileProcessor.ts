import { randomUUID } from "crypto";

export interface ProcessedFile {
  id: string;
  originalName: string;
  content: string;
  size: number;
  type: string;
}

export async function processUploadedFile(
  fileBuffer: Buffer,
  originalName: string,
  mimeType: string
): Promise<ProcessedFile> {
  try {
    let content: string;

    // For now, we'll handle text files directly
    // In a production environment, you'd use libraries like pdf-parse for PDFs
    if (mimeType.startsWith('text/') || originalName.match(/\.(txt|md)$/i)) {
      content = fileBuffer.toString('utf-8');
    } else if (originalName.match(/\.pdf$/i)) {
      // For PDF files, we'll simulate text extraction
      // In real implementation, use pdf-parse or similar library
      content = fileBuffer.toString('utf-8');
    } else {
      throw new Error(`Unsupported file type: ${mimeType}`);
    }

    return {
      id: randomUUID(),
      originalName,
      content,
      size: fileBuffer.length,
      type: mimeType
    };

  } catch (error) {
    console.error("Error processing file:", error);
    throw new Error(`Failed to process file ${originalName}: ${(error as Error).message}`);
  }
}

export function validateFileUpload(file: Express.Multer.File): void {
  const maxSize = 10 * 1024 * 1024; // 10MB
  const allowedTypes = [
    'text/plain',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ];
  
  const allowedExtensions = ['.txt', '.pdf', '.doc', '.docx', '.md'];

  if (file.size > maxSize) {
    throw new Error('File too large. Maximum size is 10MB.');
  }

  const hasValidType = allowedTypes.includes(file.mimetype);
  const hasValidExtension = allowedExtensions.some(ext => 
    file.originalname.toLowerCase().endsWith(ext)
  );

  if (!hasValidType && !hasValidExtension) {
    throw new Error('Invalid file type. Supported formats: PDF, DOC, DOCX, TXT');
  }
}

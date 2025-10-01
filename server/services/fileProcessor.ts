import { randomUUID } from "crypto";
import mammoth from "mammoth";

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

    if (mimeType.startsWith('text/') || originalName.match(/\.(txt|md)$/i)) {
      content = fileBuffer.toString('utf-8');
    } else if (originalName.match(/\.pdf$/i) || mimeType.includes('pdf')) {
      const pdfParse = (await import('pdf-parse')).default;
      const pdfData = await pdfParse(fileBuffer);
      content = pdfData.text;
    } else if (originalName.match(/\.docx$/i) || mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      const result = await mammoth.extractRawText({ buffer: fileBuffer });
      content = result.value;
    } else {
      throw new Error(`Unsupported file type: ${mimeType}. Supported formats: PDF, DOCX, TXT, MD`);
    }

    if (!content || content.trim().length === 0) {
      throw new Error('No text content could be extracted from the file');
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
    'text/markdown',
    'application/pdf',
    'application/x-pdf',
    'application/octet-stream',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ];
  
  const allowedExtensions = ['.txt', '.md', '.pdf', '.docx'];

  if (file.size > maxSize) {
    throw new Error('File too large. Maximum size is 10MB.');
  }

  const hasValidExtension = allowedExtensions.some(ext => 
    file.originalname.toLowerCase().endsWith(ext)
  );
  
  const hasValidType = allowedTypes.includes(file.mimetype) || 
    (file.mimetype.includes('pdf') && hasValidExtension && file.originalname.toLowerCase().endsWith('.pdf'));

  if (!hasValidType && !hasValidExtension) {
    console.error(`File validation failed - MIME type: ${file.mimetype}, filename: ${file.originalname}`);
    throw new Error('Invalid file type. Supported formats: PDF, DOCX, TXT, MD');
  }
}

import { randomUUID } from "crypto";
import mammoth from "mammoth";
import * as XLSX from "xlsx";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
import JSZip from "jszip";
import { extractTextFromImage, extractTextFromMultipleImages, extractTextFromPDFWithVision } from "./openai";

export interface ProcessedFile {
  id: string;
  originalName: string;
  content: string;
  size: number;
  type: string;
}

// Check if file is an image
function isImageFile(originalName: string, mimeType: string): boolean {
  return mimeType.startsWith('image/') || 
    originalName.match(/\.(png|jpg|jpeg|gif|webp|bmp|tiff?)$/i) !== null;
}

// Check if file is a PowerPoint presentation
function isPresentationFile(originalName: string, mimeType: string): boolean {
  return originalName.match(/\.(ppt|pptx)$/i) !== null ||
    mimeType.includes('presentation') ||
    mimeType.includes('powerpoint');
}

// Extract images from PPTX file (ZIP-based format)
async function extractImagesFromPPTX(fileBuffer: Buffer): Promise<Array<{base64: string, mimeType: string}>> {
  const images: Array<{base64: string, mimeType: string}> = [];
  
  try {
    // PPTX is a ZIP file, use JSZip to read it
    const zip = await JSZip.loadAsync(fileBuffer);
    
    // Look for images in ppt/media folder
    const mediaFiles = Object.keys(zip.files).filter(path => 
      path.includes('ppt/media/') && 
      (path.endsWith('.png') || path.endsWith('.jpg') || path.endsWith('.jpeg') || path.endsWith('.gif'))
    );
    
    for (const path of mediaFiles) {
      try {
        const imageData = await zip.file(path)?.async('base64');
        if (imageData) {
          const ext = path.split('.').pop()?.toLowerCase();
          const mimeType = ext === 'png' ? 'image/png' : 
                         ext === 'gif' ? 'image/gif' : 'image/jpeg';
          images.push({ base64: imageData, mimeType });
        }
      } catch (e) {
        console.error(`Error extracting image ${path}:`, e);
      }
    }
  } catch (error) {
    console.error("Error extracting images from PPTX:", error);
  }
  
  return images;
}

// Extract text content from PPTX slides
async function extractTextFromPPTX(fileBuffer: Buffer): Promise<string> {
  const textParts: string[] = [];
  
  try {
    const zip = await JSZip.loadAsync(fileBuffer);
    
    // Find all slide XML files
    const slideFiles = Object.keys(zip.files)
      .filter(path => path.match(/ppt\/slides\/slide\d+\.xml$/))
      .sort((a, b) => {
        const numA = parseInt(a.match(/slide(\d+)\.xml$/)?.[1] || '0');
        const numB = parseInt(b.match(/slide(\d+)\.xml$/)?.[1] || '0');
        return numA - numB;
      });
    
    for (let i = 0; i < slideFiles.length; i++) {
      const slideXml = await zip.file(slideFiles[i])?.async('string');
      if (slideXml) {
        // Extract text from XML - look for <a:t> tags which contain text
        const textMatches = slideXml.match(/<a:t>([^<]*)<\/a:t>/g);
        if (textMatches) {
          const slideText = textMatches
            .map(match => match.replace(/<\/?a:t>/g, ''))
            .filter(text => text.trim())
            .join(' ');
          if (slideText.trim()) {
            textParts.push(`--- Slide ${i + 1} ---\n${slideText}`);
          }
        }
      }
    }
  } catch (error) {
    console.error("Error extracting text from PPTX:", error);
  }
  
  return textParts.join('\n\n');
}

// Convert PPTX slides to images for Vision API processing
async function processPPTXWithVision(fileBuffer: Buffer, originalName: string): Promise<string> {
  let content = "";
  
  // First, try to extract text content from slides
  const slideText = await extractTextFromPPTX(fileBuffer);
  if (slideText.trim()) {
    content += "=== Text Content from Slides ===\n\n" + slideText;
  }
  
  // Then, extract and process embedded images with Vision API
  const images = await extractImagesFromPPTX(fileBuffer);
  
  if (images.length > 0) {
    const imageText = await extractTextFromMultipleImages(images.slice(0, 15)); // Limit to 15 images
    if (imageText.trim()) {
      content += "\n\n=== Content from Presentation Images ===\n\n" + imageText;
    }
  }
  
  if (!content.trim()) {
    content = "[Note: This is a PowerPoint presentation. No text content or images could be extracted. The presentation may be empty or in an unsupported format.]";
  }
  
  return content;
}

export async function processUploadedFile(
  fileBuffer: Buffer,
  originalName: string,
  mimeType: string,
  fastMode: boolean = false
): Promise<ProcessedFile> {
  try {
    let content: string;

    // Handle image files with Vision API
    if (isImageFile(originalName, mimeType)) {
      const base64 = fileBuffer.toString('base64');
      const imageMimeType = mimeType.startsWith('image/') ? mimeType : 
        originalName.match(/\.png$/i) ? 'image/png' :
        originalName.match(/\.gif$/i) ? 'image/gif' : 'image/jpeg';
      
      content = await extractTextFromImage(base64, imageMimeType);
      
      if (!content || content.trim().length === 0) {
        content = "[Image file uploaded - no readable text content could be extracted]";
      }
    }
    // Handle PowerPoint presentations
    else if (isPresentationFile(originalName, mimeType)) {
      if (fastMode) {
        // Fast mode: only extract text, skip Vision API for embedded images
        content = await extractTextFromPPTX(fileBuffer);
        if (!content.trim()) {
          content = "[PowerPoint presentation - text content will be extracted during grading]";
        }
      } else {
        content = await processPPTXWithVision(fileBuffer, originalName);
      }
    }
    // Handle plain text files
    else if (mimeType.startsWith('text/') || originalName.match(/\.(txt|md)$/i)) {
      content = fileBuffer.toString('utf-8');
    } 
    // Handle PDF files
    else if (originalName.match(/\.pdf$/i) || mimeType.includes('pdf')) {
      try {
        const loadingTask = pdfjsLib.getDocument({
          data: new Uint8Array(fileBuffer),
          useWorkerFetch: false,
          isEvalSupported: false,
          useSystemFonts: true,
        });
        const pdfDocument = await loadingTask.promise;
        const textParts: string[] = [];
        let totalTextLength = 0;
        
        for (let pageNum = 1; pageNum <= pdfDocument.numPages; pageNum++) {
          const page = await pdfDocument.getPage(pageNum);
          const textContent = await page.getTextContent();
          const pageText = textContent.items.map((item: any) => item.str).join(' ').trim();
          textParts.push(`--- Page ${pageNum} ---\n${pageText}`);
          totalTextLength += pageText.length;
        }
        
        content = textParts.join('\n\n');
        
        // Check if PDF has very little text (likely scanned/image-based)
        const averageTextPerPage = totalTextLength / pdfDocument.numPages;
        const isImageBasedPDF = averageTextPerPage < 50;
        
        console.log(`PDF processed: ${pdfDocument.numPages} pages, ${totalTextLength} total chars, avg ${averageTextPerPage.toFixed(0)} chars/page, image-based: ${isImageBasedPDF}`);
        
        // If image-based PDF and not in fast mode, use Vision API to extract content
        if (isImageBasedPDF && !fastMode) {
          console.log("Detected image-based PDF, using Vision API for full extraction...");
          try {
            const pdfBase64 = fileBuffer.toString('base64');
            const visionContent = await extractTextFromPDFWithVision(pdfBase64);
            if (visionContent && visionContent.trim().length > 50) {
              content = visionContent;
            }
          } catch (visionError) {
            console.error("Vision PDF extraction failed:", visionError);
          }
        }
      } catch (pdfError) {
        // PDF parsing failed (e.g. encrypted, corrupted, or unsupported structure)
        // Fall back to a placeholder so the submission is still accepted
        console.error(`PDF text extraction failed for ${originalName}, will use Vision processing:`, pdfError);
        content = "";
      }
    } 
    // Handle Word documents
    else if (originalName.match(/\.docx$/i) || mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      const result = await mammoth.extractRawText({ buffer: fileBuffer });
      content = result.value;
      
      // Also try to extract images from DOCX (skip in fast mode)
      if (!fastMode) {
        try {
          const imageResult = await mammoth.convertToHtml({ buffer: fileBuffer });
          // Extract base64 images from HTML if present
          const imgMatches = imageResult.value.match(/src="data:image\/(png|jpeg|jpg|gif);base64,([^"]+)"/g);
          if (imgMatches && imgMatches.length > 0) {
            const docImages: Array<{base64: string, mimeType: string}> = [];
            for (const match of imgMatches.slice(0, 10)) { // Limit to 10 images
              const dataMatch = match.match(/src="data:image\/(png|jpeg|jpg|gif);base64,([^"]+)"/);
              if (dataMatch) {
                docImages.push({
                  base64: dataMatch[2],
                  mimeType: `image/${dataMatch[1]}`
                });
              }
            }
            
            if (docImages.length > 0) {
              const imageText = await extractTextFromMultipleImages(docImages);
              if (imageText.trim()) {
                content += "\n\n=== Content from Document Images ===\n\n" + imageText;
              }
            }
          }
        } catch (e) {
          // Image extraction from DOCX failed, continue with text
        }
      }
    } 
    // Handle spreadsheet files
    else if (originalName.match(/\.(xlsx|xls|csv)$/i) || mimeType.includes('spreadsheet') || mimeType.includes('excel') || mimeType.includes('csv')) {
      const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
      const sheets = workbook.SheetNames.map(sheetName => {
        const sheet = workbook.Sheets[sheetName];
        return XLSX.utils.sheet_to_txt(sheet);
      });
      content = sheets.join('\n\n');
    } else {
      throw new Error(`Unsupported file type: ${mimeType}. Supported formats: PDF, DOCX, PPTX, XLSX, XLS, CSV, TXT, MD, PNG, JPG, JPEG, GIF`);
    }

    if (!content || content.trim().length === 0) {
      // For PDFs and presentations, return empty content so the submit route can flag for Vision processing
      // instead of rejecting the submission outright
      const isPdfOrPresentation = originalName.match(/\.(pdf|ppt|pptx)$/i) || 
        mimeType.includes('pdf') || mimeType.includes('presentation') || mimeType.includes('powerpoint');
      if (isPdfOrPresentation) {
        content = "";
      } else {
        throw new Error('No text content could be extracted from the file');
      }
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

// Helper function to convert raw image data to base64 PNG
function createImageCanvas(imgData: any): string | null {
  try {
    // Create a simple PNG representation
    // This is a simplified version - in production you'd use a proper canvas library
    const { width, height, data } = imgData;
    
    if (!data || !width || !height) return null;
    
    // For now, we'll skip complex image conversion
    // The Vision API will work with the images we can extract directly
    return null;
  } catch (e) {
    return null;
  }
}

export function validateFileUpload(file: Express.Multer.File): void {
  const maxSize = 10 * 1024 * 1024; // 10MB
  const allowedTypes = [
    'text/plain',
    'text/markdown',
    'text/csv',
    'application/pdf',
    'application/x-pdf',
    'application/octet-stream',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.ms-powerpoint',
    'application/vnd.ms-excel',
    'application/x-msexcel',
    'application/excel',
    'application/x-excel',
    'image/png',
    'image/jpeg',
    'image/jpg',
    'image/gif',
    'image/webp',
    'image/bmp',
    'image/tiff'
  ];
  
  const allowedExtensions = ['.txt', '.md', '.pdf', '.docx', '.xlsx', '.xls', '.csv', '.ppt', '.pptx', '.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.tiff', '.tif'];

  if (file.size > maxSize) {
    throw new Error('File too large. Maximum size is 10MB.');
  }

  const hasValidExtension = allowedExtensions.some(ext => 
    file.originalname.toLowerCase().endsWith(ext)
  );
  
  const hasValidType = allowedTypes.includes(file.mimetype) || 
    file.mimetype.includes('pdf') || 
    file.mimetype.includes('spreadsheet') ||
    file.mimetype.includes('excel') ||
    file.mimetype.includes('presentation') ||
    file.mimetype.includes('powerpoint') ||
    file.mimetype.startsWith('image/');

  if (!hasValidType && !hasValidExtension) {
    console.error(`File validation failed - MIME type: ${file.mimetype}, filename: ${file.originalname}`);
    throw new Error('Invalid file type. Supported formats: PDF, DOCX, PPTX, PPT, XLSX, XLS, CSV, TXT, MD, PNG, JPG, JPEG, GIF');
  }
}

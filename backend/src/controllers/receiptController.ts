/**
 * Receipt Controller
 * 
 * Handles receipt processing with OCR, image upload to storage,
 * and expense data extraction using Google Cloud Vision.
 * 
 * @module controllers/receiptController
 */

import { Request, Response, NextFunction } from 'express';
import { storage } from '../config/firebase';
import { ImageAnnotatorClient } from '@google-cloud/vision';
import multer from 'multer';
import sharp from 'sharp';
import crypto from 'crypto';
import { AppError } from '../middleware/errorHandler';
import logger from '../utils/logger';

// Initialize Google Cloud Vision client
const visionClient = new ImageAnnotatorClient({
  keyFilename: process.env.GOOGLE_CLOUD_KEY_PATH,
  projectId: process.env.GOOGLE_CLOUD_PROJECT_ID
});

// Raster formats sharp can safely decode. SVG is deliberately excluded:
// it passes an image/* check but is an XML/script surface, not a photo.
const ALLOWED_RECEIPT_MIMETYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
]);

// Configure multer for image uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 1,
    fields: 10,
  },
  fileFilter: (_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    if (ALLOWED_RECEIPT_MIMETYPES.has(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new AppError('Unsupported file type - upload a JPEG, PNG, WebP, or HEIC image', 415, true));
    }
  }
}).single('receipt');

interface ParsedReceiptData {
  merchant?: string;
  amount?: number;
  date?: string;
  items?: string[];
  confidence: number;
  suggestedName?: string;
  suggestedCategory?: string;
  suggestedDescription?: string;
}

/** Multer middleware for receipt image uploads */
export const uploadMiddleware = upload;

/**
 * Generate expense name from receipt data
 */
const generateExpenseName = (merchant?: string, items?: string[]): string => {
  if (merchant) {
    return `${merchant} Purchase`;
  }
  if (items && items.length > 0) {
    return items.length === 1 ? items[0] : `${items[0]} & ${items.length - 1} more`;
  }
  return 'Receipt Purchase';
};

/**
 * Categorize expense based on merchant and items
 */
const categorizeExpense = (merchant?: string, items?: string[], fullText?: string): string => {
  // Safely handle undefined values to prevent literal "undefined" in concatenation
  const text = ((merchant || '') + ' ' + (items?.join(' ') || '') + ' ' + (fullText || '')).toLowerCase();
  
  // Category mapping based on keywords
  const categories: Record<string, string[]> = {
    'Food & Dining': ['restaurant', 'cafe', 'food', 'pizza', 'burger', 'coffee', 'starbucks', 'mcdonald', 'subway', 'dining'],
    'Groceries': ['grocery', 'supermarket', 'market', 'walmart', 'target', 'costco', 'safeway', 'kroger', 'milk', 'bread', 'produce'],
    'Transportation': ['gas', 'fuel', 'uber', 'lyft', 'taxi', 'metro', 'bus', 'parking', 'shell', 'bp', 'exxon'],
    'Entertainment': ['movie', 'cinema', 'theater', 'netflix', 'spotify', 'game', 'concert', 'ticket'],
    'Healthcare': ['pharmacy', 'hospital', 'doctor', 'medical', 'cvs', 'walgreens', 'medicine', 'prescription'],
    'Shopping': ['amazon', 'ebay', 'mall', 'store', 'clothing', 'shoes', 'electronics', 'home depot', 'lowes'],
    'Utilities': ['electric', 'water', 'internet', 'phone', 'cable', 'utility', 'bill'],
    'Other': []
  };

  for (const [category, keywords] of Object.entries(categories)) {
    if (category === 'Other') continue;
    if (keywords.some(keyword => text.includes(keyword))) {
      return category;
    }
  }

  return 'Other';
};

/**
 * Generate expense description from receipt data
 */
const generateDescription = (merchant?: string, items?: string[], amount?: number): string => {
  let description = '';
  
  if (merchant) {
    description += `Purchase from ${merchant}`;
  }
  
  if (items && items.length > 0) {
    if (description) description += ' - ';
    description += `Items: ${items.slice(0, 3).join(', ')}`;
    if (items.length > 3) {
      description += ` and ${items.length - 3} more`;
    }
  }
  
  if (amount) {
    if (description) description += ` `;
    description += `($${amount.toFixed(2)})`;
  }
  
  return description || 'Expense from receipt';
};

/**
 * Upload image to Firebase Storage
 */
const uploadImageToStorage = async (
  userId: string, 
  imageBuffer: Buffer
): Promise<string> => {
  try {
    if (!storage) {
      throw new AppError('Firebase Storage not initialized', 500, false);
    }
    
    // Get the default bucket or use the project bucket
    const bucketName = process.env.FIREBASE_STORAGE_BUCKET ||
                       process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;

    if (!bucketName) {
      throw new AppError(
        'Firebase storage bucket not configured. Please set FIREBASE_STORAGE_BUCKET or NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET environment variable',
        500,
        false
      );
    }
    
    const bucket = storage.bucket(bucketName);
    
    // Validate userId to match Firebase Auth UID format (alphanumeric with hyphens, 20-128 chars)
    if (!userId || !/^[a-zA-Z0-9-]{20,128}$/.test(userId)) {
      throw new AppError('Invalid user ID format', 400, true);
    }
    
    // Generate unique filename
    const timestamp = Date.now();
    const randomId = crypto.randomBytes(8).toString('hex');
    const fileName = `receipts/${userId}/${timestamp}-${randomId}.jpg`;
    
    const file = bucket.file(fileName);
    
    // Upload the file - NOT public, use signed URLs for access control
    await file.save(imageBuffer, {
      metadata: {
        contentType: 'image/jpeg',
        metadata: {
          userId: userId,
          uploadedAt: new Date().toISOString()
        }
      }
      // Removed public: true - receipts contain sensitive PII
    });

    // Generate a signed URL that expires in 1 hour for secure, time-limited access
    const [signedUrl] = await file.getSignedUrl({
      action: 'read',
      expires: Date.now() + 60 * 60 * 1000, // 1 hour from now
    });
    
    return signedUrl;
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    throw new AppError(`Failed to upload receipt image: ${errorMessage}`, 500, false);
  }
};

/**
 * Parse receipt text to extract structured data
 */
const parseReceiptText = async (text: string): Promise<ParsedReceiptData> => {
  const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  
  let merchant = '';
  let amount = 0;
  let date = '';
  const items: string[] = [];
  let confidence = 0.5;

  // Extract merchant (usually first few lines)
  const merchantPatterns = [
    /^[A-Z\s&]+$/,
    /^[A-Z][a-z\s&]+$/
  ];
  
  for (let i = 0; i < Math.min(3, lines.length); i++) {
    if (merchantPatterns.some(pattern => pattern.test(lines[i])) && lines[i].length > 2) {
      merchant = lines[i];
      confidence += 0.1;
      break;
    }
  }

  // Extract total amount (look for patterns like $XX.XX, TOTAL, etc.)
  // Patterns support both whole dollars and two decimal places
  const amountPatterns = [
    /(?:total|subtotal|amount)\s*[:\-]?\s*\$?(\d+(?:\.\d{2})?)/i,
    /\$(\d+(?:\.\d{2})?)\s*(?:total|subtotal)?/i,
    /(\d+(?:\.\d{2})?)\s*(?:total|subtotal)?$/i
  ];

  for (const line of lines) {
    for (const pattern of amountPatterns) {
      const match = line.match(pattern);
      if (match) {
        const parsedAmount = parseFloat(match[1]);
        if (parsedAmount > amount) { // Take the largest amount found
          amount = parsedAmount;
          confidence += 0.2;
        }
      }
    }
  }

  // Extract date
  const datePatterns = [
    /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/,
    /(\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2})/,
    /((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},?\s+\d{2,4})/i
  ];

  for (const line of lines) {
    for (const pattern of datePatterns) {
      const match = line.match(pattern);
      if (match) {
        date = match[1];
        confidence += 0.1;
        break;
      }
    }
    if (date) break;
  }

  // Extract items (lines with prices) - supports whole dollars and two decimal places
  const itemPattern = /^(.+?)\s+\$?(\d+(?:\.\d{2})?)$/;
  for (const line of lines) {
    const match = line.match(itemPattern);
    if (match) {
      const itemPrice = parseFloat(match[2]);
      // Only add if we have a valid total and item is less than total, or no total found yet
      if (!amount || itemPrice < amount) {
        items.push(match[1].trim());
      }
    }
  }

  // Generate suggestions based on extracted data
  const suggestedName = generateExpenseName(merchant, items);
  const suggestedCategory = categorizeExpense(merchant, items, text);
  const suggestedDescription = generateDescription(merchant, items, amount);

  return {
    merchant: merchant || undefined,
    amount: amount || undefined,
    date: date || undefined,
    items: items.length > 0 ? items : undefined,
    confidence: Math.min(confidence, 1.0),
    suggestedName,
    suggestedCategory,
    suggestedDescription
  };
};

/**
 * Process a receipt image with OCR
 */
export const processReceipt = async (
  req: Request, 
  res: Response, 
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.uid;
    if (!userId) {
      throw new AppError('Unauthorized: User ID missing', 401, true);
    }

    if (!req.file) {
      throw new AppError('No image file provided', 400, true);
    }

    // Preprocess image for better OCR accuracy
    // Verify magic bytes: the multer mimetype is client-supplied, so decode
    // the header and require a real raster format before processing.
    const imageMeta = await sharp(req.file.buffer).metadata().catch(() => null);
    const ALLOWED_FORMATS = new Set(['jpeg', 'png', 'webp', 'heif']);
    if (!imageMeta?.format || !ALLOWED_FORMATS.has(imageMeta.format)) {
      throw new AppError('File content is not a supported image format', 415, true);
    }

    const processedImage = await sharp(req.file.buffer)
      .resize(1200, null, { withoutEnlargement: true })
      .sharpen()
      .normalize()
      .toBuffer();

    // Upload original image to Firebase Storage
    let imageUrl: string | null = null;
    try {
      imageUrl = await uploadImageToStorage(userId, req.file.buffer);

    // Perform OCR using Google Cloud Vision
    const [result] = await visionClient.textDetection({
      image: { content: processedImage }
    });

    const detections = result.textAnnotations;
    if (!detections || detections.length === 0) {
      throw new AppError('No text detected in image', 400, true);
    }

    const fullText = detections[0].description || '';
    
    // Parse receipt data using regex patterns and heuristics
    const parsedData = await parseReceiptText(fullText);

    res.json({
      success: true,
      data: {
        ...parsedData,
        imageUrl,
        rawText: fullText
      }
    });
    } catch (ocrError) {
      // Clean up uploaded file if OCR fails to prevent orphaned files
      if (imageUrl) {
        try {
          const bucketName = process.env.FIREBASE_STORAGE_BUCKET ||
                            process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
          if (bucketName && storage) {
            // Extract file path from signed URL or construct from pattern
            const urlParts = imageUrl.split(`${bucketName}/`);
            if (urlParts.length > 1) {
              const filePath = urlParts[1].split('?')[0]; // Remove query params from signed URL
              await storage.bucket(bucketName).file(filePath).delete();
              logger.info('Cleaned up orphaned receipt image after OCR failure', { filePath, userId });
            }
          }
        } catch (cleanupError) {
          logger.error('Failed to cleanup uploaded receipt image', { 
            imageUrl, 
            cleanupError: cleanupError instanceof Error ? cleanupError.message : 'Unknown',
            userId 
          });
        }
      }
      throw ocrError;
    }

  } catch (error) {
    if (error instanceof AppError) {
      next(error);
      return;
    }
    logger.error('Error processing receipt', { 
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: req.user?.uid
    });
    next(new AppError('Failed to process receipt', 500, false));
  }
};

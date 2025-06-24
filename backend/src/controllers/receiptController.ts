import { Request, Response } from 'express';
import { auth, storage } from '../config/firebase';
import { ImageAnnotatorClient } from '@google-cloud/vision';
import multer from 'multer';
import sharp from 'sharp';
import crypto from 'crypto';

// Initialize Google Cloud Vision client
const visionClient = new ImageAnnotatorClient({
  keyFilename: process.env.GOOGLE_CLOUD_KEY_PATH,
  projectId: process.env.GOOGLE_CLOUD_PROJECT_ID
});

// Configure multer for image uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(null, false);
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

export class ReceiptController {
  static uploadMiddleware = upload;

  static async processReceipt(req: Request, res: Response) {
    try {
      const userId = req.user?.uid;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      if (!req.file) {
        return res.status(400).json({ error: 'No image file provided' });
      }

      // Preprocess image for better OCR accuracy
      const processedImage = await sharp(req.file.buffer)
        .resize(1200, null, { withoutEnlargement: true })
        .sharpen()
        .normalize()
        .toBuffer();

      // Upload original image to Firebase Storage
      const imageUrl = await ReceiptController.uploadImageToStorage(userId, req.file.buffer);

      // Perform OCR using Google Cloud Vision
      const [result] = await visionClient.textDetection({
        image: { content: processedImage }
      });

      const detections = result.textAnnotations;
      if (!detections || detections.length === 0) {
        return res.status(400).json({ error: 'No text detected in image' });
      }

      const fullText = detections[0].description || '';
      
      // Parse receipt data using regex patterns and heuristics
      const parsedData = await ReceiptController.parseReceiptText(fullText);

      res.json({
        success: true,
        data: {
          ...parsedData,
          imageUrl,
          rawText: fullText
        }
      });

    } catch (error: any) {
      console.error('Receipt processing error:', error);
      res.status(500).json({ 
        error: 'Failed to process receipt',
        details: error.message 
      });
    }
  }

  private static async uploadImageToStorage(userId: string, imageBuffer: Buffer): Promise<string> {
    try {
      if (!storage) {
        throw new Error('Firebase Storage not initialized');
      }
      
      // Get the default bucket or use the project bucket
      const bucketName = process.env.FIREBASE_STORAGE_BUCKET || 
                         process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || 
                         `${process.env.FIREBASE_PROJECT_ID || 'personalexpensetracker-ff87a'}.appspot.com`;
      
      const bucket = storage.bucket(bucketName);
      
      // Generate unique filename
      const timestamp = Date.now();
      const randomId = crypto.randomBytes(8).toString('hex');
      const fileName = `receipts/${userId}/${timestamp}-${randomId}.jpg`;
      
      const file = bucket.file(fileName);
      
      // Upload the file
      await file.save(imageBuffer, {
        metadata: {
          contentType: 'image/jpeg',
          metadata: {
            userId: userId,
            uploadedAt: new Date().toISOString()
          }
        },
        public: true
      });

      // Return the public URL
      return `https://storage.googleapis.com/${bucketName}/${fileName}`;
    } catch (error: any) {
      console.error('Error uploading image to storage:', error);
      console.error('Error details:', {
        message: error.message,
        code: error.code,
        details: error.details
      });
      throw new Error(`Failed to upload receipt image: ${error.message}`);
    }
  }

  private static async parseReceiptText(text: string): Promise<ParsedReceiptData> {
    const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    
    let merchant = '';
    let amount = 0;
    let date = '';
    let items: string[] = [];
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
    const amountPatterns = [
      /(?:total|subtotal|amount)\s*[:\-]?\s*\$?(\d+\.?\d{2})/i,
      /\$(\d+\.?\d{2})\s*(?:total|subtotal)?/i,
      /(\d+\.?\d{2})\s*(?:total|subtotal)?$/i
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

    // Extract items (lines with prices)
    const itemPattern = /^(.+?)\s+\$?(\d+\.?\d{2})$/;
    for (const line of lines) {
      const match = line.match(itemPattern);
      if (match && parseFloat(match[2]) < amount) {
        items.push(match[1].trim());
      }
    }

          // Generate suggestions based on extracted data
      const suggestedName = ReceiptController.generateExpenseName(merchant, items);
      const suggestedCategory = ReceiptController.categorizeExpense(merchant, items, text);
      const suggestedDescription = ReceiptController.generateDescription(merchant, items, amount);

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
    }

    private static generateExpenseName(merchant?: string, items?: string[]): string {
      if (merchant) {
        return `${merchant} Purchase`;
      }
      if (items && items.length > 0) {
        return items.length === 1 ? items[0] : `${items[0]} & ${items.length - 1} more`;
      }
      return 'Receipt Purchase';
    }

    private static categorizeExpense(merchant?: string, items?: string[], fullText?: string): string {
      const text = (merchant + ' ' + (items?.join(' ') || '') + ' ' + (fullText || '')).toLowerCase();
      
      // Category mapping based on keywords
      const categories = {
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
    }

    private static generateDescription(merchant?: string, items?: string[], amount?: number): string {
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
    }
  }
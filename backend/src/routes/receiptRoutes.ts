import { Router } from 'express';
import { ReceiptController } from '../controllers/receiptController';
import { auth } from '../middleware/auth';

const router = Router();

// Process receipt with OCR
router.post('/process', 
  auth,
  ReceiptController.uploadMiddleware,
  ReceiptController.processReceipt
);

export default router; 
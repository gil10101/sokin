"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const receiptController_1 = require("../controllers/receiptController");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
// Process receipt with OCR
router.post('/process', auth_1.auth, receiptController_1.ReceiptController.uploadMiddleware, receiptController_1.ReceiptController.processReceipt);
exports.default = router;

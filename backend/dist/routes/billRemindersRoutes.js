"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const billRemindersController_1 = require("../controllers/billRemindersController");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
// Get user's bill reminders
router.get('/', auth_1.auth, billRemindersController_1.BillRemindersController.getUserBillReminders);
// Create new bill reminder
router.post('/', auth_1.auth, billRemindersController_1.BillRemindersController.createBillReminder);
// Mark bill as paid
router.post('/:billId/pay', auth_1.auth, billRemindersController_1.BillRemindersController.markBillAsPaid);
// Update bill reminder
router.put('/:billId', auth_1.auth, billRemindersController_1.BillRemindersController.updateBillReminder);
// Delete bill reminder
router.delete('/:billId', auth_1.auth, billRemindersController_1.BillRemindersController.deleteBillReminder);
exports.default = router;

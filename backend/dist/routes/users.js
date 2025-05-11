"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const auth_1 = require("../middleware/auth");
const validation_1 = require("../middleware/validation");
const schemas_1 = require("../models/schemas");
const users_1 = require("../controllers/users");
const router = express_1.default.Router();
// Get user profile
router.get('/profile', auth_1.auth, users_1.getUserProfile);
// Update user profile
router.put('/profile', auth_1.auth, (0, validation_1.validate)(schemas_1.updateUserSchema), users_1.updateUserProfile);
exports.default = router;

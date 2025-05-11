import express from 'express';
import { auth } from '../middleware/auth';
import { validate } from '../middleware/validation';
import { updateUserSchema } from '../models/schemas';
import { getUserProfile, updateUserProfile } from '../controllers/users';

const router = express.Router();

// Get user profile
router.get('/profile', auth, getUserProfile);

// Update user profile
router.put('/profile', auth, validate(updateUserSchema), updateUserProfile);

export default router; 
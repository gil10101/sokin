import express from 'express';
import { auth } from '../middleware/auth';
import { validate } from '../middleware/validation';
import { createRateLimiter } from '../middleware/rateLimiter';
import { updateUserSchema } from '../models/schemas';
import { getUserProfile, updateUserProfile } from '../controllers/users';

const router = express.Router();

// Apply rate limiting to user routes
const userRateLimit = createRateLimiter.api(); // 100 requests per 15 minutes

// Get user profile
router.get('/profile', userRateLimit, auth, getUserProfile);

// Update user profile
router.put('/profile', userRateLimit, auth, validate(updateUserSchema), updateUserProfile);

export default router; 
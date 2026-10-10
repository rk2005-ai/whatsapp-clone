import { Router } from 'express';
import { me, requestOtp, verifyOtp } from '../controllers/authController.js';
import { protect } from '../middleware/auth.js';
const router = Router();
router.post('/request-otp', requestOtp);
router.post('/verify-otp', verifyOtp);
router.get('/me', protect, me);
export default router;

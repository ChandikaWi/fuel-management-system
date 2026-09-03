import express from 'express';
import { getActiveShift, openShift, closeShift, getLastClosedShift } from '../controllers/shiftController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.get('/active', protect, getActiveShift);
router.get('/last-closed', protect, getLastClosedShift);
router.post('/open', protect, openShift);
router.post('/close', protect, closeShift);

export default router;
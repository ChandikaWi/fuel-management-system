import express from 'express';
import { 
  recordSale, 
  getSalesReport, 
  getAllTransactions, 
  deleteTransaction,
  getChartData,
  getRecentActivity,
  getLeaderboard
} from '../controllers/transactionController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.get('/chart-data', protect, getChartData);
router.get('/recent', protect, getRecentActivity);
router.get('/leaderboard', protect, getLeaderboard);

router.route('/').get(protect, getAllTransactions);
router.route('/:id').delete(protect, deleteTransaction);

router.post('/sale', protect, recordSale);
router.get('/report', protect, getSalesReport);

export default router;
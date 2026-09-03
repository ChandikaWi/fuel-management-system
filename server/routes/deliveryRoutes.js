import express from 'express';
import { recordDelivery, getDeliveries, deleteDelivery, approveDelivery } from '../controllers/deliveryController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

// Get all and Create new
router.route('/')
  .post(protect, recordDelivery)
  .get(protect, getDeliveries);

// Delete specific record
router.route('/:id')
  .delete(protect, deleteDelivery);

// Approve Delivery
router.route('/:id/approve')
  .put(protect, approveDelivery);

export default router;
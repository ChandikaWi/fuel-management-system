import express from 'express';
import { getInventory, updateFuelLevel, addFuelType, deleteFuelType } from '../controllers/inventoryController.js';
import { protect, admin } from '../middleware/authMiddleware.js'; 

const router = express.Router();

// Get all inventory OR Add new fuel (Admin only)
router.route('/')
  .get(protect, getInventory)
  .post(protect, admin, addFuelType);

// Update OR Delete specific fuel (Admin only)
router.route('/:id')
  .put(protect, admin, updateFuelLevel)
  .delete(protect, admin, deleteFuelType);

export default router;
import express from 'express';
import { getUsers, createStaff, deleteUser, updateUserProfile, deleteUserProfile, updateUser } from '../controllers/userController.js';
import { protect, admin } from '../middleware/authMiddleware.js';

const router = express.Router();

// Personal Profile Routes (Accessible by BOTH Admin and Staff)
router.route('/profile')
  .put(protect, updateUserProfile)
  .delete(protect, deleteUserProfile);

// Admin-Only Routes for Staff Management
router.route('/')
  .get(protect, admin, getUsers)
  .post(protect, admin, createStaff);

router.route('/:id')
  .put(protect, admin, updateUser)
  .delete(protect, admin, deleteUser);

export default router;
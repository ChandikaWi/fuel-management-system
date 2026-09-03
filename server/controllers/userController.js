import User from '../models/User.js';
import Transaction from '../models/Transaction.js';
import bcrypt from 'bcryptjs';
import { logAudit } from '../utils/auditLogger.js';

// Get all users (Admin only)
export const getUsers = async (req, res) => {
  try {
    const users = await User.find({}).select('-password').lean();
    
    // Find the oldest admin to determine who the super admin is
    const superAdmin = await User.findOne({ role: 'Admin' }).sort({ createdAt: 1 });
    
    const usersWithMetrics = await Promise.all(users.map(async (user) => {
      const txCount = await Transaction.countDocuments({ attendantName: user.username, isDeleted: false });
      return { 
        ...user, 
        transactionCount: txCount,
        isSuperAdmin: superAdmin ? superAdmin._id.toString() === user._id.toString() : false 
      };
    }));

    res.json(usersWithMetrics);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Create a new staff account (Admin only)
export const createStaff = async (req, res) => {
  try {
    const { username, password, role } = req.body;

    const userExists = await User.findOne({ username });
    if (userExists) return res.status(400).json({ message: 'Username already taken' });

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const user = await User.create({ 
      username, 
      password: hashedPassword, 
      role: role || 'Staff' 
    });

    await logAudit(
      req,
      'CREATE_USER',
      `Provisioned new ${user.role} account: ${user.username}`
    );

    res.status(201).json({ _id: user.id, username: user.username, role: user.role });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Delete a user (Admin only)
export const deleteUser = async (req, res) => {
  try {
    const userToDelete = await User.findById(req.params.id);
    if (!userToDelete) return res.status(404).json({ message: 'User not found' });

    // Prevent the admin from accidentally deleting their own currently logged-in account
    if (userToDelete._id.toString() === req.user._id.toString()) {
      return res.status(400).json({ message: 'You cannot delete your own account!' });
    }

    // Find super admin
    const superAdmin = await User.findOne({ role: 'Admin' }).sort({ createdAt: 1 });

    // SUPER ADMIN LOCK- Ensure the main super admin account can never be deleted
    if (superAdmin && superAdmin._id.toString() === userToDelete._id.toString()) {
      return res.status(403).json({ message: 'CRITICAL: The Super Admin account cannot be deleted.' });
    }

    await userToDelete.deleteOne();

    await logAudit(
      req,
      'DELETE_USER',
      `Permanently deleted account: ${userToDelete.username}`
    );

    res.json({ message: 'User removed successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Update a user (Admin only) - Role, isActive, Password Reset
export const updateUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    // Prevent admin from suspending/demoting themselves
    if (user._id.toString() === req.user._id.toString()) {
      if (req.body.isActive === false) return res.status(400).json({ message: 'You cannot suspend your own account!' });
      if (req.body.role === 'Staff' && user.role === 'Admin') return res.status(400).json({ message: 'You cannot demote yourself!' });
    }

    if (req.body.role) user.role = req.body.role;
    if (req.body.isActive !== undefined) {
      user.isActive = req.body.isActive;
      // If we are suspending the user, emit a force_logout event
      if (user.isActive === false) {
        req.app.get('io').emit('force_logout', { username: user.username });
      }
    }
    
    if (req.body.password) {
      const salt = await bcrypt.genSalt(10);
      user.password = await bcrypt.hash(req.body.password, salt);
    }

    const updatedUser = await user.save();

    const changes = [];
    if (req.body.role) changes.push(`role to ${req.body.role}`);
    if (req.body.isActive !== undefined) changes.push(`status to ${req.body.isActive ? 'Active' : 'Suspended'}`);
    if (req.body.password) changes.push(`password reset`);

    if (changes.length > 0) {
      await logAudit(
        req,
        'UPDATE_USER',
        `Modified ${updatedUser.username}: ${changes.join(', ')}`
      );
    }

    res.json({
      _id: updatedUser._id,
      username: updatedUser.username,
      role: updatedUser.role,
      isActive: updatedUser.isActive
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


// Update own profile (Username, Password, Profile Pic)
export const updateUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id); 
    if (!user) return res.status(404).json({ message: 'User not found' });

    // Require current password for sensitive changes
    const isChangingUsername = req.body.username && req.body.username !== user.username;
    const isChangingPassword = !!req.body.password;

    if (isChangingUsername || isChangingPassword) {
      if (!req.body.currentPassword) {
        return res.status(400).json({ message: 'Current password is required to make sensitive changes.' });
      }
      const isMatch = await bcrypt.compare(req.body.currentPassword, user.password);
      if (!isMatch) {
        return res.status(401).json({ message: 'Invalid current password.' });
      }
    }

    // Check if they are trying to change to a username that already exists
    if (isChangingUsername) {
      const usernameTaken = await User.findOne({ username: req.body.username });
      if (usernameTaken) return res.status(400).json({ message: 'Username is already taken' });
      user.username = req.body.username;
    }

    if (req.body.profilePic !== undefined) {
      user.profilePic = req.body.profilePic;
    }

    if (isChangingPassword) {
      const salt = await bcrypt.genSalt(10);
      user.password = await bcrypt.hash(req.body.password, salt);
    }

    const updatedUser = await user.save();

    res.json({
      _id: updatedUser._id,
      username: updatedUser.username,
      role: updatedUser.role,
      profilePic: updatedUser.profilePic
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Delete own account
export const deleteUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    // Find super admin
    const superAdmin = await User.findOne({ role: 'Admin' }).sort({ createdAt: 1 });

    // SUPER ADMIN LOCK- Ensure the main super admin account can never delete itself
    if (superAdmin && superAdmin._id.toString() === user._id.toString()) {
      return res.status(403).json({ message: 'CRITICAL: The Super Admin account cannot be deleted.' });
    }

    // Require current password to delete account
    if (!req.body.currentPassword) {
      return res.status(400).json({ message: 'Current password is required to delete your account.' });
    }
    const isMatch = await bcrypt.compare(req.body.currentPassword, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid current password.' });
    }

    await user.deleteOne();
    res.json({ message: 'User account deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
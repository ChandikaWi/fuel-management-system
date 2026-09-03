import User from '../models/User.js';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { logAudit } from '../utils/auditLogger.js';

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '30d' });
};

export const registerUser = async (req, res) => {
  try {
    const { username, password, role } = req.body;
    
    const userExists = await User.findOne({ username });
    if (userExists) return res.status(400).json({ message: 'User already exists' });

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const user = await User.create({ username, password: hashedPassword, role });
    
    if (user) {
      res.status(201).json({
        _id: user.id,
        username: user.username,
        role: user.role,
        token: generateToken(user.id)
      });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const loginUser = async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await User.findOne({ username });

    if (user && (await bcrypt.compare(password, user.password))) {
      // Check if account is suspended
      if (user.isActive === false) {
        return res.status(403).json({ message: 'Account suspended. Contact administrator.' });
      }

      // Update lastLogin timestamp
      user.lastLogin = new Date();
      await user.save();

      await logAudit(
        req,
        'USER_LOGIN',
        `User ${user.username} successfully logged in.`,
        user.username
      );

      // Determine if they are the super admin (oldest admin account)
      const superAdmin = await User.findOne({ role: 'Admin' }).sort({ createdAt: 1 });
      const isSuperAdmin = superAdmin ? superAdmin._id.toString() === user._id.toString() : false;

      res.json({
        _id: user.id,
        username: user.username,
        role: user.role,
        profilePic: user.profilePic,
        isActive: user.isActive,
        lastLogin: user.lastLogin,
        isSuperAdmin,
        token: generateToken(user.id)
      });
    } else {
      res.status(401).json({ message: 'Invalid credentials' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
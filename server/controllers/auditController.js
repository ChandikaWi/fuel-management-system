import AuditLog from '../models/AuditLog.js';

export const getAuditLogs = async (req, res) => {
  try {
    const { page = 1, limit = 50, user, date, action } = req.query;
    
    // Build filter query
    const query = {};
    if (user) {
      query.user = { $regex: user, $options: 'i' };
    }
    if (action) {
      query.action = action;
    }
    if (date) {
      // Date comes in as YYYY-MM-DD
      const startDate = new Date(date);
      const endDate = new Date(date);
      endDate.setDate(endDate.getDate() + 1);
      query.timestamp = { $gte: startDate, $lt: endDate };
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const logs = await AuditLog.find(query)
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(parseInt(limit));
      
    const total = await AuditLog.countDocuments(query);
    const uniqueActions = await AuditLog.distinct('action');

    res.json({
      logs,
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / parseInt(limit)),
      uniqueActions
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
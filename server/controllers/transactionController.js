import Transaction from '../models/Transaction.js';
import FuelInventory from '../models/FuelInventory.js';
import { logAudit } from '../utils/auditLogger.js';

// Helper to get match stage for date filtering and soft deletion
const getDateMatchStage = (days) => {
  const baseMatch = { isDeleted: { $ne: true } };
  if (!days || days === 'all') return { $match: baseMatch };
  const pastDate = new Date();
  pastDate.setDate(pastDate.getDate() - parseInt(days));
  return { $match: { ...baseMatch, timestamp: { $gte: pastDate } } };
};

export const recordSale = async (req, res) => {
  try {
    const { fuelType, litersSold, paymentMethod } = req.body;

    // Find the fuel in inventory
    const fuel = await FuelInventory.findOne({ fuelType });
    if (!fuel) return res.status(404).json({ message: 'Fuel type not found' });

    // Check if enough fuel is available
    if (fuel.currentLevel < litersSold) {
      return res.status(400).json({ message: 'Insufficient fuel in inventory' });
    }

    const totalAmount = fuel.pricePerLiter * litersSold;
    
    // Default cost price to 90% of pricePerLiter if not set
    const cost = fuel.costPrice && fuel.costPrice > 0 ? fuel.costPrice : fuel.pricePerLiter * 0.9;
    const totalProfit = totalAmount - (cost * litersSold);

    // Create transaction
    const transaction = await Transaction.create({
      fuelType,
      litersSold,
      totalAmount,
      totalProfit,
      paymentMethod: paymentMethod || 'Cash',
      attendantName: req.user.username 
    });

    // Deduct from inventory
    fuel.currentLevel -= litersSold;
    await fuel.save();

    // Emit event for real-time dashboard updates
    if (req.app.get('io')) {
      req.app.get('io').emit('dashboard_update');
    }

    res.status(201).json(transaction);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getSalesReport = async (req, res) => {
  try {
    const { days } = req.query;
    const matchStage = getDateMatchStage(days);

    // Using MongoDB Aggregation Pipeline to group and sum data
    const report = await Transaction.aggregate([
      matchStage,
      {
        $group: {
          _id: '$fuelType',
          totalLitersSold: { $sum: '$litersSold' },
          totalRevenue: { $sum: '$totalAmount' },
          totalProfit: { $sum: '$totalProfit' },
          transactionCount: { $sum: 1 }
        }
      }
    ]);
    res.json(report);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Fetch all transactions, sorted by newest first
export const getAllTransactions = async (req, res) => {
  try {
    const transactions = await Transaction.find({}).sort({ timestamp: -1 });
    res.json(transactions);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Fetch 5 most recent transactions for the dashboard feed
export const getRecentActivity = async (req, res) => {
  try {
    const recent = await Transaction.find({ isDeleted: { $ne: true } })
      .sort({ timestamp: -1 })
      .limit(5);
    res.json(recent);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Fetch Leaderboard for Staff Performance
export const getLeaderboard = async (req, res) => {
  try {
    const leaderboard = await Transaction.aggregate([
      { $match: { isDeleted: { $ne: true } } },
      {
        $group: {
          _id: "$attendantName",
          totalRevenue: { $sum: "$totalAmount" },
          totalVolume: { $sum: "$litersSold" },
          salesCount: { $sum: 1 }
        }
      },
      { $sort: { totalRevenue: -1 } },
      { $limit: 5 }
    ]);
    res.json(leaderboard);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Delete transaction & restore fuel inventory
export const deleteTransaction = async (req, res) => {
  try {
    const transaction = await Transaction.findById(req.params.id);
    if (!transaction) return res.status(404).json({ message: 'Transaction not found' });

    const fuel = await FuelInventory.findOne({ fuelType: transaction.fuelType });
    if (fuel) {
      fuel.currentLevel += transaction.litersSold;
      await fuel.save();
    }

    // RECORD AUDIT LOG
    await logAudit(
      req,
      'DELETE_TRANSACTION',
      `Deleted sale of ${transaction.litersSold}L ${transaction.fuelType} (Rs ${transaction.totalAmount})`
    );

    transaction.isDeleted = true;
    transaction.deletedAt = new Date();
    await transaction.save();

    // Emit event for real-time dashboard updates
    if (req.app.get('io')) {
      req.app.get('io').emit('dashboard_update');
    }

    res.json({ message: 'Transaction removed and inventory restored' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get daily revenue and volume for charts
export const getChartData = async (req, res) => {
  try {
    const days = req.query.days || 30; // default to 30 if not specified
    const matchStage = getDateMatchStage(days);

    const dailyData = await Transaction.aggregate([
      matchStage,
      // Group by the date (ignoring the exact time)
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$timestamp" } },
          revenue: { $sum: "$totalAmount" },
          volume: { $sum: "$litersSold" },
          profit: { $sum: "$totalProfit" }
        }
      },
      // Sort by date ascending 
      { $sort: { _id: 1 } }
    ]);

    // Format the output specifically for the Recharts library
    const formattedData = dailyData.map(data => ({
      date: data._id,
      Revenue: data.revenue,
      Volume: data.volume,
      Profit: data.profit || 0
    }));

    res.json(formattedData);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
import Shift from '../models/Shift.js';
import Transaction from '../models/Transaction.js';

// Get the currently open shift for the logged-in user
export const getActiveShift = async (req, res) => {
  try {
    const shift = await Shift.findOne({ attendantName: req.user.username, status: 'Open' }).lean();
    if (shift) {
      // Calculate total cash sales so far to attach to the response
      const transactions = await Transaction.find({
        attendantName: req.user.username,
        timestamp: { $gte: shift.startTime },
        isDeleted: { $ne: true }
      });
      const totalCashSales = transactions
        .filter(t => !t.paymentMethod || t.paymentMethod === 'Cash')
        .reduce((acc, curr) => acc + curr.totalAmount, 0);
      
      shift.currentCashSales = totalCashSales;
      shift.expectedCash = shift.startingCash + totalCashSales;
    }
    res.json(shift || null);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get the last closed shift for the logged-in user
export const getLastClosedShift = async (req, res) => {
  try {
    const shift = await Shift.findOne({ attendantName: req.user.username, status: 'Closed' }).sort({ endTime: -1 });
    res.json(shift || null);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Open a new shift
export const openShift = async (req, res) => {
  try {
    const { startingCash } = req.body;
    
    // Check if they already have an open shift
    const existingShift = await Shift.findOne({ attendantName: req.user.username, status: 'Open' });
    if (existingShift) return res.status(400).json({ message: 'You already have an open shift.' });

    const shift = await Shift.create({
      attendantName: req.user.username,
      startingCash: Number(startingCash)
    });
    
    res.status(201).json(shift);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Close shift and reconcile cash
export const closeShift = async (req, res) => {
  try {
    const { actualCash } = req.body;
    
    const shift = await Shift.findOne({ attendantName: req.user.username, status: 'Open' });
    if (!shift) return res.status(404).json({ message: 'No open shift found.' });

    // Find all transactions made by this user DURING this shift's timeframe
    const transactions = await Transaction.find({
      attendantName: req.user.username,
      timestamp: { $gte: shift.startTime },
      isDeleted: { $ne: true }
    });

    // Calculate Total Cash Sales during this shift
    const totalCashSales = transactions
      .filter(t => !t.paymentMethod || t.paymentMethod === 'Cash')
      .reduce((acc, curr) => acc + curr.totalAmount, 0);

    // Calculate Total Non-Cash Sales (just for tracking if needed later)
    const totalNonCashSales = transactions
      .filter(t => t.paymentMethod && t.paymentMethod !== 'Cash')
      .reduce((acc, curr) => acc + curr.totalAmount, 0);

    // Calculate Reconciliation Metrics
    shift.endTime = new Date();
    shift.expectedCash = shift.startingCash + totalCashSales;
    shift.actualCash = Number(actualCash);
    shift.variance = shift.actualCash - shift.expectedCash;
    shift.status = 'Closed';

    await shift.save();
    res.json(shift);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
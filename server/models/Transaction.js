import mongoose from 'mongoose';

const transactionSchema = new mongoose.Schema(
  {
    fuelType: {
      type: String,
      required: [true, 'Fuel type is required'],
    },
    litersSold: {
      type: Number,
      required: [true, 'Amount of liters sold is required'],
      min: [0.1, 'Must sell at least 0.1 liters'],
    },
    totalAmount: {
      type: Number,
      required: [true, 'Total transaction amount is required'],
    },
    totalProfit: {
      type: Number,
      default: 0
    },
    attendantName: {
      type: String,
      required: [true, 'Attendant name is required'],
      trim: true,
    },
    paymentMethod: {
      type: String,
      enum: ['Cash', 'Card', 'Fleet'],
      default: 'Cash'
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
    isDeleted: {
      type: Boolean,
      default: false
    },
    deletedAt: {
      type: Date,
      default: null
    }
  }
);

export default mongoose.model('Transaction', transactionSchema);
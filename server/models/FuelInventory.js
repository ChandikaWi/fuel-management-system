import mongoose from 'mongoose';

const fuelInventorySchema = new mongoose.Schema(
  {
    fuelType: {
      type: String,
      required: [true, 'Fuel type is required (e.g., Petrol, Diesel)'],
      unique: true,
      trim: true,
    },
    capacity: {
      type: Number,
      required: [true, 'Total capacity in liters is required'],
      min: [0, 'Capacity cannot be negative'],
    },
    currentLevel: {
      type: Number,
      required: [true, 'Current level in liters is required'],
      min: [0, 'Current level cannot be negative'],
    },
    pricePerLiter: {
      type: Number,
      required: [true, 'Price per liter is required'],
      min: [0, 'Price cannot be negative'],
    },
    costPrice: {
      type: Number,
      default: 0,
      min: [0, 'Cost price cannot be negative'],
    },
  },
  {
    timestamps: true, 
  }
);

export default mongoose.model('FuelInventory', fuelInventorySchema);
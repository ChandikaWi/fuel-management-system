import mongoose from 'mongoose';

const deliverySchema = new mongoose.Schema({
  supplierName: { type: String, required: true },
  fuelType: { type: String, required: true },
  volumeDelivered: { type: Number, required: true, min: 1 },
  costPerLiter: { type: Number, required: true, min: 0 },
  totalCost: { type: Number, required: true },
  status: { type: String, enum: ['Pending', 'Completed'], default: 'Pending' },
  deliveryDate: { type: Date, default: Date.now },
  receivedBy: { type: String, required: true } 
}, { timestamps: true });

export default mongoose.model('Delivery', deliverySchema);
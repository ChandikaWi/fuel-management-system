import mongoose from 'mongoose';

const shiftSchema = new mongoose.Schema({
  attendantName: { type: String, required: true },
  startTime: { type: Date, default: Date.now },
  endTime: { type: Date },
  startingCash: { type: Number, required: true, min: 0 },
  actualCash: { type: Number },   // What they physically counted at the end
  expectedCash: { type: Number }, // What the system calculates they SHOULD have
  variance: { type: Number },     // actualCash - expectedCash (negative means they are short)
  status: { type: String, enum: ['Open', 'Closed'], default: 'Open' }
}, { timestamps: true });

export default mongoose.model('Shift', shiftSchema);
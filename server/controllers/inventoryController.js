import FuelInventory from '../models/FuelInventory.js';
import { logAudit } from '../utils/auditLogger.js';

// Get all inventory
export const getInventory = async (req, res) => {
  try {
    const inventory = await FuelInventory.find({});
    res.json(inventory);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Update an existing fuel type
export const updateFuelLevel = async (req, res) => {
  try {
    const { id } = req.params;
    const { currentLevel, capacity, newPrice, newCost } = req.body;

    const fuel = await FuelInventory.findById(id);
    if (!fuel) return res.status(404).json({ message: 'Fuel type not found' });

    let changes = [];
    if (currentLevel !== undefined && currentLevel !== fuel.currentLevel) {
      changes.push(`Volume from ${fuel.currentLevel} to ${currentLevel}`);
      fuel.currentLevel = Number(currentLevel);
    }
    if (capacity !== undefined && capacity !== fuel.capacity) {
      changes.push(`Capacity from ${fuel.capacity} to ${capacity}`);
      fuel.capacity = Number(capacity);
    }
    if (newPrice !== undefined && newPrice !== fuel.pricePerLiter) {
      changes.push(`Price from Rs ${fuel.pricePerLiter} to Rs ${newPrice}`);
      fuel.pricePerLiter = Number(newPrice);
    }
    if (newCost !== undefined && newCost !== fuel.costPrice) {
      changes.push(`Cost Price from Rs ${fuel.costPrice} to Rs ${newCost}`);
      fuel.costPrice = Number(newCost);
    }

    if (fuel.currentLevel > fuel.capacity) {
      return res.status(400).json({ message: 'Current level cannot exceed maximum capacity' });
    }

    const updatedFuel = await fuel.save();

    // RECORD AUDIT LOG IF CHANGES WERE MADE
    if (changes.length > 0) {
      await logAudit(
        req,
        'UPDATE_INVENTORY',
        `Updated ${fuel.fuelType}: ${changes.join(', ')}`
      );
    }

    res.json(updatedFuel);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Add a completely new fuel type
export const addFuelType = async (req, res) => {
  try {
    const { fuelType, capacity, currentLevel, pricePerLiter } = req.body;
    
    // Check if it already exists
    const existing = await FuelInventory.findOne({ fuelType });
    if (existing) return res.status(400).json({ message: 'This fuel type already exists in your inventory.' });

    const newFuel = await FuelInventory.create({
      fuelType,
      capacity: Number(capacity),
      currentLevel: Number(currentLevel),
      pricePerLiter: Number(pricePerLiter)
    });

    // Record Audit Log
    await logAudit(
      req,
      'ADD_FUEL_TYPE',
      `Added new fuel tank: ${fuelType} with capacity ${capacity}L`
    );

    res.status(201).json(newFuel);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Delete a fuel type
export const deleteFuelType = async (req, res) => {
  try {
    const fuel = await FuelInventory.findById(req.params.id);
    if (!fuel) return res.status(404).json({ message: 'Fuel type not found' });

    // Record Audit Log
    await logAudit(
      req,
      'DELETE_FUEL_TYPE',
      `Deleted fuel tank: ${fuel.fuelType}`
    );

    await fuel.deleteOne();
    res.json({ message: 'Fuel type removed from inventory' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
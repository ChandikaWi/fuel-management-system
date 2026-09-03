import Delivery from '../models/Delivery.js';
import FuelInventory from '../models/FuelInventory.js';
import { logAudit } from '../utils/auditLogger.js';

export const recordDelivery = async (req, res) => {
  try {
    const { supplierName, fuelType, volumeDelivered, costPerLiter, updateCostPrice } = req.body;

    // Find the fuel tank in inventory
    const fuel = await FuelInventory.findOne({ fuelType });
    if (!fuel) return res.status(404).json({ message: 'Fuel type not found in inventory.' });

    // Prevent tank overflow
    const newLevel = fuel.currentLevel + Number(volumeDelivered);
    if (newLevel > fuel.capacity) {
      return res.status(400).json({ 
        message: `Delivery exceeds tank capacity! You can only fit ${fuel.capacity - fuel.currentLevel} more liters.` 
      });
    }

    const totalCost = Number(volumeDelivered) * Number(costPerLiter);

    // Save the delivery receipt as PENDING
    const delivery = await Delivery.create({
      supplierName,
      fuelType,
      volumeDelivered: Number(volumeDelivered),
      costPerLiter: Number(costPerLiter),
      totalCost,
      status: 'Pending',
      receivedBy: req.user.username 
    });

    res.status(201).json(delivery);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const approveDelivery = async (req, res) => {
  try {
    const { updateCostPrice } = req.body;
    const delivery = await Delivery.findById(req.params.id);
    if (!delivery) return res.status(404).json({ message: 'Delivery not found.' });
    if (delivery.status === 'Completed') return res.status(400).json({ message: 'Delivery already approved.' });

    const fuel = await FuelInventory.findOne({ fuelType: delivery.fuelType });
    if (!fuel) return res.status(404).json({ message: 'Fuel type not found in inventory.' });

    const newLevel = fuel.currentLevel + delivery.volumeDelivered;
    if (newLevel > fuel.capacity) {
      return res.status(400).json({ 
        message: `Delivery exceeds tank capacity! You can only fit ${fuel.capacity - fuel.currentLevel} more liters.` 
      });
    }

    if (updateCostPrice) {
      const currentTotalValue = fuel.currentLevel * (fuel.costPrice || 0);
      const newTotalValue = currentTotalValue + delivery.totalCost;
      const newCostPrice = newTotalValue / newLevel;
      fuel.costPrice = Number(newCostPrice.toFixed(2));
    }

    fuel.currentLevel = newLevel;
    await fuel.save();

    delivery.status = 'Completed';
    await delivery.save();

    await logAudit(
      req,
      'APPROVE_DELIVERY',
      `Approved delivery of ${delivery.volumeDelivered}L ${delivery.fuelType} from ${delivery.supplierName}`
    );

    res.json(delivery);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getDeliveries = async (req, res) => {
  try {
    const deliveries = await Delivery.find().sort({ deliveryDate: -1 });
    res.json(deliveries);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const deleteDelivery = async (req, res) => {
  try {
    const delivery = await Delivery.findById(req.params.id);
    if (!delivery) {
      return res.status(404).json({ message: 'Delivery record not found' });
    }

    // Find the associated fuel tank and subtract the delivered volume ONLY if it was completed
    const fuel = await FuelInventory.findOne({ fuelType: delivery.fuelType });
    if (fuel && delivery.status === 'Completed') {
      fuel.currentLevel -= delivery.volumeDelivered;
      // Prevent inventory from dropping below zero if sales occurred after delivery
      if (fuel.currentLevel < 0) fuel.currentLevel = 0; 
      await fuel.save();
    }

    // Record this sensitive action in the Audit Log
    await logAudit(
      req,
      'DELETE_DELIVERY',
      `Deleted delivery of ${delivery.volumeDelivered}L ${delivery.fuelType} from ${delivery.supplierName} (Rs ${delivery.totalCost})`
    );

    // Delete the record
    await delivery.deleteOne();
    res.json({ message: 'Delivery record removed and inventory adjusted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
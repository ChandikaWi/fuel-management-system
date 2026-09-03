import { useState, useEffect, useRef } from 'react';
import { 
  Edit2, Check, X, Trash2, Plus, AlertCircle, Droplet, Fuel, 
  Lock, ArrowDownToLine, TrendingUp, AlertTriangle, ShieldAlert, Activity,
  FileText, ArrowRightLeft, Scale, DollarSign
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-hot-toast';
import { io } from 'socket.io-client';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import api from '../api/axios';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Badge } from '../components/ui/Badge';

const Inventory = () => {
  const [inventory, setInventory] = useState([]);
  
  // Edit State
  const [editId, setEditId] = useState(null);
  const [editPrice, setEditPrice] = useState('');
  const [editCost, setEditCost] = useState('');
  const [editCurrentLevel, setEditCurrentLevel] = useState('');
  const [editCapacity, setEditCapacity] = useState('');

  // Add New Fuel State
  const [newFuel, setNewFuel] = useState({ fuelType: '', capacity: '', currentLevel: '', pricePerLiter: '', costPrice: '' });

  // Refuel State
  const [refuelId, setRefuelId] = useState(null);
  const [refuelVolume, setRefuelVolume] = useState('');

  // Calibration State
  const [calibrateId, setCalibrateId] = useState(null);
  const [dipReading, setDipReading] = useState('');

  // Transfer State
  const [transferId, setTransferId] = useState(null);
  const [transferDestId, setTransferDestId] = useState('');
  const [transferVolume, setTransferVolume] = useState('');

  // Manager Override State
  const [showOverride, setShowOverride] = useState(false);
  const [overridePin, setOverridePin] = useState('');
  const [pendingDeleteId, setPendingDeleteId] = useState(null);
  const pinInputRef = useRef(null);

  const fetchInventory = async () => {
    try {
      const { data } = await api.get('/inventory');
      setInventory(data);
    } catch (error) {
      console.error('Error fetching inventory', error);
    }
  };

  useEffect(() => {
    fetchInventory();

    // Real-time synchronization
    const socket = io('http://localhost:5000');
    socket.on('dashboard_update', () => {
      fetchInventory();
    });

    return () => socket.disconnect();
  }, []);



  const handleAddFuel = async (e) => {
    e.preventDefault();
    if (Number(newFuel.currentLevel) > Number(newFuel.capacity)) {
      return toast.error('Current level cannot exceed total capacity!');
    }
    try {
      await api.post('/inventory', {
        ...newFuel,
        costPrice: Number(newFuel.costPrice) || 0
      });
      toast.success('New fuel type added successfully!');
      setNewFuel({ fuelType: '', capacity: '', currentLevel: '', pricePerLiter: '', costPrice: '' });
      fetchInventory();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Error adding fuel');
    }
  };

  // TRIGGER MANAGER OVERRIDE
  const requestDelete = (id) => {
    setPendingDeleteId(id);
    setShowOverride(true);
    setTimeout(() => pinInputRef.current?.focus(), 100);
  };

  const handleVerifyOverride = async (e) => {
    e.preventDefault();
    if (overridePin === '1234') { 
      setShowOverride(false);
      setOverridePin('');
      await executeDelete(pendingDeleteId);
    } else {
      toast.error('Invalid Manager PIN. Access Denied.');
      setOverridePin('');
    }
  };

  const executeDelete = async (id) => {
    try {
      await api.delete(`/inventory/${id}`);
      toast.success('Fuel tank permanently deleted.');
      setPendingDeleteId(null);
      fetchInventory();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Error deleting fuel');
    }
  };

  const handleUpdateInventory = async (id) => {
    try {
      await api.put(`/inventory/${id}`, { 
        newPrice: Number(editPrice),
        newCost: Number(editCost),
        currentLevel: Number(editCurrentLevel),
        capacity: Number(editCapacity)
      });
      setEditId(null);
      toast.success('Tank parameters updated successfully!');
      fetchInventory();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Error updating inventory');
    }
  };

  const handleRefuel = async (e) => {
    e.preventDefault();
    const tank = inventory.find(t => t._id === refuelId);
    if (!tank) return;

    const volumeToAdd = Number(refuelVolume);
    if (volumeToAdd <= 0) return toast.error('Volume must be positive');
    
    if (tank.currentLevel + volumeToAdd > tank.capacity) {
      return toast.error(`Refill exceeds max capacity by ${(tank.currentLevel + volumeToAdd - tank.capacity).toLocaleString()}L`);
    }

    try {
      await api.put(`/inventory/${refuelId}`, {
        currentLevel: tank.currentLevel + volumeToAdd
      });
      toast.success(`Successfully logged ${volumeToAdd.toLocaleString()}L delivery!`);
      setRefuelId(null);
      setRefuelVolume('');
      fetchInventory();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Error logging delivery');
    }
  };

  const handleCalibration = async (e) => {
    e.preventDefault();
    const tank = inventory.find(t => t._id === calibrateId);
    const dip = Number(dipReading);
    if (dip < 0 || dip > tank.capacity) return toast.error('Invalid dip reading');

    try {
      await api.put(`/inventory/${calibrateId}`, { currentLevel: dip });
      toast.success('Tank calibrated successfully!');
      setCalibrateId(null);
      setDipReading('');
      fetchInventory();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Error calibrating tank');
    }
  };

  const handleTransfer = async (e) => {
    e.preventDefault();
    if (transferId === transferDestId) return toast.error('Cannot transfer to the same tank');
    
    const source = inventory.find(t => t._id === transferId);
    const dest = inventory.find(t => t._id === transferDestId);
    const vol = Number(transferVolume);

    if (vol <= 0) return toast.error('Transfer volume must be positive');
    if (source.currentLevel < vol) return toast.error('Insufficient fuel in source tank');
    if (dest.currentLevel + vol > dest.capacity) return toast.error('Transfer exceeds destination capacity');

    try {
      await api.put(`/inventory/${source._id}`, { currentLevel: source.currentLevel - vol });
      await api.put(`/inventory/${dest._id}`, { currentLevel: dest.currentLevel + vol });
      
      toast.success(`Successfully transferred ${vol.toLocaleString()}L from ${source.fuelType} to ${dest.fuelType}`);
      setTransferId(null);
      setTransferDestId('');
      setTransferVolume('');
      fetchInventory();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Error during transfer');
    }
  };

  const generatePO = (fuel) => {
    const amountNeeded = fuel.capacity - fuel.currentLevel;
    const estimatedCost = amountNeeded * (fuel.costPrice || fuel.pricePerLiter * 0.8);

    const doc = new jsPDF();
    doc.setFontSize(20);
    doc.text("PURCHASE ORDER", 105, 20, { align: "center" });
    
    doc.setFontSize(10);
    doc.text(`PO Number: PO-${Date.now().toString().slice(-6)}`, 14, 35);
    doc.text(`Date: ${new Date().toLocaleDateString()}`, 14, 42);
    
    autoTable(doc, {
      startY: 50,
      head: [['Item', 'Fuel Type', 'Volume Required (L)', 'Est. Cost Price (Rs)']],
      body: [
        ['1', fuel.fuelType, amountNeeded.toLocaleString(), estimatedCost.toLocaleString(undefined, {minimumFractionDigits: 2})]
      ],
      theme: 'grid',
      headStyles: { fillColor: [16, 185, 129] }
    });

    const finalY = doc.lastAutoTable.finalY || 50;
    doc.setFontSize(12);
    doc.text(`Total Estimated Cost: Rs ${estimatedCost.toLocaleString(undefined, {minimumFractionDigits: 2})}`, 14, finalY + 15);
    
    doc.setFontSize(10);
    doc.text("Authorized Signature: _______________________", 14, finalY + 40);

    doc.save(`PO_${fuel.fuelType.replace(/\s+/g, '_')}_${new Date().getTime()}.pdf`);
    toast.success('Purchase Order Generated successfully!');
  };

  const startEditing = (fuel) => {
    setEditId(fuel._id);
    setEditPrice(fuel.pricePerLiter);
    setEditCost(fuel.costPrice || 0);
    setEditCurrentLevel(fuel.currentLevel);
    setEditCapacity(fuel.capacity);
  };

  const totalStockValue = inventory.reduce((sum, fuel) => {
    const valuationPrice = fuel.costPrice > 0 ? fuel.costPrice : fuel.pricePerLiter;
    return sum + (fuel.currentLevel * valuationPrice);
  }, 0);

  return (
    <div className="space-y-8 pb-12 w-full max-w-[1600px] mx-auto relative">
      
      {/* HEADER & VALUATION KPI */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-card/40 backdrop-blur-md p-4 rounded-2xl border border-border/50 shadow-sm sticky top-2 z-30">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Active Tanks Management</h1>
          <p className="text-sm text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1.5 animate-pulse">
            <span className="relative flex h-2.5 w-2.5"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span><span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span></span>
            Live Monitoring Active
          </p>
        </div>
        <div className="bg-primary/10 border border-primary/20 px-6 py-2 rounded-xl text-right">
          <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider mb-0.5">Total Stock Valuation</p>
          <p className="text-xl font-black text-primary flex items-center justify-end gap-1"><DollarSign size={20}/> {totalStockValue.toLocaleString(undefined, {minimumFractionDigits: 2})}</p>
        </div>
      </div>



      {/* TANK GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        <AnimatePresence>
          {inventory.map((fuel, index) => {
            const fillPercentage = Math.min(100, Math.max(0, (fuel.currentLevel / fuel.capacity) * 100));
            const isLow = fillPercentage < 20;
            const isCritical = fillPercentage < 10;
            const margin = fuel.costPrice > 0 ? ((fuel.pricePerLiter - fuel.costPrice) / fuel.pricePerLiter) * 100 : 0;

            return (
              <motion.div key={fuel._id} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: index * 0.1 }} className="h-full">
                <Card className={`h-full glass border transition-all duration-500 overflow-hidden relative ${isCritical ? 'border-destructive/60 shadow-[0_0_30px_-5px_rgba(239,68,68,0.3)] animate-pulse' : isLow ? 'border-amber-500/50' : 'border-border/50 hover:border-primary/30'}`}>
                  
                  {/* Visual Background Fill (Liquid Effect) */}
                  <div className="absolute bottom-0 left-0 right-0 z-0 opacity-10 transition-all duration-1000 ease-out" style={{ height: `${fillPercentage}%`, backgroundColor: isCritical ? '#ef4444' : isLow ? '#f59e0b' : '#10b981' }} />
                  
                  <div className="relative z-10 p-6 flex flex-col h-full">
                    <div className="flex justify-between items-start mb-6">
                      <div className="flex items-center gap-3">
                        <div className={`p-3 rounded-xl ${isCritical ? 'bg-destructive/20 text-destructive' : isLow ? 'bg-amber-500/20 text-amber-500' : 'bg-primary/20 text-primary'}`}>
                          <Droplet size={24} />
                        </div>
                        <div>
                          <h3 className="font-black text-xl tracking-tight leading-none">{fuel.fuelType}</h3>
                          {isCritical ? (
                            <Badge variant="destructive" className="mt-2 text-[10px] animate-pulse">CRITICAL EMPTY</Badge>
                          ) : isLow ? (
                            <Badge variant="warning" className="mt-2 text-[10px] bg-amber-500/20 text-amber-500 border-none">REORDER SOON</Badge>
                          ) : (
                            <Badge variant="success" className="mt-2 text-[10px] bg-emerald-500/20 text-emerald-500 border-none">HEALTHY LEVEL</Badge>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" onClick={() => startEditing(fuel)} className="h-8 w-8 text-muted-foreground hover:text-primary" title="Edit Properties"><Edit2 size={14}/></Button>
                        <Button size="icon" variant="ghost" onClick={() => setCalibrateId(fuel._id)} className="h-8 w-8 text-muted-foreground hover:text-amber-500" title="Dip Calibration"><Scale size={14}/></Button>
                        <Button size="icon" variant="ghost" onClick={() => setTransferId(fuel._id)} className="h-8 w-8 text-muted-foreground hover:text-blue-500" title="Cross-Pump Transfer"><ArrowRightLeft size={14}/></Button>
                        <Button size="icon" variant="ghost" onClick={() => requestDelete(fuel._id)} className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10" title="Delete Tank"><Trash2 size={14}/></Button>
                      </div>
                    </div>

                    {/* Level Visualizer */}
                    <div className="mb-8">
                      <div className="flex justify-between items-end mb-2">
                        <span className="text-3xl font-black">{fuel.currentLevel.toLocaleString()}<span className="text-base font-medium text-muted-foreground ml-1">L</span></span>
                        <span className="text-sm font-bold text-muted-foreground">/ {fuel.capacity.toLocaleString()} L</span>
                      </div>
                      <div className="h-4 w-full bg-secondary/50 rounded-full overflow-hidden border border-border/50">
                        <motion.div 
                          className={`h-full rounded-full ${isCritical ? 'bg-destructive' : isLow ? 'bg-amber-500' : 'bg-emerald-500'}`}
                          initial={{ width: 0 }}
                          animate={{ width: `${fillPercentage}%` }}
                          transition={{ type: "spring", stiffness: 50 }}
                        />
                      </div>
                      <p className="text-right text-xs font-bold mt-1 text-muted-foreground">{fillPercentage.toFixed(1)}% Full</p>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mt-auto mb-6">
                      <div className="bg-secondary/30 p-3 rounded-xl border border-border/30">
                        <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider mb-1">Selling Price</p>
                        <p className="text-lg font-black text-foreground">Rs {fuel.pricePerLiter.toFixed(2)}</p>
                      </div>
                      <div className="bg-secondary/30 p-3 rounded-xl border border-border/30 relative overflow-hidden">
                        <Activity className="absolute -right-2 -bottom-2 text-primary/5 opacity-50" size={60} />
                        <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider mb-1">Gross Margin</p>
                        <p className={`text-lg font-black flex items-center gap-1 ${margin > 0 ? 'text-emerald-500' : 'text-muted-foreground'}`}>
                          {margin > 0 ? <TrendingUp size={16}/> : null}
                          {margin.toFixed(1)}%
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button onClick={() => setRefuelId(fuel._id)} className="flex-1 font-bold gap-2 py-6 bg-background shadow-sm border border-border hover:bg-primary/5 hover:text-primary hover:border-primary/30" variant="outline">
                        <ArrowDownToLine size={16}/> Log Delivery
                      </Button>
                      {isLow && (
                        <Button onClick={() => generatePO(fuel)} className="font-bold gap-2 py-6 bg-amber-500 hover:bg-amber-600 text-white border-none shadow-lg shadow-amber-500/20" title="Generate Purchase Order">
                          <FileText size={16}/> PO
                        </Button>
                      )}
                    </div>
                  </div>
                </Card>
              </motion.div>
            );
          })}
        </AnimatePresence>
        
        {/* ADD NEW TANK CARD */}
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: inventory.length * 0.1 }}>
          <Card className="h-full glass border-border/50 border-dashed hover:border-primary/50 transition-colors flex flex-col min-h-[400px]">
            <CardHeader className="text-center mt-4">
              <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4 text-primary">
                <Plus size={32} />
              </div>
              <CardTitle className="text-xl">Register New Tank</CardTitle>
              <CardDescription>Expand your fuel capacity</CardDescription>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col justify-center">
              <form onSubmit={handleAddFuel} className="space-y-4">
                <Input type="text" required placeholder="Tank Name (e.g. Diesel 2)" value={newFuel.fuelType} onChange={(e) => setNewFuel({ ...newFuel, fuelType: e.target.value })} className="bg-background"/>
                <div className="grid grid-cols-2 gap-3">
                  <Input type="number" required placeholder="Capacity (L)" min="1" value={newFuel.capacity} onChange={(e) => setNewFuel({ ...newFuel, capacity: e.target.value })} className="bg-background"/>
                  <Input type="number" required placeholder="Current (L)" min="0" value={newFuel.currentLevel} onChange={(e) => setNewFuel({ ...newFuel, currentLevel: e.target.value })} className="bg-background"/>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Input type="number" required step="0.01" placeholder="Cost (Rs)" min="0" value={newFuel.costPrice} onChange={(e) => setNewFuel({ ...newFuel, costPrice: e.target.value })} className="bg-background" title="Cost Price per Liter"/>
                  <Input type="number" required step="0.01" placeholder="Selling (Rs)" min="1" value={newFuel.pricePerLiter} onChange={(e) => setNewFuel({ ...newFuel, pricePerLiter: e.target.value })} className="bg-background"/>
                </div>
                <Button type="submit" className="w-full mt-2 font-bold">Register Asset</Button>
              </form>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* EDIT MODAL */}
      <AnimatePresence>
        {editId && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="bg-card w-full max-w-md rounded-2xl shadow-2xl overflow-hidden border border-border">
              <div className="p-6">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-xl font-black">Edit Tank Parameters</h3>
                  <Button size="icon" variant="ghost" onClick={() => setEditId(null)}><X size={18}/></Button>
                </div>
                <div className="space-y-4">
                  <div><label className="text-xs font-bold text-muted-foreground uppercase">Capacity (L)</label><Input type="number" value={editCapacity} onChange={e=>setEditCapacity(e.target.value)} /></div>
                  <div className="grid grid-cols-2 gap-4">
                    <div><label className="text-xs font-bold text-muted-foreground uppercase">Selling Price</label><Input type="number" value={editPrice} onChange={e=>setEditPrice(e.target.value)} /></div>
                    <div><label className="text-xs font-bold text-muted-foreground uppercase">Cost Price</label><Input type="number" value={editCost} onChange={e=>setEditCost(e.target.value)} /></div>
                  </div>
                </div>
                <Button onClick={() => handleUpdateInventory(editId)} className="w-full mt-6 gap-2"><Check size={18}/> Save Changes</Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* REFUEL MODAL */}
      <AnimatePresence>
        {refuelId && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: -20 }} className="bg-card w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden border border-border">
              <div className="bg-emerald-600 p-6 text-center text-white relative">
                <div className="absolute top-3 right-3 cursor-pointer p-1 bg-white/20 hover:bg-white/30 rounded-full transition-colors" onClick={() => setRefuelId(null)}><X size={16}/></div>
                <ArrowDownToLine size={48} className="mx-auto mb-3 opacity-90" />
                <h3 className="text-xl font-black tracking-tight">Log Delivery</h3>
              </div>
              <div className="p-6">
                <form onSubmit={handleRefuel}>
                  <label className="text-xs font-bold text-muted-foreground uppercase mb-2 block">Volume Received (Liters)</label>
                  <Input autoFocus type="number" min="1" required placeholder="e.g. 5000" className="text-2xl font-black h-14 mb-6 bg-background" value={refuelVolume} onChange={(e) => setRefuelVolume(e.target.value)} />
                  <Button type="submit" className="w-full py-6 text-lg font-bold bg-emerald-600 hover:bg-emerald-500 text-white">Confirm Delivery</Button>
                </form>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* CALIBRATION MODAL */}
      <AnimatePresence>
        {calibrateId && (() => {
          const tank = inventory.find(t => t._id === calibrateId);
          const variance = dipReading ? Number(dipReading) - tank.currentLevel : 0;
          return (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
              <motion.div initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: -20 }} className="bg-card w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden border border-border">
                <div className="bg-amber-500 p-6 text-center text-white relative">
                  <div className="absolute top-3 right-3 cursor-pointer p-1 bg-white/20 hover:bg-white/30 rounded-full transition-colors" onClick={() => {setCalibrateId(null); setDipReading('');}}><X size={16}/></div>
                  <Scale size={48} className="mx-auto mb-3 opacity-90" />
                  <h3 className="text-xl font-black tracking-tight">Dip Calibration</h3>
                  <p className="text-sm opacity-90 mt-1">Adjust system variance</p>
                </div>
                <div className="p-6">
                  <form onSubmit={handleCalibration}>
                    <div className="flex justify-between items-center mb-4 pb-4 border-b border-border/50">
                      <span className="text-sm font-bold text-muted-foreground">System Level</span>
                      <span className="font-mono text-lg font-black">{tank.currentLevel.toLocaleString()} L</span>
                    </div>
                    
                    <label className="text-xs font-bold text-muted-foreground uppercase mb-2 block">Actual Dipstick Reading (L)</label>
                    <Input autoFocus type="number" min="0" max={tank.capacity} required placeholder="e.g. 4950" className="text-2xl font-black h-14 mb-4 bg-background" value={dipReading} onChange={(e) => setDipReading(e.target.value)} />
                    
                    <div className="flex justify-between items-center mb-6">
                      <span className="text-sm font-bold text-muted-foreground">Variance</span>
                      <span className={`font-mono text-lg font-black ${variance === 0 ? 'text-emerald-500' : 'text-destructive'}`}>
                        {variance > 0 ? '+' : ''}{variance.toLocaleString()} L
                      </span>
                    </div>

                    <Button type="submit" className="w-full py-6 text-lg font-bold bg-amber-500 hover:bg-amber-600 text-white">Log Variance & Calibrate</Button>
                  </form>
                </div>
              </motion.div>
            </motion.div>
          );
        })()}
      </AnimatePresence>

      {/* TRANSFER MODAL */}
      <AnimatePresence>
        {transferId && (() => {
          const sourceTank = inventory.find(t => t._id === transferId);
          return (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
              <motion.div initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: -20 }} className="bg-card w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden border border-border">
                <div className="bg-blue-600 p-6 text-center text-white relative">
                  <div className="absolute top-3 right-3 cursor-pointer p-1 bg-white/20 hover:bg-white/30 rounded-full transition-colors" onClick={() => {setTransferId(null); setTransferDestId(''); setTransferVolume('');}}><X size={16}/></div>
                  <ArrowRightLeft size={48} className="mx-auto mb-3 opacity-90" />
                  <h3 className="text-xl font-black tracking-tight">Cross-Pump Transfer</h3>
                  <p className="text-sm opacity-90 mt-1">Move fuel between tanks</p>
                </div>
                <div className="p-6">
                  <form onSubmit={handleTransfer} className="space-y-4">
                    <div>
                      <label className="text-xs font-bold text-muted-foreground uppercase mb-1 block">Source Tank</label>
                      <div className="p-3 bg-secondary/50 rounded-lg font-bold border border-border/50 text-foreground">{sourceTank.fuelType} ({sourceTank.currentLevel.toLocaleString()} L)</div>
                    </div>
                    
                    <div>
                      <label className="text-xs font-bold text-muted-foreground uppercase mb-1 block">Destination Tank</label>
                      <select required className="w-full h-10 px-3 rounded-lg border border-border bg-background text-foreground text-sm font-medium" value={transferDestId} onChange={(e) => setTransferDestId(e.target.value)}>
                        <option value="" disabled>Select destination...</option>
                        {inventory.filter(t => t._id !== transferId).map(t => (
                          <option key={t._id} value={t._id}>{t.fuelType} (Capacity left: {(t.capacity - t.currentLevel).toLocaleString()} L)</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-xs font-bold text-muted-foreground uppercase mb-1 block">Transfer Volume (L)</label>
                      <Input type="number" min="1" max={sourceTank.currentLevel} required placeholder="Volume to move" className="font-black h-12 bg-background" value={transferVolume} onChange={(e) => setTransferVolume(e.target.value)} />
                    </div>

                    <Button type="submit" className="w-full py-6 mt-2 text-lg font-bold bg-blue-600 hover:bg-blue-700 text-white">Execute Transfer</Button>
                  </form>
                </div>
              </motion.div>
            </motion.div>
          );
        })()}
      </AnimatePresence>

      {/* MANAGER OVERRIDE MODAL */}
      <AnimatePresence>
        {showOverride && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/90 backdrop-blur-md">
            <motion.div initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0, y: -20 }} className="bg-card w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden border border-destructive/50 flex flex-col">
              <div className="bg-destructive p-6 text-center text-destructive-foreground relative">
                <div className="absolute top-3 right-3 cursor-pointer p-1 bg-black/20 hover:bg-black/30 rounded-full transition-colors" onClick={() => setShowOverride(false)}><X size={16}/></div>
                <ShieldAlert size={48} className="mx-auto mb-3 opacity-90" />
                <h3 className="text-xl font-black tracking-tight">Manager Override</h3>
                <p className="text-sm opacity-80 mt-1">Authorization required to delete tank</p>
              </div>
              <div className="p-8 pb-10 bg-card flex-1 flex flex-col justify-center">
                <form onSubmit={handleVerifyOverride}>
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3 block text-center">Enter 4-Digit PIN</label>
                  <Input ref={pinInputRef} type="password" required maxLength={4} className="text-center text-4xl tracking-[1em] font-black h-16 bg-background border-border/50 mb-6" value={overridePin} onChange={(e) => setOverridePin(e.target.value)} placeholder="••••" />
                  <Button type="submit" className="w-full gap-2 py-6 text-lg font-black shadow-lg" variant="destructive"><Lock size={18}/> Verify & Delete</Button>
                </form>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
};

export default Inventory;
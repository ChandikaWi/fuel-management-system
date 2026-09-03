import { useState, useEffect, useRef, useCallback } from 'react';
import { Truck, Calendar, DollarSign, Package, AlertCircle, Trash2, Search, FileText, Lock, ShieldAlert, BarChart3, TrendingUp, Layers, X, Download, CheckCircle2, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-hot-toast';
import { io } from 'socket.io-client';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import api from '../api/axios';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Badge } from '../components/ui/Badge';

const Deliveries = () => {
  const [deliveries, setDeliveries] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [formData, setFormData] = useState({
    supplierName: '',
    fuelType: '',
    volumeDelivered: '',
    costPerLiter: '',
    updateCostPrice: true
  });

  // Filtering States
  const [filterSupplier, setFilterSupplier] = useState('');
  const [filterFuelType, setFilterFuelType] = useState('ALL');

  // Manager Override State
  const [showOverride, setShowOverride] = useState(false);
  const [overridePin, setOverridePin] = useState('');
  const [overrideAction, setOverrideAction] = useState({ type: null, id: null }); // type: 'DELETE' or 'APPROVE'
  const pinInputRef = useRef(null);

  const fetchData = useCallback(async () => {
    try {
      const [delRes, invRes] = await Promise.all([
        api.get('/deliveries'),
        api.get('/inventory')
      ]);
      setDeliveries(delRes.data);
      setInventory(invRes.data);
      
      setFormData(prev => {
         if (invRes.data.length > 0 && !prev.fuelType) {
            return { ...prev, fuelType: invRes.data[0].fuelType };
         }
         return prev;
      });
    } catch (error) {
      console.error('Error fetching data', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();

    const socket = io('http://localhost:5000');
    socket.on('dashboard_update', () => {
      fetchData();
    });

    return () => socket.disconnect();
  }, []);



  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.post('/deliveries', formData);
      toast.success('Delivery logged as Pending. Requires Manager Approval.');
      setFormData({ ...formData, volumeDelivered: '', costPerLiter: '' });
      fetchData(); 
    } catch (error) {
      toast.error(error.response?.data?.message || 'Error recording delivery');
    }
  };

  // TRIGGER MANAGER OVERRIDE
  const requestAction = (type, id) => {
    setOverrideAction({ type, id });
    setShowOverride(true);
    setTimeout(() => pinInputRef.current?.focus(), 100);
  };

  const handleVerifyOverride = async (e) => {
    e.preventDefault();
    if (overridePin === '1234') { 
      setShowOverride(false);
      setOverridePin('');
      if (overrideAction.type === 'DELETE') {
        await executeDelete(overrideAction.id);
      } else if (overrideAction.type === 'APPROVE') {
        await executeApprove(overrideAction.id);
      }
    } else {
      toast.error('Invalid Manager PIN. Access Denied.');
      setOverridePin('');
    }
  };

  const executeDelete = async (id) => {
    try {
      await api.delete(`/deliveries/${id}`);
      toast.success('Delivery record removed.');
      setOverrideAction({ type: null, id: null });
      fetchData(); 
    } catch (error) {
      console.error('Error deleting delivery', error);
      toast.error(error.response?.data?.message || 'Failed to delete delivery.');
    }
  };

  const executeApprove = async (id) => {
    try {
      await api.put(`/deliveries/${id}/approve`, { updateCostPrice: true });
      toast.success('Delivery Approved! Tank volume and Weighted Average Cost updated.');
      setOverrideAction({ type: null, id: null });
      fetchData();
    } catch (error) {
      console.error('Error approving delivery', error);
      toast.error(error.response?.data?.message || 'Failed to approve delivery.');
    }
  };

  const generateGRN = (delivery) => {
    const doc = new jsPDF();
    doc.setFontSize(20);
    doc.text("GOODS RECEIVED NOTE (GRN)", 105, 20, { align: "center" });
    
    doc.setFontSize(10);
    doc.text(`GRN Number: GRN-${delivery._id.slice(-6).toUpperCase()}`, 14, 35);
    doc.text(`Delivery Date: ${new Date(delivery.deliveryDate).toLocaleString()}`, 14, 42);
    doc.text(`Received By: ${delivery.receivedBy}`, 14, 49);
    doc.text(`Supplier: ${delivery.supplierName}`, 14, 56);
    doc.text(`Status: ${delivery.status || 'Completed'}`, 14, 63);
    
    autoTable(doc, {
      startY: 72,
      head: [['Fuel Type', 'Volume (L)', 'Cost per Liter (Rs)', 'Total Value (Rs)']],
      body: [
        [
          delivery.fuelType, 
          delivery.volumeDelivered.toLocaleString(), 
          delivery.costPerLiter.toFixed(2), 
          delivery.totalCost.toLocaleString(undefined, {minimumFractionDigits: 2})
        ]
      ],
      theme: 'grid',
      headStyles: { fillColor: [79, 70, 229] } 
    });

    const finalY = doc.lastAutoTable.finalY || 72;
    
    doc.setFontSize(10);
    doc.text("Authorized Receiver Signature: _______________________", 14, finalY + 30);
    doc.text("Supplier Driver Signature: _______________________", 14, finalY + 45);

    doc.save(`GRN_${delivery.supplierName.replace(/\s+/g, '_')}_${new Date(delivery.deliveryDate).getTime()}.pdf`);
    toast.success('GRN PDF Generated successfully!');
  };

  const exportToCSV = () => {
    if (filteredDeliveries.length === 0) {
      toast.error("No data to export");
      return;
    }

    const headers = ['Delivery ID', 'Date', 'Supplier', 'Fuel Type', 'Volume (L)', 'Cost Per Liter', 'Total Cost', 'Status', 'Received By'];
    
    const csvRows = [headers.join(',')];

    for (const d of filteredDeliveries) {
      const row = [
        d._id,
        new Date(d.deliveryDate).toLocaleString().replace(',', ''),
        `"${d.supplierName}"`,
        d.fuelType,
        d.volumeDelivered,
        d.costPerLiter,
        d.totalCost,
        d.status || 'Completed',
        d.receivedBy
      ];
      csvRows.push(row.join(','));
    }

    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `Deliveries_Export_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    
    URL.revokeObjectURL(url);
    toast.success('CSV exported successfully');
  };

  const filteredDeliveries = deliveries.filter(delivery => {
    const matchesSupplier = delivery.supplierName.toLowerCase().includes(filterSupplier.toLowerCase());
    const matchesFuelType = filterFuelType === 'ALL' || delivery.fuelType === filterFuelType;
    return matchesSupplier && matchesFuelType;
  });

  // Unique suppliers for autocomplete
  const uniqueSuppliers = [...new Set(deliveries.map(d => d.supplierName))];

  // Calculate KPIs based on filtered COMPLETED records
  const completedFiltered = filteredDeliveries.filter(d => (d.status || 'Completed') === 'Completed');
  const kpiTotalVolume = completedFiltered.reduce((sum, d) => sum + d.volumeDelivered, 0);
  const kpiTotalSpend = completedFiltered.reduce((sum, d) => sum + d.totalCost, 0);

  // Chart Data (Aggregate by Date)
  const chartDataMap = {};
  [...completedFiltered].reverse().forEach(d => {
    const dateStr = new Date(d.deliveryDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    if (!chartDataMap[dateStr]) chartDataMap[dateStr] = { date: dateStr, volume: 0, cost: 0 };
    chartDataMap[dateStr].volume += d.volumeDelivered;
    chartDataMap[dateStr].cost += d.totalCost;
  });
  const chartData = Object.values(chartDataMap);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <svg className="animate-spin h-10 w-10 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <p className="text-muted-foreground font-medium animate-pulse">Loading supply chain...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 pb-8 max-w-[1600px] mx-auto">
      
      {/* KPI DASHBOARD */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="glass border-border/50 relative overflow-hidden group">
          <div className="absolute -right-4 -top-4 opacity-5 group-hover:opacity-10 transition-opacity">
            <Layers size={100} />
          </div>
          <CardContent className="p-6">
            <p className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-2">Total Volume Received</p>
            <h3 className="text-4xl font-black text-foreground">{kpiTotalVolume.toLocaleString()} <span className="text-xl text-muted-foreground">L</span></h3>
          </CardContent>
        </Card>
        <Card className="glass border-border/50 relative overflow-hidden group">
          <div className="absolute -right-4 -top-4 opacity-5 group-hover:opacity-10 text-indigo-500 transition-opacity">
            <TrendingUp size={100} />
          </div>
          <CardContent className="p-6">
            <p className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-2">Capital Expenditure</p>
            <h3 className="text-4xl font-black text-indigo-500 flex items-center gap-1">
              <DollarSign size={28}/>
              {kpiTotalSpend.toLocaleString(undefined, {minimumFractionDigits: 2})}
            </h3>
          </CardContent>
        </Card>
        <Card className="glass border-border/50 relative overflow-hidden group">
          <div className="absolute -right-4 -top-4 opacity-5 group-hover:opacity-10 text-primary transition-opacity">
            <Truck size={100} />
          </div>
          <CardContent className="p-6">
            <p className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-2">Deliveries Completed</p>
            <h3 className="text-4xl font-black text-foreground">{completedFiltered.length}</h3>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Record Delivery Form */}
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="w-full lg:w-1/3">
          <Card className="glass border-border/50 sticky top-6">
            <CardHeader className="border-b border-border/50 bg-secondary/20">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-500/10 rounded-lg text-indigo-500">
                  <Truck size={24} />
                </div>
                <CardTitle>Log Delivery</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-6">


              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-muted-foreground uppercase">Supplier / Vendor Name</label>
                  <Input 
                    type="text" 
                    required
                    list="suppliers"
                    value={formData.supplierName}
                    onChange={(e) => setFormData({ ...formData, supplierName: e.target.value })}
                    placeholder="e.g. Ceylon Petroleum Corp"
                    className="bg-background"
                  />
                  <datalist id="suppliers">
                    {uniqueSuppliers.map((sup, idx) => (
                      <option key={idx} value={sup} />
                    ))}
                  </datalist>
                </div>
                
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-muted-foreground uppercase">Fuel Type</label>
                  <select 
                    className="flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition-all"
                    value={formData.fuelType}
                    onChange={(e) => setFormData({ ...formData, fuelType: e.target.value })}
                  >
                    {inventory.map(fuel => (
                      <option key={fuel._id} value={fuel.fuelType} className="bg-card text-foreground">{fuel.fuelType}</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="block text-xs font-bold text-muted-foreground uppercase">Volume (Liters)</label>
                    <div className="relative">
                      <Package className="absolute left-3 top-3 text-muted-foreground" size={16} />
                      <Input 
                        type="number" 
                        required min="1"
                        className="pl-9 h-11 bg-background"
                        value={formData.volumeDelivered}
                        onChange={(e) => setFormData({ ...formData, volumeDelivered: e.target.value })}
                        placeholder="0"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="block text-xs font-bold text-muted-foreground uppercase">Cost per Liter</label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-3 text-muted-foreground" size={16} />
                      <Input 
                        type="number" 
                        required min="0" step="0.01"
                        className="pl-9 h-11 bg-background"
                        value={formData.costPerLiter}
                        onChange={(e) => setFormData({ ...formData, costPerLiter: e.target.value })}
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                </div>

                {/* Weighted Average Cost Toggle */}
                <div className="p-4 bg-indigo-500/5 rounded-lg border border-indigo-500/20">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input 
                      type="checkbox" 
                      className="mt-1 w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 bg-background border-border"
                      checked={formData.updateCostPrice}
                      onChange={(e) => setFormData({ ...formData, updateCostPrice: e.target.checked })}
                    />
                    <div>
                      <p className="text-sm font-bold text-foreground leading-none">Recalculate Cost Price</p>
                      <p className="text-xs text-muted-foreground mt-1">Automatically calculates the new Weighted Average Cost for this tank upon approval.</p>
                    </div>
                  </label>
                </div>

                <div className="bg-secondary/50 p-4 rounded-lg border border-border/50 flex justify-between items-center">
                  <span className="text-xs font-bold text-muted-foreground uppercase">Total Invoice:</span>
                  <span className="text-xl font-black text-foreground">
                    Rs {((formData.volumeDelivered || 0) * (formData.costPerLiter || 0)).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>

                <Button type="submit" className="w-full py-6 text-base font-bold shadow-lg shadow-amber-500/20 bg-amber-500 hover:bg-amber-600 text-white border-none">
                  Submit for Approval
                </Button>
              </form>
            </CardContent>
          </Card>
        </motion.div>

        {/* Deliveries Area */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full lg:w-2/3 flex flex-col gap-6">
          
          {/* Analytics Chart */}
          {chartData.length > 0 && (
            <Card className="glass border-border/50 overflow-hidden">
              <CardHeader className="py-4 border-b border-border/50">
                <CardTitle className="text-sm text-muted-foreground uppercase">Volume Trends (Filtered)</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="h-48 w-full p-4 pb-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData} margin={{ top: 5, right: 0, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorVolume" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="date" hide />
                      <Tooltip 
                        contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '0.5rem', fontWeight: 'bold' }}
                        itemStyle={{ color: 'hsl(var(--foreground))' }}
                        formatter={(value) => [`${value.toLocaleString()} L`, 'Volume']}
                      />
                      <Area type="monotone" dataKey="volume" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#colorVolume)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Table Card */}
          <Card className="glass border-border/50 overflow-hidden h-full flex-1">
            {/* Header & Interactive Filters */}
            <div className="p-6 border-b border-border/50 bg-secondary/20 space-y-4">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="flex items-center gap-3">
                  <CardTitle className="text-lg">Supply Chain Ledger</CardTitle>
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <div className="relative flex-1 sm:w-64">
                    <Search className="absolute left-3 top-2.5 text-muted-foreground" size={16} />
                    <Input 
                      type="text" 
                      placeholder="Search by supplier name..." 
                      className="pl-9 bg-background h-10"
                      value={filterSupplier}
                      onChange={(e) => setFilterSupplier(e.target.value)}
                    />
                  </div>
                  <Button variant="outline" className="h-10 px-3 bg-background" onClick={exportToCSV} title="Export to CSV">
                    <Download size={16} className="text-indigo-500" />
                  </Button>
                </div>
              </div>

              {/* Interactive Fuel Type Chips */}
              <div className="flex flex-wrap gap-2">
                <Badge 
                  className={`cursor-pointer px-4 py-1.5 text-sm transition-all ${filterFuelType === 'ALL' ? 'bg-primary text-primary-foreground shadow-md' : 'bg-background hover:bg-secondary border border-border text-foreground'}`}
                  onClick={() => setFilterFuelType('ALL')}
                >
                  All Fuels
                </Badge>
                {inventory.map(fuel => (
                  <Badge 
                    key={fuel._id}
                    className={`cursor-pointer px-4 py-1.5 text-sm transition-all ${filterFuelType === fuel.fuelType ? 'bg-primary text-primary-foreground shadow-md' : 'bg-background hover:bg-secondary border border-border text-foreground'}`}
                    onClick={() => setFilterFuelType(fuel.fuelType)}
                  >
                    {fuel.fuelType}
                  </Badge>
                ))}
              </div>
            </div>

            <div className="overflow-x-auto h-[500px] no-scrollbar">
              <table className="w-full text-left border-collapse min-w-[700px]">
                <thead className="sticky top-0 bg-secondary/80 backdrop-blur-md shadow-sm z-10 border-b border-border/50">
                  <tr className="text-muted-foreground text-xs uppercase tracking-wider font-bold">
                    <th className="p-4 pl-6">Date & Status</th>
                    <th className="p-4">Supplier</th>
                    <th className="p-4">Fuel & Volume</th>
                    <th className="p-4">Financials</th>
                    <th className="p-4 pr-6 text-right">Actions</th> 
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  <AnimatePresence>
                    {filteredDeliveries.map((delivery, index) => {
                      const isPending = delivery.status === 'Pending';

                      return (
                        <motion.tr 
                          key={delivery._id} 
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, x: -20 }}
                          transition={{ delay: index * 0.05 }}
                          className={`transition-colors group ${isPending ? 'bg-amber-500/5 hover:bg-amber-500/10' : 'hover:bg-secondary/30'}`}
                        >
                          <td className="p-4 pl-6 text-foreground">
                            <div className="flex items-center gap-2 text-sm font-bold mb-1">
                              <Calendar size={14} className="text-indigo-500"/>
                              {new Date(delivery.deliveryDate).toLocaleDateString()}
                            </div>
                            {isPending ? (
                              <Badge className="bg-amber-500/20 text-amber-600 hover:bg-amber-500/30 border-none gap-1 py-0 px-2 text-[10px]">
                                <Clock size={10}/> PENDING
                              </Badge>
                            ) : (
                              <Badge className="bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 border-none gap-1 py-0 px-2 text-[10px]">
                                <CheckCircle2 size={10}/> COMPLETED
                              </Badge>
                            )}
                          </td>
                          <td className="p-4 font-black text-foreground text-sm">
                            {delivery.supplierName}
                            <div className="text-[10px] text-muted-foreground mt-0.5 font-medium">By: {delivery.receivedBy}</div>
                          </td>
                          <td className="p-4">
                            <div className="font-bold text-foreground text-sm">{delivery.fuelType}</div>
                            <div className={`text-xs font-black px-2 py-0.5 rounded inline-block mt-1 ${isPending ? 'bg-amber-500/20 text-amber-600' : 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10'}`}>
                              + {delivery.volumeDelivered.toLocaleString()} L
                            </div>
                          </td>
                          <td className="p-4">
                            <div className="font-bold text-foreground">
                              Rs {delivery.totalCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </div>
                            <div className="text-xs text-muted-foreground mt-1 font-medium">
                              @ Rs {delivery.costPerLiter.toFixed(2)} / L
                            </div>
                          </td>
                          <td className="p-4 pr-6 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1 transition-opacity">
                              {isPending && (
                                <Button 
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => requestAction('APPROVE', delivery._id)}
                                  className="text-emerald-600 bg-emerald-500/10 hover:bg-emerald-500/20 w-8 h-8 rounded-md mr-1"
                                  title="Approve Delivery (Manager Only)"
                                >
                                  <CheckCircle2 size={16} />
                                </Button>
                              )}
                              <Button 
                                size="icon"
                                variant="ghost"
                                onClick={() => generateGRN(delivery)}
                                className="text-indigo-500 hover:bg-indigo-500/10 w-8 h-8 rounded-md"
                                title="Download GRN PDF"
                              >
                                <FileText size={16} />
                              </Button>
                              <Button 
                                size="icon"
                                variant="ghost"
                                onClick={() => requestAction('DELETE', delivery._id)}
                                className="text-destructive hover:bg-destructive/10 w-8 h-8 rounded-md"
                                title={isPending ? 'Cancel Delivery' : 'Delete Delivery & Deduct Inventory'}
                              >
                                <Trash2 size={16} />
                              </Button>
                            </div>
                          </td>
                        </motion.tr>
                      );
                    })}
                  </AnimatePresence>
                  
                  {/* Dynamic Empty State */}
                  {filteredDeliveries.length === 0 && (
                    <tr>
                      <td colSpan="5" className="p-16 text-center">
                        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-secondary/50 text-muted-foreground mb-4">
                          <BarChart3 size={24} />
                        </div>
                        <p className="text-muted-foreground font-bold">
                          {deliveries.length === 0 ? 'No supply chain data recorded yet.' : 'No delivery records match your active filters.'}
                        </p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </motion.div>
      </div>

      {/* MANAGER OVERRIDE MODAL */}
      <AnimatePresence>
        {showOverride && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/90 backdrop-blur-md">
            <motion.div initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0, y: -20 }} className={`bg-card w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden border flex flex-col ${overrideAction.type === 'APPROVE' ? 'border-emerald-500/50' : 'border-destructive/50'}`}>
              <div className={`${overrideAction.type === 'APPROVE' ? 'bg-emerald-600' : 'bg-destructive'} p-6 text-center text-white relative`}>
                <div className="absolute top-3 right-3 cursor-pointer p-1 bg-black/20 hover:bg-black/30 rounded-full transition-colors" onClick={() => setShowOverride(false)}><X size={16}/></div>
                {overrideAction.type === 'APPROVE' ? (
                  <CheckCircle2 size={48} className="mx-auto mb-3 opacity-90" />
                ) : (
                  <ShieldAlert size={48} className="mx-auto mb-3 opacity-90" />
                )}
                <h3 className="text-xl font-black tracking-tight">Manager Override</h3>
                <p className="text-sm opacity-80 mt-1">
                  {overrideAction.type === 'APPROVE' ? 'Authorization required to approve delivery' : 'Authorization required to reverse delivery'}
                </p>
              </div>
              <div className="p-8 pb-10 bg-card flex-1 flex flex-col justify-center">
                <form onSubmit={handleVerifyOverride}>
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3 block text-center">Enter 4-Digit PIN</label>
                  <Input ref={pinInputRef} type="password" required maxLength={4} className="text-center text-4xl tracking-[1em] font-black h-16 bg-background border-border/50 mb-6" value={overridePin} onChange={(e) => setOverridePin(e.target.value)} placeholder="••••" />
                  <Button type="submit" className={`w-full gap-2 py-6 text-lg font-black shadow-lg ${overrideAction.type === 'APPROVE' ? 'bg-emerald-600 hover:bg-emerald-700 text-white border-none' : ''}`} variant={overrideAction.type === 'DELETE' ? 'destructive' : 'default'}>
                    <Lock size={18}/> {overrideAction.type === 'APPROVE' ? 'Verify & Approve' : 'Verify & Delete'}
                  </Button>
                </form>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
};

export default Deliveries;
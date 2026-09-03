import { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { 
  LockOpen, Lock, Receipt, DollarSign, AlertCircle, Fuel, 
  CheckCircle2, Printer, X, ShieldAlert, History, WifiOff, RefreshCw
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-hot-toast';
import api from '../api/axios';
import ConfirmModal from '../components/ui/ConfirmModal';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Badge } from '../components/ui/Badge';

// Helper for sound
const playBeep = () => {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, ctx.currentTime);
    gain.gain.setValueAtTime(0.1, ctx.currentTime);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    gain.gain.exponentialRampToValueAtTime(0.00001, ctx.currentTime + 0.1);
    osc.stop(ctx.currentTime + 0.1);
  } catch (_e) {
    console.error("Audio not supported");
  }
};

const TransactionForm = () => {
  const [inventory, setInventory] = useState([]);
  const [activeShift, setActiveShift] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // POS States
  const [selectedFuel, setSelectedFuel] = useState('');
  const [inputMode, setInputMode] = useState('volume'); // 'volume' or 'currency'
  const [inputValue, setInputValue] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [sessionSales, setSessionSales] = useState([]);
  
  // Modal States
  const [showReceipt, setShowReceipt] = useState(null); // stores transaction data to show
  const [showZReport, setShowZReport] = useState(null); // State for End-of-Shift Z-Report
  
  // Shift States
  const [startingCash, setStartingCash] = useState('0');
  const [actualCash, setActualCash] = useState('');
  const [varianceReason, setVarianceReason] = useState('');
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  // Modal confirm states
  const [isLockShiftModalOpen, setIsLockShiftModalOpen] = useState(false);
  const [isVarianceModalOpen, setIsVarianceModalOpen] = useState(false);
  const [currentVariance, setCurrentVariance] = useState(0);


  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const fetchInitialData = async () => {
      try {
        const [invRes, shiftRes, lastShiftRes] = await Promise.all([
          api.get('/inventory'),
          api.get('/shifts/active'),
          api.get('/shifts/last-closed')
        ]);
        setInventory(invRes.data);
        setActiveShift(shiftRes.data);
        
        // Prefill starting cash with the previous shift's starting cash (the standard float)
        if (!shiftRes.data && lastShiftRes.data && lastShiftRes.data.startingCash !== undefined) {
          setStartingCash(lastShiftRes.data.startingCash.toString());
        }

        if (invRes.data.length > 0) setSelectedFuel(invRes.data[0].fuelType);
      } catch (error) {
        console.error("Error fetching data", error);
      } finally {
        setLoading(false);
      }
    };
    fetchInitialData();

    // Listen for real-time updates (like transactions deleted from History page)
    const socket = io('http://localhost:5000');
    socket.on('dashboard_update', () => {
      fetchInitialData();
    });

    return () => {
      socket.disconnect();
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Keyboard Shortcuts Listener
  useEffect(() => {
    if (!activeShift) return;

    const handleKeyDown = (e) => {
      // Ignore if typing in an actual input field (except body)
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        if (e.key === 'Escape') {
          e.preventDefault();
          setInputValue('');
        }
        if (e.key === 'Enter') {
          e.preventDefault();
          handleRecordSale();
        }
        return;
      }

      switch(e.key) {
        case 'Escape':
          e.preventDefault();
          setInputValue('');
          break;
        case 'Enter':
          e.preventDefault();
          handleRecordSale();
          break;
        case ' ':
          // Space toggles mode
          e.preventDefault();
          setInputMode(prev => prev === 'volume' ? 'currency' : 'volume');
          setInputValue('');
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeShift, inputMode, inputValue, selectedFuel, paymentMethod]); 

  // Auto-fill Actual Cash when activeShift.expectedCash changes
  useEffect(() => {
    if (activeShift && activeShift.expectedCash !== undefined) {
      setActualCash(activeShift.expectedCash.toString());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeShift?.expectedCash]);



  const activeFuelData = inventory.find(f => f.fuelType === selectedFuel) || { pricePerLiter: 0, currentLevel: 0, capacity: 0 };
  
  // Live Math Calculation
  const parsedInput = parseFloat(inputValue) || 0;
  let calculatedVolume = 0;
  let calculatedAmount = 0;

  if (inputMode === 'volume') {
    calculatedVolume = parsedInput;
    calculatedAmount = parsedInput * activeFuelData.pricePerLiter;
  } else {
    calculatedAmount = parsedInput;
    calculatedVolume = parsedInput / (activeFuelData.pricePerLiter || 1);
  }

  const isExceedingInventory = calculatedVolume > activeFuelData.currentLevel;

  // Handlers
  const handleOpenShift = async (e) => {
    e.preventDefault();
    try {
      const { data } = await api.post('/shifts/open', { startingCash: Number(startingCash) });
      setActiveShift(data);
      toast.success('Shift opened successfully!');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Error opening shift');
    }
  };

  const handleRecordSale = async (e) => {
    if (e) e.preventDefault();
    if (calculatedVolume <= 0) return toast.error('Amount must be greater than 0');
    if (isExceedingInventory) return toast.error('Cannot sell more than available inventory');

    try {
      const { data } = await api.post('/transactions/sale', {
        fuelType: selectedFuel,
        litersSold: Number(calculatedVolume.toFixed(2)),
        paymentMethod
      });
      
      playBeep();
      setInputValue('');
      setSessionSales(prev => [data, ...prev].slice(0, 5)); // Keep last 5
      
      // Update local inventory state for immediate feedback
      setInventory(prev => prev.map(f => f.fuelType === selectedFuel ? { ...f, currentLevel: f.currentLevel - calculatedVolume } : f));
      
      // Live update local shift expected cash
      if (paymentMethod === 'Cash' || !paymentMethod) {
        setActiveShift(prev => ({
          ...prev,
          currentCashSales: (prev.currentCashSales || 0) + data.totalAmount,
          expectedCash: (prev.expectedCash || 0) + data.totalAmount
        }));
      }
      
      setShowReceipt(data);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Error recording transaction');
    }
  };

  const handleCloseShiftRequest = (e) => {
    e.preventDefault();
    const variance = Number(actualCash) - activeShift.expectedCash;
    setCurrentVariance(variance);
    
    if (Math.abs(variance) > 1000) {
      setIsVarianceModalOpen(true);
    } else {
      setIsLockShiftModalOpen(true);
    }
  };

  const executeCloseShift = async () => {
    try {
      const { data } = await api.post('/shifts/close', { actualCash: Number(actualCash), notes: varianceReason });
      
      // Show Z-Report instead of simple alert
      setShowZReport(data);
      
      setActiveShift(null);
      setActualCash('');
      setVarianceReason('');
      setSessionSales([]);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Error closing shift');
    }
  };

  const handleQuickAdd = (val, mode) => {
    if (inputMode !== mode) setInputMode(mode);
    setInputValue(prev => {
      const curr = parseFloat(prev) || 0;
      return (curr + val).toString();
    });
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center gap-4">
        <div className="relative w-16 h-16"><div className="absolute inset-0 rounded-full border-4 border-primary/20"></div><div className="absolute inset-0 rounded-full border-4 border-primary border-t-transparent animate-spin"></div></div>
        <p className="text-muted-foreground font-bold tracking-widest uppercase text-xs animate-pulse">Initializing POS Terminal...</p>
      </div>
    );
  }

  return (
    <div className="max-w-[1600px] mx-auto space-y-6 pb-12 relative">
      
      {/* OFFLINE BANNER */}
      <AnimatePresence>
        {!isOnline && (
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="p-4 bg-destructive text-destructive-foreground font-black tracking-widest text-center shadow-lg rounded-xl flex items-center justify-center gap-3">
            <WifiOff size={24} /> SYSTEM OFFLINE - CHECK INTERNET CONNECTION
          </motion.div>
        )}
      </AnimatePresence>



      {!activeShift ? (
        /* OPEN SHIFT SCREEN */
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="max-w-xl mx-auto mt-20">
          <Card className="glass border-border/50 text-center p-12 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 p-32 bg-primary/10 rounded-full blur-[80px] -mr-16 -mt-16 pointer-events-none"></div>
            <div className="w-24 h-24 bg-secondary/80 rounded-full flex items-center justify-center mx-auto mb-8 shadow-inner border border-border/50 relative z-10">
              <Lock size={48} className="text-muted-foreground" />
            </div>
            <h2 className="text-4xl font-black text-foreground mb-4 tracking-tight relative z-10">Terminal Locked</h2>
            <p className="text-muted-foreground mb-12 text-lg relative z-10">Declare starting drawer cash to initiate a new operational shift.</p>
            
            <form onSubmit={handleOpenShift} className="space-y-6 relative z-10">
              <div className="space-y-3">
                <div className="relative group">
                  <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors" size={24} />
                  <Input type="number" required className="pl-12 text-2xl py-8 font-bold text-center bg-background/50 border-border/50 focus:bg-background" value={startingCash} onChange={(e) => setStartingCash(e.target.value)} placeholder="0.00" />
                </div>
              </div>
              <Button type="submit" size="lg" className="w-full py-8 text-xl font-bold shadow-lg shadow-primary/25 rounded-xl">
                Authorize & Open Shift
              </Button>
            </form>
          </Card>
        </motion.div>
      ) : (
        /* ACTIVE SHIFT POS SCREEN */
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-1 xl:grid-cols-12 gap-6">
          
          {/* LEFT PANEL- POS INPUT */}
          <div className="xl:col-span-8 flex flex-col gap-6">
            <Card className="glass border-border/50 flex-1 flex flex-col overflow-hidden">
              <CardHeader className="border-b border-border/50 bg-secondary/20 pb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-primary/10 rounded-xl text-primary"><Fuel size={24} /></div>
                    <CardTitle className="text-2xl">Point of Sale</CardTitle>
                  </div>
                  <Badge variant="outline" className="px-3 py-1 bg-background/50 text-sm font-bold border-emerald-500/30 text-emerald-600 dark:text-emerald-400">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 mr-2 animate-pulse"></span> Terminal Active
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-8 flex-1 flex flex-col justify-between">
                
                {/* Product Selection */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
                  {inventory.map(fuel => {
                    const isSelected = selectedFuel === fuel.fuelType;
                    const isLow = fuel.currentLevel / fuel.capacity < 0.1;
                    return (
                      <div 
                        key={fuel._id} 
                        onClick={() => setSelectedFuel(fuel.fuelType)}
                        className={`p-4 rounded-xl cursor-pointer border-2 transition-all ${isSelected ? 'border-primary bg-primary/5 shadow-md shadow-primary/10 scale-[1.02]' : 'border-border/50 bg-card hover:bg-secondary/50'}`}
                      >
                        <div className="flex justify-between items-start mb-2">
                          <h3 className={`font-black ${isSelected ? 'text-primary' : 'text-foreground'}`}>{fuel.fuelType}</h3>
                          {isLow && <ShieldAlert size={14} className="text-destructive animate-pulse" />}
                        </div>
                        <p className="text-xs font-bold text-muted-foreground mb-3">Rs {fuel.pricePerLiter}/L</p>
                        <div className="w-full bg-secondary rounded-full h-1.5 overflow-hidden">
                          <div className={`h-full ${isLow ? 'bg-destructive' : 'bg-primary/60'}`} style={{ width: `${(fuel.currentLevel / fuel.capacity) * 100}%` }}></div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Input Mode Toggle & Display */}
                <div className="flex flex-col md:flex-row gap-6 items-end mb-8">
                  <div className="w-full md:w-1/2">
                    <div className="flex bg-secondary/50 p-1 rounded-xl mb-4 border border-border/50">
                      <button onClick={() => { setInputMode('volume'); setInputValue(''); }} className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${inputMode === 'volume' ? 'bg-background shadow-sm text-primary' : 'text-muted-foreground hover:text-foreground'}`}>Volume (L)</button>
                      <button onClick={() => { setInputMode('currency'); setInputValue(''); }} className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${inputMode === 'currency' ? 'bg-background shadow-sm text-primary' : 'text-muted-foreground hover:text-foreground'}`}>Currency (Rs)</button>
                    </div>
                    <div className="relative">
                      <Input 
                        type="number" 
                        className={`text-4xl font-black py-10 pl-6 bg-background/50 border-border/50 ${isExceedingInventory ? 'text-destructive border-destructive focus-visible:ring-destructive' : 'text-foreground focus-visible:ring-primary'}`}
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        placeholder="0.00"
                        autoFocus
                      />
                      <span className="absolute right-6 top-1/2 -translate-y-1/2 text-2xl font-black text-muted-foreground">
                        {inputMode === 'volume' ? 'L' : 'Rs'}
                      </span>
                    </div>
                    {isExceedingInventory && (
                      <p className="text-destructive text-sm font-bold mt-2 flex items-center gap-1"><AlertCircle size={14}/> Exceeds available tank inventory!</p>
                    )}
                  </div>
                  
                  {/* Quick Action Buttons */}
                  <div className="w-full md:w-1/2 grid grid-cols-4 gap-2">
                    {inputMode === 'volume' ? (
                      <>
                        {[1, 5, 10, 20, 50, 100].map(val => (
                          <Button key={val} type="button" variant="outline" className="py-6 font-bold bg-background/50 hover:bg-primary/10 hover:text-primary hover:border-primary/30" onClick={() => handleQuickAdd(val, 'volume')}>+{val}L</Button>
                        ))}
                        <Button type="button" variant="secondary" className="py-6 font-black bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20" onClick={() => { setInputMode('volume'); setInputValue(activeFuelData.currentLevel.toString()); }}>FULL</Button>
                        <Button type="button" variant="destructive" className="py-6 font-black hover:bg-destructive/90" onClick={() => setInputValue('')}>CLEAR</Button>
                      </>
                    ) : (
                      <>
                        {[500, 1000, 2000, 5000, 10000, 20000].map(val => (
                          <Button key={val} type="button" variant="outline" className="py-6 font-bold bg-background/50 hover:bg-primary/10 hover:text-primary hover:border-primary/30" onClick={() => handleQuickAdd(val, 'currency')}>+{val >= 1000 ? `${val/1000}k` : val}</Button>
                        ))}
                        <Button type="button" variant="secondary" className="py-6 font-black bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20" onClick={() => { setInputMode('volume'); setInputValue(activeFuelData.currentLevel.toString()); }}>FULL</Button>
                        <Button type="button" variant="destructive" className="py-6 font-black hover:bg-destructive/90" onClick={() => setInputValue('')}>CLEAR</Button>
                      </>
                    )}
                  </div>
                </div>
                
                {/* Payment Method Selector */}
                <div className="mb-8 p-1 bg-secondary/50 rounded-xl flex gap-1 border border-border/50">
                  {['Cash', 'Card', 'Fleet'].map(method => (
                    <button
                      key={method}
                      type="button"
                      onClick={() => setPaymentMethod(method)}
                      className={`flex-1 py-3 text-sm font-black rounded-lg transition-all ${paymentMethod === method ? 'bg-background shadow-sm text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-secondary'}`}
                    >
                      {method === 'Cash' ? '💵 ' : method === 'Card' ? '💳 ' : '🏢 '}
                      {method}
                    </button>
                  ))}
                </div>

                {/* Big Action Button */}
                <Button 
                  onClick={handleRecordSale} 
                  disabled={isExceedingInventory || calculatedVolume <= 0 || !isOnline}
                  className={`w-full py-10 text-2xl font-black rounded-xl transition-all shadow-xl ${isExceedingInventory || calculatedVolume <= 0 || !isOnline ? 'bg-secondary text-muted-foreground shadow-none' : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-500/25 border-none'}`}
                >
                  <CheckCircle2 size={28} className="mr-3" /> {!isOnline ? "OFFLINE" : "AUTHORIZE DISPENSE"}
                </Button>

              </CardContent>
            </Card>
          </div>

          {/* RIGHT PANEL- LIVE RECEIPT & SHIFT STATUS */}
          <div className="xl:col-span-4 flex flex-col gap-6">
            
            {/* Live Receipt Panel */}
            <Card className="glass border-border/50 relative overflow-hidden flex flex-col min-h-[420px]">
              <div className="absolute -right-16 -top-16 text-secondary/30 pointer-events-none transform rotate-12">
                <Receipt size={180} />
              </div>
              <CardHeader className="border-b border-dashed border-border/60 pb-4 z-10">
                <CardTitle className="text-lg flex items-center gap-2"><Receipt size={18}/> Digital Receipt</CardTitle>
                <CardDescription>Live transaction preview</CardDescription>
              </CardHeader>
              <CardContent className="pt-6 flex-1 flex flex-col z-10 bg-gradient-to-b from-transparent to-background/50">
                <div className="space-y-4 flex-1 font-mono">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Product</span>
                    <span className="font-bold">{selectedFuel}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Unit Price</span>
                    <span className="font-bold">Rs {activeFuelData.pricePerLiter.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Volume</span>
                    <span className="font-bold">{calculatedVolume > 0 ? calculatedVolume.toFixed(2) : '0.00'} L</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Payment</span>
                    <span className="font-bold">{paymentMethod}</span>
                  </div>
                  <div className="w-full h-px bg-border/50 my-2"></div>
                </div>
                <div className="mt-auto">
                  <p className="text-sm text-muted-foreground font-bold mb-1 uppercase tracking-widest text-right">Total Due</p>
                  <p className="text-5xl font-black text-right text-foreground tracking-tighter">
                    Rs {calculatedAmount > 0 ? calculatedAmount.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}) : '0.00'}
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Shift Operations */}
            <Card className="glass border-border/50 flex flex-col h-full">
              <CardHeader className="pb-3 border-b border-border/50 bg-secondary/20">
                <CardTitle className="text-lg flex items-center gap-2"><LockOpen size={18}/> Operational Shift</CardTitle>
              </CardHeader>
              <CardContent className="pt-5 flex flex-col justify-between h-[500px]">
                <div className="flex flex-col gap-2 mb-4">
                  <div className="flex justify-between items-center text-sm p-3 rounded-lg bg-secondary/50 border border-border/50">
                    <span className="text-muted-foreground font-bold">Session Started</span>
                    <span className="font-black font-mono">{new Date(activeShift.startTime).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm p-3 rounded-lg bg-secondary/50 border border-border/50">
                    <span className="text-muted-foreground font-bold">Total Cash Earned</span>
                    <span className="font-black font-mono text-emerald-500">Rs {(activeShift.currentCashSales || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                  </div>
                </div>

                {/* Recent Shift Sales Ledger */}
                <div className="flex-1 overflow-y-auto no-scrollbar mb-4">
                  <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-2"><History size={14}/> Recent Shift Sales</h4>
                  {sessionSales.length === 0 ? (
                    <div className="h-20 border border-dashed border-border/50 rounded-lg flex items-center justify-center text-muted-foreground text-sm font-medium">No sales this shift yet</div>
                  ) : (
                    <div className="space-y-2">
                      {sessionSales.map((sale) => (
                        <div key={sale._id} className="bg-background/50 border border-border/50 p-2 rounded-lg flex justify-between items-center">
                          <div>
                            <p className="text-xs font-black text-foreground">{sale.fuelType}</p>
                            <p className="text-[10px] text-muted-foreground font-mono">{new Date(sale.timestamp).toLocaleTimeString()}</p>
                          </div>
                          <div className="text-right flex items-center gap-3">
                            <div>
                              <p className="text-sm font-black text-primary">Rs {sale.totalAmount.toLocaleString(undefined, {minimumFractionDigits: 2})}</p>
                              <p className="text-[10px] text-muted-foreground font-bold uppercase">{sale.paymentMethod || 'CASH'}</p>
                            </div>
                            <Button size="icon" variant="ghost" onClick={() => setShowReceipt(sale)} className="w-8 h-8 rounded-md bg-secondary/50 hover:bg-primary/20 hover:text-primary transition-colors text-muted-foreground" title="Reprint">
                              <RefreshCw size={14} />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="mt-auto">
                  <div className="bg-destructive/5 p-5 rounded-xl border border-destructive/20 relative overflow-hidden group">
                    <div className="absolute top-0 left-0 w-1 h-full bg-destructive"></div>
                    <form onSubmit={handleCloseShiftRequest}>
                      <label className="block text-sm font-black text-foreground mb-1">Close Terminal & Reconcile</label>
                      <p className="text-xs text-muted-foreground mb-4">Enter physical drawer cash to lock the POS.</p>
                      <Input type="number" required className="mb-3 text-lg font-bold bg-background border-border/50" value={actualCash} onChange={(e) => setActualCash(e.target.value)} placeholder="Physical Cash (Rs)" />
                      {/* Optional variance reason if short */}
                      <AnimatePresence>
                        {actualCash && parseFloat(actualCash) < (activeShift.startingCash + sessionSales.reduce((a,b)=>a+b.totalAmount,0)) && (
                          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden mb-3">
                             <Input required type="text" className="text-sm bg-background border-amber-500/30" placeholder="Reason for shortage..." value={varianceReason} onChange={e=>setVarianceReason(e.target.value)} />
                          </motion.div>
                        )}
                      </AnimatePresence>
                      <Button type="submit" variant="destructive" className="w-full gap-2 py-5 text-base font-bold">
                        <Lock size={18} /> Lock Terminal
                      </Button>
                    </form>
                  </div>
                </div>
              </CardContent>
            </Card>

          </div>
        </motion.div>
      )}

      {/* SUCCESS RECEIPT MODAL */}
      <AnimatePresence>
        {showReceipt && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50" onClick={() => setShowReceipt(null)} />
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
              <motion.div initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0, y: -20 }} className="bg-card w-full max-w-sm rounded-2xl shadow-2xl border border-border/50 overflow-hidden pointer-events-auto flex flex-col">
                <div className="bg-emerald-600 p-6 text-center text-white relative">
                  <div className="absolute top-3 right-3 cursor-pointer p-1 bg-white/20 hover:bg-white/30 rounded-full transition-colors" onClick={() => setShowReceipt(null)}><X size={16}/></div>
                  <CheckCircle2 size={48} className="mx-auto mb-3 opacity-90" />
                  <h3 className="text-xl font-black tracking-tight">Transaction Successful</h3>
                </div>
                
                {/* Printable Area */}
                <div className="p-8 bg-white text-black font-mono text-sm relative" id="receipt-print-area">
                  <div className="text-center mb-6 border-b border-dashed border-gray-300 pb-4">
                    <h2 className="text-xl font-black mb-1">FUEL MASTER</h2>
                    <p className="text-xs text-gray-500">Authorized Retailer</p>
                  </div>
                  
                  <div className="space-y-3 mb-6">
                    <div className="flex justify-between"><span className="text-gray-500">Tx ID:</span><span className="font-bold">{showReceipt._id.substring(0,8).toUpperCase()}</span></div>
                    <div className="flex justify-between"><span className="text-gray-500">Date:</span><span className="font-bold">{new Date(showReceipt.timestamp).toLocaleString()}</span></div>
                    <div className="flex justify-between"><span className="text-gray-500">Cashier:</span><span className="font-bold">{showReceipt.attendantName}</span></div>
                  </div>
                  
                  <div className="border-t border-b border-dashed border-gray-300 py-4 mb-6 space-y-3">
                    <div className="flex justify-between font-bold text-base"><span>{showReceipt.fuelType}</span><span>Rs {showReceipt.totalAmount.toLocaleString(undefined, {minimumFractionDigits: 2})}</span></div>
                    <div className="flex justify-between text-xs text-gray-500"><span>Volume:</span><span>{showReceipt.litersSold.toFixed(2)} L</span></div>
                  </div>

                  <div className="text-center">
                    <p className="text-2xl font-black">Rs {showReceipt.totalAmount.toLocaleString(undefined, {minimumFractionDigits: 2})}</p>
                    <p className="text-xs text-gray-500 mt-2">Thank you for your business!</p>
                  </div>
                </div>
                
                <div className="p-4 bg-secondary/30 flex gap-3">
                  <Button variant="outline" className="flex-1 bg-background" onClick={() => setShowReceipt(null)}>Close</Button>
                  <Button className="flex-1 gap-2" onClick={handlePrint}><Printer size={16}/> Print Receipt</Button>
                </div>
              </motion.div>
            </div>
          </>
        )}
        {/* END OF SHIFT Z-REPORT MODAL */}
        {showZReport && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="bg-card w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden border border-border">
              <div className="p-8 pb-4 bg-white text-black" id="z-report-print-area">
                <div className="text-center mb-6">
                  <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-3">
                    <Receipt className="text-primary" size={24}/>
                  </div>
                  <h3 className="text-2xl font-black font-mono tracking-tighter">Z-REPORT</h3>
                  <p className="text-xs text-muted-foreground uppercase tracking-widest mt-1">End of Shift Summary</p>
                </div>
                
                <div className="space-y-4 font-mono text-sm">
                  <div className="flex justify-between border-b border-border/50 pb-2">
                    <span className="text-muted-foreground">Attendant</span>
                    <span className="font-bold">{showZReport.attendantName}</span>
                  </div>
                  <div className="flex justify-between border-b border-border/50 pb-2">
                    <span className="text-muted-foreground">Opened</span>
                    <span className="font-bold">{new Date(showZReport.startTime).toLocaleTimeString()}</span>
                  </div>
                  <div className="flex justify-between border-b border-border/50 pb-2">
                    <span className="text-muted-foreground">Closed</span>
                    <span className="font-bold">{new Date(showZReport.endTime).toLocaleTimeString()}</span>
                  </div>
                  <div className="flex justify-between border-b border-border/50 pb-2">
                    <span className="text-muted-foreground">Starting Float</span>
                    <span className="font-bold">Rs {showZReport.startingCash.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                  </div>
                  <div className="flex justify-between border-b border-border/50 pb-2">
                    <span className="text-muted-foreground">Expected Cash</span>
                    <span className="font-bold">Rs {showZReport.expectedCash.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                  </div>
                  <div className="flex justify-between border-b border-border/50 pb-2">
                    <span className="text-muted-foreground">Actual Cash Declared</span>
                    <span className="font-bold">Rs {showZReport.actualCash.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 bg-secondary/30 px-2 rounded">
                    <span className="text-muted-foreground font-bold uppercase text-xs tracking-wider">Variance</span>
                    <span className={`font-black text-lg ${showZReport.variance === 0 ? 'text-emerald-500' : 'text-destructive'}`}>
                      {showZReport.variance > 0 ? '+' : ''}{showZReport.variance.toLocaleString(undefined, {minimumFractionDigits: 2})}
                    </span>
                  </div>
                </div>
                
                <div className="mt-8 text-center">
                  <svg className="w-full h-12 opacity-20"><rect width="100%" height="100%" fill="url(#barcode-pattern)"/></svg>
                  <p className="text-[10px] text-muted-foreground mt-2 font-mono">SHIFT-ID: {showZReport._id}</p>
                </div>
              </div>
              
              <div className="p-4 bg-secondary/30 flex gap-2 border-t border-border">
                <Button variant="outline" className="flex-1" onClick={() => setShowZReport(null)}>Done</Button>
                <Button className="flex-1 gap-2 bg-primary hover:bg-primary/90 text-primary-foreground" onClick={handlePrint}>
                  <Printer size={16}/> Print Report
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <ConfirmModal
        isOpen={isLockShiftModalOpen}
        onClose={() => setIsLockShiftModalOpen(false)}
        onConfirm={executeCloseShift}
        title="Lock Terminal"
        description="Are you sure you want to lock the terminal and close the shift? This will finalize all transactions and print the Z-Report."
        confirmText="Lock Shift"
        isDanger={true}
        icon={Lock}
      />

      <ConfirmModal
        isOpen={isVarianceModalOpen}
        onClose={() => setIsVarianceModalOpen(false)}
        onConfirm={executeCloseShift}
        title="CRITICAL VARIANCE WARNING"
        description={`Your variance is Rs ${Math.abs(currentVariance).toLocaleString()} ${currentVariance > 0 ? 'OVER' : 'SHORT'}.\n\nThis is a massive discrepancy. Are you absolutely sure you want to proceed and lock this shift?`}
        confirmText="Proceed Anyway"
        isDanger={true}
        icon={ShieldAlert}
      />

      {/* Global Print Styles injected securely */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #receipt-print-area, #receipt-print-area *, 
          #z-report-print-area, #z-report-print-area * { visibility: visible; }
          #receipt-print-area, #z-report-print-area { position: absolute; left: 0; top: 0; width: 100%; margin: 0; padding: 20px; font-family: monospace; }
        }
      `}</style>
    </div>
  );
};

export default TransactionForm;
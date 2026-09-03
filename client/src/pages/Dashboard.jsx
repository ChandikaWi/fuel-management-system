import { useState, useEffect, useCallback } from 'react';
import { io } from 'socket.io-client';
import { 
  DollarSign, Droplet, AlertTriangle, Activity, TrendingUp, ArrowUpRight, 
  ArrowDownRight, Download, CalendarDays, Clock, Zap, History, CheckCircle2,
  Cloud, CloudRain, Sun, X, Trophy
} from 'lucide-react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, 
  ResponsiveContainer, ComposedChart, Bar, Line, Legend, PieChart, Pie, Cell, Sector
} from 'recharts';
import { motion, AnimatePresence, useSpring, useTransform } from 'framer-motion';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import api from '../api/axios';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';

// Animations
const containerVariants = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.1 } } };
const itemVariants = { hidden: { y: 20, opacity: 0 }, visible: { y: 0, opacity: 1, transition: { type: "spring", stiffness: 300, damping: 24 } } };
const modalVariants = { hidden: { opacity: 0, scale: 0.95 }, visible: { opacity: 1, scale: 1, transition: { type: "spring", stiffness: 300, damping: 25 } }, exit: { opacity: 0, scale: 0.95 } };

const AnimatedNumber = ({ value, prefix = "", suffix = "", decimals = 0 }) => {
  const spring = useSpring(0, { mass: 1, stiffness: 50, damping: 20 });
  const display = useTransform(spring, (current) => {
    return prefix + current.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) + suffix;
  });
  useEffect(() => { spring.set(value); }, [value, spring]);
  return <motion.span>{display}</motion.span>;
};

const PIE_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

const Dashboard = () => {
  const [inventory, setInventory] = useState([]);
  const [reports, setReports] = useState([]);
  const [chartData, setChartData] = useState([]);
  const [recentActivity, setRecentActivity] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [weather, setWeather] = useState(null);
  
  const [loading, setLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState('30');
  const [activeIndex, setActiveIndex] = useState(0);
  
  // Drill-down Modal State
  const [selectedFuel, setSelectedFuel] = useState(null); // String (fuel type) to show in modal

  const fetchDashboardData = useCallback(async (showLoader = true) => {
    if (showLoader) setLoading(true);
    try {
      const [invRes, repRes, chartRes, activityRes, leadRes] = await Promise.all([
        api.get('/inventory'),
        api.get(`/transactions/report?days=${dateFilter}`),
        api.get(`/transactions/chart-data?days=${dateFilter}`),
        api.get('/transactions/recent'),
        api.get('/transactions/leaderboard')
      ]);
      setInventory(invRes.data);
      setReports(repRes.data);
      setChartData(chartRes.data);
      setRecentActivity(activityRes.data);
      setLeaderboard(leadRes.data);
    } catch (error) {
      console.error("Error fetching data", error);
    } finally {
      if (showLoader) setLoading(false);
    }
  }, [dateFilter]);

  useEffect(() => {
    fetchDashboardData();

    // Socket.io Real-time connection
    const socket = io('http://localhost:5000'); 
    socket.on('dashboard_update', () => {
      console.log('Real-time update received! Fetching fresh data...');
      fetchDashboardData(false); // Refetch silently on background without loader
    });

    // Weather API (Open-Meteo, coordinates for Colombo/Sri Lanka as default)
    fetch('https://api.open-meteo.com/v1/forecast?latitude=6.9271&longitude=79.8612&current_weather=true')
      .then(res => res.json())
      .then(data => setWeather(data.current_weather))
      .catch(err => console.error("Weather API error", err));

    return () => socket.disconnect();
  }, [dateFilter]);

  const exportPDF = () => {
    const doc = new jsPDF();
    const dateStr = new Date().toLocaleString();
    doc.setFontSize(20); doc.text("FuelMaster Enterprise Report", 14, 22);
    doc.setFontSize(11); doc.setTextColor(100);
    doc.text(`Generated on: ${dateStr} | Timeframe: ${dateFilter === 'all' ? 'All Time' : `Last ${dateFilter} Days`}`, 14, 30);

    const totalRev = reports.reduce((acc, curr) => acc + curr.totalRevenue, 0);
    const totalProf = reports.reduce((acc, curr) => acc + (curr.totalProfit || 0), 0);
    
    doc.setFontSize(12); doc.setTextColor(0);
    doc.text(`Revenue: Rs ${totalRev.toLocaleString()} | Profit: Rs ${totalProf.toLocaleString()}`, 14, 45);

    autoTable(doc, {
      startY: 55,
      head: [['Fuel Type', 'Tx Count', 'Volume (L)', 'Revenue (Rs)', 'Gross Profit (Rs)']],
      body: reports.map(r => [ r._id, r.transactionCount, r.totalLitersSold.toFixed(2), r.totalRevenue.toFixed(2), (r.totalProfit||0).toFixed(2) ]),
      theme: 'grid', headStyles: { fillColor: [37, 99, 235] }
    });
    
    const finalY = doc.lastAutoTable.finalY || 55;
    doc.text("Current Inventory Levels", 14, finalY + 15);
    autoTable(doc, {
      startY: finalY + 20,
      head: [['Tank / Fuel', 'Current Level (L)', 'Capacity (L)', 'Status']],
      body: inventory.map(i => [ i.fuelType, i.currentLevel, i.capacity, (i.currentLevel / i.capacity) < 0.2 ? 'CRITICAL' : 'OK' ]),
      theme: 'grid', headStyles: { fillColor: [15, 23, 42] }
    });
    doc.save(`FuelMaster_Report_${new Date().getTime()}.pdf`);
  };

  const totalRevenue = reports.reduce((acc, curr) => acc + curr.totalRevenue, 0);
  const totalProfit = reports.reduce((acc, curr) => acc + (curr.totalProfit || 0), 0);
  const lowStockAlerts = inventory.filter(f => (f.currentLevel / f.capacity) < 0.2).length;

  const onPieEnter = (_, index) => setActiveIndex(index);
  const openDrillDown = (fuelType) => setSelectedFuel(fuelType);

  return (
    <div className="space-y-6 pb-12 w-full max-w-[1600px] mx-auto relative">
      
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-card/40 backdrop-blur-md p-4 rounded-2xl border border-border/50 shadow-sm sticky top-2 z-40">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Enterprise Overview</h1>
          <p className="text-sm text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1.5 animate-pulse">
            <span className="relative flex h-2.5 w-2.5"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span><span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span></span>
            Live Connection Active
          </p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <div className="flex bg-secondary/50 p-1 rounded-xl items-center gap-1 border border-border/50">
            {[{label: "Today", val: '1'}, {label: "7D", val: '7'}, {label: "30D", val: '30'}, {label: "All", val: 'all'}].map(filter => (
              <button
                key={filter.val}
                onClick={() => setDateFilter(filter.val)}
                className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${dateFilter === filter.val ? 'bg-background shadow-sm text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-secondary'}`}
              >
                {filter.label}
              </button>
            ))}
          </div>
          {dateFilter !== '30' && (
             <button 
               onClick={() => setDateFilter('30')}
               className="text-sm font-bold text-muted-foreground hover:text-primary transition-colors underline underline-offset-4 decoration-muted-foreground/30 hover:decoration-primary"
             >
               Reset
             </button>
          )}
          <Button onClick={exportPDF} variant="outline" className="gap-2 bg-background border-border/50 shadow-sm hover:bg-primary/5 hover:text-primary hover:border-primary/30">
            <Download size={16} /> Export PDF
          </Button>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {loading ? (
          <motion.div key="loader" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-[60vh] flex flex-col items-center justify-center gap-4">
            <div className="relative w-16 h-16"><div className="absolute inset-0 rounded-full border-4 border-primary/20"></div><div className="absolute inset-0 rounded-full border-4 border-primary border-t-transparent animate-spin"></div></div>
            <p className="text-muted-foreground font-bold tracking-widest uppercase text-xs animate-pulse">Aggregating Enterprise Data...</p>
          </motion.div>
        ) : (
          <motion.div key="content" variants={containerVariants} initial="hidden" animate="visible" className="space-y-6">
            
            {/* Top KPI Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              <StatCard icon={<DollarSign />} title="Total Revenue" value={<AnimatedNumber value={totalRevenue} prefix="Rs " decimals={0} />} iconBg="bg-blue-500/10 text-blue-600 dark:text-blue-400" />
              <StatCard icon={<TrendingUp />} title="Gross Profit" value={<AnimatedNumber value={totalProfit} prefix="Rs " decimals={0} />} iconBg="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" />
              <StatCard icon={<Droplet />} title="Active Fuel Grades" value={<AnimatedNumber value={inventory.length} />} iconBg="bg-primary/10 text-primary" />
              <StatCard icon={<AlertTriangle />} title="Critical Alerts" value={<AnimatedNumber value={lowStockAlerts} />} iconBg={lowStockAlerts > 0 ? "bg-destructive/10 text-destructive" : "bg-secondary text-muted-foreground"} alert={lowStockAlerts > 0} />
            </div>

            {/* Middle Analytics Row */}
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
              
              {/* Dual-Axis Combo Chart */}
              <motion.div variants={itemVariants} className="xl:col-span-8">
                <Card className="h-full glass border-border/50">
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <div><CardTitle>Sales & Volume Dynamics</CardTitle><CardDescription>Correlating cash flow with fluid output</CardDescription></div>
                    <div className="p-2 bg-primary/10 rounded-lg text-primary"><Activity size={20} /></div>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[350px] w-full mt-4">
                      {chartData.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                            <defs>
                              <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.8}/><stop offset="95%" stopColor="var(--primary)" stopOpacity={0.1}/>
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.5} />
                            <XAxis dataKey="date" stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} dy={10} />
                            <YAxis yAxisId="left" stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => `Rs${val >= 1000 ? (val/1000).toFixed(0)+'k' : val}`} />
                            <YAxis yAxisId="right" orientation="right" stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => `${val >= 1000 ? (val/1000).toFixed(0)+'k' : val}L`} />
                            <RechartsTooltip contentStyle={{ borderRadius: '12px', border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--card-foreground)', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                            <Legend wrapperStyle={{ paddingTop: '20px' }} iconType="circle" />
                            <Bar yAxisId="right" dataKey="Volume" fill="var(--muted-foreground)" radius={[4, 4, 0, 0]} maxBarSize={40} opacity={0.3} />
                            <Area yAxisId="left" type="monotone" dataKey="Revenue" stroke="var(--primary)" strokeWidth={3} fillOpacity={1} fill="url(#colorRev)" />
                            <Line yAxisId="left" type="monotone" dataKey="Profit" stroke="#10b981" strokeWidth={2} dot={false} />
                          </ComposedChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="h-full flex items-center justify-center text-muted-foreground font-medium bg-secondary/20 rounded-xl border border-dashed border-border/50">No data available for this timeframe.</div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

              {/* Revenue Breakdown Donut Chart */}
              <motion.div variants={itemVariants} className="xl:col-span-4 flex flex-col gap-6">
                <Card className="flex-1 glass border-border/50">
                  <CardHeader>
                    <CardTitle>Revenue Distribution</CardTitle>
                    <CardDescription>Click a slice for deep analytics</CardDescription>
                  </CardHeader>
                  <CardContent className="flex flex-col items-center justify-center">
                    <div className="h-[200px] w-full relative">
                      {reports.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              activeIndex={activeIndex} activeShape={renderActiveShape}
                              data={reports.map(r => ({ name: r._id, value: r.totalRevenue }))}
                              cx="50%" cy="50%" innerRadius={60} outerRadius={80} dataKey="value"
                              onMouseEnter={onPieEnter} onClick={(data) => openDrillDown(data.payload.name)}
                              stroke="var(--card)" strokeWidth={3} className="cursor-pointer outline-none"
                            >
                              {reports.map((entry, index) => <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />)}
                            </Pie>
                          </PieChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="h-full flex items-center justify-center text-muted-foreground font-medium">No sales data.</div>
                      )}
                    </div>
                    {/* Compact Legend */}
                    <div className="w-full mt-4 grid grid-cols-2 gap-2">
                      {reports.map((r, i) => (
                        <div key={r._id} onClick={() => openDrillDown(r._id)} className="flex items-center gap-2 text-sm p-1.5 rounded-md hover:bg-secondary/50 cursor-pointer transition-colors border border-transparent hover:border-border/50">
                          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }}></span>
                          <span className="font-semibold text-foreground truncate flex-1">{r._id}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            </div>

            {/* Bottom Row */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              
              {/* Intelligent Insights & Weather Column */}
              <motion.div variants={itemVariants} className="lg:col-span-4 flex flex-col gap-6">
                
                {/* Weather Context Widget */}
                {weather && (
                  <Card className="glass border-border/50 bg-gradient-to-br from-blue-500/5 to-cyan-500/5 overflow-hidden relative">
                    <div className="absolute right-0 top-0 -mt-8 -mr-8 text-blue-500/10 pointer-events-none">
                      {weather.weathercode > 3 ? <CloudRain size={120}/> : <Sun size={120}/>}
                    </div>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2"><Cloud size={16}/> Environmental Context</CardTitle>
                    </CardHeader>
                    <CardContent className="relative z-10">
                      <div className="flex items-end gap-3 mb-2">
                        <span className="text-4xl font-black text-foreground">{weather.temperature}°C</span>
                        <span className="text-muted-foreground font-bold mb-1">{weather.windspeed} km/h wind</span>
                      </div>
                      <p className="text-xs font-medium text-foreground/80 bg-background/50 p-2 rounded-lg border border-border/50 backdrop-blur-sm mt-3">
                        {weather.weathercode > 50 ? "Heuristic: Rain detected. Expect a potential 10-15% drop in station traffic today." : "Heuristic: Clear conditions. Standard volume expected."}
                      </p>
                    </CardContent>
                  </Card>
                )}

                {/* System Insights */}
                <Card className="flex-1 glass-panel border-border/50 relative overflow-hidden bg-primary/5">
                  <div className="absolute top-0 right-0 p-32 bg-primary/10 rounded-full blur-[80px] -mr-16 -mt-16 pointer-events-none"></div>
                  <CardHeader className="pb-4">
                    <div className="flex items-center gap-2 mb-1"><Zap size={20} className="text-amber-500 fill-amber-500" /><CardTitle>System Insights</CardTitle></div>
                    <CardDescription>Algorithmic alerts and predictive analytics</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {inventory.map((fuel) => {
                        const perc = fuel.currentLevel / fuel.capacity;
                        const dailyAvgVolume = (reports.find(r => r._id === fuel.fuelType)?.totalLitersSold || 0) / (dateFilter === 'all' ? 30 : parseInt(dateFilter));
                        const daysLeft = dailyAvgVolume > 0 ? (fuel.currentLevel / dailyAvgVolume).toFixed(1) : '∞';
                        
                        let statusIcon, bg, textColor, msg;
                        if (perc < 0.2) {
                          statusIcon = <AlertTriangle size={16} />; bg = "bg-destructive/10 border-destructive/20"; textColor = "text-destructive"; msg = `Critical level. Depletion in ${daysLeft} days.`;
                        } else if (daysLeft !== '∞' && parseFloat(daysLeft) < 3) {
                          statusIcon = <History size={16} />; bg = "bg-amber-500/10 border-amber-500/20"; textColor = "text-amber-600 dark:text-amber-400"; msg = `High volume. Will deplete in ${daysLeft} days.`;
                        } else {
                          statusIcon = <CheckCircle2 size={16} />; bg = "bg-emerald-500/10 border-emerald-500/20"; textColor = "text-emerald-600 dark:text-emerald-400"; msg = `Stable inventory. Operating nominally.`;
                        }
                        return (
                          <div key={fuel._id} className={`p-3 rounded-xl border ${bg} flex flex-col gap-1 backdrop-blur-sm cursor-pointer transition-transform hover:scale-[1.02]`} onClick={() => openDrillDown(fuel.fuelType)}>
                            <div className="flex items-center justify-between">
                              <span className={`font-bold text-sm ${textColor} flex items-center gap-2`}>{statusIcon} {fuel.fuelType}</span>
                              <span className="text-sm font-black">{Math.round(perc * 100)}%</span>
                            </div>
                            <p className={`text-xs font-semibold opacity-80 ${textColor}`}>{msg}</p>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

              {/* Live Tank Levels */}
              <motion.div variants={itemVariants} className="lg:col-span-4">
                <Card className="h-full glass border-border/50">
                  <CardHeader>
                    <CardTitle>Storage Infrastructure</CardTitle>
                    <CardDescription>Click a tank for specific analytics</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-6 mt-2">
                      {inventory.map((fuel, index) => {
                        const percentage = Math.round((fuel.currentLevel / fuel.capacity) * 100);
                        const isLow = percentage < 20;
                        return (
                          <motion.div key={fuel._id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 * index }} 
                            className="cursor-pointer group" onClick={() => openDrillDown(fuel.fuelType)}
                          >
                            <div className="flex justify-between items-end mb-2">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-foreground text-sm group-hover:text-primary transition-colors">{fuel.fuelType}</span>
                                <Badge variant="outline" className="text-[10px] py-0 bg-background/50 border-border/50">Rs {fuel.pricePerLiter.toFixed(2)}/L</Badge>
                              </div>
                              <span className={`text-xs font-bold ${isLow ? 'text-destructive' : 'text-muted-foreground'}`}>
                                {fuel.currentLevel.toLocaleString()} / {fuel.capacity.toLocaleString()} L
                              </span>
                            </div>
                            <div className="w-full bg-secondary rounded-full h-4 overflow-hidden border border-border/50 relative shadow-inner">
                              <motion.div initial={{ width: 0 }} animate={{ width: `${percentage}%` }} transition={{ duration: 1.5, ease: "easeOut" }} className={`h-full absolute left-0 top-0 ${isLow ? 'bg-destructive' : 'bg-primary'} group-hover:brightness-110 transition-all`}>
                                <div className="absolute inset-0 bg-gradient-to-b from-white/30 to-transparent"></div>
                              </motion.div>
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

              {/* Operations & Leaderboard Column */}
              <motion.div variants={itemVariants} className="lg:col-span-4 flex flex-col gap-6">
                
                {/* Attendant Leaderboard */}
                <Card className="flex-1 glass border-border/50 overflow-hidden flex flex-col">
                  <CardHeader className="bg-secondary/30 border-b border-border/50 pb-3">
                    <CardTitle className="text-sm flex items-center gap-2"><Trophy size={16} className="text-amber-500"/> Shift Leaderboard</CardTitle>
                  </CardHeader>
                  <CardContent className="p-0 flex-1 overflow-y-auto no-scrollbar">
                    <div className="divide-y divide-border/50">
                      {leaderboard.map((staff, idx) => (
                        <div key={staff._id} className="p-3 hover:bg-secondary/30 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${idx === 0 ? 'bg-amber-500 text-white' : idx === 1 ? 'bg-slate-400 text-white' : idx === 2 ? 'bg-amber-700 text-white' : 'bg-secondary text-muted-foreground'}`}>
                              {idx + 1}
                            </div>
                            <span className="text-sm font-bold">{staff._id}</span>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-black text-emerald-600 dark:text-emerald-400">Rs {(staff.totalRevenue/1000).toFixed(1)}k</p>
                          </div>
                        </div>
                      ))}
                      {leaderboard.length === 0 && <div className="p-6 text-center text-muted-foreground text-sm font-medium">No sales recorded.</div>}
                    </div>
                  </CardContent>
                </Card>

                {/* Recent Activity Feed */}
                <Card className="flex-1 glass border-border/50 overflow-hidden flex flex-col">
                  <CardHeader className="bg-secondary/30 border-b border-border/50 pb-3">
                    <CardTitle className="text-sm flex items-center gap-2"><Activity size={16} className="text-primary"/> Live Feed</CardTitle>
                  </CardHeader>
                  <CardContent className="p-0 flex-1 overflow-y-auto no-scrollbar h-[200px]">
                    <div className="divide-y divide-border/50">
                      {recentActivity.map((tx, idx) => (
                        <motion.div key={tx._id} initial={{ opacity: 0, backgroundColor: 'var(--primary)' }} animate={{ opacity: 1, backgroundColor: 'transparent' }} transition={{ delay: idx * 0.1 }} className="p-3 hover:bg-secondary/30 transition-colors flex items-center justify-between">
                          <div>
                            <p className="text-xs font-bold text-foreground">Sold {tx.litersSold}L {tx.fuelType}</p>
                            <p className="text-[10px] text-muted-foreground font-medium">{tx.attendantName}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-xs font-black text-emerald-600 dark:text-emerald-400">Rs {tx.totalAmount.toLocaleString()}</p>
                            <p className="text-[9px] text-muted-foreground font-bold">{new Date(tx.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
                          </div>
                        </motion.div>
                      ))}
                      {recentActivity.length === 0 && <div className="p-6 text-center text-muted-foreground text-sm font-medium">No recent operations.</div>}
                    </div>
                  </CardContent>
                </Card>

              </motion.div>

            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Drill-Down Modal */}
      <AnimatePresence>
        {selectedFuel && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50" onClick={() => setSelectedFuel(null)} />
            <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none p-4">
              <motion.div variants={modalVariants} initial="hidden" animate="visible" exit="exit" className="bg-card w-full max-w-lg rounded-2xl shadow-2xl border border-border/50 overflow-hidden pointer-events-auto">
                <div className="p-4 border-b border-border/50 flex justify-between items-center bg-secondary/30">
                  <h2 className="text-xl font-extrabold flex items-center gap-2"><Droplet className="text-primary"/> {selectedFuel} Analytics</h2>
                  <Button variant="ghost" size="icon" onClick={() => setSelectedFuel(null)} className="h-8 w-8 rounded-full"><X size={16}/></Button>
                </div>
                <div className="p-6 space-y-6">
                  {(() => {
                    const r = reports.find(r => r._id === selectedFuel);
                    const inv = inventory.find(i => i.fuelType === selectedFuel);
                    if (!r || !inv) return <p className="text-center text-muted-foreground">No data found.</p>;
                    
                    const margin = ((r.totalProfit / r.totalRevenue) * 100).toFixed(1);
                    return (
                      <>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="bg-secondary/50 p-4 rounded-xl border border-border/50">
                            <p className="text-xs text-muted-foreground font-bold uppercase mb-1">Total Revenue</p>
                            <p className="text-2xl font-black text-foreground">Rs {r.totalRevenue.toLocaleString()}</p>
                          </div>
                          <div className="bg-emerald-500/10 p-4 rounded-xl border border-emerald-500/20">
                            <p className="text-xs text-emerald-600 dark:text-emerald-400 font-bold uppercase mb-1">Gross Profit ({margin}%)</p>
                            <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400">Rs {r.totalProfit.toLocaleString()}</p>
                          </div>
                          <div className="bg-secondary/50 p-4 rounded-xl border border-border/50">
                            <p className="text-xs text-muted-foreground font-bold uppercase mb-1">Volume Sold</p>
                            <p className="text-2xl font-black text-foreground">{r.totalLitersSold.toFixed(1)} L</p>
                          </div>
                          <div className="bg-secondary/50 p-4 rounded-xl border border-border/50">
                            <p className="text-xs text-muted-foreground font-bold uppercase mb-1">Transactions</p>
                            <p className="text-2xl font-black text-foreground">{r.transactionCount}</p>
                          </div>
                        </div>
                        <div className="pt-4 border-t border-border/50">
                          <p className="text-sm font-bold mb-2">Inventory Status</p>
                          <div className="flex justify-between text-sm mb-1">
                            <span className="text-muted-foreground">Current Level</span>
                            <span className="font-bold">{inv.currentLevel.toLocaleString()} / {inv.capacity.toLocaleString()} L</span>
                          </div>
                          <div className="w-full bg-secondary rounded-full h-2 overflow-hidden border border-border/50">
                            <div className="bg-primary h-full" style={{ width: `${(inv.currentLevel / inv.capacity) * 100}%` }}></div>
                          </div>
                        </div>
                      </>
                    )
                  })()}
                </div>
              </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

// Recharts Custom Active Shape
const renderActiveShape = (props) => {
  const RADIAN = Math.PI / 180;
  const { cx, cy, midAngle, innerRadius, outerRadius, startAngle, endAngle, fill, payload, percent, value } = props;
  const sin = Math.sin(-RADIAN * midAngle); const cos = Math.cos(-RADIAN * midAngle);
  const sx = cx + (outerRadius + 10) * cos; const sy = cy + (outerRadius + 10) * sin;
  const mx = cx + (outerRadius + 20) * cos; const my = cy + (outerRadius + 20) * sin;
  const ex = mx + (cos >= 0 ? 1 : -1) * 22; const ey = my;
  const textAnchor = cos >= 0 ? 'start' : 'end';

  return (
    <g>
      <text x={cx} y={cy} dy={-8} textAnchor="middle" fill="var(--foreground)" fontSize={14} fontWeight="bold">{payload.name}</text>
      <text x={cx} y={cy} dy={12} textAnchor="middle" fill="var(--muted-foreground)" fontSize={12} fontWeight="600">{(percent * 100).toFixed(1)}%</text>
      <Sector cx={cx} cy={cy} innerRadius={innerRadius} outerRadius={outerRadius + 8} startAngle={startAngle} endAngle={endAngle} fill={fill} />
      <Sector cx={cx} cy={cy} startAngle={startAngle} endAngle={endAngle} innerRadius={outerRadius + 10} outerRadius={outerRadius + 12} fill={fill} />
      <path d={`M${sx},${sy}L${mx},${my}L${ex},${ey}`} stroke={fill} fill="none" />
      <circle cx={ex} cy={ey} r={2} fill={fill} stroke="none" />
      <text x={ex + (cos >= 0 ? 1 : -1) * 12} y={ey} textAnchor={textAnchor} fill="var(--foreground)" fontSize={12} fontWeight="bold">{`Rs ${(value/1000).toFixed(1)}k`}</text>
    </g>
  );
};

const StatCard = ({ icon, title, value, iconBg, alert }) => (
  <motion.div variants={itemVariants}>
    <Card className={`glass border-border/50 relative overflow-hidden group hover:shadow-md transition-shadow ${alert ? 'border-destructive/50 ring-1 ring-destructive/20' : ''}`}>
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
      <CardContent className="p-5 relative z-10 flex flex-col justify-between h-full gap-4">
        <div className="flex justify-between items-start">
          <div className={`p-2.5 rounded-xl ${iconBg} shadow-sm border border-border/50`}>{icon}</div>
        </div>
        <div>
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">{title}</p>
          <h3 className="text-2xl font-black text-foreground tracking-tight">{value}</h3>
        </div>
      </CardContent>
    </Card>
  </motion.div>
);

export default Dashboard;
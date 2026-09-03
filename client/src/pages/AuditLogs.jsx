import { useState, useEffect, useMemo, useCallback } from 'react';
import { ShieldAlert, Clock, User, Activity, Search, Trash2, Download, Network, Monitor, AlertOctagon, Table2, AlignLeft, ArrowDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { io } from 'socket.io-client';
import api from '../api/axios';
import { jsPDF } from 'jspdf';
import { toast } from 'react-hot-toast';
import autoTable from 'jspdf-autotable';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Card, CardTitle, CardHeader, CardContent } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';

// Setup socket connection
const socket = io(import.meta.env.VITE_API_URL || 'http://localhost:5000');

const AuditLogs = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fetchingMore, setFetchingMore] = useState(false);
  
  // Pagination & Backend Filter States
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [totalRecords, setTotalRecords] = useState(0);
  const [uniqueActions, setUniqueActions] = useState([]);

  // UI Filter States
  const [filterUser, setFilterUser] = useState('');
  const [filterDate, setFilterDate] = useState('');
  const [filterAction, setFilterAction] = useState('');

  // View Mode- 'table' or 'timeline'
  const [viewMode, setViewMode] = useState('table');

  const fetchLogs = useCallback(async (currentPage, isLoadMore = false) => {
    try {
      if (isLoadMore) setFetchingMore(true);
      else setLoading(true);

      const params = {
        page: currentPage,
        limit: 50,
      };
      if (filterUser) params.user = filterUser;
      if (filterDate) params.date = filterDate;
      if (filterAction) params.action = filterAction;

      const { data } = await api.get('/audit', { params });
      
      if (isLoadMore) {
        setLogs(prev => [...prev, ...data.logs]);
      } else {
        setLogs(data.logs);
      }
      
      setTotalRecords(data.total);
      setHasMore(data.page < data.totalPages);
      setUniqueActions(data.uniqueActions || []);
    } catch (error) {
      console.error('Error fetching audit logs', error);
    } finally {
      setLoading(false);
      setFetchingMore(false);
    }
  }, [filterUser, filterDate, filterAction]);

  useEffect(() => {
    // Whenever filters change, reset to page 1
    setPage(1);
    fetchLogs(1, false);
  }, [filterUser, filterDate, filterAction, fetchLogs]);

  useEffect(() => {
    // Listen for real-time audit logs
    socket.on('audit_log_created', (newLog) => {
      // Only append if it matches the current filters (basic client-side check)
      const matchesUser = filterUser ? newLog.user.toLowerCase().includes(filterUser.toLowerCase()) : true;
      const matchesAction = filterAction ? newLog.action === filterAction : true;
      let matchesDate = true;
      if (filterDate) {
        matchesDate = new Date(newLog.timestamp).toISOString().split('T')[0] === filterDate;
      }
      
      if (matchesUser && matchesAction && matchesDate) {
        setLogs((prevLogs) => [newLog, ...prevLogs]);
        setTotalRecords(prev => prev + 1);
      }
    });

    return () => {
      socket.off('audit_log_created');
    };
  }, [filterUser, filterDate, filterAction]);

  const loadMore = () => {
    if (!hasMore || fetchingMore) return;
    const nextPage = page + 1;
    setPage(nextPage);
    fetchLogs(nextPage, true);
  };

  // KPI Calculations (Based on currently loaded data or total if known)
  const highRiskActions = logs.filter(l => l.action.includes('DELETE') || l.action.includes('SUSPEND') || l.action.includes('OVERRIDE')).length;
  const uniqueIps = new Set(logs.map(l => l.ipAddress)).size;

  // Chart Data preparation (group by day)
  const chartData = useMemo(() => {
    const grouped = {};
    [...logs].reverse().forEach(log => {
      const date = new Date(log.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      grouped[date] = (grouped[date] || 0) + 1;
    });
    return Object.keys(grouped).map(key => ({ date: key, events: grouped[key] }));
  }, [logs]);

  const generatePDF = () => {
    if (logs.length === 0) return toast.error('No data to export');

    const doc = new jsPDF('landscape');
    doc.setFontSize(18);
    doc.text('Forensic Audit Trail', 14, 22);
    
    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 30);

    const tableColumn = ["Timestamp", "User", "Action", "Details", "IP Address"];
    const tableRows = logs.map(log => [
      new Date(log.timestamp).toLocaleString(),
      log.user,
      log.action,
      log.details,
      log.ipAddress || 'Unknown'
    ]);

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 40,
      theme: 'grid',
      headStyles: { fillColor: [220, 38, 38] }, // Red-600 for security
      styles: { fontSize: 9 }
    });

    doc.save(`Security_Audit_Report_${new Date().toISOString().split('T')[0]}.pdf`);
  };



  const getActionBadgeClass = (action) => {
    if (action.includes('DELETE') || action.includes('SUSPEND') || action.includes('OVERRIDE')) return 'bg-destructive/10 text-destructive border-destructive/20';
    if (action.includes('CREATE') || action.includes('ADD') || action.includes('LOGIN')) return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
    return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
  };

  return (
    <div className="flex flex-col gap-6 pb-8 max-w-[1600px] mx-auto">
      
      {/* KPI DASHBOARD */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="glass border-border/50 relative overflow-hidden group">
          <CardContent className="p-6">
            <div className="absolute right-[-10px] top-[-10px] opacity-5 text-foreground transition-opacity group-hover:opacity-10">
              <ShieldAlert size={120} />
            </div>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Total Events Found</p>
            <h3 className="text-4xl font-black">{totalRecords}</h3>
          </CardContent>
        </Card>
        
        <Card className="glass border-destructive/20 relative overflow-hidden group">
          <CardContent className="p-6">
            <div className="absolute right-[-10px] top-[-10px] opacity-5 text-destructive transition-opacity group-hover:opacity-10">
              <AlertOctagon size={120} />
            </div>
            <p className="text-xs font-bold text-destructive/80 uppercase tracking-wider mb-2">High-Risk (Loaded)</p>
            <h3 className="text-4xl font-black text-destructive">{highRiskActions}</h3>
          </CardContent>
        </Card>

        <Card className="glass border-border/50 relative overflow-hidden group md:col-span-2">
          <CardContent className="p-6 flex items-center justify-between h-full">
            <div>
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Unique IP Sources</p>
              <h3 className="text-4xl font-black text-indigo-500">{uniqueIps}</h3>
            </div>
            <div className="w-2/3 h-20">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="colorEvents" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#dc2626" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#dc2626" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <Tooltip contentStyle={{ backgroundColor: 'rgba(0,0,0,0.8)', border: 'none', borderRadius: '8px', color: '#fff', fontSize: '12px' }} />
                  <Area type="monotone" dataKey="events" stroke="#dc2626" strokeWidth={2} fillOpacity={1} fill="url(#colorEvents)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="glass border-border/50 overflow-hidden">
        {/* HEADER SECTION */}
        <CardHeader className="border-b border-border/50 bg-secondary/30">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-destructive/10 text-destructive rounded-lg shadow-inner">
                <ShieldAlert size={24} />
              </div>
              <div>
                <CardTitle className="text-xl">Forensic Audit Trail</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">Immutable ledger of sensitive administrative actions.</p>
              </div>
            </div>
            <div className="flex items-center gap-3 w-full sm:w-auto">
              
              {/* VIEW TOGGLE */}
              <div className="flex bg-secondary/50 rounded-lg p-1 border border-border/50">
                <Button 
                  size="sm" 
                  variant="ghost" 
                  onClick={() => setViewMode('table')} 
                  className={`h-8 px-3 rounded-md transition-all ${viewMode === 'table' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-background/50'}`}
                >
                  <Table2 size={16} className="mr-2"/> Table
                </Button>
                <Button 
                  size="sm" 
                  variant="ghost" 
                  onClick={() => setViewMode('timeline')} 
                  className={`h-8 px-3 rounded-md transition-all ${viewMode === 'timeline' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-background/50'}`}
                >
                  <AlignLeft size={16} className="mr-2"/> Timeline
                </Button>
              </div>

              <Button onClick={generatePDF} className="bg-destructive hover:bg-destructive/90 text-white gap-2 shadow-sm whitespace-nowrap h-10">
                <Download size={16} /> Export Forensic Report
              </Button>
            </div>
          </div>
        </CardHeader>

        {/* FILTERING BAR */}
        <div className="p-4 border-b border-border/50 bg-background/50 flex flex-col sm:flex-row gap-4 items-center justify-between">
          <div className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto">
            
            {/* User Search Input */}
            <div className="relative w-full sm:w-48">
              <Search className="absolute left-3 top-2.5 text-muted-foreground" size={16} />
              <Input 
                type="text" 
                placeholder="Filter user..." 
                className="pl-9 bg-card h-10"
                value={filterUser}
                onChange={(e) => setFilterUser(e.target.value)}
              />
            </div>

            {/* Action Filter */}
            <select 
              className="w-full sm:w-auto flex h-10 rounded-md border border-input bg-card px-3 py-2 text-sm text-foreground ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition-all"
              value={filterAction}
              onChange={(e) => setFilterAction(e.target.value)}
            >
              <option value="">All Actions</option>
              {uniqueActions.map(action => (
                <option key={action} value={action}>{action}</option>
              ))}
            </select>

            {/* Date Picker Input */}
            <div className="w-full sm:w-auto">
              <Input 
                type="date" 
                className="bg-card h-10"
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
              />
            </div>
          </div>

          {/* Clear Filters Button */}
          {(filterUser || filterDate || filterAction) && (
            <Button 
              variant="ghost"
              onClick={() => { setFilterUser(''); setFilterDate(''); setFilterAction(''); }}
              className="text-destructive hover:text-destructive hover:bg-destructive/10 whitespace-nowrap gap-2 font-bold"
            >
              <Trash2 size={16} /> Reset Filters
            </Button>
          )}
        </div>

        {/* MAIN CONTENT AREA */}
        <div className="overflow-y-auto overflow-x-auto h-[600px] no-scrollbar relative">
          
          {loading ? (
             <div className="h-full flex items-center justify-center">
              <div className="flex flex-col items-center gap-4">
                <svg className="animate-spin h-10 w-10 text-destructive" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <p className="text-muted-foreground font-medium animate-pulse">Loading secure audit trail...</p>
              </div>
            </div>
          ) : logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full p-16">
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-secondary/50 text-muted-foreground mb-4 shadow-inner">
                <ShieldAlert size={32} />
              </div>
              <p className="text-lg text-muted-foreground font-bold">
                No audit records match your current filters.
              </p>
            </div>
          ) : viewMode === 'table' ? (
            // TABLE VIEW
            <table className="w-full text-left border-collapse min-w-[800px]">
              <thead className="sticky top-0 bg-secondary/80 backdrop-blur-md shadow-sm z-10 border-b border-border/50">
                <tr className="text-muted-foreground text-[10px] font-black uppercase tracking-widest">
                  <th className="p-4 pl-6">Timestamp</th>
                  <th className="p-4">User</th>
                  <th className="p-4">Action Event</th>
                  <th className="p-4">Context & Details</th>
                  <th className="p-4 pr-6">Network Source</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                <AnimatePresence>
                  {logs.map((log, index) => (
                    <motion.tr 
                      key={log._id} 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ delay: index < 20 ? index * 0.02 : 0 }}
                      className="hover:bg-secondary/20 transition-colors group"
                    >
                      <td className="p-4 pl-6 text-foreground">
                        <div className="flex flex-col gap-1">
                          <div className="text-sm font-black text-foreground">
                            {new Date(log.timestamp).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                          </div>
                          <div className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground">
                            <Clock size={12}/>
                            {new Date(log.timestamp).toLocaleTimeString()}
                          </div>
                        </div>
                      </td>
                      
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-foreground font-bold shadow-inner">
                            {log.user.charAt(0).toUpperCase()}
                          </div>
                          <span className="font-bold text-sm">
                            {log.user}
                          </span>
                        </div>
                      </td>
                      
                      <td className="p-4">
                        <Badge variant="outline" className={`gap-1.5 px-2.5 py-1 uppercase text-[10px] tracking-wider font-black ${getActionBadgeClass(log.action)}`}>
                          <Activity size={12} />
                          {log.action}
                        </Badge>
                      </td>
                      
                      <td className="p-4 text-sm font-medium text-muted-foreground max-w-md">
                        {log.details}
                      </td>

                      <td className="p-4 pr-6 text-xs font-medium text-muted-foreground">
                        <div className="flex flex-col gap-1.5">
                          <div className="flex items-center gap-1.5">
                            <Network size={12} className="text-primary/50" />
                            <span className="font-bold font-mono group-hover:text-primary transition-colors cursor-help" title="Mock Geo: Colombo, Sri Lanka">
                              {log.ipAddress || 'Unknown'}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 text-[10px] opacity-70" title={log.userAgent}>
                            <Monitor size={12} />
                            <span className="truncate max-w-[150px]">{log.userAgent || 'Unknown device'}</span>
                          </div>
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
              </tbody>
            </table>
          ) : (
            // TIMELINE VIEW
            <div className="p-8 max-w-4xl mx-auto">
              <div className="relative border-l-2 border-border/50 ml-4 md:ml-0 md:left-1/2 md:-translate-x-1/2 space-y-12">
                <AnimatePresence>
                  {logs.map((log, index) => {
                    const isRight = index % 2 === 0;
                    const badgeClass = getActionBadgeClass(log.action);
                    
                    return (
                      <motion.div 
                        key={log._id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="relative flex items-center justify-between md:justify-normal w-full"
                      >
                        {/* Timeline Dot */}
                        <div className="absolute left-[-9px] md:left-1/2 md:-translate-x-1/2 w-4 h-4 rounded-full bg-background border-2 border-primary z-10 shadow-[0_0_10px_rgba(var(--primary),0.5)]"></div>
                        
                        {/* Content Card */}
                        <div className={`w-[calc(100%-2rem)] ml-8 md:ml-0 md:w-[calc(50%-2rem)] ${isRight ? 'md:pr-8 md:text-right md:mr-auto' : 'md:pl-8 md:ml-auto md:text-left'}`}>
                          <Card className="glass border-border/50 p-4 hover:border-primary/50 transition-colors group">
                            <div className={`flex flex-col gap-3 ${isRight ? 'md:items-end' : 'md:items-start'}`}>
                              
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className={`gap-1.5 px-2.5 py-1 uppercase text-[10px] tracking-wider font-black ${badgeClass}`}>
                                  {log.action}
                                </Badge>
                                <span className="text-xs font-bold text-muted-foreground flex items-center gap-1">
                                  <Clock size={12} />
                                  {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </div>

                              <p className="text-sm font-medium text-foreground">{log.details}</p>
                              
                              <div className={`flex items-center gap-4 text-xs font-bold text-muted-foreground mt-1 ${isRight ? 'md:justify-end' : 'md:justify-start'} w-full`}>
                                <div className="flex items-center gap-1.5 bg-secondary/50 px-2 py-1 rounded-md">
                                  <User size={12} className="text-primary"/> {log.user}
                                </div>
                                <div className="flex items-center gap-1.5 cursor-help" title="Mock Geo: Colombo, Sri Lanka">
                                  <Network size={12} className="text-indigo-500"/> {log.ipAddress}
                                </div>
                              </div>

                            </div>
                          </Card>
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            </div>
          )}

          {/* Load More Button */}
          {!loading && hasMore && (
            <div className="flex justify-center p-8 border-t border-border/50">
              <Button 
                onClick={loadMore} 
                disabled={fetchingMore}
                variant="outline"
                className="gap-2 bg-secondary/20 hover:bg-primary hover:text-primary-foreground border-primary/20 shadow-[0_0_15px_rgba(0,0,0,0.1)] rounded-full px-8"
              >
                {fetchingMore ? (
                  <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                ) : (
                  <ArrowDown size={16} />
                )}
                {fetchingMore ? 'Decoding records...' : 'Load Older Records'}
              </Button>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};

export default AuditLogs;
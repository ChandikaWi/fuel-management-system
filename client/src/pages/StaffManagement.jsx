import { useState, useEffect, useRef } from 'react';
import { UserPlus, Trash2, Shield, User, Search, Users, ShieldAlert, Lock, CheckCircle2, XCircle, KeyRound, AlertCircle, X, ChevronDown, Clock, Download, FileText, TrendingUp } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-hot-toast';
import api from '../api/axios';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Badge } from '../components/ui/Badge';

const StaffManagement = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({ username: '', password: '', role: 'Staff' });

  // Filtering States
  const [filterUsername, setFilterUsername] = useState('');
  const [filterRole, setFilterRole] = useState('');

  // Manager Override State
  const [showOverride, setShowOverride] = useState(false);
  const [overridePin, setOverridePin] = useState('');
  const [overrideAction, setOverrideAction] = useState({ type: null, user: null, payload: null });
  const pinInputRef = useRef(null);

  const fetchUsers = async () => {
    try {
      const { data } = await api.get('/users');
      setUsers(data);
    } catch (error) {
      console.error('Error fetching users', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);



  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.post('/users', formData);
      toast.success('User created successfully!');
      setFormData({ username: '', password: '', role: 'Staff' });
      fetchUsers();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Error creating user');
    }
  };

  const requestAction = (type, user, payload = null) => {
    setOverrideAction({ type, user, payload });
    setShowOverride(true);
    setTimeout(() => pinInputRef.current?.focus(), 100);
  };

  const handleVerifyOverride = async (e) => {
    e.preventDefault();
    if (overridePin === '1234') { 
      setShowOverride(false);
      setOverridePin('');
      await executeAction();
    } else {
      toast.error('Invalid Manager PIN. Access Denied.');
      setOverridePin('');
    }
  };

  const executeAction = async () => {
    const { type, user, payload } = overrideAction;
    try {
      if (type === 'DELETE') {
        await api.delete(`/users/${user._id}`);
        toast.success(`User ${user.username} deleted permanently.`);
      } else if (type === 'RESET_PASSWORD') {
        await api.put(`/users/${user._id}`, { password: payload.newPassword });
        toast.success(`Password reset successfully for ${user.username}.`);
      }
      setOverrideAction({ type: null, user: null, payload: null });
      fetchUsers(); 
    } catch (error) {
      console.error('Action error', error);
      toast.error(error.response?.data?.message || 'Action failed.');
    }
  };

  // Immediate actions (No PIN required for these specific inline updates by an Admin)
  const toggleSuspend = async (user) => {
    try {
      await api.put(`/users/${user._id}`, { isActive: !user.isActive });
      if (user.isActive) {
        toast.error(`Account ${user.username} suspended.`);
      } else {
        toast.success(`Account ${user.username} activated.`);
      }
      fetchUsers();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Error updating status');
    }
  };

  const changeRole = async (user, newRole) => {
    try {
      await api.put(`/users/${user._id}`, { role: newRole });
      toast.success(`Role updated to ${newRole} for ${user.username}.`);
      fetchUsers();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Error updating role');
    }
  };

  const filteredUsers = users.filter(user => {
    const matchesUsername = user.username.toLowerCase().includes(filterUsername.toLowerCase());
    const matchesRole = filterRole === '' || user.role === filterRole;
    return matchesUsername && matchesRole;
  });

  const getInitials = (name) => {
    return name.slice(0, 2).toUpperCase();
  };

  const formatRelativeTime = (dateStr) => {
    if (!dateStr) return 'Never logged in';
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 5) return 'Just now';
    if (diffMins < 60) return `${diffMins} mins ago`;
    if (diffHours < 24) return `${diffHours} hours ago`;
    if (diffDays === 1) return 'Yesterday';
    return `${diffDays} days ago`;
  };

  const generatePDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text('Staff Directory & Performance Report', 14, 22);
    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 30);

    const tableColumn = ["Personnel", "Role", "Status", "Last Seen", "Transactions"];
    const tableRows = [];

    filteredUsers.forEach(user => {
      const userData = [
        user.username,
        user.role,
        user.isActive === false ? 'Suspended' : 'Active',
        user.lastLogin ? new Date(user.lastLogin).toLocaleDateString() : 'Never',
        user.transactionCount || 0
      ];
      tableRows.push(userData);
    });

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 40,
      theme: 'grid',
      headStyles: { fillColor: [79, 70, 229] } 
    });

    doc.save('staff_directory.pdf');
  };

  // KPIs
  const activeCount = users.filter(u => u.isActive !== false).length;
  const adminCount = users.filter(u => u.role === 'Admin').length;
  const suspendedCount = users.filter(u => u.isActive === false).length;

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <svg className="animate-spin h-10 w-10 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <p className="text-muted-foreground font-medium animate-pulse">Loading staff directory...</p>
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
            <Users size={100} />
          </div>
          <CardContent className="p-6">
            <p className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-2">Total Active Personnel</p>
            <h3 className="text-4xl font-black text-foreground">{activeCount}</h3>
          </CardContent>
        </Card>
        <Card className="glass border-border/50 relative overflow-hidden group">
          <div className="absolute -right-4 -top-4 opacity-5 group-hover:opacity-10 text-emerald-500 transition-opacity">
            <Shield size={100} />
          </div>
          <CardContent className="p-6">
            <p className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-2">Administrators</p>
            <h3 className="text-4xl font-black text-emerald-500">{adminCount}</h3>
          </CardContent>
        </Card>
        <Card className="glass border-destructive/20 relative overflow-hidden group">
          <div className="absolute -right-4 -top-4 opacity-5 group-hover:opacity-10 text-destructive transition-opacity">
            <ShieldAlert size={100} />
          </div>
          <CardContent className="p-6">
            <p className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-2">Suspended Accounts</p>
            <h3 className="text-4xl font-black text-destructive">{suspendedCount}</h3>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Create User Form */}
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="w-full lg:w-1/3">
          <Card className="glass border-border/50 sticky top-6">
            <CardHeader className="border-b border-border/50 bg-secondary/20">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-500/10 text-indigo-500 rounded-lg">
                  <UserPlus size={24} />
                </div>
                <CardTitle>Create Account</CardTitle>
              </div>
            </CardHeader>
            
            <CardContent className="pt-6">


              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-muted-foreground uppercase">Username</label>
                  <div className="relative">
                    <User className="absolute left-3 top-3 text-muted-foreground" size={16} />
                    <Input 
                      type="text" required
                      className="pl-9 h-11 bg-background"
                      value={formData.username}
                      onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                      placeholder="e.g. JohnDoe"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-muted-foreground uppercase">Temporary Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 text-muted-foreground" size={16} />
                    <Input 
                      type="password" required minLength="6"
                      className="pl-9 h-11 bg-background"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      placeholder="Min 6 characters"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-muted-foreground uppercase">Privilege Level</label>
                  <select 
                    className="flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition-all"
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  >
                    <option value="Staff" className="bg-card text-foreground">Staff (POS & History Only)</option>
                    <option value="Admin" className="bg-card text-foreground">Admin (Full Access)</option>
                  </select>
                </div>
                <Button type="submit" className="w-full mt-2 py-6 text-base font-bold shadow-lg shadow-indigo-500/20 bg-indigo-600 hover:bg-indigo-700 text-white border-none">
                  Provision Account
                </Button>
              </form>
            </CardContent>
          </Card>
        </motion.div>

        {/* Staff List Table */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full lg:w-2/3">
          <Card className="glass border-border/50 overflow-hidden h-full flex flex-col">
            
            {/* Header */}
            <div className="p-6 border-b border-border/50 bg-secondary/20 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <CardTitle className="text-lg">Staff Directory</CardTitle>
              
              <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
                <div className="relative w-full sm:w-48">
                  <Search className="absolute left-3 top-2.5 text-muted-foreground" size={16} />
                  <Input 
                    type="text" 
                    placeholder="Search personnel..." 
                    className="pl-9 bg-background h-10"
                    value={filterUsername}
                    onChange={(e) => setFilterUsername(e.target.value)}
                  />
                </div>
                <select 
                  className="w-full sm:w-auto flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition-all"
                  value={filterRole}
                  onChange={(e) => setFilterRole(e.target.value)}
                >
                  <option value="">All Roles</option>
                  <option value="Admin">Admin</option>
                  <option value="Staff">Staff</option>
                </select>
                <Button 
                  onClick={generatePDF}
                  className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 text-white gap-2 shadow-sm"
                >
                  <Download size={16} /> Export PDF
                </Button>
              </div>
            </div>

            <div className="overflow-x-auto h-[600px] no-scrollbar">
              <table className="w-full text-left border-collapse min-w-[700px]">
                <thead className="sticky top-0 bg-secondary/80 backdrop-blur-md shadow-sm z-10 border-b border-border/50">
                  <tr className="text-muted-foreground text-xs uppercase tracking-wider font-bold">
                    <th className="p-4 pl-6">Personnel</th>
                    <th className="p-4">Status & Activity</th>
                    <th className="p-4">Performance</th>
                    <th className="p-4">Role & Access</th>
                    <th className="p-4 pr-6 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  <AnimatePresence>
                    {filteredUsers.map((user, index) => {
                      const isSuspended = user.isActive === false;
                      const avatarColor = user.role === 'Admin' ? 'bg-emerald-500' : 'bg-indigo-500';

                      return (
                        <motion.tr 
                          key={user._id} 
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, x: -20 }}
                          transition={{ delay: index * 0.05 }}
                          className={`transition-colors group ${isSuspended ? 'bg-destructive/5 hover:bg-destructive/10 opacity-75' : 'hover:bg-secondary/30'}`}
                        >
                          {/* Personnel Profile */}
                          <td className="p-4 pl-6">
                            <div className="flex items-center gap-3">
                              {user.profilePic ? (
                                <img src={user.profilePic} alt={user.username} className={`w-10 h-10 rounded-full object-cover border-2 ${isSuspended ? 'border-destructive grayscale' : `border-${avatarColor}`}`} />
                              ) : (
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-black text-sm shadow-inner ${isSuspended ? 'bg-destructive' : avatarColor}`}>
                                  {getInitials(user.username)}
                                </div>
                              )}
                              <div>
                                <div className={`font-black text-sm ${isSuspended ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                                  {user.username}
                                </div>
                                <div className="text-[10px] font-bold text-muted-foreground uppercase mt-0.5">ID: {user._id.slice(-6)}</div>
                              </div>
                            </div>
                          </td>

                          {/* Status & Activity */}
                          <td className="p-4">
                            <div className="mb-1.5">
                              {isSuspended ? (
                                <Badge className="bg-destructive/20 text-destructive hover:bg-destructive/30 border-none gap-1 py-0.5 px-2 text-[10px]">
                                  <XCircle size={10}/> SUSPENDED
                                </Badge>
                              ) : (
                                <Badge className="bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 border-none gap-1 py-0.5 px-2 text-[10px]">
                                  <CheckCircle2 size={10}/> ACTIVE
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
                              <Clock size={12} className={isSuspended ? 'text-destructive/50' : 'text-primary/50'}/> 
                              Seen {formatRelativeTime(user.lastLogin)}
                            </div>
                          </td>

                          {/* Performance Metrics */}
                          <td className="p-4">
                            <div className="flex items-center gap-2">
                              <div className={`p-1.5 rounded bg-blue-500/10 text-blue-500 ${isSuspended ? 'grayscale opacity-50' : ''}`}>
                                <TrendingUp size={16} />
                              </div>
                              <div>
                                <div className={`font-black text-sm ${isSuspended ? 'text-muted-foreground' : 'text-foreground'}`}>
                                  {user.transactionCount || 0}
                                </div>
                                <div className="text-[10px] font-bold text-muted-foreground uppercase">Sales Processed</div>
                              </div>
                            </div>
                          </td>

                          {/* Role & Access */}
                          <td className="p-4">
                            <div className="relative w-32">
                              {user.isSuperAdmin ? (
                                <div className="flex h-8 w-full items-center pl-3 pr-8 text-xs font-bold bg-amber-500/10 text-amber-500 border border-amber-500/30 rounded">
                                  👑 Core Admin
                                </div>
                              ) : (
                                <>
                                  <select 
                                    className={`w-full appearance-none flex h-8 rounded border bg-transparent pl-3 pr-8 text-xs font-bold ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition-all cursor-pointer ${user.role === 'Admin' ? 'text-emerald-500 border-emerald-500/30 bg-emerald-500/5' : 'text-indigo-500 border-indigo-500/30 bg-indigo-500/5'}`}
                                    value={user.role}
                                    onChange={(e) => changeRole(user, e.target.value)}
                                    disabled={isSuspended}
                                  >
                                    <option value="Admin" className="bg-card text-emerald-500">🛡️ Admin</option>
                                    <option value="Staff" className="bg-card text-indigo-500">👤 Staff</option>
                                  </select>
                                  <ChevronDown size={14} className="absolute right-2 top-2 pointer-events-none opacity-50" />
                                </>
                              )}
                            </div>
                          </td>

                          {/* Actions */}
                          <td className="p-4 pr-6 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1 transition-opacity">
                              <Button 
                                size="icon"
                                variant="ghost"
                                onClick={() => toggleSuspend(user)}
                                disabled={user.isSuperAdmin}
                                className={`w-8 h-8 rounded-md ${user.isSuperAdmin ? 'opacity-20 cursor-not-allowed text-muted-foreground' : isSuspended ? 'text-emerald-500 hover:bg-emerald-500/10' : 'text-amber-500 hover:bg-amber-500/10'}`}
                                title={user.isSuperAdmin ? "Super Admin cannot be suspended" : isSuspended ? 'Reactivate Account' : 'Suspend Account (Kill Switch)'}
                              >
                                {isSuspended ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
                              </Button>
                              <Button 
                                size="icon"
                                variant="ghost"
                                onClick={() => requestAction('RESET_PASSWORD', user, { newPassword: 'password123' })}
                                disabled={user.isSuperAdmin}
                                className={`w-8 h-8 rounded-md ${user.isSuperAdmin ? 'opacity-20 cursor-not-allowed text-muted-foreground' : 'text-primary hover:bg-primary/10'}`}
                                title={user.isSuperAdmin ? "Super Admin password cannot be reset remotely" : "Reset Password to 'password123'"}
                              >
                                <KeyRound size={16} />
                              </Button>
                              <Button 
                                size="icon"
                                variant="ghost"
                                onClick={() => requestAction('DELETE', user)}
                                disabled={user.isSuperAdmin}
                                className={`w-8 h-8 rounded-md ${user.isSuperAdmin ? 'opacity-20 cursor-not-allowed text-muted-foreground' : 'text-destructive hover:bg-destructive/10'}`}
                                title={user.isSuperAdmin ? "Super Admin cannot be deleted" : "Permanently Delete Account"}
                              >
                                <Trash2 size={16} />
                              </Button>
                            </div>
                          </td>
                        </motion.tr>
                      );
                    })}
                  </AnimatePresence>
                  
                  {filteredUsers.length === 0 && (
                    <tr>
                      <td colSpan="5" className="p-16 text-center">
                        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-secondary/50 text-muted-foreground mb-4">
                          <Users size={24} />
                        </div>
                        <p className="text-muted-foreground font-bold">
                          {users.length === 0 ? 'No personnel data found.' : 'No users match your filters.'}
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
            <motion.div initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0, y: -20 }} className={`bg-card w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden border flex flex-col ${overrideAction.type === 'DELETE' ? 'border-destructive/50' : 'border-primary/50'}`}>
              <div className={`${overrideAction.type === 'DELETE' ? 'bg-destructive' : 'bg-primary'} p-6 text-center text-white relative`}>
                <div className="absolute top-3 right-3 cursor-pointer p-1 bg-black/20 hover:bg-black/30 rounded-full transition-colors" onClick={() => setShowOverride(false)}><X size={16}/></div>
                {overrideAction.type === 'DELETE' ? (
                  <ShieldAlert size={48} className="mx-auto mb-3 opacity-90" />
                ) : (
                  <KeyRound size={48} className="mx-auto mb-3 opacity-90" />
                )}
                <h3 className="text-xl font-black tracking-tight">Manager Override</h3>
                <p className="text-sm opacity-80 mt-1">
                  {overrideAction.type === 'DELETE' ? `Authorization required to delete ${overrideAction.user?.username}` : `Authorization required to reset password for ${overrideAction.user?.username}`}
                </p>
              </div>
              <div className="p-8 pb-10 bg-card flex-1 flex flex-col justify-center">
                <form onSubmit={handleVerifyOverride}>
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3 block text-center">Enter 4-Digit PIN</label>
                  <Input ref={pinInputRef} type="password" required maxLength={4} className="text-center text-4xl tracking-[1em] font-black h-16 bg-background border-border/50 mb-6" value={overridePin} onChange={(e) => setOverridePin(e.target.value)} placeholder="••••" />
                  <Button type="submit" className="w-full gap-2 py-6 text-lg font-black shadow-lg" variant={overrideAction.type === 'DELETE' ? 'destructive' : 'default'}>
                    <Lock size={18}/> {overrideAction.type === 'DELETE' ? 'Verify & Delete' : 'Verify & Reset'}
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

export default StaffManagement;
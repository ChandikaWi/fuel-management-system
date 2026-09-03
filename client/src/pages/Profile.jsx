import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Lock, Camera, Trash2, CheckCircle, AlertCircle, ShieldAlert, Save, UserCircle, Shield, Activity as ActivityIcon, Smartphone, Mail, AlertTriangle, Monitor, Clock, Check, Download } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-hot-toast';
import api from '../api/axios';
import ConfirmModal from '../components/ui/ConfirmModal';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Badge } from '../components/ui/Badge';

const Profile = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  
  const [username, setUsername] = useState(localStorage.getItem('username') || '');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [deletePassword, setDeletePassword] = useState('');
  const [profilePic, setProfilePic] = useState(localStorage.getItem('profilePic') || '');
  const userRole = localStorage.getItem('role');
  const originalUsername = localStorage.getItem('username');

  const [loading, setLoading] = useState(false);
  
  // Modal states
  const [isRemovePicModalOpen, setIsRemovePicModalOpen] = useState(false);
  const [isDeleteAccountModalOpen, setIsDeleteAccountModalOpen] = useState(false);
  
  const [activeTab, setActiveTab] = useState('general');
  const [recentLogins, setRecentLogins] = useState([]);
  const [loadingLogins, setLoadingLogins] = useState(false);

  const isSuperAdmin = localStorage.getItem('isSuperAdmin') === 'true';

  // Fetch recent logins when Activity tab is active
  useEffect(() => {
    if (activeTab === 'activity') {
      const fetchLogins = async () => {
        setLoadingLogins(true);
        try {
          const { data } = await api.get('/audit', {
            params: { user: username, action: 'USER_LOGIN', limit: 3 }
          });
          setRecentLogins(data.logs || []);
        } catch (error) {
          console.error("Failed to fetch recent logins", error);
        } finally {
          setLoadingLogins(false);
        }
      };
      fetchLogins();
    }
  }, [activeTab, username]);

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 1024 * 1024) { 
        return toast.error('Image is too large. Please select a picture under 1MB.');
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setProfilePic(reader.result); 
      };
      reader.readAsDataURL(file);
    }
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = { username, profilePic };
      
      const isChangingUsername = username !== originalUsername;
      if (isChangingUsername || password) {
        if (!currentPassword) {
          return toast.error('Current password is required to save sensitive changes.');
        }
        payload.currentPassword = currentPassword;
      }
      
      if (password) {
        if (password !== confirmPassword) {
          return toast.error('New passwords do not match.');
        }
        payload.password = password; 
      }

      const { data } = await api.put('/users/profile', payload);
      
      localStorage.setItem('username', data.username);
      if (data.profilePic) {
        localStorage.setItem('profilePic', data.profilePic);
      } else {
        localStorage.removeItem('profilePic');
      }
      
      setPassword(''); 
      setConfirmPassword('');
      setCurrentPassword('');
      toast.success('Profile updated successfully!');
      setTimeout(() => window.location.reload(), 1000); 
    } catch (error) {
      toast.error(error.response?.data?.message || 'Error updating profile');
    } finally {
      setLoading(false);
    }
  };

  const handleRemovePicture = async () => {
    setLoading(true);
    try {
      await api.put('/users/profile', { username, profilePic: '' });
      setProfilePic('');
      localStorage.removeItem('profilePic');
      toast.success('Profile picture removed successfully!');
      setTimeout(() => window.location.reload(), 1000);
    } catch (_error) {
      toast.error('Error removing picture');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    try {
      await api.delete('/users/profile', { data: { currentPassword: deletePassword } });
      localStorage.clear();
      navigate('/');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Error deleting account');
    }
  };

  const attemptDeleteAccount = () => {
    if (isSuperAdmin) {
      return toast.error("CRITICAL: The Super Admin account cannot be deleted.");
    }

    if (!deletePassword) {
      return toast.error("You must enter your current password to delete your account.");
    }

    setIsDeleteAccountModalOpen(true);
  };

  const handleDownloadData = async () => {
    try {
      const { data: auditData } = await api.get('/audit', { params: { user: username } });
      const exportData = {
        identity: {
          username: username,
          role: userRole,
          accountCreated: "Available in DB", 
        },
        securityEvents: auditData.logs || []
      };
      
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `FuelMaster_Data_Export_${username}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Your GDPR data package has been downloaded successfully.");
    } catch (_error) {
      toast.error("Error generating data export.");
    }
  };

  // Password Strength Logic
  const getPasswordStrength = (pass) => {
    if (!pass) return 0;
    let strength = 0;
    if (pass.length > 5) strength += 33;
    if (pass.match(/[A-Z]/) && pass.match(/[0-9]/)) strength += 33;
    if (pass.match(/[^A-Za-z0-9]/)) strength += 34;
    return strength;
  };

  const passwordStrength = getPasswordStrength(password);
  const getStrengthColor = () => {
    if (passwordStrength === 0) return 'bg-border';
    if (passwordStrength < 50) return 'bg-red-500';
    if (passwordStrength < 90) return 'bg-yellow-500';
    return 'bg-emerald-500';
  };
  const getStrengthLabel = () => {
    if (passwordStrength === 0) return '';
    if (passwordStrength < 50) return 'Weak';
    if (passwordStrength < 90) return 'Medium';
    return 'Strong';
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-12">
      
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-1">
        <h1 className="text-3xl font-extrabold text-foreground tracking-tight">Account Settings</h1>
        <p className="text-muted-foreground font-medium">Manage your identity, security preferences and system access.</p>
      </motion.div>



      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
        
        {/* LEFT COLUMN- IDENTITY CARD */}
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="xl:col-span-4 space-y-6">
          <Card className="glass border-border/50 overflow-hidden relative group/card p-0">
            
            <div className="h-36 bg-gradient-to-tr from-primary/80 via-primary to-primary/40 relative overflow-hidden">
              <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff1a_1px,transparent_1px),linear-gradient(to_bottom,#ffffff1a_1px,transparent_1px)] bg-[size:14px_24px]"></div>
              {/* Animated particles mock */}
              <div className="absolute top-4 left-4 w-2 h-2 bg-white/40 rounded-full animate-ping"></div>
              <div className="absolute bottom-8 right-12 w-3 h-3 bg-white/20 rounded-full animate-pulse"></div>
            </div>

            <div className="px-6 pb-8 relative flex flex-col items-center text-center">
              
              <div className="relative group cursor-pointer -mt-16 mb-5" onClick={() => fileInputRef.current.click()}>
                <div className="w-32 h-32 rounded-full overflow-hidden bg-background border-[6px] border-background shadow-xl flex items-center justify-center relative z-10 transition-transform duration-300 group-hover:scale-105">
                  {profilePic ? (
                    <img src={profilePic} alt="Profile" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-secondary flex items-center justify-center">
                      <span className="text-5xl font-black text-primary uppercase">{username.charAt(0)}</span>
                    </div>
                  )}
                </div>
                
                <div className="absolute inset-0 bg-background/60 rounded-full flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 z-20 backdrop-blur-sm">
                  <Camera className="text-foreground mb-1" size={26} />
                  <span className="text-foreground text-xs font-bold tracking-wider uppercase">Update</span>
                </div>
              </div>
              
              <input 
                type="file" 
                accept="image/*" 
                className="hidden" 
                ref={fileInputRef} 
                onChange={handleImageChange} 
              />
              
              <h2 className="text-2xl font-bold text-foreground tracking-tight">{username}</h2>
              
              <div className="mt-3 flex flex-wrap justify-center gap-2">
                <Badge variant={userRole === 'Admin' ? 'success' : 'primary'} className="uppercase tracking-widest gap-1.5 px-3 py-1">
                  {userRole === 'Admin' ? <ShieldAlert size={14}/> : <User size={14}/>}
                  {userRole}
                </Badge>
                {isSuperAdmin && (
                  <Badge variant="outline" className="uppercase tracking-widest gap-1.5 px-3 py-1 border-primary/50 text-primary">
                    <Shield size={14}/> Core Admin
                  </Badge>
                )}
              </div>
              
              <p className="text-sm text-muted-foreground mt-5 leading-relaxed px-4">
                Click your avatar to upload a new profile picture. Recommended size: 500x500px (Max 1MB).
              </p>

              {profilePic && (
                <div className="mt-6 w-full pt-6 border-t border-border/50">
                  <Button 
                    type="button"
                    variant="destructive"
                    onClick={() => setIsRemovePicModalOpen(true)}
                    disabled={loading}
                    className="w-full gap-2 bg-destructive/10 text-destructive hover:bg-destructive/20 border border-destructive/20"
                  >
                    <Trash2 size={18} /> Remove Current Photo
                  </Button>
                </div>
              )}
            </div>
          </Card>
        </motion.div>

        {/* RIGHT COLUMN- TABBED INTERFACE */}
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="xl:col-span-8 space-y-8">
          
          {/* Custom Tabs */}
          <div className="flex bg-secondary/50 p-1.5 rounded-xl border border-border/50 shadow-inner overflow-x-auto no-scrollbar">
            <button 
              onClick={() => setActiveTab('general')}
              className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-lg font-bold text-sm transition-all whitespace-nowrap ${activeTab === 'general' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground hover:bg-background/50'}`}
            >
              <UserCircle size={18} /> General Identity
            </button>
            <button 
              onClick={() => setActiveTab('security')}
              className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-lg font-bold text-sm transition-all whitespace-nowrap ${activeTab === 'security' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground hover:bg-background/50'}`}
            >
              <Shield size={18} /> Security & Access
            </button>
            <button 
              onClick={() => setActiveTab('activity')}
              className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-lg font-bold text-sm transition-all whitespace-nowrap ${activeTab === 'activity' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground hover:bg-background/50'}`}
            >
              <ActivityIcon size={18} /> Recent Activity
            </button>
          </div>

          <AnimatePresence mode="wait">
            
            {/* GENERAL TAB */}
            {activeTab === 'general' && (
              <motion.div key="general" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
                <Card className="glass border-border/50 overflow-hidden">
                  <CardHeader className="bg-secondary/30 border-b border-border/50">
                    <CardTitle>Profile Details</CardTitle>
                    <CardDescription>Update your public facing identity within the system.</CardDescription>
                  </CardHeader>
                  <CardContent className="p-6 sm:p-8">
                    <form onSubmit={handleUpdateProfile} className="space-y-8">
                      <div className="space-y-2.5 max-w-md">
                        <label className="text-sm font-bold text-foreground ml-1">Assigned Username</label>
                        <div className="relative group">
                          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-muted-foreground group-focus-within:text-primary transition-colors">
                            <User size={20} />
                          </div>
                          <Input 
                            type="text" required
                            className="pl-12 py-6 text-base font-semibold bg-card"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            disabled={isSuperAdmin} // Prevent renaming super admin
                          />
                        </div>
                        {isSuperAdmin && (
                          <p className="text-xs text-muted-foreground font-semibold flex items-center gap-1.5 mt-2">
                            <AlertTriangle size={12} className="text-yellow-500" /> Super Admin username cannot be changed.
                          </p>
                        )}
                      </div>

                      {username !== originalUsername && (
                        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="space-y-2.5 max-w-md">
                          <label className="text-sm font-bold text-foreground ml-1 text-destructive">Current Password Required</label>
                          <div className="relative group">
                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-muted-foreground group-focus-within:text-primary transition-colors">
                              <Lock size={20} />
                            </div>
                            <Input 
                              type="password" required
                              className="pl-12 py-6 text-base bg-card border-destructive/50 focus:border-destructive"
                              placeholder="Enter password to verify identity"
                              value={currentPassword}
                              onChange={(e) => setCurrentPassword(e.target.value)}
                            />
                          </div>
                        </motion.div>
                      )}

                      <div className="pt-6 border-t border-border/50 flex flex-col sm:flex-row justify-between items-center gap-4">
                        <Button 
                          type="button" 
                          variant="outline"
                          onClick={handleDownloadData}
                          className="py-6 px-6 gap-2 text-sm text-primary hover:bg-primary/10 border-primary/20 w-full sm:w-auto"
                        >
                          <Download size={16} /> Download My Data (GDPR)
                        </Button>
                        <Button 
                          type="submit" 
                          disabled={loading || (username !== originalUsername && !currentPassword)} 
                          className="py-6 px-8 gap-2.5 text-base shadow-lg shadow-primary/20 w-full sm:w-auto"
                        >
                          <Save size={18} />
                          {loading ? 'Saving Changes...' : 'Save Profile Changes'}
                        </Button>
                      </div>
                    </form>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* SECURITY TAB */}
            {activeTab === 'security' && (
              <motion.div key="security" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-8">
                
                {/* Password Change */}
                <Card className="glass border-border/50 overflow-hidden">
                  <CardHeader className="bg-secondary/30 border-b border-border/50">
                    <CardTitle>Authentication</CardTitle>
                    <CardDescription>Update your secure password.</CardDescription>
                  </CardHeader>
                  <CardContent className="p-6 sm:p-8">
                    <form onSubmit={handleUpdateProfile} className="space-y-6">
                      <div className="space-y-2.5 max-w-md">
                        <label className="text-sm font-bold text-foreground ml-1">New Password</label>
                        <div className="relative group">
                          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-muted-foreground group-focus-within:text-primary transition-colors">
                            <Lock size={20} />
                          </div>
                          <Input 
                            type="password"
                            className="pl-12 py-6 text-base bg-card"
                            placeholder="Leave blank to keep current"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                          />
                        </div>
                        
                        <AnimatePresence>
                          {password && (
                            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="space-y-6 pt-4">
                              <div className="space-y-2.5">
                                <label className="text-sm font-bold text-foreground ml-1">Confirm New Password</label>
                                <div className="relative group">
                                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-muted-foreground group-focus-within:text-primary transition-colors">
                                    <Lock size={20} />
                                  </div>
                                  <Input 
                                    type="password"
                                    className={`pl-12 py-6 text-base bg-card ${password && confirmPassword && password !== confirmPassword ? 'border-destructive' : ''}`}
                                    placeholder="Confirm new password"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                  />
                                </div>
                                {password && confirmPassword && password !== confirmPassword && (
                                  <p className="text-xs text-destructive font-bold ml-1">Passwords do not match!</p>
                                )}
                              </div>

                              <div className="space-y-2.5">
                                <label className="text-sm font-bold text-destructive ml-1">Current Password Required</label>
                                <div className="relative group">
                                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-muted-foreground group-focus-within:text-primary transition-colors">
                                    <Lock size={20} />
                                  </div>
                                  <Input 
                                    type="password" required={!!password}
                                    className="pl-12 py-6 text-base bg-card border-destructive/50 focus:border-destructive"
                                    placeholder="Enter current password to authorize"
                                    value={currentPassword}
                                    onChange={(e) => setCurrentPassword(e.target.value)}
                                  />
                                </div>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>

                        {/* Password Strength Meter */}
                        {password && (
                          <div className="pt-2 space-y-1">
                            <div className="flex justify-between items-center text-xs font-bold">
                              <span className="text-muted-foreground">Password Strength</span>
                              <span className={passwordStrength < 50 ? 'text-red-500' : passwordStrength < 90 ? 'text-yellow-500' : 'text-emerald-500'}>
                                {getStrengthLabel()}
                              </span>
                            </div>
                            <div className="h-1.5 w-full bg-secondary rounded-full overflow-hidden">
                              <motion.div 
                                className={`h-full ${getStrengthColor()}`}
                                initial={{ width: 0 }}
                                animate={{ width: `${passwordStrength}%` }}
                                transition={{ ease: 'easeOut', duration: 0.3 }}
                              ></motion.div>
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="pt-4 border-t border-border/50 flex justify-end">
                        <Button 
                          type="submit" 
                          disabled={loading || (password && passwordStrength < 50) || (password && password !== confirmPassword) || (password && !currentPassword)} 
                          className="py-6 px-8 gap-2.5 text-base"
                        >
                          <Save size={18} /> Update Password
                        </Button>
                      </div>
                    </form>
                  </CardContent>
                </Card>

                {/* DANGER ZONE */}
                {!isSuperAdmin ? (
                  <Card className="glass border-destructive/30 overflow-hidden relative group/danger bg-destructive/5">
                    <div className="absolute inset-0 bg-[repeating-linear-gradient(-45deg,transparent,transparent_10px,rgba(220,38,38,0.03)_10px,rgba(220,38,38,0.03)_20px)] opacity-60 pointer-events-none transition-opacity group-hover/danger:opacity-100"></div>
                    <CardContent className="p-6 sm:p-8 relative z-10">
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
                        <div className="space-y-1">
                          <h3 className="text-xl font-extrabold text-destructive flex items-center gap-2.5">
                            <ShieldAlert size={24} className="text-destructive" />
                            Danger Zone
                          </h3>
                          <p className="text-sm text-destructive/80 max-w-md font-bold leading-relaxed">
                            Permanently erase your identity from the Fuel Master system. This action bypasses the trash and cannot be undone.
                          </p>
                        </div>
                        
                        <div className="flex flex-col gap-3 w-full sm:w-auto">
                          <Input 
                            type="password"
                            placeholder="Enter password to confirm"
                            className="bg-background border-destructive/50 focus:border-destructive w-full sm:w-64"
                            value={deletePassword}
                            onChange={(e) => setDeletePassword(e.target.value)}
                          />
                          <Button 
                            variant="destructive"
                            onClick={attemptDeleteAccount}
                            disabled={!deletePassword}
                            className="shrink-0 bg-transparent border-2 border-destructive text-destructive hover:bg-destructive hover:text-white py-5 px-6 gap-2 w-full"
                          >
                            <Trash2 size={18} /> Delete Account
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ) : (
                  <Card className="border-border/50 bg-secondary/20 border-dashed">
                    <CardContent className="p-6 text-center">
                      <Shield className="mx-auto text-primary/50 mb-3" size={32} />
                      <h3 className="text-lg font-bold text-foreground">Super Admin Locked</h3>
                      <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
                        This is the core administrative account. It cannot be suspended, demoted, or deleted by any user in the system.
                      </p>
                    </CardContent>
                  </Card>
                )}

              </motion.div>
            )}

            {/* ACTIVITY TAB */}
            {activeTab === 'activity' && (
              <motion.div key="activity" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
                <Card className="glass border-border/50 overflow-hidden">
                  <CardHeader className="bg-secondary/30 border-b border-border/50">
                    <div className="flex justify-between items-center">
                      <div>
                        <CardTitle>Recent Login Activity</CardTitle>
                        <CardDescription>Track where and when your account is being accessed.</CardDescription>
                      </div>
                      <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
                        Live Sync
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0">
                    {loadingLogins ? (
                      <div className="flex flex-col items-center justify-center p-12 text-muted-foreground">
                        <ActivityIcon size={32} className="animate-spin text-primary mb-4 opacity-50" />
                        <p className="font-bold text-sm">Fetching audit logs...</p>
                      </div>
                    ) : recentLogins.length > 0 ? (
                      <div className="divide-y divide-border/50">
                        {recentLogins.map((log) => (
                          <div key={log._id} className="p-6 hover:bg-secondary/20 transition-colors flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                            <div className="flex items-center gap-4">
                              <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
                                <Monitor size={20} />
                              </div>
                              <div>
                                <h4 className="font-bold text-foreground text-sm flex items-center gap-2">
                                  {log.ipAddress || 'Unknown IP'} 
                                  <Badge variant="secondary" className="text-[10px] py-0 px-1.5 h-4">SUCCESS</Badge>
                                </h4>
                                <p className="text-xs text-muted-foreground mt-1 font-medium">{log.userAgent || 'Unknown Device/Browser'}</p>
                              </div>
                            </div>
                            <div className="text-right flex items-center gap-2 text-xs font-bold text-muted-foreground bg-secondary/50 px-3 py-1.5 rounded-lg border border-border/50">
                              <Clock size={14} />
                              {new Date(log.timestamp).toLocaleString(undefined, {
                                month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-12 text-center text-muted-foreground font-medium">
                        No recent logins found in the audit trail.
                      </div>
                    )}
                    <div className="p-4 bg-secondary/30 border-t border-border/50 text-center">
                      <p className="text-xs text-muted-foreground font-semibold flex items-center justify-center gap-1.5">
                        <ShieldAlert size={12} /> Don't recognize an IP? Update your password immediately.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}

          </AnimatePresence>
        </motion.div>
      </div>
      
      {/* Modals */}
      <ConfirmModal
        isOpen={isRemovePicModalOpen}
        onClose={() => setIsRemovePicModalOpen(false)}
        onConfirm={handleRemovePicture}
        title="Remove Profile Picture"
        description="Are you sure you want to remove your profile picture? You will revert to the default initial avatar."
        confirmText="Remove Picture"
        isDanger={true}
        icon={Trash2}
      />
      
      <ConfirmModal
        isOpen={isDeleteAccountModalOpen}
        onClose={() => setIsDeleteAccountModalOpen(false)}
        onConfirm={handleDeleteAccount}
        title="Delete Account"
        description="⚠️ DANGER: Are you absolutely sure you want to delete your account? You will be immediately logged out and lose access to the system. This cannot be undone."
        confirmText="Yes, Delete My Account"
        isDanger={true}
        icon={ShieldAlert}
      />
    </div>
  );
};

export default Profile;
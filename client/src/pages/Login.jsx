import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { User, Lock, Eye, EyeOff, AlertCircle, Droplet, LogIn, ShieldCheck, Fuel } from 'lucide-react';
import { motion } from 'framer-motion';
import api from '../api/axios';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';

const Login = () => {
  const [credentials, setCredentials] = useState({ username: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    
    try {
      const { data } = await api.post('/auth/login', credentials);
      localStorage.setItem('token', data.token);
      localStorage.setItem('role', data.role);
      localStorage.setItem('username', data.username);
      localStorage.setItem('isSuperAdmin', data.isSuperAdmin);
      
      if (data.profilePic) {
        localStorage.setItem('profilePic', data.profilePic);
      } else {
        localStorage.removeItem('profilePic');
      }
      
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid credentials or server error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex w-full bg-background font-sans transition-colors duration-300">
      
      {/* Left Form Section */}
      <div className="w-full lg:w-1/2 flex flex-col justify-center px-8 sm:px-16 md:px-24 xl:px-32 relative z-10 bg-background text-foreground">
        
        {/* Mobile Header */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute top-8 left-8 flex items-center gap-2.5 lg:hidden"
        >
          <div className="p-2 bg-primary rounded-lg shadow-sm">
            <Fuel size={20} className="text-primary-foreground fill-primary-foreground" />
          </div>
          <span className="text-xl font-extrabold tracking-tight">FuelMaster</span>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, x: -50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
          className="max-w-md w-full mx-auto"
        >
          <div className="mb-10 text-center lg:text-left">
            <h1 className="text-3xl sm:text-4xl font-extrabold mb-3 tracking-tight">Welcome Back</h1>
            <p className="text-muted-foreground font-medium">Enter your credentials to access the system.</p>
          </div>

          {error && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="mb-8 p-4 bg-destructive/10 border border-destructive/20 text-destructive rounded-xl flex items-start gap-3 text-sm font-bold shadow-sm"
            >
              <AlertCircle size={20} className="shrink-0 mt-0.5" />
              <p>{error}</p>
            </motion.div>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            
            <div className="space-y-2">
              <label className="text-sm font-bold ml-1">Username</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-muted-foreground group-focus-within:text-primary transition-colors">
                  <User size={20} />
                </div>
                <Input
                  type="text"
                  required
                  className="pl-12 py-6 text-base"
                  placeholder="Enter your username"
                  value={credentials.username}
                  onChange={(e) => setCredentials({ ...credentials, username: e.target.value })}
                  disabled={loading}
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center ml-1">
                <label className="text-sm font-bold">Password</label>
              </div>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-muted-foreground group-focus-within:text-primary transition-colors">
                  <Lock size={20} />
                </div>
                <Input
                  type={showPassword ? "text" : "password"}
                  required
                  className="pl-12 pr-12 py-6 text-base"
                  placeholder="••••••••"
                  value={credentials.password}
                  onChange={(e) => setCredentials({ ...credentials, password: e.target.value })}
                  disabled={loading}
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-4 flex items-center text-muted-foreground hover:text-primary focus:outline-none transition-colors"
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex="-1" 
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              isLoading={loading}
              className="w-full py-6 rounded-xl text-base flex items-center justify-center gap-2.5 mt-8"
            >
              {!loading && <LogIn size={20} />}
              {loading ? 'Authenticating...' : 'Sign In'}
            </Button>
            
            <div className="text-center mt-6 text-sm text-muted-foreground font-medium">
              Only authorized staff can access the system. Contact your administrator if you need an account.
            </div>
          </form>

          <div className="mt-12 pt-6 border-t border-border flex items-center justify-between text-xs font-semibold text-muted-foreground">
            <span>&copy; {new Date().getFullYear()} FuelMaster</span>
            <div className="flex items-center gap-1">
              <ShieldCheck size={14} className="text-emerald-500" />
              <span>Encrypted Session</span>
            </div>
          </div>

        </motion.div>
      </div>

      {/* Right Graphic Section */}
      <div className="hidden lg:flex w-1/2 relative bg-slate-900 dark:bg-slate-950 overflow-hidden items-center justify-center">
        
        {/* Abstract Backgrounds */}
        <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-primary/20 dark:from-slate-950 dark:via-slate-900 dark:to-primary/20"></div>
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff08_1px,transparent_1px),linear-gradient(to_bottom,#ffffff08_1px,transparent_1px)] bg-[size:24px_24px]"></div>

        <motion.div 
          animate={{ scale: [1, 1.05, 1], rotate: [0, 5, 0] }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] bg-primary/20 rounded-full mix-blend-screen filter blur-[100px]"
        ></motion.div>
        
        <motion.div 
          animate={{ scale: [1, 1.1, 1], rotate: [0, -5, 0] }}
          transition={{ duration: 12, repeat: Infinity, ease: "easeInOut", delay: 1 }}
          className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] bg-emerald-500/10 rounded-full mix-blend-screen filter blur-[100px]"
        ></motion.div>

        <div className="relative z-20 flex flex-col items-center text-center px-12">
          
          <motion.div 
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", duration: 1.5, bounce: 0.5 }}
            className="w-24 h-24 mb-8 bg-white/10 backdrop-blur-md border border-white/20 rounded-3xl flex items-center justify-center shadow-2xl shadow-black/50"
          >
            <Fuel size={48} className="text-primary fill-primary/50" />
          </motion.div>

          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="text-4xl xl:text-6xl font-black text-white mb-6 tracking-tight drop-shadow-lg font-sans"
          >
            FuelMaster
            <span className="block text-transparent bg-clip-text bg-gradient-to-r from-primary to-emerald-400 mt-2 text-3xl xl:text-4xl font-extrabold">
              Enterprise System
            </span>
          </motion.h2>
          
          <motion.p 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="text-lg text-slate-300 max-w-md mx-auto font-medium leading-relaxed"
          >
            The intelligent operating system for modern fuel station management, inventory tracking and point-of-sale operations.
          </motion.p>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
            className="mt-12 flex gap-6"
          >
            <div className="flex items-center gap-2 bg-slate-800/50 border border-slate-700 px-4 py-2 rounded-full backdrop-blur-sm">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">Speed Systems</span>
            </div>
            <div className="flex items-center gap-2 bg-slate-800/50 border border-slate-700 px-4 py-2 rounded-full backdrop-blur-sm">
              <span className="w-2 h-2 rounded-full bg-primary animate-pulse" style={{ animationDelay: '1s' }}></span>
              <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">Data Security</span>
            </div>
          </motion.div>

        </div>
      </div>

    </div>
  );
};

export default Login;
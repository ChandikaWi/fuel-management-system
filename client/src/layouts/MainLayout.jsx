import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Droplet, Receipt, LogOut, Menu, History, Truck, ShieldCheck, Users, X } from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Logo } from '../components/ui/Logo';
import { ThemeToggle } from '../components/ui/ThemeToggle';
import { Button } from '../components/ui/Button';
import { toast } from 'react-hot-toast';
import io from 'socket.io-client';

const MainLayout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  
  const userRole = localStorage.getItem('role') || 'Staff';
  const username = localStorage.getItem('username') || 'User';

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024);
      if (window.innerWidth < 1024) setSidebarOpen(false);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const handleLogout = useCallback(() => {
    localStorage.clear();
    navigate('/');
  }, [navigate]);

  useEffect(() => {
    // Connect to global socket for force_logout
    const socket = io('http://localhost:5000');
    
    socket.on('force_logout', (data) => {
      if (data.username === username) {
        toast.error('Your account has been suspended by an Administrator. You have been logged out.');
        handleLogout();
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [username, handleLogout]);

  const allMenuItems = [
    { path: '/dashboard', icon: <LayoutDashboard size={20} />, label: 'Dashboard', allowed: ['Admin', 'Staff'] },
    { path: '/transaction', icon: <Receipt size={20} />, label: 'New Sale', allowed: ['Admin', 'Staff'] },
    { path: '/history', icon: <History size={20} />, label: 'Sale History', allowed: ['Admin', 'Staff'] },
    { path: '/inventory', icon: <Droplet size={20} />, label: 'Inventory', allowed: ['Admin'] },
    { path: '/deliveries', icon: <Truck size={20} />, label: 'Supply Chain', allowed: ['Admin'] },
    { path: '/staff', icon: <Users size={20} />, label: 'Manage Staff', allowed: ['Admin'] },
    { path: '/audit', icon: <ShieldCheck size={20} />, label: 'Audit Trail', allowed: ['Admin'] },
  ];

  const visibleMenuItems = allMenuItems.filter(item => item.allowed.includes(userRole));

  return (
    <div className="min-h-screen bg-background text-foreground flex overflow-hidden">
      
      {/* Background elements */}
      <div className="fixed inset-0 z-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-100 to-slate-200 dark:from-slate-900 dark:to-background"></div>

      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {isMobile && sidebarOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSidebarOpen(false)}
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <motion.aside 
        initial={false}
        animate={{ 
          width: sidebarOpen ? 260 : (isMobile ? 0 : 80),
          x: isMobile && !sidebarOpen ? -260 : 0
        }}
        className="fixed lg:relative z-50 h-[calc(100vh-32px)] my-4 ml-4 glass-panel rounded-2xl flex flex-col shadow-2xl border-border/50 overflow-hidden"
      >
        <div className="h-16 flex items-center justify-between px-4 border-b border-border/50">
          <div className="flex items-center overflow-hidden whitespace-nowrap">
            <Logo hideText={!sidebarOpen} />
          </div>
          {isMobile && sidebarOpen && (
            <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(false)} className="rounded-full">
              <X size={20} />
            </Button>
          )}
        </div>
        
        <nav className="flex-1 py-6 overflow-y-auto no-scrollbar">
          <ul className="space-y-1.5 px-3">
            {visibleMenuItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <li key={item.path}>
                  <Link
                    to={item.path}
                    onClick={() => isMobile && setSidebarOpen(false)}
                    className={`relative flex items-center p-3 rounded-xl transition-all duration-200 group overflow-hidden ${sidebarOpen ? 'justify-start' : 'justify-center'}`}
                  >
                    {isActive && (
                      <motion.div 
                        layoutId="active-nav-bg"
                        className="absolute inset-0 bg-primary rounded-xl"
                        transition={{ type: "spring", stiffness: 300, damping: 30 }}
                      />
                    )}
                    
                    <div className={`relative z-10 flex items-center ${isActive ? 'text-primary-foreground' : 'text-muted-foreground group-hover:text-foreground'}`}>
                      {item.icon}
                      <AnimatePresence>
                        {sidebarOpen && (
                          <motion.span 
                            initial={{ opacity: 0, width: 0 }}
                            animate={{ opacity: 1, width: "auto" }}
                            exit={{ opacity: 0, width: 0 }}
                            className="ml-3 font-semibold whitespace-nowrap overflow-hidden"
                          >
                            {item.label}
                          </motion.span>
                        )}
                      </AnimatePresence>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="p-4 border-t border-border/50">
          <button 
            onClick={handleLogout}
            className={`flex items-center w-full p-3 rounded-xl text-destructive hover:bg-destructive/10 transition-colors group overflow-hidden ${sidebarOpen ? 'justify-start' : 'justify-center'}`}
          >
            <LogOut size={20} className={sidebarOpen ? "group-hover:-translate-x-1 transition-transform" : ""} />
            <AnimatePresence>
              {sidebarOpen && (
                <motion.span 
                  initial={{ opacity: 0, width: 0 }}
                  animate={{ opacity: 1, width: "auto" }}
                  exit={{ opacity: 0, width: 0 }}
                  className="ml-3 font-semibold whitespace-nowrap"
                >
                  Logout
                </motion.span>
              )}
            </AnimatePresence>
          </button>
        </div>
      </motion.aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 relative z-10 h-screen overflow-hidden">
        
        {/* Floating Header */}
        <header className="h-20 px-4 lg:px-8 flex items-center justify-between sticky top-0 z-30">
          
          <div className="flex items-center gap-4">
            <Button variant="outline" size="icon" onClick={() => setSidebarOpen(!sidebarOpen)} className="rounded-full bg-background/50 backdrop-blur-md shadow-sm">
              <Menu size={20} />
            </Button>
            
            <motion.h1 
              key={location.pathname}
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-xl font-bold capitalize bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground/70"
            >
              {location.pathname.replace('/', '') || 'Dashboard'}
            </motion.h1>
          </div>
          
          <div className="flex items-center gap-4">
            <ThemeToggle />
            
            <Link to="/profile" className="flex items-center gap-3 bg-background/50 backdrop-blur-md p-1.5 pr-4 rounded-full border border-border/50 shadow-sm hover:shadow-md transition-all cursor-pointer">
              <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold uppercase overflow-hidden border border-primary/30">
                {localStorage.getItem('profilePic') ? (
                  <img src={localStorage.getItem('profilePic')} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  username.charAt(0)
                )}
              </div>
              <div className="hidden sm:flex flex-col text-left">
                <span className="text-sm font-bold leading-none">{username}</span>
                <span className="text-[10px] font-semibold text-primary uppercase mt-0.5">{userRole}</span>
              </div>
            </Link>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto p-4 lg:p-8 no-scrollbar relative z-10">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.2 }}
              className="h-full"
            >
              <Outlet /> 
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
};

export default MainLayout;
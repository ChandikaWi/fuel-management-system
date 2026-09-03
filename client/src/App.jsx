import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import TransactionForm from './pages/TransactionForm';
import Inventory from './pages/Inventory';
import MainLayout from './layouts/MainLayout';
import TransactionHistory from './pages/TransactionHistory';
import Deliveries from './pages/Deliveries';
import AuditLogs from './pages/AuditLogs';
import StaffManagement from './pages/StaffManagement';
import Profile from './pages/Profile';

const ProtectedRoute = ({ children }) => {
  const token = localStorage.getItem('token');
  return token ? children : <Navigate to="/" />;
};

function App() {
  return (
    <Router>
      <Toaster 
        position="top-right"
        toastOptions={{
          className: 'dark:bg-slate-900 dark:text-white border dark:border-slate-800',
          style: {
            padding: '16px',
            color: 'inherit',
            background: 'inherit',
          },
          success: {
            iconTheme: {
              primary: '#10b981',
              secondary: 'white',
            },
          },
          error: {
            iconTheme: {
              primary: '#ef4444',
              secondary: 'white',
            },
          },
        }}
      />
      <Routes>
        <Route path="/" element={<Login />} />
        
        <Route element={<ProtectedRoute><MainLayout /></ProtectedRoute>}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/transaction" element={<TransactionForm />} />
          <Route path="/history" element={<TransactionHistory />} /> 
          <Route path="/inventory" element={<Inventory />} />
          <Route path="/deliveries" element={<Deliveries />} />
          <Route path="/staff" element={<StaffManagement />} />
          <Route path="/audit" element={<AuditLogs />} />
          <Route path="/profile" element={<Profile />} />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;
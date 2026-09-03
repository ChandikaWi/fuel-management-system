import { Link, useNavigate } from 'react-router-dom';

const Navbar = () => {
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem('token');
    navigate('/');
  };

  return (
    <nav className="bg-blue-600 p-4 shadow-md">
      <div className="max-w-7xl mx-auto flex justify-between items-center text-white">
        <h1 className="text-xl font-bold">Fuel Master</h1>
        <div className="space-x-4">
          <Link to="/dashboard" className="hover:text-gray-200">Dashboard</Link>
          <Link to="/transaction" className="hover:text-gray-200">New Sale</Link>
          <Link to="/inventory" className="hover:text-gray-200">Inventory</Link>
          <button onClick={handleLogout} className="bg-red-500 px-3 py-1 rounded hover:bg-red-600">
            Logout
          </button>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
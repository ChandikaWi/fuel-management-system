import { useState, useEffect } from 'react';
import { Trash2, Calendar, Clock, User, FileSpreadsheet, FileText, Search, CreditCard, ChevronLeft, ChevronRight, Lock, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { toast } from 'react-hot-toast';
import api from '../api/axios';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Badge } from '../components/ui/Badge';

const TransactionHistory = () => {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filter States
  const [filterDate, setFilterDate] = useState('');
  const [filterFuelType, setFilterFuelType] = useState('');
  const [filterAttendant, setFilterAttendant] = useState('');
  const [filterPaymentMethod, setFilterPaymentMethod] = useState('');

  // Pagination States
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(25);

  // Soft Deletion State
  const [showDeleted, setShowDeleted] = useState(false);

  // Security Modal States
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [transactionToDelete, setTransactionToDelete] = useState(null);
  const [managerPin, setManagerPin] = useState('');
  const [pinError, setPinError] = useState('');

  const fetchTransactions = async () => {
    try {
      const { data } = await api.get('/transactions');
      setTransactions(data);
    } catch (error) {
      console.error('Error fetching transactions', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, []);

  const requestDelete = (id) => {
    setTransactionToDelete(id);
    setManagerPin('');
    setPinError('');
    setShowDeleteModal(true);
  };

  const confirmDelete = async (e) => {
    e.preventDefault();
    if (managerPin !== '1234') { // Hardcoded Manager PIN
      setPinError('Invalid Manager PIN. Access Denied.');
      return;
    }

    try {
      await api.delete(`/transactions/${transactionToDelete}`);
      // Mark as deleted locally instead of removing completely
      setTransactions(transactions.map(t => t._id === transactionToDelete ? { ...t, isDeleted: true, deletedAt: new Date() } : t));
      setShowDeleteModal(false);
    } catch (error) {
      console.error('Error deleting transaction', error);
      setPinError('Failed to delete transaction.');
    }
  };

  // Derive unique fuel types for the dropdown filter
  const uniqueFuelTypes = [...new Set(transactions.map(t => t.fuelType))];

  // Filtering Logic
  const filteredTransactions = transactions.filter(t => {
    // Check Date
    let matchesDate = true;
    if (filterDate) {
      const txDate = new Date(t.timestamp).toISOString().split('T')[0];
      matchesDate = txDate === filterDate;
    }

    // Check Fuel Type
    const matchesFuelType = filterFuelType === '' || t.fuelType === filterFuelType;

    // Check Attendant
    const matchesAttendant = t.attendantName.toLowerCase().includes(filterAttendant.toLowerCase());

    // Check Payment Method (Handle legacy data where paymentMethod might be undefined -> assume Cash)
    const tPaymentMethod = t.paymentMethod || 'Cash';
    const matchesPaymentMethod = filterPaymentMethod === '' || tPaymentMethod === filterPaymentMethod;

    // Check Deleted Status
    const matchesDeleted = showDeleted ? true : !t.isDeleted;

    return matchesDate && matchesFuelType && matchesAttendant && matchesPaymentMethod && matchesDeleted;
  });

  // Reset page to 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [filterDate, filterFuelType, filterAttendant, filterPaymentMethod, showDeleted]);

  // Pagination Logic
  const indexOfLastRow = currentPage * rowsPerPage;
  const indexOfFirstRow = indexOfLastRow - rowsPerPage;
  const currentRows = filteredTransactions.slice(indexOfFirstRow, indexOfLastRow);
  const totalPages = Math.ceil(filteredTransactions.length / rowsPerPage);

  // Dynamic KPI Calculations (Always exclude deleted from totals)
  const kpiTotalRevenue = filteredTransactions.filter(t => !t.isDeleted).reduce((sum, t) => sum + t.totalAmount, 0);
  const kpiTotalVolume = filteredTransactions.filter(t => !t.isDeleted).reduce((sum, t) => sum + t.litersSold, 0);

  // CSV EXPORT 
  const exportToCSV = () => {
    if (filteredTransactions.length === 0) return toast.error('No data to export');

    const headers = ['Date', 'Time', 'Fuel Type', 'Volume Sold (L)', 'Total Revenue (Rs)', 'Payment Method', 'Attendant'];
    const rows = filteredTransactions.map(t => {
      const d = new Date(t.timestamp);
      return [
        d.toLocaleDateString(),
        d.toLocaleTimeString(),
        t.fuelType,
        t.litersSold.toFixed(2),
        t.totalAmount.toFixed(2),
        t.paymentMethod || 'Cash',
        t.attendantName
      ];
    });

    const csvContent = [
      headers.join(','),
      ...rows.map(e => e.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `Fuel_Sales_Report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // PDF EXPORT
  const exportToPDF = () => {
    if (filteredTransactions.length === 0) return toast.error('No data to export');

    try {
      const doc = new jsPDF();

      doc.setFontSize(18);
      doc.text('Fuel Station Sales Report', 14, 22);

      doc.setFontSize(11);
      doc.setTextColor(100);
      doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 30);

      // Add active filter context to the PDF if any exist
      let yPos = 30;
      if (filterDate || filterFuelType || filterAttendant) {
        yPos += 6;
        doc.setFontSize(9);
        const filterText = `Filters Applied: ${filterDate ? `Date: ${filterDate} | ` : ''}${filterFuelType ? `Fuel: ${filterFuelType} | ` : ''}${filterAttendant ? `Attendant: ${filterAttendant}` : ''}`;
        doc.text(filterText.replace(/ \| $/, ''), 14, yPos);
      }

      const tableColumn = ['Date', 'Time', 'Fuel Type', 'Volume (L)', 'Revenue (Rs)', 'Payment', 'Attendant'];
      const tableRows = filteredTransactions.map(t => {
        const d = new Date(t.timestamp);
        return [
          d.toLocaleDateString(),
          d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          t.fuelType,
          t.litersSold.toFixed(2),
          t.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 }),
          t.paymentMethod || 'Cash',
          t.attendantName
        ];
      });

      autoTable(doc, {
        head: [tableColumn],
        body: tableRows,
        startY: yPos + 10,
        theme: 'grid',
        styles: { fontSize: 9, cellPadding: 3 },
        headStyles: { fillColor: [16, 185, 129] },
      });

      const grandTotal = filteredTransactions.filter(t => !t.isDeleted).reduce((sum, t) => sum + t.totalAmount, 0);
      const finalY = doc.lastAutoTable ? doc.lastAutoTable.finalY : yPos + 10;

      doc.setFontSize(12);
      doc.setTextColor(0);
      doc.text(`Grand Total: Rs ${grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, 14, finalY + 10);

      doc.save(`Fuel_Sales_Report_${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (error) {
      console.error("PDF Generation Error:", error);
      toast.error("Error generating PDF. Please check the browser console.");
    }
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <svg className="animate-spin h-10 w-10 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <p className="text-muted-foreground font-medium animate-pulse">Loading history...</p>
        </div>
      </div>
    );
  }

  return (
    <Card className="glass border-border/50 overflow-hidden pb-8">

      {/* HEADER */}
      <div className="p-6 border-b border-border/50 bg-secondary/30 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <CardTitle className="text-xl">Recent Sales History</CardTitle>
          <Badge variant="secondary" className="mt-2 text-sm bg-primary/10 text-primary border-primary/20">
            {filteredTransactions.length} Records Found
          </Badge>
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={exportToCSV}
            className="gap-2 shadow-sm bg-background/50"
          >
            <FileSpreadsheet size={16} className="text-emerald-500" />
            Export CSV
          </Button>
          <Button
            onClick={exportToPDF}
            className="gap-2 shadow-sm shadow-emerald-500/20 bg-emerald-600 hover:bg-emerald-700 text-white border-none"
          >
            <FileText size={16} />
            Export PDF
          </Button>
        </div>
      </div>

      {/* DYNAMIC KPI BANNER */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-border/50 border-b border-border/50">
        <div className="bg-background/50 p-6 flex items-center justify-between">
          <div>
            <p className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-1">Filtered Revenue (Valid)</p>
            <p className="text-3xl font-black text-emerald-600 dark:text-emerald-400 tracking-tighter">Rs {kpiTotalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
          </div>
          <Badge className="bg-emerald-500/10 text-emerald-600 border-none px-3 py-1 font-bold">{filteredTransactions.filter(t => !t.isDeleted).length} Valid Transactions</Badge>
        </div>
        <div className="bg-background/50 p-6 flex items-center justify-between">
          <div>
            <p className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-1">Filtered Volume (Valid)</p>
            <p className="text-3xl font-black text-foreground tracking-tighter">{kpiTotalVolume.toLocaleString(undefined, { minimumFractionDigits: 2 })} <span className="text-xl text-muted-foreground">Liters</span></p>
          </div>
          <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center text-muted-foreground">
            <Search size={18} />
          </div>
        </div>
      </div>

      {/* FILTERING BAR */}
      <div className="p-4 border-b border-border/50 bg-background/50 flex flex-col xl:flex-row gap-4 items-center justify-between">
        <div className="flex flex-col sm:flex-row flex-wrap items-center gap-3 w-full xl:w-auto">

          {/* Date Filter */}
          <div className="w-full sm:w-auto">
            <Input
              type="date"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              onClick={(e) => e.target.showPicker && e.target.showPicker()}
              className="bg-card shadow-sm h-10 cursor-pointer"
            />
          </div>

          {/* Fuel Type Dropdown Filter */}
          <select
            className="w-full sm:w-auto flex h-10 rounded-md border border-input bg-card px-3 py-2 text-sm text-foreground ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition-all shadow-sm"
            value={filterFuelType}
            onChange={(e) => setFilterFuelType(e.target.value)}
          >
            <option value="">All Fuel Types</option>
            {uniqueFuelTypes.map(fuel => (
              <option key={fuel} value={fuel}>{fuel}</option>
            ))}
          </select>

          {/* Payment Method Filter */}
          <select
            className="w-full sm:w-auto flex h-10 rounded-md border border-input bg-card px-3 py-2 text-sm text-foreground ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition-all shadow-sm"
            value={filterPaymentMethod}
            onChange={(e) => setFilterPaymentMethod(e.target.value)}
          >
            <option value="">All Payments</option>
            <option value="Cash">Cash</option>
            <option value="Card">Card</option>
            <option value="Fleet">Fleet</option>
          </select>

          {/* Attendant Search Filter */}
          <div className="relative w-full sm:w-48 lg:w-64">
            <Search className="absolute left-3 top-3 text-muted-foreground" size={16} />
            <Input
              type="text"
              placeholder="Filter by attendant..."
              className="pl-9 bg-card shadow-sm h-10"
              value={filterAttendant}
              onChange={(e) => setFilterAttendant(e.target.value)}
            />
          </div>
        </div>

        {/* Show Deleted Toggle */}
        <div className="flex items-center gap-2 mt-4 xl:mt-0 xl:ml-auto pr-4">
          <input
            type="checkbox"
            id="showDeleted"
            checked={showDeleted}
            onChange={(e) => setShowDeleted(e.target.checked)}
            className="w-4 h-4 rounded border-border/50 cursor-pointer text-emerald-600 focus:ring-emerald-600"
          />
          <label htmlFor="showDeleted" className="text-sm font-bold text-muted-foreground cursor-pointer">Show Voided Records</label>
        </div>

        {/* Clear Filters Button */}
        {(filterDate || filterFuelType || filterAttendant || filterPaymentMethod) && (
          <Button
            variant="ghost"
            onClick={() => { setFilterDate(''); setFilterFuelType(''); setFilterAttendant(''); setFilterPaymentMethod(''); }}
            className="text-destructive hover:text-destructive hover:bg-destructive/10 whitespace-nowrap gap-2 font-bold shadow-sm border border-destructive/20 xl:border-transparent"
          >
            <Trash2 size={16} /> Reset Filters
          </Button>
        )}
      </div>

      <div className="overflow-x-auto min-h-[500px] no-scrollbar">
        <table className="w-full text-left border-collapse relative min-w-[900px]">
          <thead className="bg-secondary/50 border-b border-border/50">
            <tr className="text-muted-foreground text-xs uppercase tracking-wider font-semibold">
              <th className="p-4 pl-6">Date & Time</th>
              <th className="p-4">Fuel Type</th>
              <th className="p-4">Volume Sold</th>
              <th className="p-4">Total Revenue</th>
              <th className="p-4">Payment</th>
              <th className="p-4">Attendant</th>
              <th className="p-4 pr-6 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            <AnimatePresence mode="popLayout">
              {currentRows.map((transaction, index) => {
                const dateObj = new Date(transaction.timestamp);
                const pMethod = transaction.paymentMethod || 'Cash';

                return (
                  <motion.tr
                    key={transaction._id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ delay: index * 0.01 }}
                    className={`transition-colors group ${transaction.isDeleted ? 'bg-destructive/5' : 'hover:bg-secondary/10'}`}
                  >
                    <td className="p-4 pl-6 text-foreground">
                      <div className="flex flex-col gap-1">
                        <span className={`flex items-center gap-1.5 text-sm font-semibold ${transaction.isDeleted ? 'text-destructive line-through opacity-75' : ''}`}>
                          <Calendar size={14} className="text-muted-foreground" />
                          {dateObj.toLocaleDateString()}
                        </span>
                        <span className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
                          <Clock size={14} className="text-muted-foreground" />
                          {dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </td>
                    <td className={`p-4 font-bold text-foreground ${transaction.isDeleted ? 'opacity-50 line-through' : ''}`}>
                      {transaction.fuelType}
                    </td>
                    <td className={`p-4 text-muted-foreground font-medium ${transaction.isDeleted ? 'line-through' : ''}`}>
                      {transaction.litersSold.toFixed(2)} L
                    </td>
                    <td className="p-4">
                      <span className={`font-bold ${transaction.isDeleted ? 'text-destructive/70 line-through' : 'text-emerald-600 dark:text-emerald-400'}`}>
                        Rs {transaction.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </span>
                    </td>
                    <td className={`p-4 ${transaction.isDeleted ? 'opacity-50 line-through' : ''}`}>
                      <span className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                        {pMethod === 'Cash' ? '💵' : pMethod === 'Card' ? '💳' : '🏢'} {pMethod}
                      </span>
                    </td>
                    <td className="p-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1.5 bg-secondary/50 px-2 py-1 rounded w-max font-medium">
                        <User size={14} className="text-muted-foreground" />
                        {transaction.attendantName}
                      </span>
                    </td>
                    <td className="p-4 pr-6 text-right">
                      {transaction.isDeleted ? (
                        <Badge variant="destructive" className="text-[10px] font-black tracking-widest bg-destructive/10 text-destructive shadow-none">VOIDED</Badge>
                      ) : (
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => requestDelete(transaction._id)}
                          className="text-destructive hover:bg-destructive/10 transition-opacity w-8 h-8 rounded-md"
                          title="Delete Transaction"
                        >
                          <Trash2 size={16} />
                        </Button>
                      )}
                    </td>
                  </motion.tr>
                );
              })}
            </AnimatePresence>

            {currentRows.length === 0 && (
              <tr>
                <td colSpan="7" className="p-12 text-center text-muted-foreground font-medium">
                  {transactions.length === 0 ? 'No transaction history found.' : 'No transactions match your current filters.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* PAGINATION FOOTER */}
      {filteredTransactions.length > 0 && (
        <div className="p-4 border-t border-border/50 bg-secondary/10 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-sm text-muted-foreground font-medium">
            Showing <span className="text-foreground font-bold">{indexOfFirstRow + 1}</span> to <span className="text-foreground font-bold">{Math.min(indexOfLastRow, filteredTransactions.length)}</span> of <span className="text-foreground font-bold">{filteredTransactions.length}</span> entries
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              Rows per page:
              <select
                className="bg-card border border-input rounded text-foreground text-sm h-8 px-2"
                value={rowsPerPage}
                onChange={(e) => {
                  setRowsPerPage(Number(e.target.value));
                  setCurrentPage(1);
                }}
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>

            <div className="flex gap-1">
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              >
                <ChevronLeft size={14} />
              </Button>
              <div className="flex items-center px-3 text-sm font-bold bg-background border border-input rounded h-8">
                {currentPage} / {totalPages}
              </div>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              >
                <ChevronRight size={14} />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* SECURITY DELETE MODAL */}
      <AnimatePresence>
        {showDeleteModal && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50" onClick={() => setShowDeleteModal(false)} />
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="bg-card w-full max-w-sm rounded-2xl shadow-2xl border border-destructive/20 overflow-hidden">
                <div className="bg-destructive/10 p-5 border-b border-destructive/20 flex justify-between items-center">
                  <h3 className="text-destructive font-black flex items-center gap-2"><Lock size={18} /> Manager Override</h3>
                  <button onClick={() => setShowDeleteModal(false)} className="text-muted-foreground hover:text-foreground"><X size={18} /></button>
                </div>
                <div className="p-6">
                  <p className="text-sm text-muted-foreground mb-4 font-medium">To securely delete this transaction and refund the physical inventory, a manager PIN is required.</p>
                  <form onSubmit={confirmDelete}>
                    <Input
                      type="password"
                      placeholder="Enter 4-Digit PIN (e.g. 1234)"
                      required
                      autoFocus
                      maxLength={4}
                      className="text-center text-xl font-bold tracking-widest mb-2"
                      value={managerPin}
                      onChange={(e) => setManagerPin(e.target.value)}
                    />
                    {pinError && <p className="text-xs text-destructive font-bold mb-4">{pinError}</p>}
                    <div className="flex gap-3 mt-6">
                      <Button type="button" variant="ghost" className="flex-1" onClick={() => setShowDeleteModal(false)}>Cancel</Button>
                      <Button type="submit" variant="destructive" className="flex-1">Authorize Delete</Button>
                    </div>
                  </form>
                </div>
              </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>

    </Card>
  );
};

export default TransactionHistory;
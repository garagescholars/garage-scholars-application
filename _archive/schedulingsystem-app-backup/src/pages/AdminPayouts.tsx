import React, { useEffect, useState } from "react";
import { collection, onSnapshot, query, orderBy, updateDoc, doc, getDoc } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import { db } from "../firebase";
import { Payout } from "../../types";
import { COLLECTIONS } from "../collections";
import { ArrowLeft, DollarSign, Download, CheckCircle2 } from "lucide-react";

const AdminPayouts: React.FC = () => {
  const navigate = useNavigate();
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [markPaidModal, setMarkPaidModal] = useState<Payout | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'Venmo' | 'Zelle' | 'Cash' | 'Check'>('Venmo');
  const [transactionNote, setTransactionNote] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (!db) {
      setError("Firestore not initialized.");
      setLoading(false);
      return;
    }

    const payoutsQuery = query(collection(db, COLLECTIONS.PAYOUTS), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(
      payoutsQuery,
      (snapshot) => {
        const payoutsList = snapshot.docs.map((docSnap) => {
          const data = docSnap.data() as Record<string, any>;
          return {
            id: docSnap.id,
            jobId: data.jobId || '',
            scholarId: data.scholarId || '',
            scholarName: data.recipientName || data.scholarName || 'Unknown',
            scholarEmail: data.scholarEmail || '',
            amount: data.amount || 0,
            status: data.status || 'pending',
            createdAt: data.createdAt || '',
            paidAt: data.paidAt,
            paymentMethod: data.paymentMethod,
            transactionNote: data.notes || data.transactionNote,
            approvedBy: data.approvedBy,
          } as Payout;
        });
        setPayouts(payoutsList);
        setError(null);
        setLoading(false);
      },
      (err) => {
        setError(err.message || "Failed to load payouts.");
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const handleMarkAsPaid = async () => {
    if (!markPaidModal || !db) return;

    setBusyId(markPaidModal.id);
    try {
      await updateDoc(doc(db, COLLECTIONS.PAYOUTS, markPaidModal.id), {
        status: "paid",
        paidAt: new Date().toISOString(),
        paymentMethod: `manual_${paymentMethod.toLowerCase()}`,
        notes: transactionNote
      });
      setMarkPaidModal(null);
      setPaymentMethod('Venmo');
      setTransactionNote('');
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to mark as paid.";
      setError(message);
    } finally {
      setBusyId(null);
    }
  };

  const handleExportCSV = () => {
    const currentYear = new Date().getFullYear();
    const yearPayouts = payouts.filter(p => {
      const payoutYear = new Date(p.paidAt || p.createdAt).getFullYear();
      return payoutYear === currentYear && p.status === 'paid';
    });

    // Group by scholar
    const scholarTotals = yearPayouts.reduce((acc, payout) => {
      if (!acc[payout.scholarId]) {
        acc[payout.scholarId] = {
          name: payout.scholarName,
          email: payout.scholarEmail || '',
          total: 0
        };
      }
      acc[payout.scholarId].total += payout.amount;
      return acc;
    }, {} as Record<string, { name: string; email: string; total: number }>);

    // Filter scholars with >$600 (1099 threshold)
    type ScholarTotal = { name: string; email: string; total: number };
    const csv = [
      ['Scholar Name', 'Scholar Email', 'Total Paid (Year-to-Date)', 'Tax ID'].join(','),
      ...(Object.values(scholarTotals) as ScholarTotal[])
        .filter(scholar => scholar.total > 600)
        .map(scholar => [
          scholar.name,
          scholar.email,
          scholar.total.toFixed(2),
          '' // Tax ID placeholder
        ].join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `1099-data-${currentYear}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleJobClick = async (jobId: string) => {
    // Navigate back to main app and open job detail
    navigate(`/?job=${jobId}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-sm text-slate-500">Loading payouts...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6 page-enter">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate(-1)}
              className="p-2 hover:bg-slate-200 rounded-full"
            >
              <ArrowLeft size={20} className="text-slate-600" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-slate-800">Payout Management</h1>
              <p className="text-sm text-slate-500">Track and manage scholar payments</p>
            </div>
          </div>
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-emerald-700"
          >
            <Download size={16} />
            Export for Taxes
          </button>
        </div>

        {error && (
          <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-lg p-4">
            {error}
          </div>
        )}

        {/* Summary Cards */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="text-xs font-semibold text-slate-500 uppercase mb-1">Pending</div>
            <div className="text-2xl font-bold text-amber-600">
              ${payouts.filter(p => p.status === 'pending').reduce((sum, p) => sum + p.amount, 0).toFixed(2)}
            </div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="text-xs font-semibold text-slate-500 uppercase mb-1">Paid (YTD)</div>
            <div className="text-2xl font-bold text-emerald-600">
              ${payouts.filter(p => p.status === 'paid').reduce((sum, p) => sum + p.amount, 0).toFixed(2)}
            </div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="text-xs font-semibold text-slate-500 uppercase mb-1">Total Payouts</div>
            <div className="text-2xl font-bold text-slate-800">{payouts.length}</div>
          </div>
        </div>

        {/* Payouts Table */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Payout ID</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Scholar</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Job ID</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Amount</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {payouts.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-500">
                      No payouts found.
                    </td>
                  </tr>
                ) : (
                  payouts.map((payout) => (
                    <tr key={payout.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 text-sm font-mono text-slate-600">
                        {payout.id.slice(0, 8)}...
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-slate-800">
                        {payout.scholarName}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => handleJobClick(payout.jobId)}
                          className="text-sm text-blue-600 hover:underline font-mono"
                        >
                          {payout.jobId.slice(0, 8)}...
                        </button>
                      </td>
                      <td className="px-4 py-3 text-sm font-bold text-emerald-600">
                        ${payout.amount.toFixed(2)}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-block px-2 py-1 rounded-full text-xs font-bold ${
                            payout.status === 'paid'
                              ? 'bg-emerald-100 text-emerald-700'
                              : payout.status === 'pending'
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-rose-100 text-rose-700'
                          }`}
                        >
                          {payout.status.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {payout.status === 'pending' ? (
                          <button
                            onClick={() => setMarkPaidModal(payout)}
                            className="text-xs font-bold bg-emerald-600 text-white px-3 py-1.5 rounded-lg hover:bg-emerald-700"
                          >
                            Mark as Paid
                          </button>
                        ) : payout.status === 'paid' ? (
                          <div className="text-xs text-slate-500">
                            {payout.paymentMethod && (
                              <div>
                                <CheckCircle2 size={12} className="inline mr-1 text-emerald-600" />
                                {payout.paymentMethod}
                              </div>
                            )}
                            {payout.paidAt && (
                              <div className="text-[10px] text-slate-400">
                                {new Date(payout.paidAt).toLocaleDateString()}
                              </div>
                            )}
                          </div>
                        ) : null}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Mark as Paid Modal */}
      {markPaidModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl p-6 max-w-md w-full">
            <h2 className="text-xl font-bold text-slate-800 mb-4">Confirm Payment</h2>
            <p className="text-sm text-slate-600 mb-6">
              Confirm payment of <span className="font-bold text-emerald-600">${markPaidModal.amount.toFixed(2)}</span> to{' '}
              <span className="font-semibold">{markPaidModal.scholarName}</span>
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Payment Method
                </label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as typeof paymentMethod)}
                  className="w-full border border-slate-200 rounded-lg p-3 text-sm"
                >
                  <option value="Venmo">Venmo</option>
                  <option value="Zelle">Zelle</option>
                  <option value="Cash">Cash</option>
                  <option value="Check">Check</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Transaction ID / Note / Confirmation Code
                </label>
                <input
                  type="text"
                  value={transactionNote}
                  onChange={(e) => setTransactionNote(e.target.value)}
                  placeholder="e.g., Venmo ID or confirmation #"
                  className="w-full border border-slate-200 rounded-lg p-3 text-sm"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setMarkPaidModal(null);
                  setPaymentMethod('Venmo');
                  setTransactionNote('');
                }}
                disabled={busyId === markPaidModal.id}
                className="flex-1 bg-slate-200 text-slate-700 font-semibold py-3 rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={handleMarkAsPaid}
                disabled={busyId === markPaidModal.id || !transactionNote.trim()}
                className="flex-1 bg-emerald-600 text-white font-bold py-3 rounded-xl hover:bg-emerald-700 disabled:opacity-50"
              >
                {busyId === markPaidModal.id ? 'Processing...' : 'Confirm Payment'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPayouts;

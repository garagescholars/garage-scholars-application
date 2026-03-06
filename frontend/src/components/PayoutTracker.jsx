import React, { useState, useEffect } from 'react';
import { DollarSign, CheckCircle2, Clock, Send, ChevronDown, ChevronUp, Filter } from 'lucide-react';
import { db } from '../firebase';
import { collection, onSnapshot, addDoc, updateDoc, doc, query, orderBy, where } from 'firebase/firestore';
import { useToast } from '../context/ToastContext';

const COMMISSION_RATE = 0.50; // 50% commission

export default function PayoutTracker({ soldInventory }) {
  const [payouts, setPayouts] = useState([]);
  const [expandedClient, setExpandedClient] = useState(null);
  const [payoutModal, setPayoutModal] = useState(null); // { clientName, amount, method }
  const [payoutMethod, setPayoutMethod] = useState('venmo');
  const [payoutNotes, setPayoutNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [filterView, setFilterView] = useState('unpaid'); // 'unpaid' | 'all'

  const { showToast } = useToast();

  // Listen for payouts collection
  useEffect(() => {
    const q = query(collection(db, 'payouts'), orderBy('paidAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      setPayouts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, () => {});
    return () => unsub();
  }, []);

  // Calculate per-client balances
  const clientBalances = soldInventory.reduce((acc, item) => {
    const client = item.clientName || 'Unknown Client';
    if (!acc[client]) {
      acc[client] = { totalSales: 0, commission: 0, clientOwed: 0, items: [], paidOut: 0 };
    }
    const salePrice = parseFloat(item.price) || 0;
    const commission = salePrice * COMMISSION_RATE;
    const clientShare = salePrice - commission;

    acc[client].totalSales += salePrice;
    acc[client].commission += commission;
    acc[client].clientOwed += clientShare;
    acc[client].items.push({
      id: item.id,
      title: item.title,
      price: salePrice,
      commission,
      clientShare,
      dateSold: item.dateSold,
      paidOut: item.paidOut || false,
    });
    return acc;
  }, {});

  // Subtract payouts from client balances
  payouts.forEach(payout => {
    const client = payout.clientName;
    if (clientBalances[client]) {
      clientBalances[client].paidOut += (payout.amount || 0);
    }
  });

  // Compute outstanding balance per client
  Object.keys(clientBalances).forEach(client => {
    const b = clientBalances[client];
    b.outstandingBalance = Math.max(0, b.clientOwed - b.paidOut);
  });

  // Sort clients: unpaid first, then alphabetically
  const sortedClients = Object.entries(clientBalances).sort((a, b) => {
    if (filterView === 'unpaid') {
      return b[1].outstandingBalance - a[1].outstandingBalance;
    }
    return a[0].localeCompare(b[0]);
  });

  const filteredClients = filterView === 'unpaid'
    ? sortedClients.filter(([_, b]) => b.outstandingBalance > 0)
    : sortedClients;

  // Totals
  const totalGrossRevenue = soldInventory.reduce((s, i) => s + (parseFloat(i.price) || 0), 0);
  const totalCommission = totalGrossRevenue * COMMISSION_RATE;
  const totalOwed = Object.values(clientBalances).reduce((s, b) => s + b.outstandingBalance, 0);
  const totalPaidOut = payouts.reduce((s, p) => s + (p.amount || 0), 0);

  const handleRecordPayout = async () => {
    if (!payoutModal) return;
    setIsSubmitting(true);
    try {
      await addDoc(collection(db, 'payouts'), {
        clientName: payoutModal.clientName,
        amount: payoutModal.amount,
        method: payoutMethod,
        notes: payoutNotes,
        paidAt: new Date(),
        recordedBy: 'admin',
      });

      // Send payout confirmation email via Firestore mail collection
      await addDoc(collection(db, 'mail'), {
        to: ['garagescholars@gmail.com', 'admin@garagescholars.com'],
        message: {
          subject: `Payout Recorded: $${payoutModal.amount.toFixed(2)} to ${payoutModal.clientName}`,
          html: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1e293b;">
  <div style="background: #0f1b2d; padding: 24px; text-align: center; border-radius: 12px 12px 0 0;">
    <h1 style="color: #14b8a6; margin: 0; font-size: 24px;">Garage Scholars</h1>
  </div>
  <div style="padding: 32px 24px; background: #f8fafc; border: 1px solid #e2e8f0;">
    <h2 style="color: #0f1b2d; margin: 0 0 8px 0;">Payout Recorded</h2>
    <p style="color: #475569;">A client payout has been recorded in the Resale Concierge.</p>
    <div style="background: #ecfdf5; border-radius: 8px; padding: 16px; margin: 16px 0;">
      <table style="width: 100%; font-size: 14px; color: #334155;">
        <tr><td style="padding: 4px 0;"><strong>Client:</strong></td><td style="text-align: right;">${payoutModal.clientName}</td></tr>
        <tr><td style="padding: 4px 0;"><strong>Amount:</strong></td><td style="text-align: right; font-weight: 700; color: #059669;">$${payoutModal.amount.toFixed(2)}</td></tr>
        <tr><td style="padding: 4px 0;"><strong>Method:</strong></td><td style="text-align: right;">${payoutMethod}</td></tr>
        ${payoutNotes ? `<tr><td style="padding: 4px 0;"><strong>Notes:</strong></td><td style="text-align: right;">${payoutNotes}</td></tr>` : ''}
        <tr><td style="padding: 4px 0;"><strong>Date:</strong></td><td style="text-align: right;">${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</td></tr>
      </table>
    </div>
  </div>
  <div style="background: #0f1b2d; padding: 16px; text-align: center; border-radius: 0 0 12px 12px;">
    <p style="color: #64748b; font-size: 12px; margin: 0;">Garage Scholars — Denver's College-Powered Garage Transformations</p>
  </div>
</div>`
        },
        createdAt: new Date(),
      });

      showToast({ type: 'success', message: `Recorded $${payoutModal.amount.toFixed(2)} payout to ${payoutModal.clientName}` });
      setPayoutModal(null);
      setPayoutNotes('');
      setPayoutMethod('venmo');
    } catch (e) {
      showToast({ type: 'error', message: 'Failed to record payout: ' + e.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-white">Payouts & Commission</h2>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <SummaryCard label="Gross Revenue" value={`$${totalGrossRevenue.toLocaleString()}`} color="text-white" />
        <SummaryCard label="Our Commission (50%)" value={`$${totalCommission.toLocaleString()}`} color="text-emerald-400" highlight />
        <SummaryCard label="Total Owed to Clients" value={`$${totalOwed.toLocaleString()}`} color="text-amber-400" />
        <SummaryCard label="Total Paid Out" value={`$${totalPaidOut.toLocaleString()}`} color="text-teal-400" />
      </div>

      {/* Filter Toggle */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setFilterView('unpaid')}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${filterView === 'unpaid' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30' : 'text-slate-400 border border-slate-800 hover:border-slate-700'}`}
        >
          Unpaid ({sortedClients.filter(([_, b]) => b.outstandingBalance > 0).length})
        </button>
        <button
          onClick={() => setFilterView('all')}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${filterView === 'all' ? 'bg-teal-500/10 text-teal-400 border border-teal-500/30' : 'text-slate-400 border border-slate-800 hover:border-slate-700'}`}
        >
          All Clients ({sortedClients.length})
        </button>
      </div>

      {/* Client List */}
      {filteredClients.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-12 text-center">
          <DollarSign size={48} className="text-slate-700 mx-auto mb-4" />
          <p className="text-slate-400 text-lg font-medium">No sold items yet</p>
          <p className="text-slate-600 text-sm mt-1">Commission and payouts will appear here after items sell</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredClients.map(([clientName, balance]) => {
            const isExpanded = expandedClient === clientName;

            return (
              <div key={clientName} className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                {/* Client Header */}
                <button
                  onClick={() => setExpandedClient(isExpanded ? null : clientName)}
                  className="w-full p-4 flex items-center justify-between hover:bg-slate-800/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-teal-400 font-bold text-lg border border-slate-700">
                      {clientName.charAt(0).toUpperCase()}
                    </div>
                    <div className="text-left">
                      <p className="text-white font-medium">{clientName}</p>
                      <p className="text-xs text-slate-500">{balance.items.length} item{balance.items.length !== 1 ? 's' : ''} sold</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    {balance.outstandingBalance > 0 ? (
                      <div className="text-right">
                        <p className="text-amber-400 font-bold font-mono">${balance.outstandingBalance.toFixed(2)}</p>
                        <p className="text-[10px] text-slate-500">owed</p>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 text-emerald-400 text-sm">
                        <CheckCircle2 size={14} />
                        <span>Paid up</span>
                      </div>
                    )}
                    {isExpanded ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
                  </div>
                </button>

                {/* Expanded Detail */}
                {isExpanded && (
                  <div className="border-t border-slate-800">
                    {/* Balance Summary */}
                    <div className="grid grid-cols-4 gap-3 p-4 bg-slate-950/50">
                      <div>
                        <p className="text-[10px] text-slate-500 uppercase">Total Sales</p>
                        <p className="text-white font-mono">${balance.totalSales.toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-500 uppercase">Commission (50%)</p>
                        <p className="text-emerald-400 font-mono">${balance.commission.toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-500 uppercase">Client Share</p>
                        <p className="text-white font-mono">${balance.clientOwed.toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-500 uppercase">Already Paid</p>
                        <p className="text-teal-400 font-mono">${balance.paidOut.toFixed(2)}</p>
                      </div>
                    </div>

                    {/* Items List */}
                    <div className="p-4 space-y-2">
                      <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Sold Items</p>
                      {balance.items.map(item => (
                        <div key={item.id} className="flex items-center justify-between py-2 border-b border-slate-800/50 last:border-0">
                          <div>
                            <p className="text-sm text-white">{item.title}</p>
                            <p className="text-[10px] text-slate-500">Sold {item.dateSold || 'Unknown date'}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm text-white font-mono">${item.price.toFixed(2)}</p>
                            <p className="text-[10px] text-slate-500">Client gets: <span className="text-teal-400">${item.clientShare.toFixed(2)}</span></p>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Payout History */}
                    {payouts.filter(p => p.clientName === clientName).length > 0 && (
                      <div className="p-4 border-t border-slate-800">
                        <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-2">Payout History</p>
                        {payouts.filter(p => p.clientName === clientName).map(p => (
                          <div key={p.id} className="flex items-center justify-between py-2 border-b border-slate-800/50 last:border-0">
                            <div className="flex items-center gap-2">
                              <CheckCircle2 size={14} className="text-emerald-400" />
                              <div>
                                <p className="text-sm text-white">${(p.amount || 0).toFixed(2)} via {p.method}</p>
                                <p className="text-[10px] text-slate-500">{p.paidAt?.toDate ? p.paidAt.toDate().toLocaleDateString() : 'Unknown'}{p.notes ? ` — ${p.notes}` : ''}</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Record Payout Button */}
                    {balance.outstandingBalance > 0 && (
                      <div className="p-4 border-t border-slate-800">
                        <button
                          onClick={() => setPayoutModal({ clientName, amount: balance.outstandingBalance })}
                          className="w-full flex items-center justify-center gap-2 bg-teal-500 hover:bg-teal-400 text-slate-900 py-2.5 rounded-lg font-bold transition-colors"
                        >
                          <Send size={16} />
                          Record Payout (${balance.outstandingBalance.toFixed(2)})
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Payout Modal */}
      {payoutModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-700 w-full max-w-md rounded-xl p-6 shadow-2xl">
            <h3 className="text-xl font-bold text-white mb-4">Record Payout</h3>

            <div className="space-y-4">
              <div className="p-4 bg-slate-800 rounded-lg">
                <p className="text-sm text-slate-400">Paying <span className="text-white font-bold">{payoutModal.clientName}</span></p>
                <p className="text-2xl font-bold text-teal-400 font-mono mt-1">${payoutModal.amount.toFixed(2)}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Payment Method</label>
                <select
                  className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-white focus:border-teal-500 outline-none"
                  value={payoutMethod}
                  onChange={e => setPayoutMethod(e.target.value)}
                >
                  <option value="venmo">Venmo</option>
                  <option value="zelle">Zelle</option>
                  <option value="paypal">PayPal</option>
                  <option value="cash">Cash</option>
                  <option value="check">Check</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Notes (optional)</label>
                <input
                  type="text"
                  className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-white focus:border-teal-500 outline-none"
                  placeholder="e.g., Venmo @username"
                  value={payoutNotes}
                  onChange={e => setPayoutNotes(e.target.value)}
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={handleRecordPayout}
                  disabled={isSubmitting}
                  className="flex-1 bg-teal-500 hover:bg-teal-400 text-slate-900 py-3 rounded-lg font-bold transition-colors disabled:opacity-50"
                >
                  {isSubmitting ? 'Recording...' : 'Confirm Payout'}
                </button>
                <button
                  onClick={() => { setPayoutModal(null); setPayoutNotes(''); }}
                  className="px-4 text-slate-400 hover:text-white border border-slate-700 rounded-lg transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SummaryCard({ label, value, color, highlight }) {
  return (
    <div className={`border p-4 rounded-xl ${highlight ? 'bg-emerald-500/10 border-emerald-500/50' : 'bg-slate-900 border-slate-800'}`}>
      <p className="text-[10px] uppercase font-bold tracking-wider text-slate-500">{label}</p>
      <p className={`text-xl font-bold font-mono ${color}`}>{value}</p>
    </div>
  );
}

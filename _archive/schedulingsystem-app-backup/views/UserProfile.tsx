import React, { useEffect, useState } from 'react';
import { ArrowLeft, User, LogOut, ShieldCheck, Mail, ToggleLeft, ToggleRight, Target, TrendingUp, DollarSign, Phone, Download } from 'lucide-react';
import { User as UserType, Job, JobStatus, Payout } from '../types';
import { useAuth } from '../src/auth/AuthProvider';
import { signOut } from 'firebase/auth';
import { auth, db } from '../src/firebase';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { COLLECTIONS } from '../src/collections';

interface UserProfileProps {
  onBack: () => void;
  userRole: 'scholar' | 'admin';
  users: UserType[];
  onUpdateUser: (userId: string, updates: Partial<UserType>) => void;
  jobs: Job[];
  currentUserId: string | null;
}

const UserProfile: React.FC<UserProfileProps> = ({ onBack, userRole, users, onUpdateUser, jobs, currentUserId }) => {

  const { user: authUser } = useAuth();
  const navigate = useNavigate();
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [payoutsLoading, setPayoutsLoading] = useState(true);

  // Load payouts for current scholar
  useEffect(() => {
    if (!db || !currentUserId || userRole === 'admin') {
      setPayoutsLoading(false);
      return;
    }

    const payoutsQuery = query(
      collection(db, COLLECTIONS.PAYOUTS),
      where('scholarId', '==', currentUserId)
    );

    const unsubscribe = onSnapshot(payoutsQuery, (snapshot) => {
      const payoutsList = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data()
      })) as Payout[];
      setPayouts(payoutsList.sort((a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      ));
      setPayoutsLoading(false);
    }, (error) => {
      console.error('Error loading payouts:', error);
      setPayoutsLoading(false);
    });

    return () => unsubscribe();
  }, [currentUserId, userRole]);

  const handleGoalChange = (userId: string, newGoal: number) => {
      onUpdateUser(userId, { monthlyGoal: newGoal });
  };

  const handlePhoneChange = (userId: string, newPhone: string) => {
      onUpdateUser(userId, { phoneNumber: newPhone });
  };

  const handleDownload1099Info = () => {
    const currentYear = new Date().getFullYear();
    const totalPaid = payouts
      .filter(p => p.status === 'paid' && new Date(p.paidAt || p.createdAt).getFullYear() === currentYear)
      .reduce((sum, p) => sum + p.amount, 0);

    if (totalPaid < 600) {
      alert(`Your total earnings for ${currentYear} ($${totalPaid.toFixed(2)}) are below the $600 1099 threshold.`);
      return;
    }

    const csv = [
      ['Item', 'Value'].join(','),
      ['Year', currentYear].join(','),
      ['Scholar Name', displayUser.name].join(','),
      ['Total Paid', totalPaid.toFixed(2)].join(','),
      ['Number of Payouts', payouts.filter(p => p.status === 'paid').length].join(','),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `1099-info-${currentYear}-${displayUser.name.replace(/\s+/g, '-')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleLogout = async () => {
    if (!auth) return;
    try {
      await signOut(auth);
      navigate('/login');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const currentUser = users.find(u => u.id === currentUserId) || users[0];
  const displayUser = currentUser || {
    id: 'unknown',
    name: 'Scholar',
    role: 'scholar',
    monthlyGoal: 0,
    avatarInitials: 'GS',
    achievedMilestones: [],
    phoneNumber: ''
  };
  const adminEmail = (authUser?.email || '').toLowerCase();
  const adminName = adminEmail ? adminEmail.split('@')[0] : 'Admin';
  const adminInitials = adminName ? adminName.charAt(0).toUpperCase() : 'A';
  const isAdmin = userRole === 'admin';

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans animate-in slide-in-from-right duration-200">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20">
        <div className="max-w-md mx-auto px-4 h-16 flex items-center">
          <button 
            onClick={onBack} 
            className="p-2 -ml-2 hover:bg-slate-100 rounded-full transition-colors text-slate-600"
          >
            <ArrowLeft size={20} />
          </button>
          <h1 className="font-bold text-lg ml-2">{userRole === 'admin' ? 'Admin Profile & Settings' : 'My Profile'}</h1>
        </div>
      </header>

      <main className="max-w-md mx-auto px-4 py-6 space-y-6">
        {/* Profile Header */}
        <div className="flex flex-col items-center text-center">
          <div className="w-24 h-24 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center shadow-lg mb-4 text-white text-3xl font-bold">
            {isAdmin ? adminInitials : displayUser.avatarInitials}
          </div>
          <h2 className="text-2xl font-bold text-slate-800">{isAdmin ? adminName : displayUser.name}</h2>
          {!isAdmin && (
            <div className="flex items-center gap-2 mt-1 text-slate-500">
              <ShieldCheck size={16} className="text-blue-500" />
              <span className="font-medium">Verified Specialist</span>
            </div>
          )}
          {!isAdmin && displayUser.phoneNumber && (
             <div className="flex items-center gap-1 mt-1 text-slate-400 text-sm">
                <Phone size={12} /> {displayUser.phoneNumber}
             </div>
          )}
        </div>

        {/* Stats Grid */}
        {!isAdmin && (
          <div className="grid grid-cols-3 gap-3">
              <div className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm text-center">
                  <div className="text-2xl font-bold text-slate-800">4.9</div>
                  <div className="text-xs text-slate-500 font-medium uppercase tracking-wide">Rating</div>
              </div>
              <div className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm text-center">
                  <div className="text-2xl font-bold text-slate-800">
                      {jobs.filter(j => j.assigneeId === currentUserId && j.status === 'COMPLETED').length}
                  </div>
                  <div className="text-xs text-slate-500 font-medium uppercase tracking-wide">Completed</div>
              </div>
              <div className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm text-center">
                  <div className="text-2xl font-bold text-slate-800">2yr</div>
                  <div className="text-xs text-slate-500 font-medium uppercase tracking-wide">Exp</div>
              </div>
          </div>
        )}

        {/* Earnings Section (Scholar Only) */}
        {!isAdmin && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-4 bg-gradient-to-r from-emerald-50 to-teal-50 border-b flex justify-between items-center">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <DollarSign size={18} className="text-emerald-600" />
                Earnings
              </h3>
              {!payoutsLoading && payouts.filter(p => p.status === 'paid').reduce((sum, p) => sum + p.amount, 0) > 600 && (
                <button
                  onClick={handleDownload1099Info}
                  className="flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-100 px-2 py-1 rounded-lg hover:bg-emerald-200"
                >
                  <Download size={12} />
                  1099 Info
                </button>
              )}
            </div>

            {payoutsLoading ? (
              <div className="p-6 text-center text-sm text-slate-500">Loading earnings...</div>
            ) : payouts.length === 0 ? (
              <div className="p-6 text-center text-sm text-slate-500">No payouts yet. Complete jobs to earn!</div>
            ) : (
              <div className="divide-y divide-slate-100">
                {/* Summary */}
                <div className="p-4 grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-xs text-slate-500 uppercase font-semibold mb-1">Pending</div>
                    <div className="text-xl font-bold text-amber-600">
                      ${payouts.filter(p => p.status === 'pending').reduce((sum, p) => sum + p.amount, 0).toFixed(2)}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500 uppercase font-semibold mb-1">Paid (YTD)</div>
                    <div className="text-xl font-bold text-emerald-600">
                      ${payouts.filter(p => p.status === 'paid').reduce((sum, p) => sum + p.amount, 0).toFixed(2)}
                    </div>
                  </div>
                </div>

                {/* Payout List */}
                <div className="max-h-60 overflow-y-auto">
                  {payouts.slice(0, 10).map((payout) => (
                    <div key={payout.id} className="p-3 hover:bg-slate-50 flex justify-between items-center">
                      <div>
                        <div className="text-sm font-semibold text-slate-800">${payout.amount.toFixed(2)}</div>
                        <div className="text-xs text-slate-500">
                          {new Date(payout.createdAt).toLocaleDateString()}
                          {payout.status === 'paid' && payout.paymentMethod && (
                            <span className="ml-2 text-emerald-600">• {payout.paymentMethod}</span>
                          )}
                        </div>
                      </div>
                      <span
                        className={`text-xs font-bold px-2 py-1 rounded-full ${
                          payout.status === 'paid'
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-amber-100 text-amber-700'
                        }`}
                      >
                        {payout.status.toUpperCase()}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Employee Goal & Phone Settings (Admin Only) */}
        {userRole === 'admin' && (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden animate-in fade-in slide-in-from-bottom-2">
                <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                    <h3 className="font-bold text-slate-800 flex items-center gap-2">
                        <Target size={18} className="text-blue-600"/> 
                        Team Backend Settings
                    </h3>
                    <span className="text-[10px] font-bold bg-blue-100 text-blue-700 px-2 py-1 rounded-full uppercase">
                        Admin Only
                    </span>
                </div>
                <div className="divide-y divide-slate-100">
                    {users.filter(u => u.role === 'scholar').map(user => {
                        // Calculate total revenue for this user based on COMPLETED jobs
                        const userRevenue = jobs
                            .filter(j => j.assigneeId === user.id && j.status === JobStatus.COMPLETED)
                            .reduce((sum, j) => sum + j.pay, 0);

                        const progress = Math.min(100, Math.round((userRevenue / user.monthlyGoal) * 100));
                        
                        return (
                            <div key={user.id} className="p-4">
                                <div className="flex flex-col gap-3">
                                     <div className="flex justify-between items-start">
                                        <div>
                                            <p className="font-bold text-slate-800 text-sm">{user.name}</p>
                                            <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                                                <TrendingUp size={12}/> ${userRevenue.toLocaleString()} / ${user.monthlyGoal.toLocaleString()}
                                            </p>
                                        </div>
                                        
                                        {/* Goal Input */}
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs text-slate-400 font-medium uppercase hidden sm:inline">Target:</span>
                                            <div className="relative">
                                                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold">$</span>
                                                <input 
                                                    type="number" 
                                                    min="1"
                                                    step="50"
                                                    value={user.monthlyGoal}
                                                    onChange={(e) => handleGoalChange(user.id, parseInt(e.target.value) || 0)}
                                                    className="w-20 border border-slate-300 rounded p-1.5 pl-5 text-center text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                                                />
                                            </div>
                                        </div>
                                     </div>

                                     {/* Phone Number Input */}
                                     <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-lg border border-slate-100">
                                         <Phone size={14} className="text-slate-400 flex-shrink-0" />
                                         <input 
                                             type="tel" 
                                             placeholder="Enter mobile number for alerts..."
                                             value={user.phoneNumber || ''}
                                             onChange={(e) => handlePhoneChange(user.id, e.target.value)}
                                             className="w-full bg-transparent text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none font-mono"
                                         />
                                     </div>
                                </div>

                                {/* Mini Progress Bar */}
                                <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden mt-3">
                                    <div 
                                        className={`h-full rounded-full ${progress >= 100 ? 'bg-green-500' : 'bg-blue-500'}`} 
                                        style={{ width: `${progress}%` }}
                                    ></div>
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>
        )}

        {/* Details Section */}
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-50 flex items-center gap-4">
                <div className="bg-slate-100 p-2 rounded-lg text-slate-600">
                    <User size={20} />
                </div>
                <div>
                    <p className="text-xs text-slate-400 font-medium uppercase">Role</p>
                    <p className="text-slate-800 font-medium">{isAdmin ? 'Admin' : 'Senior Organization Specialist'}</p>
                </div>
            </div>
            <div className="p-4 flex items-center gap-4">
                <div className="bg-slate-100 p-2 rounded-lg text-slate-600">
                    <Mail size={20} />
                </div>
                <div>
                    <p className="text-xs text-slate-400 font-medium uppercase">Email</p>
                    <p className="text-slate-800 font-medium">{isAdmin ? adminEmail || 'admin@garagescholars.com' : 'alex.scholar@garagescholars.com'}</p>
                </div>
            </div>
        </div>

        {/* Logout Button */}
        <button
          onClick={handleLogout}
          className="w-full bg-white border border-slate-200 text-red-600 font-medium py-3 rounded-xl hover:bg-red-50 transition-colors flex items-center justify-center gap-2"
        >
            <LogOut size={18} />
            Log Out
        </button>

         <p className="text-center text-xs text-slate-400 pt-4">Garage Scholars v1.2.1 (Internal)</p>
      </main>
    </div>
  );
};

export default UserProfile;

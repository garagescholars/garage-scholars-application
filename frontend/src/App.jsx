import React, { useState, useEffect } from 'react';
import { db, auth } from './firebase';
import { collection, onSnapshot, query, orderBy, where, limit, doc, getDoc, updateDoc } from 'firebase/firestore';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { Package, Plus, LogOut, LayoutGrid, Settings as SettingsIcon, MessageSquare, Menu, X, DollarSign, TrendingUp, Bell, Search, RefreshCw, Activity, CheckCircle2, XCircle, Loader2, Clock, BarChart3, Zap, Archive, Shield, Wallet } from 'lucide-react';

import { ToastProvider, useToast } from './context/ToastContext';
import AddListingModal from './components/AddListingModal';
import Login from './components/Login';
import MessagesView from './components/MessagesView';
import NotificationsPanel from './components/NotificationsPanel';
import JobDetailDrawer from './components/JobDetailDrawer';
import ReviewQueue from './components/ReviewQueue';
import PayoutTracker from './components/PayoutTracker';

const ALLOWED_EMAILS = [
  "tylerzsodia@gmail.com",
  "zach.harmon25@gmail.com",
  "garagescholars@gmail.com"
];

function AppContent() {
  const [user, setUser] = useState(null);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [loadingAuth, setLoadingAuth] = useState(true);

  const [inventory, setInventory] = useState([]);
  const [soldInventory, setSoldInventory] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [automationJobs, setAutomationJobs] = useState([]);
  const [notifications, setNotifications] = useState([]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Notifications panel
  const [showNotifications, setShowNotifications] = useState(false);

  // Job detail drawer
  const [drawerItem, setDrawerItem] = useState(null);

  // Hover image preview
  const [hoveredItemId, setHoveredItemId] = useState(null);

  // Inventory filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [platformFilter, setPlatformFilter] = useState('All');

  // Settings
  const [ebayConfig, setEbayConfig] = useState(null);
  const [rateLimits, setRateLimits] = useState([]);
  const [backendHealth, setBackendHealth] = useState(null);

  const { showToast } = useToast();

  // AUTH
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        if (ALLOWED_EMAILS.includes(currentUser.email)) {
          setUser(currentUser);
          setIsAuthorized(true);
        } else {
          signOut(auth);
          setUser(null);
          setIsAuthorized(false);
        }
      } else {
        setUser(null);
        setIsAuthorized(false);
      }
      setLoadingAuth(false);
    });
    return () => unsub();
  }, []);

  // INVENTORY
  useEffect(() => {
    if (!user || !isAuthorized) return;
    const q = query(collection(db, "inventory"), orderBy("dateListed", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      const toDate = (v) => {
        if (!v) return new Date(0);
        if (typeof v.toDate === 'function') return v.toDate();
        if (typeof v === 'number') return new Date(v);
        return new Date(v);
      };
      items.sort((a, b) => toDate(b.dateListed).getTime() - toDate(a.dateListed).getTime());
      setInventory(items);
    });
    return () => unsub();
  }, [user, isAuthorized]);

  // SOLD INVENTORY
  useEffect(() => {
    if (!user || !isAuthorized) return;
    const unsub = onSnapshot(query(collection(db, "sold_inventory")), (snap) => {
      setSoldInventory(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, [user, isAuthorized]);

  // CONVERSATIONS
  useEffect(() => {
    if (!user || !isAuthorized) return;
    const unsub = onSnapshot(query(collection(db, "conversations")), (snap) => {
      setConversations(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, [user, isAuthorized]);

  // AUTOMATION JOBS (recent 25)
  useEffect(() => {
    if (!user || !isAuthorized) return;
    const q = query(collection(db, "automationJobs"), orderBy("createdAt", "desc"), limit(25));
    const unsub = onSnapshot(q, (snap) => {
      setAutomationJobs(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, [user, isAuthorized]);

  // ADMIN NOTIFICATIONS (unread)
  useEffect(() => {
    if (!user || !isAuthorized) return;
    const q = query(collection(db, "adminNotifications"), where("read", "==", false), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      setNotifications(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (err) => {
      // Index may still be building
      console.warn('Notifications query error (index building?):', err.message);
    });
    return () => unsub();
  }, [user, isAuthorized]);

  // SETTINGS: eBay config
  useEffect(() => {
    if (!user || !isAuthorized || activeTab !== 'settings') return;
    getDoc(doc(db, 'integrations', 'ebay')).then(snap => {
      if (snap.exists()) setEbayConfig(snap.data());
    }).catch(() => {});
  }, [user, isAuthorized, activeTab]);

  // SETTINGS: Rate limits
  useEffect(() => {
    if (!user || !isAuthorized || activeTab !== 'settings') return;
    const unsub = onSnapshot(collection(db, 'rateLimits'), (snap) => {
      setRateLimits(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, () => {});
    return () => unsub();
  }, [user, isAuthorized, activeTab]);

  // SETTINGS: Backend health
  useEffect(() => {
    if (activeTab !== 'settings') return;
    const fetchHealth = () => {
      fetch('http://localhost:3001/stats').then(r => r.json()).then(setBackendHealth).catch(() => setBackendHealth(null));
    };
    fetchHealth();
    const iv = setInterval(fetchHealth, 10000);
    return () => clearInterval(iv);
  }, [activeTab]);

  // --- COMPUTED VALUES ---
  const activeValue = inventory.reduce((sum, i) => sum + (parseFloat(i.price) || 0), 0);
  const grossRevenue = soldInventory.reduce((sum, i) => sum + (parseFloat(i.price) || 0), 0);
  const unreadCount = conversations.filter(c => c.isUnread === true).length;
  const pendingCount = inventory.filter(i => i.status === 'Pending' || i.status === 'Running').length;
  const reviewCount = inventory.filter(i => i.status === 'Needs Review').length;
  const avgSalePrice = soldInventory.length > 0 ? grossRevenue / soldInventory.length : 0;

  const successfulJobs = automationJobs.filter(j => j.status === 'succeeded').length;
  const totalFinishedJobs = automationJobs.filter(j => ['succeeded', 'failed', 'compliance_failed', 'dead_letter'].includes(j.status)).length;
  const successRate = totalFinishedJobs > 0 ? Math.round((successfulJobs / totalFinishedJobs) * 100) : 0;

  // Platform revenue breakdown
  const platformRevenue = soldInventory.reduce((acc, item) => {
    const p = item.platform || 'Other';
    const key = p.includes('Both') ? 'Multi' : p.includes('All') ? 'Multi' : p.includes('FB') ? 'Facebook' : p.includes('Craigslist') ? 'Craigslist' : p.toLowerCase().includes('ebay') ? 'eBay' : 'Other';
    acc[key] = (acc[key] || 0) + (parseFloat(item.price) || 0);
    return acc;
  }, {});

  // Filtered inventory
  const filteredInventory = inventory.filter(item => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (!(item.title || '').toLowerCase().includes(q) && !(item.clientName || '').toLowerCase().includes(q)) return false;
    }
    if (statusFilter !== 'All' && item.status !== statusFilter) return false;
    if (platformFilter !== 'All') {
      const p = item.platform || '';
      if (platformFilter === 'CL' && !p.includes('Craigslist') && !p.includes('Both') && !p.includes('All')) return false;
      if (platformFilter === 'FB' && !p.includes('FB') && !p.includes('Both') && !p.includes('All')) return false;
      if (platformFilter === 'eBay' && !p.toLowerCase().includes('ebay') && !p.includes('All')) return false;
    }
    return true;
  });

  // Helpers
  const statusClassMap = {
    'Needs Review': 'bg-amber-500/10 border-amber-500/50 text-amber-400',
    Pending: 'bg-slate-500/10 border-slate-500/40 text-slate-300',
    Running: 'bg-blue-500/10 border-blue-500/50 text-blue-400',
    Active: 'bg-emerald-500/10 border-emerald-500/50 text-emerald-400',
    Error: 'bg-rose-500/10 border-rose-500/50 text-rose-400',
    'Compliance Error': 'bg-amber-500/10 border-amber-500/50 text-amber-400',
    Denied: 'bg-rose-500/10 border-rose-500/30 text-rose-300',
  };

  const progressIcon = (state) => {
    if (state === 'success') return <CheckCircle2 size={12} className="text-emerald-400" />;
    if (state === 'running') return <Loader2 size={12} className="text-blue-400 animate-spin" />;
    if (state === 'queued') return <Clock size={12} className="text-yellow-400" />;
    if (state === 'error') return <XCircle size={12} className="text-rose-400" />;
    return <span className="w-3 h-3 rounded-full bg-slate-700 inline-block" />;
  };

  const handleRetryFromNotification = async (inventoryId) => {
    try {
      await updateDoc(doc(db, 'inventory', inventoryId), {
        status: 'Pending', lastError: null, progress: {}, lastUpdated: new Date()
      });
      showToast({ type: 'success', message: 'Item re-queued for automation' });
    } catch (e) {
      showToast({ type: 'error', message: 'Retry failed: ' + e.message });
    }
  };

  const handleRetryItem = async (item) => {
    try {
      await updateDoc(doc(db, 'inventory', item.id), {
        status: 'Pending', lastError: null, progress: {}, lastUpdated: new Date()
      });
      showToast({ type: 'success', message: `Re-queued "${item.title}"` });
    } catch (e) {
      showToast({ type: 'error', message: 'Retry failed' });
    }
  };

  // --- RENDER ---
  if (loadingAuth) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white">Loading Security...</div>;
  if (!user || !isAuthorized) return <Login />;

  return (
    <div className="flex h-screen bg-slate-950 text-slate-100 overflow-hidden font-sans">

      {/* MOBILE HEADER */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-16 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-4 z-40">
        <h1 className="text-lg font-bold bg-gradient-to-r from-teal-400 to-emerald-400 bg-clip-text text-transparent">Garage Scholars</h1>
        <div className="flex items-center gap-2">
          {notifications.length > 0 && (
            <button onClick={() => setShowNotifications(true)} className="relative text-slate-300">
              <Bell size={20} />
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 rounded-full text-[10px] text-white flex items-center justify-center">{notifications.length}</span>
            </button>
          )}
          <button onClick={() => setIsMobileMenuOpen(true)} className="text-slate-300"><Menu size={24} /></button>
        </div>
      </div>

      {/* SIDEBAR */}
      <div className={`fixed inset-0 z-50 bg-slate-950/95 transition-transform duration-300 md:relative md:translate-x-0 md:bg-slate-950/50 md:w-64 md:border-r md:border-slate-800 md:flex md:flex-col ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-6 flex justify-between items-center">
          <div>
            <h1 className="text-xl font-bold bg-gradient-to-r from-teal-400 to-emerald-400 bg-clip-text text-transparent hidden md:block">Garage Scholars</h1>
            <h1 className="text-2xl font-bold text-white md:hidden">Menu</h1>
            <p className="text-xs text-slate-500 mt-1 hidden md:block">Resale Concierge</p>
          </div>
          <button onClick={() => setIsMobileMenuOpen(false)} className="md:hidden text-slate-400"><X size={28} /></button>
        </div>

        <nav className="flex-1 px-4 space-y-2 mt-4 md:mt-0">
          <SidebarItem icon={<LayoutGrid size={20} />} label="Dashboard" active={activeTab === 'dashboard'} onClick={() => { setActiveTab('dashboard'); setIsMobileMenuOpen(false); }} />
          <SidebarItem icon={<Package size={20} />} label="Inventory" active={activeTab === 'inventory'} onClick={() => { setActiveTab('inventory'); setIsMobileMenuOpen(false); }} badge={pendingCount > 0 ? pendingCount : null} />
          <SidebarItem icon={<Shield size={20} />} label="Review Queue" active={activeTab === 'review'} onClick={() => { setActiveTab('review'); setIsMobileMenuOpen(false); }} badge={reviewCount > 0 ? reviewCount : null} />
          <SidebarItem icon={<Wallet size={20} />} label="Payouts" active={activeTab === 'payouts'} onClick={() => { setActiveTab('payouts'); setIsMobileMenuOpen(false); }} />
          <SidebarItem icon={<MessageSquare size={20} />} label="Messages" active={activeTab === 'messages'} onClick={() => { setActiveTab('messages'); setIsMobileMenuOpen(false); }} badge={unreadCount > 0 ? unreadCount : null} />
          <SidebarItem icon={<SettingsIcon size={20} />} label="Settings" active={activeTab === 'settings'} onClick={() => { setActiveTab('settings'); setIsMobileMenuOpen(false); }} />

          {/* Notification bell */}
          <div className="pt-4 border-t border-slate-800 mt-4">
            <button onClick={() => setShowNotifications(true)} className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-all relative">
              <Bell size={20} />
              <span className="font-medium">Notifications</span>
              {notifications.length > 0 && (
                <span className="ml-auto bg-rose-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">{notifications.length}</span>
              )}
            </button>
          </div>
        </nav>

        <div className="p-4 border-t border-slate-800">
          <div className="flex items-center gap-3 mb-4 px-2">
            <img src={user.photoURL} className="w-8 h-8 rounded-full" alt="User" />
            <div className="text-sm overflow-hidden">
              <p className="text-white font-medium truncate">{user.displayName}</p>
              <p className="text-xs text-slate-500 truncate">{user.email}</p>
            </div>
          </div>
          <button onClick={() => signOut(auth)} className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors w-full px-2 py-2 rounded hover:bg-slate-800">
            <LogOut size={18} /><span>Logout</span>
          </button>
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div className="flex-1 flex flex-col h-full overflow-hidden relative pt-16 md:pt-0">
        <div className="flex-1 overflow-y-auto p-4 md:p-8">

          {/* ==================== DASHBOARD ==================== */}
          {activeTab === 'dashboard' && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold text-white">Dashboard Overview</h2>

              {/* Metric Cards — Row 1 */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <DashboardCard title="Active Listings" value={inventory.length} icon={<Package className="text-blue-400" />} />
                <DashboardCard title="Portfolio Value" value={`$${activeValue.toLocaleString()}`} icon={<TrendingUp className="text-purple-400" />} />
                <DashboardCard title="Items Sold" value={soldInventory.length} icon={<Archive className="text-teal-400" />} />
                <DashboardCard title="Gross Revenue" value={`$${grossRevenue.toLocaleString()}`} icon={<DollarSign className="text-emerald-400" />} highlight />
              </div>

              {/* Metric Cards — Row 2 */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <DashboardCard title="Avg Sale Price" value={`$${avgSalePrice.toFixed(0)}`} icon={<BarChart3 className="text-amber-400" />} />
                <DashboardCard title="Success Rate" value={`${successRate}%`} icon={<Zap className="text-yellow-400" />} />
                <DashboardCard title="Needs Review" value={reviewCount} icon={<Shield className="text-amber-400" />} onClick={() => setActiveTab('review')} />
                <DashboardCard title="Unread Messages" value={unreadCount} icon={<Bell className="text-yellow-400" />} />
              </div>

              {/* Platform Revenue Breakdown */}
              {grossRevenue > 0 && (
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
                  <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-3">Revenue by Platform</h3>
                  <div className="flex h-4 rounded-full overflow-hidden bg-slate-800">
                    {Object.entries(platformRevenue).map(([platform, amount]) => {
                      const pct = (amount / grossRevenue) * 100;
                      const colors = { Craigslist: 'bg-purple-500', Facebook: 'bg-blue-500', eBay: 'bg-amber-500', Multi: 'bg-teal-500', Other: 'bg-slate-500' };
                      return <div key={platform} className={`${colors[platform] || 'bg-slate-500'}`} style={{ width: `${pct}%` }} title={`${platform}: $${amount.toLocaleString()}`} />;
                    })}
                  </div>
                  <div className="flex flex-wrap gap-4 mt-2">
                    {Object.entries(platformRevenue).map(([platform, amount]) => (
                      <span key={platform} className="text-xs text-slate-400">{platform}: <span className="text-white font-medium">${amount.toLocaleString()}</span></span>
                    ))}
                  </div>
                </div>
              )}

              {/* Two Column: Recent Sales + Activity Feed */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Recent Sales */}
                <div>
                  <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-3">Recent Sales</h3>
                  {soldInventory.length === 0 ? (
                    <div className="p-6 text-center border border-slate-800 rounded-xl border-dashed text-slate-600 text-sm">No sales yet</div>
                  ) : (
                    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                      {soldInventory.slice(0, 5).map(item => (
                        <div key={item.id} className="flex justify-between items-center p-3 border-b border-slate-800 last:border-0">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 bg-slate-800 rounded overflow-hidden">
                              {item.imageUrls?.[0] && <img src={item.imageUrls[0]} className="w-full h-full object-cover" alt="" />}
                            </div>
                            <div>
                              <p className="text-sm font-medium text-white truncate max-w-[180px]">{item.title}</p>
                              <p className="text-[10px] text-slate-500">{item.dateSold || 'Unknown'}</p>
                            </div>
                          </div>
                          <span className="font-mono text-emerald-400 text-sm">+${item.price}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Activity Feed */}
                <div>
                  <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-3">Recent Activity</h3>
                  {automationJobs.length === 0 ? (
                    <div className="p-6 text-center border border-slate-800 rounded-xl border-dashed text-slate-600 text-sm">No automation activity yet</div>
                  ) : (
                    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden divide-y divide-slate-800">
                      {automationJobs.slice(0, 8).map(job => {
                        const invItem = inventory.find(i => i.id === job.inventoryId);
                        return (
                          <div key={job.id} className="flex items-center gap-3 p-3">
                            {job.status === 'succeeded' && <CheckCircle2 size={16} className="text-emerald-400 flex-shrink-0" />}
                            {job.status === 'failed' && <XCircle size={16} className="text-rose-400 flex-shrink-0" />}
                            {job.status === 'running' && <Loader2 size={16} className="text-blue-400 animate-spin flex-shrink-0" />}
                            {job.status === 'queued' && <Clock size={16} className="text-slate-400 flex-shrink-0" />}
                            {job.status === 'compliance_failed' && <XCircle size={16} className="text-amber-400 flex-shrink-0" />}
                            {job.status === 'dead_letter' && <XCircle size={16} className="text-rose-600 flex-shrink-0" />}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-white truncate">{invItem?.title || job.inventoryId}</p>
                              <p className="text-[10px] text-slate-500">
                                {job.status === 'succeeded' ? 'Posted successfully' : job.status === 'failed' ? `Failed (attempt ${job.attempts || 1})` : job.status === 'running' ? `Running (attempt ${job.attempts || 1})` : job.status === 'compliance_failed' ? 'Compliance error' : job.status === 'dead_letter' ? 'Permanently failed' : 'Queued'}
                              </p>
                            </div>
                            <span className="text-[10px] text-slate-600 flex-shrink-0">{job.createdAt?.toDate ? timeAgo(job.createdAt.toDate()) : ''}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ==================== REVIEW QUEUE ==================== */}
          {activeTab === 'review' && <ReviewQueue inventory={inventory} />}

          {/* ==================== PAYOUTS ==================== */}
          {activeTab === 'payouts' && <PayoutTracker soldInventory={soldInventory} />}

          {/* ==================== MESSAGES ==================== */}
          {activeTab === 'messages' && <MessagesView />}

          {/* ==================== INVENTORY ==================== */}
          {activeTab === 'inventory' && (
            <>
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
                <h2 className="text-2xl font-bold text-white">Inventory</h2>
                <button onClick={() => { setEditingItem(null); setIsModalOpen(true); }} className="bg-teal-500 hover:bg-teal-400 text-slate-900 px-4 py-2 rounded-lg font-bold flex items-center gap-2 transition-colors shadow-lg shadow-teal-500/20 text-sm">
                  <Plus size={18} />New Listing
                </button>
              </div>

              {/* Search + Filters */}
              <div className="flex flex-col sm:flex-row gap-2 mb-4">
                <div className="relative flex-1">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input type="text" placeholder="Search by title or client..." className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-sm text-white focus:border-teal-500 outline-none" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
                </div>
                <select className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white outline-none" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                  <option value="All">All Status</option>
                  <option value="Needs Review">Needs Review</option>
                  <option value="Pending">Pending</option>
                  <option value="Running">Running</option>
                  <option value="Active">Active</option>
                  <option value="Error">Error</option>
                  <option value="Denied">Denied</option>
                </select>
                <select className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white outline-none" value={platformFilter} onChange={e => setPlatformFilter(e.target.value)}>
                  <option value="All">All Platforms</option>
                  <option value="CL">Craigslist</option>
                  <option value="FB">Facebook</option>
                  <option value="eBay">eBay</option>
                </select>
              </div>

              {/* Table */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
                <div className="overflow-x-auto">
                  <div className="min-w-[800px]">
                    <div className="grid grid-cols-12 gap-4 p-4 border-b border-slate-800 text-xs font-bold text-slate-400 uppercase tracking-wider">
                      <div className="col-span-4">Item Name</div>
                      <div className="col-span-2">Price</div>
                      <div className="col-span-2">Date Listed</div>
                      <div className="col-span-1">Client</div>
                      <div className="col-span-1">Platform</div>
                      <div className="col-span-2 text-right">Status</div>
                    </div>
                    <div className="divide-y divide-slate-800">
                      {filteredInventory.map(item => {
                        const progress = item.progress || {};
                        const pv = item.platform || '';
                        const showCL = pv.includes('Craigslist') || pv.includes('Both') || pv.includes('All');
                        const showFB = pv.includes('FB') || pv.includes('Both') || pv.includes('All');
                        const showEB = pv.toLowerCase().includes('ebay') || pv.includes('All');
                        const isError = item.status === 'Error' || item.status === 'Compliance Error';

                        return (
                          <div key={item.id} className="grid grid-cols-12 gap-4 p-4 items-center hover:bg-slate-800/50 transition-colors cursor-pointer group">
                            <div className="col-span-4 flex items-center gap-3 relative" onClick={() => { setEditingItem(item); setIsModalOpen(true); }} onMouseEnter={() => setHoveredItemId(item.id)} onMouseLeave={() => setHoveredItemId(null)}>
                              <div className="w-12 h-12 rounded bg-slate-800 flex-shrink-0 overflow-hidden border border-slate-700">
                                {item.imageUrls?.length > 0
                                  ? <img src={item.imageUrls.find(u => !u.toLowerCase().includes('.heic')) || item.imageUrls[0]} alt={item.title} className="w-full h-full object-cover" />
                                  : <div className="w-full h-full flex items-center justify-center text-slate-600"><Package size={20} /></div>
                                }
                              </div>
                              <span className="font-medium text-white group-hover:text-teal-400 transition-colors truncate">{item.title}</span>
                              {hoveredItemId === item.id && item.imageUrls?.find(u => !u.toLowerCase().includes('.heic')) && (
                                <div className="absolute left-0 top-16 z-50 w-64 p-2 bg-slate-950 border border-slate-700 rounded-lg shadow-2xl pointer-events-none">
                                  <div className="aspect-square rounded overflow-hidden bg-slate-900">
                                    <img src={item.imageUrls.find(u => !u.toLowerCase().includes('.heic')) || item.imageUrls[0]} alt="Preview" className="w-full h-full object-cover" />
                                  </div>
                                  {item.imageUrls.some(u => u.toLowerCase().includes('.heic')) && (
                                    <div className="mt-1 text-xs text-yellow-500 text-center bg-yellow-500/10 py-1 rounded">Includes HEIC files</div>
                                  )}
                                </div>
                              )}
                            </div>
                            <div className="col-span-2 font-mono text-teal-400" onClick={() => { setEditingItem(item); setIsModalOpen(true); }}>${item.price}</div>
                            <div className="col-span-2 text-slate-400 text-sm" onClick={() => { setEditingItem(item); setIsModalOpen(true); }}>{item.dateListed}</div>
                            <div className="col-span-1 text-slate-400 text-sm truncate" onClick={() => { setEditingItem(item); setIsModalOpen(true); }}>{item.clientName || '-'}</div>
                            <div className="col-span-1" onClick={() => { setEditingItem(item); setIsModalOpen(true); }}>
                              <PlatformChip platform={pv} />
                            </div>
                            <div className="col-span-2 text-right" onClick={() => setDrawerItem(item)}>
                              <span className={`text-xs px-2 py-1 rounded border ${statusClassMap[item.status] || statusClassMap.Pending}`}>{item.status || 'Pending'}</span>
                              {(showCL || showFB || showEB) && (
                                <div className="mt-1 flex items-center justify-end gap-2">
                                  {showCL && <span className="flex items-center gap-0.5 text-[10px] text-slate-400">{progressIcon(progress.craigslist)} CL</span>}
                                  {showFB && <span className="flex items-center gap-0.5 text-[10px] text-slate-400">{progressIcon(progress.facebook)} FB</span>}
                                  {showEB && <span className="flex items-center gap-0.5 text-[10px] text-slate-400">{progressIcon(item.ebay?.status || progress.ebay)} EB</span>}
                                </div>
                              )}
                              {isError && (
                                <button onClick={(e) => { e.stopPropagation(); handleRetryItem(item); }} className="mt-1 flex items-center gap-1 text-[10px] text-teal-400 hover:text-teal-300 ml-auto">
                                  <RefreshCw size={10} /> Retry
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                      {filteredInventory.length === 0 && (
                        <div className="p-12 text-center text-slate-500">
                          {inventory.length === 0 ? 'No listings yet. Create your first one!' : 'No items match your filters.'}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* ==================== SETTINGS ==================== */}
          {activeTab === 'settings' && (
            <div className="space-y-6 max-w-3xl">
              <h2 className="text-2xl font-bold text-white">Settings</h2>

              {/* eBay Connection */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-3">eBay Connection</h3>
                {ebayConfig ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${ebayConfig.accessTokenExpiresAt > Date.now() ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                      <span className="text-sm text-white">{ebayConfig.accessTokenExpiresAt > Date.now() ? 'Connected' : 'Token Expired'}</span>
                    </div>
                    <p className="text-xs text-slate-500">Environment: <span className="text-slate-300">{ebayConfig.env || 'production'}</span></p>
                    {ebayConfig.updatedAt && <p className="text-xs text-slate-500">Last refresh: <span className="text-slate-300">{new Date(ebayConfig.updatedAt).toLocaleString()}</span></p>}
                    <p className="text-xs text-slate-500">Publish mode: <span className="text-slate-300">{ebayConfig.publishEnabled ? 'Auto-publish' : 'Draft only'}</span></p>
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">eBay integration not configured or loading...</p>
                )}
              </div>

              {/* Rate Limits */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-3">Rate Limits (Today)</h3>
                {rateLimits.length === 0 ? (
                  <p className="text-sm text-slate-500">No posting activity recorded yet</p>
                ) : (
                  <div className="space-y-3">
                    {rateLimits.map(rl => {
                      const maxPosts = rl.platform === 'facebook' ? 10 : 20;
                      const count = (rl.postTimestamps || []).filter(ts => ts > Date.now() - 86400000).length;
                      const pct = Math.min((count / maxPosts) * 100, 100);
                      const lastPost = rl.lastPostAt ? timeAgo(new Date(rl.lastPostAt)) : 'never';
                      return (
                        <div key={rl.id}>
                          <div className="flex justify-between text-sm mb-1">
                            <span className="text-white capitalize">{rl.platform}</span>
                            <span className="text-slate-400">{count}/{maxPosts} posts · Last: {lastPost}</span>
                          </div>
                          <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
                            <div className={`h-full rounded-full transition-all ${pct > 80 ? 'bg-rose-500' : pct > 50 ? 'bg-amber-500' : 'bg-teal-500'}`} style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Backend Health */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-3">Backend Worker</h3>
                {backendHealth ? (
                  <div className="grid grid-cols-2 gap-3">
                    <div><span className="text-xs text-slate-500">Status</span><p className="text-sm text-emerald-400 font-medium">Online</p></div>
                    <div><span className="text-xs text-slate-500">Uptime</span><p className="text-sm text-white">{Math.floor(backendHealth.uptime / 60)}m</p></div>
                    <div><span className="text-xs text-slate-500">Jobs Processed</span><p className="text-sm text-white">{backendHealth.jobsProcessed || 0}</p></div>
                    <div><span className="text-xs text-slate-500">Success / Failed</span><p className="text-sm text-white">{backendHealth.jobsSucceeded || 0} / {backendHealth.jobsFailed || 0}</p></div>
                    <div><span className="text-xs text-slate-500">Active Jobs</span><p className="text-sm text-white">{backendHealth.activeJobs || 0} / {backendHealth.maxConcurrentJobs || 2}</p></div>
                    <div><span className="text-xs text-slate-500">Worker ID</span><p className="text-sm text-white truncate">{backendHealth.workerId}</p></div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-rose-400" />
                    <span className="text-sm text-rose-400">Backend offline or unreachable</span>
                  </div>
                )}
              </div>
            </div>
          )}

        </div>
      </div>

      {/* MODALS + OVERLAYS */}
      <AddListingModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} initialData={editingItem} />

      {showNotifications && (
        <NotificationsPanel
          notifications={notifications}
          onClose={() => setShowNotifications(false)}
          onRetryItem={handleRetryFromNotification}
          onEditItem={(id) => { const item = inventory.find(i => i.id === id); if (item) { setEditingItem(item); setIsModalOpen(true); } setShowNotifications(false); }}
        />
      )}

      {drawerItem && (
        <JobDetailDrawer
          item={drawerItem}
          onClose={() => setDrawerItem(null)}
          onEdit={(item) => { setEditingItem(item); setIsModalOpen(true); }}
          onMarkSold={(item) => { setEditingItem(item); setIsModalOpen(true); }}
        />
      )}
    </div>
  );
}

// Wrap in ToastProvider
export default function App() {
  return (
    <ToastProvider>
      <AppContent />
    </ToastProvider>
  );
}

// --- SUBCOMPONENTS ---

function SidebarItem({ icon, label, active, onClick, badge }) {
  return (
    <button onClick={onClick} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${active ? 'bg-teal-500/10 text-teal-400 border border-teal-500/20' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}>
      {icon}
      <span className="font-medium">{label}</span>
      {badge && <span className="ml-auto bg-teal-500/20 text-teal-400 text-[10px] font-bold px-1.5 py-0.5 rounded-full">{badge}</span>}
    </button>
  );
}

function DashboardCard({ title, value, icon, highlight, onClick }) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag onClick={onClick} className={`border p-4 rounded-xl shadow-lg flex items-center gap-3 text-left ${highlight ? 'bg-emerald-500/10 border-emerald-500/50' : 'bg-slate-900 border-slate-800'} ${onClick ? 'hover:bg-slate-800 cursor-pointer transition-colors' : ''}`}>
      <div className={`p-2.5 rounded-full border ${highlight ? 'bg-emerald-500/20 border-emerald-500/50' : 'bg-slate-950 border-slate-800'}`}>
        {icon}
      </div>
      <div>
        <p className={`text-[10px] uppercase font-bold tracking-wider ${highlight ? 'text-emerald-400' : 'text-slate-500'}`}>{title}</p>
        <p className={`text-xl font-bold ${highlight ? 'text-emerald-300' : 'text-white'}`}>{value}</p>
      </div>
    </Tag>
  );
}

function PlatformChip({ platform }) {
  const p = platform || '';
  if (p.includes('All')) return <span className="text-xs px-2 py-0.5 rounded border bg-gradient-to-r from-purple-500/10 to-amber-500/10 text-slate-300 border-slate-700">ALL</span>;
  if (p.includes('Both')) return <span className="text-xs px-2 py-0.5 rounded border bg-gradient-to-r from-purple-500/10 to-blue-500/10 text-slate-300 border-slate-700">Both</span>;
  if (p.includes('FB')) return <span className="text-xs px-2 py-0.5 rounded border bg-blue-500/10 text-blue-400 border-blue-500/30">FB</span>;
  if (p.toLowerCase().includes('ebay')) return <span className="text-xs px-2 py-0.5 rounded border bg-amber-500/10 text-amber-400 border-amber-500/30">EB</span>;
  return <span className="text-xs px-2 py-0.5 rounded border bg-purple-500/10 text-purple-400 border-purple-500/30">CL</span>;
}

function timeAgo(date) {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const mins = Math.floor(seconds / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

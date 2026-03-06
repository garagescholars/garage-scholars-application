
import React, { useState, useEffect, useMemo } from 'react';
import { Job, Notification as AppNotification, JobStatus, User as UserType } from './types';
import JobCard from './components/JobCard';
import { JobDetail } from './views/JobDetail';
import UserProfile from './views/UserProfile';
import PendingApprovals from './views/PendingApprovals';
import { broadcastMilestone, requestSmsPermissions, SmsRecipient } from './services/smsService';
import { collection, doc, onSnapshot, orderBy, query, setDoc, serverTimestamp } from 'firebase/firestore';
import { db, firebaseInitError } from './src/firebase';
import { useAuth } from './src/auth/AuthProvider';
import { COLLECTIONS } from './src/collections';
import { 
    Bell, Search, User, X, Check, Calendar as CalendarIcon, List, Timer, 
    ClipboardList, ArrowRight, Users, ChevronLeft, ChevronRight, 
    TrendingUp, DollarSign, Target, Trophy, MessageSquare, 
    PartyPopper, Flame, Rocket, Medal, Star, Send, Plus, 
    MapPin, Clock, Filter, RotateCcw, AlertTriangle, UserCog, 
    CalendarDays, Ban, Smartphone, CheckCircle2, Loader2, SignalHigh,
    ClipboardCheck
} from 'lucide-react';
import { Link } from 'react-router-dom';

const stripUndefined = <T,>(data: T): T => (
  Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined)) as T
);

const getInitials = (name: string): string => {
  return name
    .split(' ')
    .map(part => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
};

interface SmsLogEntry {
    id: string;
    to: string;
    userName: string;
    message: string;
    timestamp: string;
    status: 'SENDING' | 'DELIVERED';
}

const App: React.FC = () => {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [users, setUsers] = useState<UserType[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [showProfile, setShowProfile] = useState(false);
  const [showPendingView, setShowPendingView] = useState(false);
  
  const [manualNotifications, setManualNotifications] = useState<AppNotification[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [activeTab, setActiveTab] = useState<'MY_JOBS' | 'AVAILABLE'>('MY_JOBS');
  
  const [smsBroadcast, setSmsBroadcast] = useState<string | null>(null);
  const [smsHistory, setSmsHistory] = useState<SmsLogEntry[]>([]);
  const [carrierStatus, setCarrierStatus] = useState<'CONNECTED' | 'DISCONNECTED'>('DISCONNECTED');
  
  const [adminViewMode, setAdminViewMode] = useState<'LIST' | 'CALENDAR'>('LIST');
  const [calendarDate, setCalendarDate] = useState(new Date());

  const [filterConfig, setFilterConfig] = useState({ status: 'ALL', assignee: 'ALL', startDate: '', endDate: '' });

  const [adminActionState, setAdminActionState] = useState<{ type: 'TRANSFER' | 'RESCHEDULE' | 'CANCEL'; job: Job; } | null>(null);
  const [actionInputValue, setActionInputValue] = useState('');
  const [isConfirmingAction, setIsConfirmingAction] = useState(false);

  const [claimJobState, setClaimJobState] = useState<Job | null>(null);
  const [isClaimingJob, setIsClaimingJob] = useState(false);

  const [showAddJobModal, setShowAddJobModal] = useState(false);
  const [newJobForm, setNewJobForm] = useState({ clientName: '', address: '', date: '', time: '09:00', pay: '', description: '', assigneeId: '' });

  const [dismissedIds, setDismissedIds] = useState<string[]>([]);
  const [readIds, setReadIds] = useState<string[]>([]);

  // --- Initialize SMS Carrier ---
  useEffect(() => {
      const initSms = async () => {
          await requestSmsPermissions();
          setCarrierStatus('CONNECTED');
      };
      initSms();
  }, []);

  const { profile, effectiveUid, viewAsUid, setViewAsUid } = useAuth();
  const userRole = profile?.role || 'scholar';
  const displayRole = viewAsUid ? 'scholar' : userRole;
  const currentUserId = effectiveUid;

  // --- Firestore Subscriptions ---
  useEffect(() => {
      if (!db || !profile) return;

      const usersRef = collection(db, COLLECTIONS.PROFILES);
      const usersUnsub = onSnapshot(usersRef, (snapshot) => {
          const nextUsers = snapshot.docs.map((docSnap) => {
              const data = docSnap.data() as Record<string, any>;
              const name = data.fullName || data.name || 'Scholar';
              return {
                  id: docSnap.id,
                  name,
                  role: data.role || 'scholar',
                  monthlyGoal: data.monthlyGoal || data.monthlyMoneyGoal || 0,
                  avatarInitials: data.avatarInitials || getInitials(name),
                  achievedMilestones: data.achievedMilestones || [],
                  phoneNumber: data.phone || data.phoneNumber || ''
              };
          });
          setUsers(nextUsers);
      });

      // gs_jobs: map gs field names to internal Job type
      const jobsRef = query(collection(db, COLLECTIONS.JOBS), orderBy('scheduledDate', 'asc'));
      const jobsUnsub = onSnapshot(jobsRef, (snapshot) => {
          const nextJobs = snapshot.docs.map((docSnap) => {
              const data = docSnap.data() as Record<string, any>;
              // Build full ISO date from scheduledDate + scheduledTimeStart
              const sd = data.scheduledDate || data.date || '';
              const st = data.scheduledTimeStart || '09:00';
              const dateStr = sd ? (sd.includes('T') ? sd : `${sd}T${st}:00`) : new Date().toISOString();
              return {
                  id: docSnap.id,
                  clientName: data.title || data.clientName || 'Unknown Client',
                  address: data.address || '',
                  date: dateStr,
                  scheduledEndTime: data.scheduledTimeEnd || data.scheduledEndTime || dateStr,
                  pay: data.payout ?? data.pay ?? 0,
                  description: data.description || '',
                  status: data.status || JobStatus.UPCOMING,
                  locationLat: data.lat ?? data.locationLat ?? 0,
                  locationLng: data.lng ?? data.locationLng ?? 0,
                  checklist: Array.isArray(data.checklist) ? data.checklist.map((item: any) => ({
                      id: item.id,
                      text: item.text,
                      isCompleted: item.completed ?? item.isCompleted ?? false,
                      status: item.approvalStatus === 'pending' ? 'PENDING' : item.status || 'APPROVED'
                  })) : [],
                  assigneeId: data.claimedBy || data.assigneeId,
                  assigneeName: data.claimedByName || data.assigneeName,
                  checkInTime: data.checkInTime,
                  checkOutTime: data.checkOutTime,
                  checkInMedia: data.checkInMedia,
                  checkOutMedia: data.checkOutMedia,
                  qualityReport: data.qualityReport,
                  cancellationReason: data.cancellationReason,
                  generatedSOP: data.sopContent || data.generatedSOP,
                  sopApprovedBy: data.sopApprovedBy,
                  sopApprovedAt: data.sopApprovedAt,
                  packageTier: data.packageTier,
                  shelvingSelections: data.shelvingSelections,
                  addOns: data.addOns,
                  package: data.package,
                  intakeMediaPaths: data.intakeMediaPaths,
                  sopId: data.sopId,
                  clientId: data.clientId || data.customerId,
                  clientFolder: data.clientFolder
              };
          });
          setJobs(nextJobs);
      });

      return () => {
          usersUnsub();
          jobsUnsub();
      };
  }, [db, profile]);

  const totalPendingTasks = jobs.reduce((acc, job) =>
    acc + job.checklist.filter(t => t.status === 'PENDING').length, 0
  );

  const currentUser = users.find(u => u.id === currentUserId) || null;

  const currentEarnings = useMemo(() => {
    if (!currentUserId) return 0;
    return jobs
      .filter(j => j.assigneeId === currentUserId && j.status === JobStatus.COMPLETED)
      .reduce((sum, j) => sum + j.pay, 0);
  }, [jobs, currentUserId]);

  const progressPercent = useMemo(() => {
    const user = currentUser;
    if (!user || user.monthlyGoal <= 0) return 0;
    return Math.min(100, (currentEarnings / user.monthlyGoal) * 100);
  }, [currentEarnings, currentUser]);

  // --- Milestone Logic ---
  useEffect(() => {
    let updatedUsers = [...users];
    let hasUpdates = false;
    let newCelebrations: AppNotification[] = [];
    if (!db) return;

    const processMilestones = async () => {
        const resultUsers = await Promise.all(updatedUsers.map(async (user) => {
            if (user.role !== 'scholar') return user;
            const earnings = jobs
                .filter(j => j.assigneeId === user.id && j.status === JobStatus.COMPLETED)
                .reduce((sum, j) => sum + j.pay, 0);
            const percentage = user.monthlyGoal > 0 ? (earnings / user.monthlyGoal) * 100 : 0;
            let milestoneHit = 0;
            if (percentage >= 100) milestoneHit = 100;
            else if (percentage >= 90) milestoneHit = 90;
            else if (percentage >= 80) milestoneHit = 80;

            if (milestoneHit > 0 && !user.achievedMilestones.includes(milestoneHit)) {
                hasUpdates = true;
                await setDoc(doc(db, COLLECTIONS.PROFILES, user.id), {
                    achievedMilestones: [...user.achievedMilestones, milestoneHit]
                }, { merge: true });
                const recipients: SmsRecipient[] = users
                    .filter(u => u.phoneNumber)
                    .map(u => ({ name: u.name, phoneNumber: u.phoneNumber! }));
                setSmsBroadcast(`BROADCASTING: Milestone hit! Texting ${recipients.length} team members...`);
                const smsResults = await broadcastMilestone(user.name, milestoneHit, earnings, recipients);
                const logEntries: SmsLogEntry[] = smsResults.map(res => ({
                    id: `sms-${Date.now()}-${res.phoneNumber}`,
                    to: res.phoneNumber,
                    userName: res.name,
                    message: res.message,
                    timestamp: res.timestamp,
                    status: 'DELIVERED'
                }));
                setSmsHistory(prev => [...logEntries, ...prev].slice(0, 50));
                setSmsBroadcast(`SUCCESS: Texts delivered to ${recipients.map(r => r.name.split(' ')[0]).join(', ')}.`);
                setTimeout(() => setSmsBroadcast(null), 5000);
                newCelebrations.push({
                    id: `cel-${Date.now()}-${user.id}-${milestoneHit}`,
                    jobId: 'celebration',
                    message: smsResults[0]?.message || 'Goal Reached!',
                    type: 'CELEBRATION',
                    isRead: false,
                    timestamp: new Date().toISOString()
                });
                return { ...user, achievedMilestones: [...user.achievedMilestones, milestoneHit] };
            }
            return user;
        }));
        if (hasUpdates) {
            setUsers(resultUsers);
            setManualNotifications(prev => [...newCelebrations, ...prev]);
        }
    };
    processMilestones();
  }, [jobs]);

  const generatedNotifications = useMemo(() => {
      const rawNotifications: AppNotification[] = [];
      const now = Date.now();

      jobs.forEach(job => {
        if (displayRole === 'scholar' && job.assigneeId !== currentUserId) return;
        if (job.status === JobStatus.UPCOMING) {
          const jobTime = new Date(job.date).getTime();
          const diffDays = (jobTime - now) / (1000 * 60 * 60 * 24);
          if (diffDays <= 3 && diffDays > 1.5) {
              rawNotifications.push({ id: `notif-${job.id}-3d`, jobId: job.id, message: `Upcoming Job: ${job.clientName} in 3d.`, type: '3_DAY', isRead: false, timestamp: new Date().toISOString() });
          }
        }
      });

      // CORE SYSTEM: Generate Admin Notification for Pending Tasks
      if (displayRole === 'admin' && totalPendingTasks > 0) {
          rawNotifications.push({ 
              id: 'pending-tasks-alert', 
              jobId: 'admin-action', 
              message: `Action Required: ${totalPendingTasks} pending task request(s) to approve.`, 
              type: 'CHECKLIST_REQUEST', 
              isRead: false, 
              timestamp: new Date().toISOString() 
          });
      }
      return rawNotifications;
  }, [jobs, displayRole, totalPendingTasks, currentUserId]);

  const notifications = useMemo(() => {
      const combined = [...manualNotifications, ...generatedNotifications];
      const unique = Array.from(new Map(combined.map(item => [item.id, item])).values());
      return unique
        .filter(n => !dismissedIds.includes(n.id))
        .map(n => ({ ...n, isRead: readIds.includes(n.id) }))
        .sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [manualNotifications, generatedNotifications, dismissedIds, readIds]);

  const handleJobUpdate = async (updatedJob: Job) => {
    setJobs(prev => prev.map(j => j.id === updatedJob.id ? updatedJob : j));
    if (!db) return;
    const { id, ...raw } = updatedJob;
    // Map internal Job fields → gs_jobs Firestore fields
    const payload: Record<string, any> = {
        ...raw,
        title: raw.clientName,
        payout: raw.pay,
        scheduledDate: raw.date,
        lat: raw.locationLat,
        lng: raw.locationLng,
        claimedBy: raw.assigneeId ?? null,
        claimedByName: raw.assigneeName ?? null,
        sopContent: raw.generatedSOP,
    };
    if (Array.isArray(raw.checklist)) {
        payload.checklist = raw.checklist.map((item: any) => ({
            id: item.id,
            text: item.text,
            completed: item.isCompleted,
            approvalStatus: (item.status || 'APPROVED').toLowerCase()
        }));
    }
    await setDoc(doc(db, COLLECTIONS.JOBS, id), stripUndefined(payload), { merge: true });
  };

  const handleUserUpdate = async (userId: string, updates: Partial<UserType>) => {
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, ...updates } : u));
    if (!db) return;
    // Map internal User fields → gs_profiles Firestore fields
    const gsUpdates: Record<string, any> = { ...updates };
    if (updates.name !== undefined) gsUpdates.fullName = updates.name;
    if (updates.phoneNumber !== undefined) gsUpdates.phone = updates.phoneNumber;
    await setDoc(doc(db, COLLECTIONS.PROFILES, userId), stripUndefined(gsUpdates), { merge: true });
  };

  
  const handleManualNotification = (message: string, jobId: string) => {
      const newNotif: AppNotification = { 
          id: `checklist-${Date.now()}`, 
          jobId, 
          message, 
          type: 'CHECKLIST_REQUEST', 
          isRead: false, 
          timestamp: new Date().toISOString() 
      };
      setManualNotifications(prev => [newNotif, ...prev]);
  };

  const handleAdminTaskAction = (type: 'APPROVED' | 'REJECTED', jobName: string, taskText: string, jobId: string) => {
      // 1. Show confirmation toast
      setSmsBroadcast(`ADMIN DECISION: Task "${taskText}" for ${jobName} was ${type}. Sending scholar alert...`);
      setTimeout(() => setSmsBroadcast(null), 4000);

      // 2. Create persistent notification for the scholar
      const responseNotif: AppNotification = {
          id: `response-${Date.now()}`,
          jobId: jobId,
          message: `Task ${type}: "${taskText}" for ${jobName} has been ${type.toLowerCase()} by Admin.`,
          type: 'CHECKLIST_REQUEST', 
          isRead: false,
          timestamp: new Date().toISOString()
      };
      setManualNotifications(prev => [responseNotif, ...prev]);
  };

  const handleMarkAllRead = () => setReadIds(prev => [...new Set([...prev, ...notifications.map(n => n.id)])]);
  
  const handleNotificationClick = (jobId: string, notifId: string) => {
    setReadIds(prev => [...prev, notifId]);
    if (jobId === 'admin-action') {
        setShowPendingView(true);
    } else if (jobId !== 'celebration' && jobId !== 'system') {
        setSelectedJobId(jobId);
    }
    setShowNotifications(false);
  };

  const handleAdminActionClick = (action: 'TRANSFER' | 'RESCHEDULE' | 'CANCEL', job: Job, e: React.MouseEvent) => {
      e.stopPropagation();
      if (action === 'TRANSFER') setActionInputValue(job.assigneeId || '');
      if (action === 'RESCHEDULE') setActionInputValue(new Date(job.date).toISOString().slice(0, 16));
      if (action === 'CANCEL') { setActionInputValue(''); setIsConfirmingAction(false); }
      setAdminActionState({ type: action, job });
  };

  const handleClaimJobClick = (job: Job, e: React.MouseEvent) => {
    e.stopPropagation();
    setClaimJobState(job);
  };

  const confirmClaimJob = async () => {
    if (!claimJobState || !currentUserId || !currentUser || !db) return;

    setIsClaimingJob(true);
    try {
      const jobRef = doc(db, COLLECTIONS.JOBS, claimJobState.id);

      await setDoc(jobRef, {
        claimedBy: currentUserId,
        claimedByName: currentUser.name,
        assigneeId: currentUserId,
        assigneeName: currentUser.name,
        status: JobStatus.UPCOMING,
        claimedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      }, { merge: true });

      // Success! Switch to My Schedule tab
      setActiveTab('MY_JOBS');
      setClaimJobState(null);
      setSmsBroadcast(`SUCCESS: Claimed ${claimJobState.clientName} job! Check "My Schedule".`);
      setTimeout(() => setSmsBroadcast(null), 4000);

    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to claim job.';
      if (message.includes('permission') || message.includes('already')) {
        setSmsBroadcast(`ERROR: Job already claimed by another scholar.`);
      } else {
        setSmsBroadcast(`ERROR: ${message}`);
      }
      setTimeout(() => setSmsBroadcast(null), 4000);
      setClaimJobState(null);
    } finally {
      setIsClaimingJob(false);
    }
  };

  const submitAdminAction = async () => {
      if (!adminActionState) return;
      const { type, job } = adminActionState;
      let updatedJob = { ...job };
      if (type === 'TRANSFER') {
          const user = users.find(u => u.id === actionInputValue);
          updatedJob.assigneeId = user?.id; updatedJob.assigneeName = user?.name;
      } else if (type === 'RESCHEDULE') {
          updatedJob.date = new Date(actionInputValue).toISOString();
      } else if (type === 'CANCEL') {
          updatedJob.status = JobStatus.CANCELLED; updatedJob.assigneeId = undefined; updatedJob.assigneeName = undefined; updatedJob.cancellationReason = actionInputValue;
      }
      await handleJobUpdate(updatedJob);
      setAdminActionState(null);
  };

  const selectedJob = jobs.find(j => j.id === selectedJobId);
  const unreadCount = notifications.filter(n => !n.isRead).length;

  if (firebaseInitError) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-900 font-sans flex items-center justify-center p-6">
        <div className="max-w-md rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          <div className="font-bold mb-1">Firebase configuration missing</div>
          <div>{firebaseInitError}</div>
          <div className="mt-2 text-rose-600">Update `schedulingsystem/app/.env.local` and restart the dev server.</div>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-900 font-sans flex items-center justify-center">
        <div className="text-sm text-slate-500">Loading scheduling system...</div>
      </div>
    );
  }

  if (showPendingView && displayRole === 'admin') return (<PendingApprovals jobs={jobs} onUpdateJob={handleJobUpdate} onBack={() => setShowPendingView(false)} onTaskAction={handleAdminTaskAction} />);
  if (selectedJob) return (<JobDetail job={selectedJob} users={users} onBack={() => setSelectedJobId(null)} onUpdateJob={handleJobUpdate} onNotifyAdmin={handleManualNotification} userRole={userRole} currentUserId={currentUserId} />);
  if (showProfile) return (
    <UserProfile
      onBack={() => setShowProfile(false)}
      userRole={displayRole}
      users={users}
      onUpdateUser={handleUserUpdate}
      jobs={jobs}
      currentUserId={currentUserId}
    />
  );

  const masterList = [...jobs].sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const myJobs = masterList.filter(j => j.assigneeId === currentUserId);
  const availableJobs = masterList.filter(j => !j.assigneeId && j.status === JobStatus.APPROVED_FOR_POSTING);
  const displayedJobs = displayRole === 'admin' ? masterList : (activeTab === 'MY_JOBS' ? myJobs : availableJobs);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans relative">
      {/* Network Alert Toast */}
      {smsBroadcast && (
          <div className="fixed top-20 left-4 right-4 z-50 animate-in slide-in-from-top-4 fade-in">
             <div className="bg-slate-900 text-white p-4 rounded-xl shadow-2xl flex items-start gap-3 border-l-4 border-emerald-500">
                <SignalHigh className="text-emerald-400 mt-0.5" size={20} />
                <div>
                   <h4 className="font-bold text-[10px] text-emerald-400 uppercase tracking-widest mb-1">Carrier Dispatch Log</h4>
                   <p className="text-sm font-medium leading-tight">{smsBroadcast}</p>
                </div>
             </div>
          </div>
      )}

      {/* Header Banner */}
      <header className="sticky top-0 z-20 text-white" style={{ background: 'linear-gradient(to bottom, #0f1b2d, #162340)' }}>
          <div className="max-w-md mx-auto px-5 pt-5 pb-5">
              {/* ScholarHub branding */}
              <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500 mb-3 block">ScholarHub</span>
              {/* Top row: Name + actions */}
              <div className="flex items-start justify-between mb-4">
                  <div>
                      <h1 className="text-2xl font-bold text-white leading-tight">{currentUser?.name || profile?.name || 'Scholar'}</h1>
                      <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-slate-400 mt-0.5">{displayRole === 'admin' ? 'Administrator' : 'Field Specialist'}</p>
                  </div>
                  <div className="flex items-center gap-3">
                      {userRole === 'admin' && (
                        <Link to="/admin" className="text-[10px] font-bold text-amber-400 uppercase tracking-wide hover:text-amber-300">Admin Panel</Link>
                      )}
                      <button className="relative p-2 -mr-2" onClick={() => setShowNotifications(!showNotifications)}>
                          <Bell size={18} className="text-slate-400" />
                          {unreadCount > 0 && (<span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-rose-500 rounded-full border-2" style={{ borderColor: '#162340' }}></span>)}
                      </button>
                      <button onClick={() => setShowProfile(true)} className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#1e3050' }}>
                          <Trophy size={18} className="text-amber-400" />
                      </button>
                  </div>
              </div>
              {/* Target Progress Card */}
              <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm p-4">
                  <div className="flex justify-between items-center mb-2.5">
                      <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">Target Progress</span>
                      <span className="text-sm font-bold text-white">${currentEarnings} / ${currentUser?.monthlyGoal || 500}</span>
                  </div>
                  <div className="w-full bg-black/30 rounded-full h-2 overflow-hidden">
                      <div className={`h-full rounded-full transition-all duration-1000 ${progressPercent >= 100 ? 'bg-emerald-400' : 'bg-slate-400'}`} style={{ width: `${Math.min(progressPercent, 100)}%` }}></div>
                  </div>
                  <p className="text-xs text-slate-500 italic text-center mt-3">Fuel your monthly payout. Complete more jobs to hit 75%.</p>
              </div>
          </div>
          {showNotifications && (
            <div className="absolute top-full right-0 left-0 bg-white border-b shadow-lg z-30 animate-in slide-in-from-top-2">
                <div className="max-w-md mx-auto">
                    <div className="p-3 bg-slate-50 border-b flex justify-between items-center"><span className="text-xs font-semibold text-slate-500 uppercase">Notifications</span><button onClick={handleMarkAllRead} className="text-xs font-medium text-blue-600">Mark all read</button></div>
                    <div className="max-h-[60vh] overflow-y-auto">{notifications.length === 0 ? (<div className="p-8 text-center text-slate-500 text-sm">No new alerts</div>) : (notifications.map(n => (<div key={n.id} onClick={() => handleNotificationClick(n.jobId, n.id)} className={`p-4 border-b flex gap-3 cursor-pointer ${n.isRead ? 'bg-white opacity-70' : 'bg-blue-50/40'}`}><div className={`w-2 h-2 mt-2 rounded-full flex-shrink-0 ${n.type === 'CELEBRATION' ? 'bg-amber-500' : 'bg-blue-500'}`} /><div className="flex-grow pr-6"><p className="text-sm text-slate-800">{n.type === 'CELEBRATION' && <Trophy size={14} className="inline mr-1 text-amber-600"/>}{n.message}</p></div></div>)))}</div>
                </div>
            </div>
          )}
      </header>

      <main className="max-w-md mx-auto px-4 py-6 space-y-6">
        {viewAsUid && (
          <div className="bg-amber-100 border border-amber-200 text-amber-800 rounded-xl px-4 py-3 text-xs flex items-center justify-between">
            <span>Viewing as {users.find(u => u.id === viewAsUid)?.name || "Scholar"}</span>
            <button onClick={() => setViewAsUid(null)} className="font-bold text-amber-700">Exit</button>
          </div>
        )}
        {displayRole === 'scholar' ? null : (
            <div className="space-y-4">
                {/* Admin Pending Task Alert Card */}
                {totalPendingTasks > 0 && (
                    <button 
                        onClick={() => setShowPendingView(true)}
                        className="w-full bg-orange-50 border border-orange-200 rounded-xl p-4 flex items-center justify-between text-left shadow-sm animate-pulse active:scale-95 transition-all"
                    >
                        <div className="flex items-center gap-3">
                            <div className="bg-orange-500 text-white p-2 rounded-lg">
                                <ClipboardCheck size={20} />
                            </div>
                            <div>
                                <h3 className="font-bold text-orange-900 text-sm">Action Required</h3>
                                <p className="text-xs text-orange-700">{totalPendingTasks} task request(s) waiting for approval.</p>
                            </div>
                        </div>
                        <ArrowRight size={18} className="text-orange-400" />
                    </button>
                )}

                {/* Admin SMS Center */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="font-bold text-slate-800 flex items-center gap-2">
                            <Smartphone size={20} className="text-blue-600" /> Real-Time SMS Outbox
                        </h3>
                        <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${carrierStatus === 'CONNECTED' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400'}`}>
                            <div className={`w-1.5 h-1.5 rounded-full ${carrierStatus === 'CONNECTED' ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`} />
                            Carrier {carrierStatus}
                        </div>
                    </div>
                    <div className="space-y-3 max-h-[250px] overflow-y-auto pr-2 custom-scrollbar">
                        {smsHistory.length === 0 ? (
                            <div className="text-center py-8 text-slate-400 flex flex-col items-center gap-2">
                                <MessageSquare size={32} className="opacity-20" />
                                <p className="text-xs italic">Waiting for team milestones...</p>
                            </div>
                        ) : (
                            smsHistory.map(log => (
                                <div key={log.id} className="bg-slate-50 border border-slate-100 rounded-lg p-3">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <span className="text-[10px] font-black text-slate-400 uppercase">To: {log.userName}</span>
                                            <p className="text-xs font-bold text-blue-600 font-mono tracking-tighter">{log.to}</p>
                                        </div>
                                        <div className="text-right">
                                            <div className="flex items-center gap-1 text-[9px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100">
                                                <CheckCircle2 size={10} /> 200 OK
                                            </div>
                                            <span className="text-[8px] text-slate-400 block mt-1">{new Date(log.timestamp).toLocaleTimeString([], {hour:'numeric', minute:'2-digit', second:'2-digit'})}</span>
                                        </div>
                                    </div>
                                    <p className="text-xs text-slate-600 leading-snug mt-2 pt-2 border-t border-slate-100">{log.message}</p>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                <div className="bg-slate-800 rounded-2xl p-6 text-white shadow-lg">
                    <h2 className="text-2xl font-bold mb-1">Master Schedule</h2>
                    <div className="mt-4 flex gap-2">
                        <button onClick={() => setAdminViewMode('LIST')} className={`flex-1 py-3 rounded-lg text-sm font-medium ${adminViewMode === 'LIST' ? 'bg-slate-700 text-white shadow-inner' : 'text-slate-400'}`}><List size={16} className="inline mr-2" /> List</button>
                        <button onClick={() => setAdminViewMode('CALENDAR')} className={`flex-1 py-3 rounded-lg text-sm font-medium ${adminViewMode === 'CALENDAR' ? 'bg-slate-700 text-white shadow-inner' : 'text-slate-400'}`}><CalendarIcon size={16} className="inline mr-2" /> Calendar</button>
                    </div>
                </div>
            </div>
        )}

        {displayRole === 'scholar' && (<div className="flex bg-white rounded-xl p-1 shadow-sm border"><button onClick={() => setActiveTab('MY_JOBS')} className={`flex-1 py-3 text-sm font-medium rounded-lg ${activeTab === 'MY_JOBS' ? 'bg-blue-50 text-blue-700' : 'text-slate-500'}`}>My Schedule</button><button onClick={() => setActiveTab('AVAILABLE')} className={`flex-1 py-3 text-sm font-medium rounded-lg ${activeTab === 'AVAILABLE' ? 'bg-orange-50 text-orange-700' : 'text-slate-500'}`}>Job Board 🔥</button></div>)}

        <div className="space-y-4">
            <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} /><input type="text" placeholder="Search operations..." className="w-full bg-white border rounded-xl py-3.5 pl-10 pr-4 text-sm" /></div>
            {displayedJobs.map(job => (
              <JobCard
                key={job.id}
                job={job}
                onClick={() => setSelectedJobId(job.id)}
                isAdmin={displayRole === 'admin'}
                onAdminAction={handleAdminActionClick}
                onClaimJob={displayRole === 'scholar' && activeTab === 'AVAILABLE' ? handleClaimJobClick : undefined}
                isAvailableJob={displayRole === 'scholar' && activeTab === 'AVAILABLE' && job.status === JobStatus.APPROVED_FOR_POSTING}
                showCompetitionMetrics={displayRole === 'scholar' && activeTab === 'AVAILABLE'}
              />
            ))}
        </div>
      </main>

      {displayRole === 'admin' && (<button onClick={() => setShowAddJobModal(true)} className="fixed bottom-6 right-6 w-14 h-14 bg-blue-600 text-white rounded-full shadow-lg flex items-center justify-center hover:scale-105 transition-all"><Plus size={28} /></button>)}
      
      {claimJobState && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 animate-in fade-in backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl">
            <h3 className="text-xl font-bold mb-2 text-slate-800">Claim This Job?</h3>
            <p className="text-sm text-slate-600 mb-4">
              You're about to claim <span className="font-semibold">{claimJobState.clientName}</span> for <span className="font-bold text-emerald-600">${claimJobState.pay}</span>.
            </p>
            <div className="bg-slate-50 rounded-lg p-3 mb-4 text-xs text-slate-600">
              <p className="font-semibold mb-1">📍 {claimJobState.address}</p>
              <p>🗓️ {new Date(claimJobState.date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })} at {new Date(claimJobState.date).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</p>
            </div>
            <p className="text-xs text-slate-500 mb-6">
              ⚠️ Once claimed, you'll have 2 hours to cancel if needed.
            </p>
            <button
              onClick={confirmClaimJob}
              disabled={isClaimingJob}
              className="w-full bg-emerald-600 text-white font-bold py-3 rounded-xl hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed mb-2"
            >
              {isClaimingJob ? 'Claiming...' : `Confirm - Claim Job`}
            </button>
            <button
              onClick={() => setClaimJobState(null)}
              disabled={isClaimingJob}
              className="w-full text-slate-400 text-sm py-2"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {adminActionState && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 animate-in fade-in backdrop-blur-sm">
              <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl">
                  <h3 className="text-lg font-bold mb-4">{adminActionState.type} Operation</h3>
                  {adminActionState.type === 'TRANSFER' && (
                      <select className="w-full border rounded-xl p-3 mb-6" value={actionInputValue} onChange={(e) => setActionInputValue(e.target.value)}><option value="">Unassigned</option>{users.map(u => (<option key={u.id} value={u.id}>{u.name}</option>))}</select>
                  )}
                  {adminActionState.type === 'RESCHEDULE' && (<input type="datetime-local" className="w-full border rounded-xl p-3 mb-6" value={actionInputValue} onChange={(e) => setActionInputValue(e.target.value)}/>)}
                  <button onClick={submitAdminAction} className="w-full bg-blue-600 text-white font-bold py-3 rounded-xl">Confirm Changes</button>
                  <button onClick={() => setAdminActionState(null)} className="w-full mt-2 text-slate-400 text-sm py-2">Back</button>
              </div>
          </div>
      )}
    </div>
  );
};

export default App;

import React from 'react';
import { Job, JobStatus } from '../types';
import { MapPin, DollarSign, Calendar, Clock, Eye, Flame, Zap, TrendingUp, UserCog, Ban, CalendarDays } from 'lucide-react';

interface JobCardProps {
  job: Job;
  onClick: () => void;
  showCompetitionMetrics?: boolean;
  isAdmin?: boolean;
  onAdminAction?: (action: 'TRANSFER' | 'RESCHEDULE' | 'CANCEL', job: Job, e: React.MouseEvent) => void;
  onClaimJob?: (job: Job, e: React.MouseEvent) => void;
  isAvailableJob?: boolean;
}

const JobCard: React.FC<JobCardProps> = ({ job, onClick, showCompetitionMetrics = false, isAdmin = false, onAdminAction, onClaimJob, isAvailableJob = false }) => {
  const getStatusColor = (status: JobStatus) => {
    switch (status) {
      case JobStatus.COMPLETED: return 'bg-emerald-100 text-emerald-800 border border-emerald-200';
      case JobStatus.IN_PROGRESS: return 'bg-blue-100 text-blue-800 border border-blue-200';
      case JobStatus.CANCELLED: return 'bg-rose-100 text-rose-800 border border-rose-200';
      default: return 'bg-amber-100 text-amber-800 border border-amber-200';
    }
  };

  const formattedDate = new Date(job.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  const formattedTime = new Date(job.date).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

  // Heuristics for "Hot" jobs
  const isHighPay = job.pay >= 400;
  const isUrgent = new Date(job.date).getTime() - Date.now() < 86400000 * 3; // Less than 3 days
  
  // Deterministic "viewer count" simulation based on job ID to simulate competition
  const viewerCount = showCompetitionMetrics 
    ? (job.id.split('').reduce((a, b) => a + b.charCodeAt(0), 0) % 5) + 2 
    : 0;

  return (
    <div 
      onClick={onClick}
      className={`bg-white rounded-xl shadow-sm border p-4 sm:p-5 mb-4 active:scale-[0.98] transition-all cursor-pointer hover:shadow-md relative overflow-hidden group
        ${job.status === JobStatus.CANCELLED ? 'border-rose-100 opacity-75' : 'border-slate-200'}
        ${showCompetitionMetrics && isHighPay ? 'ring-1 ring-orange-200' : ''}
      `}
    >
      {/* Hot/Urgent Background Accents */}
      {showCompetitionMetrics && isHighPay && (
        <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-br from-orange-100 to-transparent rounded-bl-full opacity-50 pointer-events-none"></div>
      )}

      <div className="flex justify-between items-start gap-3 mb-3 relative z-10">
        <div className="flex-1 min-w-0">
          {/* Client Name: optimized for wrapping on small screens */}
          <h3 className={`font-bold text-base sm:text-lg leading-snug break-words ${job.status === JobStatus.CANCELLED ? 'text-slate-500 line-through' : 'text-slate-900'}`}>
            {job.clientName}
          </h3>
          
          <div className="flex gap-2 mt-2 flex-wrap items-center">
            <span className={`inline-block px-2.5 py-1 rounded-md text-[10px] sm:text-xs font-bold uppercase tracking-wider ${getStatusColor(job.status)}`}>
              {job.status.replace('_', ' ')}
            </span>
            
            {showCompetitionMetrics && isHighPay && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] sm:text-xs font-bold bg-orange-100 text-orange-700 border border-orange-200 animate-pulse whitespace-nowrap">
                <Flame size={10} fill="currentColor" /> HIGH PAY
              </span>
            )}
            
            {showCompetitionMetrics && isUrgent && (
               <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] sm:text-xs font-bold bg-rose-100 text-rose-700 border border-rose-200 whitespace-nowrap">
                <Zap size={10} fill="currentColor" /> URGENT
              </span>
            )}
          </div>
        </div>

        <div className="text-right shrink-0">
          <div className={`flex items-center justify-end font-black text-lg sm:text-xl tracking-tight ${job.status === JobStatus.CANCELLED ? 'text-slate-400' : isHighPay && showCompetitionMetrics ? 'text-orange-600' : 'text-emerald-600'}`}>
            {showCompetitionMetrics && isHighPay && <TrendingUp size={16} className="mr-1 text-orange-500" />}
            <DollarSign size={16} className="sm:w-[18px] sm:h-[18px] -mr-0.5" />
            {job.pay}
          </div>
          <div className="text-[10px] sm:text-xs text-slate-400 font-medium uppercase tracking-wide">Est. Payout</div>
        </div>
      </div>

      <div className="space-y-2.5 relative z-10">
        <div className="flex items-start text-slate-600 text-sm">
          <MapPin size={16} className="mr-2 text-slate-400 flex-shrink-0 mt-0.5" />
          <span className="line-clamp-2 break-words leading-snug">{job.address}</span>
        </div>
        <div className="flex items-center text-slate-600 text-sm flex-wrap gap-y-1">
          <div className="flex items-center mr-4">
            <Calendar size={16} className="mr-2 text-slate-400 flex-shrink-0" />
            <span className="whitespace-nowrap">{formattedDate}</span>
          </div>
          <div className="flex items-center">
            <Clock size={16} className="mr-2 text-slate-400 flex-shrink-0" />
            <span className="whitespace-nowrap">{formattedTime}</span>
          </div>
        </div>
        
        {job.assigneeName && (
             <div className="pt-2 flex items-center gap-2 text-xs text-blue-600 font-semibold border-t border-slate-50 mt-3">
                 <div className="w-2 h-2 rounded-full bg-blue-500 shrink-0"></div>
                 <span className="truncate">Assigned to: {job.assigneeName}</span>
             </div>
        )}

        {/* Competition Metrics Footer */}
        {showCompetitionMetrics && (
          <div className="pt-3 mt-3 border-t border-slate-100 flex items-center justify-between">
             <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
                <Eye size={14} className="text-blue-500 shrink-0" />
                <span className="text-slate-500">{viewerCount} Scholars watching</span>
             </div>
          </div>
        )}

        {/* Scholar Claim Job Button */}
        {isAvailableJob && onClaimJob && (
          <div className="pt-3 mt-3 border-t border-slate-100">
            <button
              onClick={(e) => onClaimJob(job, e)}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-xl text-sm flex items-center justify-center gap-2 transition-colors shadow-sm hover:shadow-md active:scale-95"
            >
              <Zap size={18} fill="currentColor" />
              Claim Job - ${job.pay}
            </button>
          </div>
        )}

        {/* Admin Quick Actions Footer */}
        {isAdmin && job.status !== JobStatus.COMPLETED && job.status !== JobStatus.CANCELLED && (
            <div className="pt-3 mt-3 border-t border-slate-100 flex gap-2">
                <button
                    onClick={(e) => onAdminAction?.('TRANSFER', job, e)}
                    className="flex-1 bg-slate-100 hover:bg-blue-100 hover:text-blue-700 text-slate-600 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
                >
                    <UserCog size={14} /> Transfer
                </button>
                <button
                    onClick={(e) => onAdminAction?.('RESCHEDULE', job, e)}
                    className="flex-1 bg-slate-100 hover:bg-amber-100 hover:text-amber-700 text-slate-600 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
                >
                    <CalendarDays size={14} /> Reschedule
                </button>
                <button
                    onClick={(e) => onAdminAction?.('CANCEL', job, e)}
                    className="flex-1 bg-slate-100 hover:bg-rose-100 hover:text-rose-700 text-slate-600 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
                >
                    <Ban size={14} /> Cancel
                </button>
            </div>
        )}
      </div>
    </div>
  );
};

export default JobCard;
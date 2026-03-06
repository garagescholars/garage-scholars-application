
import React, { useState } from 'react';
import { Job, Task } from '../types';
import { ArrowLeft, CheckCircle, XCircle, Calendar, MapPin, CheckSquare, ShieldAlert, AlertTriangle, Loader2 } from 'lucide-react';

interface PendingApprovalsProps {
  jobs: Job[];
  onUpdateJob: (job: Job) => void;
  onBack: () => void;
  onTaskAction: (type: 'APPROVED' | 'REJECTED', jobName: string, taskText: string, jobId: string) => void;
}

type ConfirmationState = {
  type: 'APPROVE' | 'REJECT' | 'APPROVE_ALL';
  job: Job;
  task?: Task;
} | null;

const PendingApprovals: React.FC<PendingApprovalsProps> = ({ jobs, onUpdateJob, onBack, onTaskAction }) => {
  const [confirmation, setConfirmation] = useState<ConfirmationState>(null);

  // Filter only jobs that have pending tasks
  const jobsWithPendingTasks = jobs.filter(job => 
    job.checklist.some(t => t.status === 'PENDING')
  );

  const requestApprove = (job: Job, task: Task) => {
    setConfirmation({ type: 'APPROVE', job, task });
  };

  const requestReject = (job: Job, task: Task) => {
    setConfirmation({ type: 'REJECT', job, task });
  };

  const requestApproveAll = (job: Job) => {
    setConfirmation({ type: 'APPROVE_ALL', job });
  };

  const executeAction = () => {
    if (!confirmation) return;
    const { type, job, task } = confirmation;

    if (type === 'APPROVE' && task) {
        const updatedChecklist = job.checklist.map(t => 
          t.id === task.id ? { ...t, status: 'APPROVED' as const, actionTimestamp: new Date().toISOString() } : t
        );
        onUpdateJob({ ...job, checklist: updatedChecklist });
        onTaskAction('APPROVED', job.clientName, task.text, job.id);
    } 
    else if (type === 'REJECT' && task) {
        const updatedChecklist = job.checklist.filter(t => t.id !== task.id);
        onUpdateJob({ ...job, checklist: updatedChecklist });
        onTaskAction('REJECTED', job.clientName, task.text, job.id);
    } 
    else if (type === 'APPROVE_ALL') {
        const pendingCount = job.checklist.filter(t => t.status === 'PENDING').length;
        const updatedChecklist = job.checklist.map(t => 
          t.status === 'PENDING' ? { ...t, status: 'APPROVED' as const, actionTimestamp: new Date().toISOString() } : t
        );
        onUpdateJob({ ...job, checklist: updatedChecklist });
        onTaskAction('APPROVED', job.clientName, `${pendingCount} tasks`, job.id);
    }

    setConfirmation(null);
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-20 animate-in slide-in-from-right relative">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10 p-4 flex items-center shadow-sm">
        <button onClick={onBack} className="p-2 -ml-2 hover:bg-slate-100 rounded-full mr-2 text-slate-600">
          <ArrowLeft size={20} />
        </button>
        <div>
           <h2 className="font-bold text-lg text-slate-800">Pending Approvals</h2>
           <p className="text-xs text-slate-500">Review employee task requests</p>
        </div>
      </div>

      <div className="max-w-md mx-auto p-4 space-y-6">
        {jobsWithPendingTasks.length === 0 ? (
          <div className="text-center py-12 flex flex-col items-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
               <CheckCircle className="text-green-600" size={32} />
            </div>
            <h3 className="text-lg font-bold text-slate-800">All Caught Up!</h3>
            <p className="text-slate-500 mt-1">There are no pending tasks requiring approval.</p>
            <button 
              onClick={onBack}
              className="mt-6 px-6 py-2 bg-slate-200 text-slate-700 font-bold rounded-lg hover:bg-slate-300 transition-colors"
            >
              Return to Dashboard
            </button>
          </div>
        ) : (
          jobsWithPendingTasks.map(job => {
            const pendingTasks = job.checklist.filter(t => t.status === 'PENDING');
            
            return (
              <div key={job.id} className="bg-white rounded-xl shadow-sm border border-orange-200 overflow-hidden">
                {/* Job Header */}
                <div className="bg-orange-50 p-3 border-b border-orange-100 flex justify-between items-start">
                  <div>
                    <h3 className="font-bold text-slate-800">{job.clientName}</h3>
                    <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
                      <span className="flex items-center gap-1"><MapPin size={10} /> {job.address.split(',')[0]}</span>
                      <span className="flex items-center gap-1"><Calendar size={10} /> {new Date(job.date).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <button 
                    onClick={() => requestApproveAll(job)}
                    className="text-xs font-bold text-orange-700 bg-white border border-orange-200 px-2 py-1 rounded hover:bg-orange-100 transition-colors"
                  >
                    Approve All ({pendingTasks.length})
                  </button>
                </div>

                {/* Task List */}
                <div className="divide-y divide-slate-100">
                  {pendingTasks.map(task => (
                    <div key={task.id} className="p-4 flex flex-col gap-3">
                      <div className="flex items-start gap-3">
                         <div className="mt-1 bg-orange-100 p-1.5 rounded text-orange-600">
                            <ShieldAlert size={16} />
                         </div>
                         <div className="flex-grow">
                            <p className="text-sm font-semibold text-slate-800">{task.text}</p>
                            <p className="text-xs text-slate-400 mt-0.5">
                              Requested by {job.assigneeName || 'Employee'}
                              {task.actionTimestamp && ` at ${new Date(task.actionTimestamp).toLocaleTimeString()}`}
                            </p>
                         </div>
                      </div>
                      
                      <div className="flex gap-2 pl-11">
                        <button 
                           onClick={() => requestApprove(job, task)}
                           className="flex-1 flex items-center justify-center gap-1.5 bg-green-600 text-white text-sm font-bold py-2 rounded-lg hover:bg-green-700 transition-colors"
                        >
                           <CheckCircle size={16} /> Approve
                        </button>
                        <button 
                           onClick={() => requestReject(job, task)}
                           className="flex-1 flex items-center justify-center gap-1.5 bg-white border border-red-200 text-red-600 text-sm font-bold py-2 rounded-lg hover:bg-red-50 transition-colors"
                        >
                           <XCircle size={16} /> Reject
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Confirmation Modal */}
      {confirmation && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white rounded-xl p-6 max-w-sm w-full shadow-2xl transform transition-all animate-in zoom-in-95">
                <div className="flex flex-col items-center text-center mb-4">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-3 ${confirmation.type === 'REJECT' ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'}`}>
                        <AlertTriangle size={24} />
                    </div>
                    <h3 className="text-lg font-bold text-slate-800">
                        {confirmation.type === 'APPROVE' ? 'Approve Task?' : 
                         confirmation.type === 'REJECT' ? 'Reject Task?' : 
                         'Approve All Tasks?'}
                    </h3>
                    <p className="text-slate-500 text-sm mt-2">
                        {confirmation.type === 'APPROVE_ALL' 
                            ? `Are you sure you want to approve all pending tasks for ${confirmation.job.clientName}?`
                            : `Are you sure you want to ${confirmation.type.toLowerCase()} "${confirmation.task?.text}"?`
                        }
                    </p>
                    {confirmation.type === 'REJECT' && (
                        <p className="text-xs text-red-500 mt-2 font-medium">This will remove the item from the checklist.</p>
                    )}
                </div>
                
                <div className="flex gap-3">
                    <button 
                        onClick={() => setConfirmation(null)}
                        className="flex-1 py-3 text-slate-600 font-bold hover:bg-slate-100 rounded-xl transition-colors bg-slate-50"
                    >
                        Cancel
                    </button>
                    <button 
                        onClick={executeAction}
                        className={`flex-1 py-3 text-white font-bold rounded-xl shadow-sm transition-colors ${
                            confirmation.type === 'REJECT' ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'
                        }`}
                    >
                        Confirm
                    </button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default PendingApprovals;

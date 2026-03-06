
import React, { useState, useEffect, useRef } from 'react';
import { Job, JobStatus, JobMedia, Task, User, UserRole } from '../types';
import CameraCapture from '../components/CameraCapture';
import { doc, setDoc } from 'firebase/firestore';
import { getDownloadURL, ref as storageRef, uploadBytes } from 'firebase/storage';
import { db, storage } from '../src/firebase';
import { COLLECTIONS } from '../src/collections';
import { ArrowLeft, MapPin, CheckCircle, Loader2, CheckSquare, Square, Trash2, Plus, ShieldAlert, Pencil, Calendar, Upload, Clock, AlertTriangle, ChevronDown, ChevronUp, Flag } from 'lucide-react';
import { resizeImage, resizeFileToBlob } from '../utils/resizeImage';

interface JobDetailProps {
  job: Job;
  users?: User[]; 
  onBack: () => void;
  onUpdateJob: (updatedJob: Job) => void;
  onNotifyAdmin: (message: string, jobId: string) => void;
  userRole?: UserRole;
  currentUserId: string | null;
}

export const JobDetail: React.FC<JobDetailProps> = ({ job, users = [], onBack, onUpdateJob, onNotifyAdmin, userRole = 'scholar' as UserRole, currentUserId }) => {
  const [activeStep, setActiveStep] = useState<'details' | 'checkin' | 'checkout' | 'report'>('details');
  const [mediaBuffer, setMediaBuffer] = useState<Partial<JobMedia>>({});
  const [isProcessing, setIsProcessing] = useState(false);
  const [newTaskText, setNewTaskText] = useState('');
  const [showConfirmation, setShowConfirmation] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const intakeInputRef = useRef<HTMLInputElement>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancellationReason, setCancellationReason] = useState('');
  const [sortOption, setSortOption] = useState<'default' | 'alpha' | 'status'>('default');
  const [intakeUploads, setIntakeUploads] = useState<{ path: string; url: string }[]>([]);
  const [sopExpanded, setSopExpanded] = useState<Set<number>>(new Set([0, 1, 2, 3, 4, 5]));

  const getLocalDateTime = (isoString: string) => {
    const date = new Date(isoString);
    const offset = date.getTimezoneOffset();
    const localDate = new Date(date.getTime() - (offset * 60 * 1000));
    return localDate.toISOString().slice(0, 16);
  };

  const [editForm, setEditForm] = useState({
      clientName: job.clientName,
      address: job.address,
      date: getLocalDateTime(job.date),
      pay: job.pay,
      description: job.description
  });

  useEffect(() => {
    setEditForm({
        clientName: job.clientName,
        address: job.address,
        date: getLocalDateTime(job.date),
        pay: job.pay,
        description: job.description
    });
    window.scrollTo(0, 0);
  }, [job]);

  useEffect(() => {
    const run = async () => {
      if (!storage) return;
      const paths = job.intakeMediaPaths || [];
      const results = await Promise.all(paths.map(async (path) => {
        const url = await getDownloadURL(storageRef(storage, path));
        return { path, url };
      }));
      setIntakeUploads(results);
    };
    run().catch(() => setIntakeUploads([]));
  }, [job.intakeMediaPaths]);

  const generateTimestamp = () => new Date().toISOString();

  const handleMediaCapture = (key: keyof JobMedia, data: string, timestamp?: string) => {
    const timestampKey = key === 'photoFrontOfHouse' ? 'photoTimestamp' : 'videoTimestamp';
    const finalTimestamp = timestamp || generateTimestamp();
    setMediaBuffer(prev => ({ ...prev, [key]: data, [timestampKey]: finalTimestamp }));
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
        const reader = new FileReader();
        reader.onloadend = async () => {
            const result = reader.result as string;
            const resized = await resizeImage(result, 1600, 0.8);
            handleMediaCapture('photoFrontOfHouse', resized, new Date().toISOString());
        };
        reader.readAsDataURL(file);
    }
  };

  const submitCheckIn = async () => {
    const saved = job.checkInMedia;
    const photo = mediaBuffer.photoFrontOfHouse || saved?.photoFrontOfHouse;
    if (!photo) {
      alert("Please take a photo of the property exterior.");
      return;
    }

    if (!storage) {
      alert("Storage not initialized.");
      return;
    }

    setIsProcessing(true);
    try {
      // Convert base64 to blob
      const response = await fetch(photo);
      const blob = await response.blob();

      // Upload to Firebase Storage (client-centric path with legacy fallback)
      const clientFolder = (job as any).clientFolder;
      const path = clientFolder
        ? `clients/${clientFolder}/job/photos/checkin-exterior.jpg`
        : `jobs/${job.id}/checkin.jpg`;
      const uploadRef = storageRef(storage, path);
      await uploadBytes(uploadRef, blob);

      const now = generateTimestamp();

      // Update job with storage path instead of base64
      onUpdateJob({
        ...job,
        status: JobStatus.IN_PROGRESS,
        checkInTime: now,
        checkInMedia: {
          photoFrontOfHouse: path,
          videoGarage: '',
          timestamp: now,
          photoTimestamp: now
        }
      });

      setMediaBuffer({});
      setActiveStep('details');
    } catch (error) {
      console.error('Check-in upload failed:', error);
      alert('Failed to upload check-in photo. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const processCheckOut = async () => {
    setShowConfirmation(false);
    const saved = job.checkOutMedia;
    const photo = mediaBuffer.photoFrontOfHouse || saved?.photoFrontOfHouse;
    const video = mediaBuffer.videoGarage || saved?.videoGarage;
    if (!photo || !video) return;

    if (!storage) {
      alert("Storage not initialized.");
      return;
    }

    setIsProcessing(true);
    try {
      const now = generateTimestamp();

      // Upload photo to Firebase Storage (client-centric path with legacy fallback)
      const clientFolder = (job as any).clientFolder;
      let photoPath = saved?.photoFrontOfHouse || '';
      if (mediaBuffer.photoFrontOfHouse) {
        const photoBlob = await fetch(photo).then(r => r.blob());
        photoPath = clientFolder
          ? `clients/${clientFolder}/outtake/photos/checkout-exterior.jpg`
          : `jobs/${job.id}/checkout.jpg`;
        await uploadBytes(storageRef(storage, photoPath), photoBlob);
      }

      // Upload video to Firebase Storage
      let videoPath = saved?.videoGarage || '';
      if (mediaBuffer.videoGarage) {
        const videoBlob = await fetch(video).then(r => r.blob());
        videoPath = clientFolder
          ? `clients/${clientFolder}/outtake/photos/walkthrough.mp4`
          : `jobs/${job.id}/checkout.mp4`;
        await uploadBytes(storageRef(storage, videoPath), videoBlob);
      }

      // Create media object with Storage paths instead of base64
      const checkOutMedia: JobMedia = {
        photoFrontOfHouse: photoPath,
        videoGarage: videoPath,
        timestamp: now,
        photoTimestamp: mediaBuffer.photoTimestamp || saved?.photoTimestamp || now,
        videoTimestamp: mediaBuffer.videoTimestamp || saved?.videoTimestamp || now,
      };

      // Stage 3: Gemini disabled. Stub a placeholder report for admin review.
      const report = job.checkInMedia
        ? "Quality review pending (manual)."
        : "Quality review pending (no check-in media).";

      onUpdateJob({
        ...job,
        status: JobStatus.REVIEW_PENDING,
        checkOutTime: now,
        checkOutMedia,
        qualityReport: report
      });

      setMediaBuffer({});
      setActiveStep('report');
    } catch (error) {
      console.error('Check-out upload failed:', error);
      alert('Failed to upload check-out media. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleQuickTransfer = (newAssigneeId: string) => {
      if (newAssigneeId === "") { onUpdateJob({ ...job, assigneeId: undefined, assigneeName: undefined }); }
      else {
          const employee = users.find(u => u.id === newAssigneeId);
          if (employee) onUpdateJob({ ...job, assigneeId: employee.id, assigneeName: employee.name });
      }
  };

  const submitCancellation = () => {
      if (!cancellationReason.trim()) return;
      onUpdateJob({ ...job, status: JobStatus.CANCELLED, assigneeId: undefined, assigneeName: undefined, cancellationReason: cancellationReason.trim() });
      setShowCancelModal(false);
  };

  const uploadIntakeMedia = async (files: FileList) => {
    if (!storage) return;
    const paths = job.intakeMediaPaths ? [...job.intakeMediaPaths] : [];
    const availableSlots = Math.max(0, 3 - paths.length);
    const selected = Array.from(files).slice(0, availableSlots);
    if (selected.length === 0) return;
    const clientFolder = (job as any).clientFolder;
    for (const file of selected) {
      const safeName = `${Date.now()}_${file.name.replace(/\s+/g, '_').replace(/\.[^.]+$/, '.jpg')}`;
      const path = clientFolder
        ? `clients/${clientFolder}/job/photos/${safeName}`
        : `schedulingsystem/jobs/${job.id}/intake/${safeName}`;
      const resizedBlob = await resizeFileToBlob(file, 1600, 0.8);
      const uploadRef = storageRef(storage, path);
      await uploadBytes(uploadRef, resizedBlob);
      paths.push(path);
    }
    await onUpdateJob({ ...job, intakeMediaPaths: paths });
  };

  // Parse SOP markdown into sections for display
  const parseSopSections = (text: string): { title: string; body: string }[] => {
    const parts = text.split(/^(## \d+\..+)$/m);
    const sections: { title: string; body: string }[] = [];
    for (let i = 1; i < parts.length; i += 2) {
      sections.push({
        title: parts[i].replace(/^## /, '').trim(),
        body: (parts[i + 1] || '').trim()
      });
    }
    return sections;
  };

  const toggleSopSection = (idx: number) => {
    setSopExpanded(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const addTask = () => {
      if (!newTaskText.trim()) return;
      const isApproved = userRole === 'admin';
      const newTask: Task = {
          id: Date.now().toString(),
          text: newTaskText.trim(),
          isCompleted: false,
          status: isApproved ? 'APPROVED' : 'PENDING',
          addedBy: userRole,
          actionTimestamp: new Date().toISOString()
      };
      onUpdateJob({ ...job, checklist: [...job.checklist, newTask] });
      setNewTaskText('');
      if (!isApproved) {
          onNotifyAdmin(`Task Request: "${newTask.text}" added to ${job.clientName}.`, job.id);
          alert("Task request sent for approval.");
      }
  };

  const toggleTask = async (taskId: string) => {
    const task = job.checklist.find(t => t.id === taskId);
    if (task?.status === 'PENDING' && userRole === 'scholar') return;

    const updatedChecklist = job.checklist.map(t =>
      t.id === taskId ? { ...t, isCompleted: !t.isCompleted } : t
    );

    // Update locally first for immediate UI feedback
    onUpdateJob({ ...job, checklist: updatedChecklist });

    // Update Firestore immediately
    if (db) {
      try {
        await setDoc(doc(db, COLLECTIONS.JOBS, job.id), {
          checklist: updatedChecklist.map((item: any) => ({
            id: item.id,
            text: item.text,
            completed: item.isCompleted,
            approvalStatus: (item.status || 'APPROVED').toLowerCase()
          }))
        }, { merge: true });
      } catch (error) {
        console.error('Failed to update checklist in Firestore:', error);
      }
    }
  };

  const approveTask = (taskId: string) => {
      const updatedChecklist = job.checklist.map(t => t.id === taskId ? { ...t, status: 'APPROVED' as const, actionTimestamp: new Date().toISOString() } : t);
      onUpdateJob({ ...job, checklist: updatedChecklist });
  };

  const deleteTask = (taskId: string) => {
      const updatedChecklist = job.checklist.filter(t => t.id !== taskId);
      onUpdateJob({ ...job, checklist: updatedChecklist });
  };

  const sortedChecklist = [...job.checklist].sort((a,b) => {
      if (sortOption === 'alpha') return a.text.localeCompare(b.text);
      if (sortOption === 'status') return Number(a.isCompleted) - Number(b.isCompleted);
      return 0;
  });

  if (activeStep === 'report' && job.status === JobStatus.COMPLETED) {
    return (
      <div className="min-h-screen bg-slate-50 p-6 flex flex-col items-center justify-center text-center animate-fade-in">
        <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mb-6 shadow-sm"><CheckCircle className="text-emerald-600 w-10 h-10" /></div>
        <h2 className="text-2xl font-bold text-slate-900 mb-2">Great Work!</h2>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 w-full max-w-md text-left mb-6">
          {userRole === 'admin' ? (
            <>
              <h3 className="font-semibold text-slate-800 mb-2 flex items-center gap-2">Quality Control Review</h3>
              <p className="text-sm text-slate-600 italic border-l-4 border-blue-500 pl-3 py-1">{job.qualityReport}</p>
            </>
          ) : (
            <>
              <h3 className="font-semibold text-slate-800 mb-2">Checkout Successful</h3>
              <p className="text-sm text-slate-600">You've checked out and documented your work well. Thank you for your hard work today!</p>
            </>
          )}
        </div>
        <button onClick={onBack} className="w-full max-w-xs bg-blue-600 text-white font-semibold py-3.5 rounded-xl shadow">Back to Dashboard</button>
      </div>
    );
  }

  if (activeStep === 'checkin') {
    const currentSavedMedia = job.checkInMedia;
    const hasPhoto = !!mediaBuffer.photoFrontOfHouse || !!currentSavedMedia?.photoFrontOfHouse;
    const canSubmit = hasPhoto;

    return (
      <div className="min-h-screen bg-white pb-24 relative">
        <div className="bg-white border-b sticky top-0 z-10 p-4 flex items-center">
          <button onClick={() => setActiveStep('details')} className="p-2 hover:bg-slate-100 rounded-full mr-2 text-slate-600"><ArrowLeft size={20} /></button>
          <h2 className="font-bold text-lg text-slate-800">Check In</h2>
        </div>
        <div className="p-4 space-y-6">
          <CameraCapture mode="photo" label="Take a photo of the property exterior" onCapture={(data, ts) => handleMediaCapture('photoFrontOfHouse', data, ts)} initialData={mediaBuffer.photoFrontOfHouse || currentSavedMedia?.photoFrontOfHouse} />
          <div className="flex justify-end"><button onClick={() => fileInputRef.current?.click()} className="text-xs font-bold text-blue-600 bg-blue-50 px-3 py-2 rounded-lg"><Upload size={14} className="inline mr-1" /> Upload from Gallery</button><input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handlePhotoUpload} /></div>
          <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t pb-8"><button onClick={submitCheckIn} disabled={!canSubmit || isProcessing} className={`w-full font-bold py-4 rounded-xl shadow-lg ${canSubmit && !isProcessing ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-400'}`}>{isProcessing ? <><Loader2 className="animate-spin inline mr-2" size={20}/>Uploading...</> : 'Submit Check-In'}</button></div>
        </div>
      </div>
    );
  }

  if (activeStep === 'checkout') {
    const currentSavedMedia = job.checkOutMedia;
    const hasPhoto = !!mediaBuffer.photoFrontOfHouse || !!currentSavedMedia?.photoFrontOfHouse;
    const hasVideo = !!mediaBuffer.videoGarage || !!currentSavedMedia?.videoGarage;
    const canSubmit = hasPhoto && hasVideo;

    return (
      <div className="min-h-screen bg-white pb-24 relative">
        <div className="bg-white border-b sticky top-0 z-10 p-4 flex items-center">
          <button onClick={() => setActiveStep('details')} className="p-2 hover:bg-slate-100 rounded-full mr-2 text-slate-600"><ArrowLeft size={20} /></button>
          <h2 className="font-bold text-lg text-slate-800">Check Out</h2>
        </div>
        <div className="p-4 space-y-6">
          <CameraCapture mode="photo" label="1. Front of House Photo" onCapture={(data, ts) => handleMediaCapture('photoFrontOfHouse', data, ts)} initialData={mediaBuffer.photoFrontOfHouse || currentSavedMedia?.photoFrontOfHouse} />
          <div className="flex justify-end"><button onClick={() => fileInputRef.current?.click()} className="text-xs font-bold text-blue-600 bg-blue-50 px-3 py-2 rounded-lg"><Upload size={14} className="inline mr-1" /> Upload Gallery</button><input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handlePhotoUpload} /></div>
          <CameraCapture mode="video" label="2. Garage Interior Video (REQUIRED)" onCapture={(data, ts) => handleMediaCapture('videoGarage', data, ts)} initialData={currentSavedMedia?.videoGarage} />
          <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t pb-8">
            {!canSubmit && (
              <p className="text-sm text-rose-600 font-semibold text-center mb-2">
                ⚠️ Both photo and video are required to complete the job
              </p>
            )}
            <button onClick={() => setShowConfirmation(true)} disabled={!canSubmit} className={`w-full font-bold py-4 rounded-xl shadow-lg ${canSubmit ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-400'}`}>Complete Job</button>
          </div>
        </div>
        {showConfirmation && (
            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"><div className="bg-white rounded-xl p-6 max-w-sm w-full shadow-2xl"><h3 className="text-lg font-bold mb-2">Finish Job?</h3><p className="text-slate-600 mb-6">Submit documentation for quality control review?</p><div className="flex gap-3"><button onClick={() => setShowConfirmation(false)} className="flex-1 py-3 font-bold text-slate-600">Cancel</button><button onClick={processCheckOut} disabled={isProcessing} className="flex-1 py-3 bg-blue-600 text-white font-bold rounded-xl">{isProcessing ? <Loader2 className="animate-spin" size={20}/> : 'Confirm'}</button></div></div></div>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-20 animate-in slide-in-from-right">
      <div className="bg-white border-b sticky top-0 z-10 p-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center"><button onClick={onBack} className="p-2 -ml-2 hover:bg-slate-100 rounded-full mr-2 text-slate-600"><ArrowLeft size={20} /></button><div><h1 className="font-bold text-lg text-slate-800 leading-tight">Job Details</h1><p className="text-xs text-slate-400 font-medium">#{job.id.slice(-6)}</p></div></div>
        {userRole === 'admin' && (<button onClick={() => setIsEditing(!isEditing)} className={`p-2 rounded-full ${isEditing ? 'bg-blue-100 text-blue-600' : 'hover:bg-slate-100 text-slate-500'}`}><Pencil size={18} /></button>)}
      </div>

      <div className="max-w-md mx-auto p-4 space-y-6">
        {userRole === 'admin' && job.status !== JobStatus.CANCELLED && job.status !== JobStatus.COMPLETED && (
            <div className="bg-slate-800 rounded-xl p-4 shadow-lg text-white">
                <h3 className="font-bold text-sm mb-3 flex items-center gap-2 text-slate-200"><ShieldAlert size={14} className="text-blue-400"/> Admin Quick Actions</h3>
                <div className="space-y-3">
                    <div className="bg-slate-700/50 p-2 rounded-lg border border-slate-600">
                        <label className="block text-[10px] text-slate-400 font-bold uppercase mb-0.5">Assign To</label>
                        <select className="w-full bg-transparent text-sm font-semibold text-white outline-none" value={job.assigneeId || ""} onChange={(e) => handleQuickTransfer(e.target.value)}>
                            <option value="" className="text-slate-800">Unassigned</option>
                            {users.filter(u => u.role === 'scholar').map(u => (<option key={u.id} value={u.id} className="text-slate-800">{u.name}</option>))}
                        </select>
                    </div>
                    <div className="flex gap-3"><button onClick={() => setShowCancelModal(true)} className="flex-1 bg-red-500/20 border border-red-500/50 text-red-200 py-2 rounded-lg font-bold text-sm">Cancel Job</button></div>
                </div>
            </div>
        )}

        {/* Intake Media — visible to all roles for QA/documentation */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-800 text-sm">Intake Media</h3>
              <p className="text-xs text-slate-500">Photos for QA & documentation.</p>
            </div>
            <button
              onClick={() => intakeInputRef.current?.click()}
              className="text-xs font-bold text-blue-600 bg-blue-50 px-3 py-2 rounded-lg"
            >
              <Upload size={14} className="inline mr-1" />
              Upload
            </button>
            <input
              ref={intakeInputRef}
              type="file"
              className="hidden"
              accept="image/*"
              multiple
              onChange={(e) => e.target.files && uploadIntakeMedia(e.target.files)}
            />
          </div>
          {intakeUploads.length > 0 && (
            <div className="grid grid-cols-3 gap-2">
              {intakeUploads.map((item) => (
                <img key={item.path} src={item.url} alt="Intake" className="h-20 w-full object-cover rounded-lg border" />
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
            <div className="flex justify-between items-start mb-1"><h2 className={`text-xl font-bold ${job.status === JobStatus.CANCELLED ? 'text-slate-400 line-through' : 'text-slate-800'}`}>{job.clientName}</h2><span className="text-xl font-black text-emerald-600">${job.pay}</span></div>
            <div className="flex items-start text-slate-500 text-sm mb-4"><MapPin size={16} className="mr-1.5 mt-0.5" />{job.address}</div>
            <div className="flex gap-2"><div className="bg-slate-100 rounded-lg px-3 py-2 text-xs font-medium text-slate-600"><Calendar size={14} className="inline mr-1" />{new Date(job.date).toLocaleDateString()}</div><div className="bg-slate-100 rounded-lg px-3 py-2 text-xs font-medium text-slate-600"><Clock size={14} className="inline mr-1" />{new Date(job.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div></div>
        </div>

        {/* Approved SOP — visible to all roles */}
        {job.generatedSOP ? (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-4 bg-slate-50 border-b">
              <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                <CheckCircle size={16} className="text-emerald-600" />
                Standard Operating Procedure
              </h3>
            </div>
            <div className="p-4 space-y-2">
              {parseSopSections(job.generatedSOP).map((section, idx) => (
                <div key={idx} className="border border-slate-100 rounded-lg overflow-hidden">
                  <button
                    onClick={() => toggleSopSection(idx)}
                    className="w-full flex items-center justify-between p-3 bg-slate-50 hover:bg-slate-100 text-left"
                  >
                    <span className="font-semibold text-xs text-slate-800">{section.title}</span>
                    {sopExpanded.has(idx) ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </button>
                  {sopExpanded.has(idx) && (
                    <div className="p-3 text-xs text-slate-700 whitespace-pre-wrap leading-relaxed">
                      {section.body}
                    </div>
                  )}
                </div>
              ))}
              {parseSopSections(job.generatedSOP).length === 0 && (
                <div className="text-xs text-slate-700 whitespace-pre-wrap">{job.generatedSOP}</div>
              )}
            </div>
          </div>
        ) : (
          // Edge case: published job with missing SOP
          [JobStatus.APPROVED_FOR_POSTING, JobStatus.UPCOMING, JobStatus.IN_PROGRESS].includes(job.status) && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
              <AlertTriangle size={18} className="text-amber-600 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-amber-800">SOP unavailable</p>
                <p className="text-xs text-amber-700 mt-1">Contact your admin for the Standard Operating Procedure for this job.</p>
              </div>
              <button
                onClick={() => onNotifyAdmin(`SOP missing for job ${job.clientName} (#${job.id.slice(-6)})`, job.id)}
                className="text-xs font-bold text-amber-700 bg-amber-100 px-3 py-2 rounded-lg flex items-center gap-1 flex-shrink-0"
              >
                <Flag size={12} />
                Flag
              </button>
            </div>
          )
        )}

        {/* Quality Report Section (Admin Only) */}
        {userRole === 'admin' && job.status === JobStatus.COMPLETED && job.qualityReport && (
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 shadow-sm animate-in fade-in">
                <h3 className="text-blue-800 font-bold text-sm mb-2 flex items-center gap-2">
                    <CheckCircle size={16} /> Quality Control Analysis
                </h3>
                <p className="text-sm text-blue-700 leading-relaxed italic border-l-2 border-blue-300 pl-3">
                    {job.qualityReport}
                </p>
            </div>
        )}

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
             <div className="p-4 bg-slate-50 border-b flex justify-between items-center"><h3 className="font-bold text-slate-800 flex items-center gap-2"><CheckSquare size={18} className="text-blue-600"/> Checklist</h3></div>
             <div className="divide-y divide-slate-100">
                 {sortedChecklist.map(task => (
                     <div key={task.id} className={`p-4 flex items-start gap-3 ${task.isCompleted ? 'bg-slate-50' : 'bg-white'}`}>
                         <button disabled={job.status === JobStatus.COMPLETED || task.status === 'PENDING'} onClick={() => void toggleTask(task.id)} className={`mt-0.5 transition-all ${task.status === 'PENDING' ? 'text-orange-300' : task.isCompleted ? 'text-emerald-600' : 'text-slate-300'}`}>
                             {task.status === 'PENDING' ? <Clock size={20} /> : task.isCompleted ? <CheckSquare size={20} className="animate-in scale-in" /> : <Square size={20} />}
                         </button>
                         <div className="flex-1">
                             <p className={`text-sm font-medium ${task.isCompleted ? 'text-slate-400 line-through' : 'text-slate-700'}`}>{task.text}</p>
                             {task.status === 'PENDING' && (
                                 <div className="flex items-center gap-2 mt-1">
                                     <span className="text-[10px] bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded font-bold">WAITING FOR ADMIN</span>
                                     {userRole === 'admin' && (<button onClick={() => approveTask(task.id)} className="text-[10px] font-bold text-green-600 uppercase">Approve</button>)}
                                 </div>
                             )}
                         </div>
                         {userRole === 'admin' && (<button onClick={() => deleteTask(task.id)} className="text-slate-300 hover:text-red-500"><Trash2 size={16} /></button>)}
                     </div>
                 ))}
                 {job.status !== JobStatus.COMPLETED && (
                     <div className="p-3 bg-slate-50 flex gap-2">
                         <input type="text" placeholder="Add task..." className="flex-1 border rounded-lg px-3 py-2 text-sm outline-none" value={newTaskText} onChange={(e) => setNewTaskText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addTask()} />
                         <button onClick={addTask} className="bg-blue-600 text-white rounded-lg px-3"><Plus size={20} /></button>
                     </div>
                 )}
             </div>
        </div>

        {job.status === JobStatus.UPCOMING && job.assigneeId === currentUserId && (<button onClick={() => setActiveStep('checkin')} className="w-full bg-blue-600 text-white font-bold py-4 rounded-xl shadow-lg">Start Job (Check In)</button>)}
        {job.status === JobStatus.IN_PROGRESS && job.assigneeId === currentUserId && (<button onClick={() => setActiveStep('checkout')} className="w-full bg-emerald-600 text-white font-bold py-4 rounded-xl shadow-lg">Complete Job (Check Out)</button>)}
      </div>

      {showCancelModal && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"><div className="bg-white rounded-xl p-6 max-w-sm w-full"><h3 className="text-lg font-bold mb-4 text-rose-600">Cancel Job?</h3><textarea className="w-full border p-3 text-sm mb-4" rows={3} placeholder="Reason..." value={cancellationReason} onChange={(e) => setCancellationReason(e.target.value)} /><div className="flex gap-3"><button onClick={() => setShowCancelModal(false)} className="flex-1 font-bold text-slate-500">Back</button><button onClick={submitCancellation} disabled={!cancellationReason.trim()} className="flex-1 py-3 bg-rose-600 text-white font-bold rounded-xl">Confirm</button></div></div></div>
      )}
    </div>
  );
};

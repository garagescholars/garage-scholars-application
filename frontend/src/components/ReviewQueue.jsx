import React, { useState } from 'react';
import { Shield, CheckCircle2, XCircle, AlertTriangle, Eye, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';
import { db } from '../firebase';
import { updateDoc, doc } from 'firebase/firestore';
import { useToast } from '../context/ToastContext';

// Safety review checks run client-side before approval
const PROHIBITED_KEYWORDS = [
  // Weapons
  'gun', 'rifle', 'pistol', 'ammo', 'ammunition', 'firearm', 'ar-15', 'shotgun', 'handgun',
  // Drugs
  'marijuana', 'cannabis', 'weed', 'thc', 'cbd', 'vape', 'e-cigarette',
  // Animals
  'puppy', 'kitten', 'livestock',
  // Adult
  'adult toy', 'sex toy',
  // Counterfeits
  'replica', 'knockoff', 'bootleg', 'counterfeit', 'fake',
  // Hazardous
  'explosive', 'firework', 'pepper spray',
  // Regulated
  'prescription', 'medication',
  // Digital
  'gift card', 'nft', 'software license', 'concert ticket',
];

const QUALITY_CHECKS = [
  { id: 'title_length', label: 'Title is 5-80 characters', check: (item) => (item.title || '').length >= 5 && (item.title || '').length <= 80 },
  { id: 'has_description', label: 'Description is provided (20+ chars)', check: (item) => (item.description || '').length >= 20 },
  { id: 'has_price', label: 'Price is set ($1 - $99,999)', check: (item) => { const p = parseFloat(item.price); return p >= 1 && p <= 99999; } },
  { id: 'has_images', label: 'At least 1 photo uploaded', check: (item) => (item.imageUrls || []).length >= 1 },
  { id: 'has_condition', label: 'Condition is set', check: (item) => !!item.condition },
  { id: 'no_caps', label: 'Title is not all caps', check: (item) => item.title !== (item.title || '').toUpperCase() || (item.title || '').length < 3 },
  { id: 'no_phone', label: 'No phone numbers in description', check: (item) => !/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/.test(item.description || '') },
  { id: 'no_urls', label: 'No URLs in description', check: (item) => !/(https?:\/\/|www\.)\S+/i.test(item.description || '') },
  { id: 'no_prohibited', label: 'No prohibited items detected', check: (item) => {
    const text = `${item.title} ${item.description}`.toLowerCase();
    return !PROHIBITED_KEYWORDS.some(kw => text.includes(kw));
  }},
  { id: 'client_name', label: 'Client name provided', check: (item) => !!(item.clientName || '').trim() },
];

function runSafetyCheck(item) {
  const results = QUALITY_CHECKS.map(check => ({
    ...check,
    passed: check.check(item),
  }));

  const text = `${item.title} ${item.description}`.toLowerCase();
  const flaggedKeywords = PROHIBITED_KEYWORDS.filter(kw => text.includes(kw));

  const passCount = results.filter(r => r.passed).length;
  const failCount = results.filter(r => !r.passed).length;
  const score = Math.round((passCount / results.length) * 100);

  let riskLevel = 'low';
  if (flaggedKeywords.length > 0) riskLevel = 'critical';
  else if (failCount >= 3) riskLevel = 'high';
  else if (failCount >= 1) riskLevel = 'medium';

  return { results, flaggedKeywords, score, riskLevel, passCount, failCount };
}

export default function ReviewQueue({ inventory, onApprove, onDeny }) {
  const [expandedItem, setExpandedItem] = useState(null);
  const [denyReason, setDenyReason] = useState('');
  const [denyingItem, setDenyingItem] = useState(null);
  const [processing, setProcessing] = useState(null);

  const { showToast } = useToast();

  // Items needing review = status 'Needs Review'
  const reviewItems = inventory.filter(i => i.status === 'Needs Review');

  const handleApprove = async (item) => {
    setProcessing(item.id);
    try {
      await updateDoc(doc(db, 'inventory', item.id), {
        status: 'Pending',
        reviewStatus: 'approved',
        reviewedAt: new Date(),
        lastUpdated: new Date(),
        lastError: null,
        progress: {},
      });
      showToast({ type: 'success', message: `Approved "${item.title}" — automation starting` });
    } catch (e) {
      showToast({ type: 'error', message: 'Approval failed: ' + e.message });
    } finally {
      setProcessing(null);
    }
  };

  const handleDeny = async (item) => {
    if (!denyReason.trim()) {
      showToast({ type: 'error', message: 'Please provide a reason for denial' });
      return;
    }
    setProcessing(item.id);
    try {
      await updateDoc(doc(db, 'inventory', item.id), {
        status: 'Denied',
        reviewStatus: 'denied',
        reviewNotes: denyReason,
        reviewedAt: new Date(),
        lastUpdated: new Date(),
      });
      showToast({ type: 'info', message: `Denied "${item.title}"` });
      setDenyingItem(null);
      setDenyReason('');
    } catch (e) {
      showToast({ type: 'error', message: 'Denial failed: ' + e.message });
    } finally {
      setProcessing(null);
    }
  };

  const riskColors = {
    low: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
    medium: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
    high: 'text-orange-400 bg-orange-500/10 border-orange-500/30',
    critical: 'text-rose-400 bg-rose-500/10 border-rose-500/30',
  };

  const riskIcons = {
    low: <CheckCircle2 size={16} className="text-emerald-400" />,
    medium: <AlertTriangle size={16} className="text-amber-400" />,
    high: <AlertTriangle size={16} className="text-orange-400" />,
    critical: <XCircle size={16} className="text-rose-400" />,
  };

  if (reviewItems.length === 0) {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-white">Safety Review Queue</h2>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-12 text-center">
          <Shield size={48} className="text-slate-700 mx-auto mb-4" />
          <p className="text-slate-400 text-lg font-medium">All clear</p>
          <p className="text-slate-600 text-sm mt-1">No items waiting for review</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white">Safety Review Queue</h2>
        <span className="bg-amber-500/10 text-amber-400 text-sm font-bold px-3 py-1 rounded-full border border-amber-500/30">
          {reviewItems.length} pending
        </span>
      </div>

      <div className="space-y-4">
        {reviewItems.map(item => {
          const safety = runSafetyCheck(item);
          const isExpanded = expandedItem === item.id;
          const isDenying = denyingItem === item.id;
          const isProcessing = processing === item.id;

          return (
            <div key={item.id} className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
              {/* Header */}
              <div className="p-4 flex items-start gap-4">
                {/* Thumbnail */}
                <div className="w-20 h-20 rounded-lg bg-slate-800 flex-shrink-0 overflow-hidden border border-slate-700">
                  {item.imageUrls?.[0] ? (
                    <img src={item.imageUrls[0]} alt={item.title} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-600">No img</div>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-white font-bold truncate">{item.title}</h3>
                    <span className="font-mono text-teal-400 text-sm flex-shrink-0">${item.price}</span>
                  </div>
                  <p className="text-sm text-slate-400 line-clamp-2">{item.description}</p>
                  <div className="flex items-center gap-3 mt-2 text-xs text-slate-500">
                    <span>Client: <span className="text-slate-300">{item.clientName || 'Not set'}</span></span>
                    <span>Platform: <span className="text-slate-300">{item.platform || 'Not set'}</span></span>
                    <span>Condition: <span className="text-slate-300">{item.condition || 'Not set'}</span></span>
                  </div>
                </div>

                {/* Risk Badge */}
                <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold ${riskColors[safety.riskLevel]}`}>
                  {riskIcons[safety.riskLevel]}
                  <span className="capitalize">{safety.riskLevel} Risk</span>
                  <span className="opacity-60">({safety.score}%)</span>
                </div>
              </div>

              {/* Safety Checks Expandable */}
              <button
                onClick={() => setExpandedItem(isExpanded ? null : item.id)}
                className="w-full px-4 py-2 bg-slate-800/50 flex items-center justify-between text-sm text-slate-400 hover:text-white transition-colors"
              >
                <span className="flex items-center gap-2">
                  <Eye size={14} />
                  Safety Checks ({safety.passCount}/{QUALITY_CHECKS.length} passed)
                  {safety.flaggedKeywords.length > 0 && (
                    <span className="text-rose-400 text-xs">— {safety.flaggedKeywords.length} prohibited keyword(s)</span>
                  )}
                </span>
                {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>

              {isExpanded && (
                <div className="px-4 py-3 bg-slate-950/50 space-y-2">
                  {/* Photos grid */}
                  {item.imageUrls?.length > 0 && (
                    <div className="mb-3">
                      <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-2">Photos ({item.imageUrls.length})</p>
                      <div className="flex gap-2 overflow-x-auto pb-2">
                        {item.imageUrls.map((url, idx) => (
                          <div key={idx} className="w-24 h-24 rounded-lg bg-slate-800 flex-shrink-0 overflow-hidden border border-slate-700">
                            <img src={url} alt={`Photo ${idx + 1}`} className="w-full h-full object-cover" />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Checks list */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    {safety.results.map(r => (
                      <div key={r.id} className="flex items-center gap-2 text-sm">
                        {r.passed ? (
                          <CheckCircle2 size={14} className="text-emerald-400 flex-shrink-0" />
                        ) : (
                          <XCircle size={14} className="text-rose-400 flex-shrink-0" />
                        )}
                        <span className={r.passed ? 'text-slate-400' : 'text-rose-300'}>{r.label}</span>
                      </div>
                    ))}
                  </div>

                  {/* Flagged keywords */}
                  {safety.flaggedKeywords.length > 0 && (
                    <div className="mt-3 p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg">
                      <p className="text-rose-400 text-xs font-bold uppercase tracking-wider mb-1">Prohibited Keywords Found</p>
                      <div className="flex flex-wrap gap-1.5">
                        {safety.flaggedKeywords.map(kw => (
                          <span key={kw} className="bg-rose-500/20 text-rose-300 text-xs px-2 py-0.5 rounded">{kw}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Full description */}
                  <div className="mt-3 p-3 bg-slate-800/50 rounded-lg">
                    <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-1">Full Description</p>
                    <p className="text-sm text-slate-300 whitespace-pre-wrap">{item.description}</p>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="p-4 border-t border-slate-800 flex items-center gap-3">
                {isDenying ? (
                  <div className="flex-1 flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="Reason for denial..."
                      className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:border-rose-500 outline-none"
                      value={denyReason}
                      onChange={e => setDenyReason(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleDeny(item)}
                      autoFocus
                    />
                    <button
                      onClick={() => handleDeny(item)}
                      disabled={isProcessing}
                      className="bg-rose-500 hover:bg-rose-400 text-white px-4 py-2 rounded-lg text-sm font-bold transition-colors disabled:opacity-50"
                    >
                      Confirm Deny
                    </button>
                    <button
                      onClick={() => { setDenyingItem(null); setDenyReason(''); }}
                      className="text-slate-400 hover:text-white text-sm"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <>
                    <button
                      onClick={() => handleApprove(item)}
                      disabled={isProcessing || safety.riskLevel === 'critical'}
                      className="flex-1 flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-slate-900 py-2.5 rounded-lg font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <CheckCircle2 size={18} />
                      {isProcessing ? 'Approving...' : 'Approve & Post'}
                    </button>
                    <button
                      onClick={() => setDenyingItem(item.id)}
                      disabled={isProcessing}
                      className="flex items-center justify-center gap-2 text-rose-400 px-4 py-2.5 rounded-lg border border-rose-500/20 hover:bg-rose-500/10 transition-colors disabled:opacity-50"
                    >
                      <XCircle size={18} />
                      Deny
                    </button>
                  </>
                )}
              </div>

              {/* Critical risk warning */}
              {safety.riskLevel === 'critical' && (
                <div className="px-4 pb-3">
                  <div className="p-2 bg-rose-500/10 border border-rose-500/20 rounded-lg text-xs text-rose-400 text-center">
                    Approval blocked — prohibited content detected. Deny or edit the listing first.
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";
import { JobStatus } from "../../types";
import { COLLECTIONS } from "../collections";

const AdminCreateJob: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    clientName: "",
    clientEmail: "",
    clientPhone: "",
    address: "",
    description: "",
    estimatedHours: 3,
    scholarPayout: 200,
    clientPrice: 500,
    scheduledDate: "",
    accessInstructions: "",
    sellVsKeepPreference: "decide" as "sell" | "keep" | "decide"
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === "estimatedHours" || name === "scholarPayout" || name === "clientPrice"
        ? parseFloat(value) || 0
        : value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!db) {
      setError("Firebase not initialized.");
      return;
    }

    // Validation
    if (!formData.clientName.trim() || !formData.address.trim()) {
      setError("Client name and address are required.");
      return;
    }
    if (formData.scholarPayout < 50 || formData.scholarPayout > 1000) {
      setError("Scholar payout must be between $50 and $1000.");
      return;
    }
    if (formData.clientPrice < 100 || formData.clientPrice > 3000) {
      setError("Client price must be between $100 and $3000.");
      return;
    }
    if (!formData.scheduledDate) {
      setError("Scheduled date is required.");
      return;
    }

    setLoading(true);

    try {
      const scheduledDateTime = new Date(formData.scheduledDate);
      const endDateTime = new Date(scheduledDateTime.getTime() + formData.estimatedHours * 60 * 60 * 1000);

      // Create basic 5-step checklist
      const checklist = [
        { id: "check-in", text: "Check in with photo of property exterior", isCompleted: false, status: "APPROVED" as const },
        { id: "clear-main", text: "Clear and organize main garage area", isCompleted: false, status: "APPROVED" as const },
        { id: "organize-items", text: "Organize items by category and zone", isCompleted: false, status: "APPROVED" as const },
        { id: "clean-floor", text: "Sweep and clean garage floor", isCompleted: false, status: "APPROVED" as const },
        { id: "check-out", text: "Take final photos and check out", isCompleted: false, status: "APPROVED" as const }
      ];

      // Write to gs_jobs with both old and new field names
      const jobDoc = await addDoc(collection(db, COLLECTIONS.JOBS), {
        // gs_jobs field names (for mobile app)
        title: formData.clientName.trim(),
        clientName: formData.clientName.trim(),
        clientEmail: formData.clientEmail.trim(),
        clientPhone: formData.clientPhone.trim(),
        address: formData.address.trim(),
        description: formData.description.trim(),
        scheduledDate: scheduledDateTime.toISOString(),
        scheduledTimeStart: scheduledDateTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }),
        scheduledTimeEnd: endDateTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }),
        payout: formData.scholarPayout,
        clientPrice: formData.clientPrice,
        status: JobStatus.APPROVED_FOR_POSTING,
        lat: 0,
        lng: 0,
        urgencyLevel: 'standard',
        rushBonus: 0,
        currentViewers: 0,
        viewerFloor: 0,
        totalViews: 0,
        reopenCount: 0,
        checklist: checklist.map(item => ({
          id: item.id,
          text: item.text,
          completed: false,
          approvalStatus: 'approved'
        })),
        accessConstraints: formData.accessInstructions.trim(),
        sellVsKeepPreference: formData.sellVsKeepPreference,
        inventoryExtracted: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      // Show success message
      setError(null);
      alert(`Job created successfully! Job ID: ${jobDoc.id}`);

      // Redirect to admin dashboard after 2 seconds
      setTimeout(() => {
        navigate("/admin");
      }, 2000);

    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to create job.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6 page-enter">
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <button
            onClick={() => navigate("/admin")}
            className="text-sm text-slate-500 hover:text-slate-700 mb-2"
          >
            ← Back to Dashboard
          </button>
          <h1 className="text-2xl font-bold text-slate-800">Create New Job</h1>
          <p className="text-sm text-slate-500 mt-1">
            Add a new job that will be available for scholars to claim.
          </p>
        </div>

        {error && (
          <div className="mb-4 text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-lg p-3">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-slate-200 p-6 space-y-6">
          {/* Client Information */}
          <div className="space-y-4">
            <h2 className="font-bold text-slate-800 text-lg border-b pb-2">Client Information</h2>

            <div>
              <label className="text-sm font-medium text-slate-600">
                Client Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                name="clientName"
                value={formData.clientName}
                onChange={handleChange}
                className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-slate-900 placeholder-slate-400"
                placeholder="John Smith"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-slate-600">Client Email</label>
                <input
                  type="email"
                  name="clientEmail"
                  value={formData.clientEmail}
                  onChange={handleChange}
                  className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-slate-900 placeholder-slate-400"
                  placeholder="john@example.com"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-600">Client Phone</label>
                <input
                  type="tel"
                  name="clientPhone"
                  value={formData.clientPhone}
                  onChange={handleChange}
                  className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-slate-900 placeholder-slate-400"
                  placeholder="(555) 123-4567"
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-slate-600">
                Property Address <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                name="address"
                value={formData.address}
                onChange={handleChange}
                className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-slate-900 placeholder-slate-400"
                placeholder="123 Main St, Los Angeles, CA 90001"
                required
              />
            </div>
          </div>

          {/* Job Details */}
          <div className="space-y-4">
            <h2 className="font-bold text-slate-800 text-lg border-b pb-2">Job Details</h2>

            <div>
              <label className="text-sm font-medium text-slate-600">Job Description</label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleChange}
                className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 min-h-[100px] text-slate-900 placeholder-slate-400"
                placeholder="Full garage cleanout and organization. Heavy lifting may be required."
                maxLength={500}
              />
              <p className="text-xs text-slate-400 mt-1">{formData.description.length}/500 characters</p>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="text-sm font-medium text-slate-600">Estimated Hours</label>
                <input
                  type="number"
                  name="estimatedHours"
                  value={formData.estimatedHours}
                  onChange={handleChange}
                  className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-slate-900 placeholder-slate-400"
                  min="1"
                  max="12"
                  step="0.5"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-600">
                  Scholar Payout <span className="text-rose-500">*</span>
                </label>
                <div className="relative mt-1">
                  <span className="absolute left-3 top-2 text-slate-500">$</span>
                  <input
                    type="number"
                    name="scholarPayout"
                    value={formData.scholarPayout}
                    onChange={handleChange}
                    className="w-full border border-slate-200 rounded-lg pl-7 pr-3 py-2 text-slate-900"
                    min="50"
                    max="1000"
                    step="10"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-600">
                  Client Price <span className="text-rose-500">*</span>
                </label>
                <div className="relative mt-1">
                  <span className="absolute left-3 top-2 text-slate-500">$</span>
                  <input
                    type="number"
                    name="clientPrice"
                    value={formData.clientPrice}
                    onChange={handleChange}
                    className="w-full border border-slate-200 rounded-lg pl-7 pr-3 py-2 text-slate-900"
                    min="100"
                    max="3000"
                    step="10"
                    required
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-slate-600">
                Scheduled Date & Time <span className="text-rose-500">*</span>
              </label>
              <input
                type="datetime-local"
                name="scheduledDate"
                value={formData.scheduledDate}
                onChange={handleChange}
                className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-slate-900 placeholder-slate-400"
                required
              />
            </div>
          </div>

          {/* Additional Information */}
          <div className="space-y-4">
            <h2 className="font-bold text-slate-800 text-lg border-b pb-2">Additional Information</h2>

            <div>
              <label className="text-sm font-medium text-slate-600">Access Instructions</label>
              <textarea
                name="accessInstructions"
                value={formData.accessInstructions}
                onChange={handleChange}
                className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 min-h-[80px] text-slate-900 placeholder-slate-400"
                placeholder="Gate code: 1234, Key under mat, Client will be home"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-slate-600">Sell vs Keep Preference</label>
              <select
                name="sellVsKeepPreference"
                value={formData.sellVsKeepPreference}
                onChange={handleChange}
                className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-slate-900 placeholder-slate-400"
              >
                <option value="decide">I'll Decide Later</option>
                <option value="sell">Sell Everything</option>
                <option value="keep">Keep Everything</option>
              </select>
            </div>
          </div>

          {/* Submit Buttons */}
          <div className="flex gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={() => navigate("/admin")}
              className="flex-1 bg-slate-200 text-slate-700 font-semibold py-3 rounded-xl hover:bg-slate-300 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-blue-600 text-white font-semibold py-3 rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Creating Job..." : "Create Job"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AdminCreateJob;

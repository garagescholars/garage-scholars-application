import React, { useState } from "react";
import { collection, addDoc, updateDoc, doc, serverTimestamp } from "firebase/firestore";
import { ref, getDownloadURL } from "firebase/storage";
import { db, storage } from "../firebase";
import { COLLECTIONS } from "../collections";
import { ServiceJob } from "../../types";
import { X, Plus, Trash2, Package, DollarSign, FileText, Image as ImageIcon, CheckCircle2, Loader2 } from "lucide-react";

interface JobToInventoryModalProps {
  job: ServiceJob;
  onClose: () => void;
  onSuccess: () => void;
}

interface InventoryItemForm {
  title: string;
  description: string;
  price: string;
  condition: 'new' | 'used';
  platform: 'Both' | 'All' | 'Craigslist' | 'FB Marketplace' | 'eBay Only';
  selectedPhotos: string[]; // Storage paths
}

const JobToInventoryModal: React.FC<JobToInventoryModalProps> = ({ job, onClose, onSuccess }) => {
  const [items, setItems] = useState<InventoryItemForm[]>([]);
  const [currentItem, setCurrentItem] = useState<InventoryItemForm>({
    title: '',
    description: '',
    price: '',
    condition: 'used',
    platform: 'All',
    selectedPhotos: []
  });

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingPhotos, setLoadingPhotos] = useState(true);
  const [jobPhotos, setJobPhotos] = useState<{path: string; url: string}[]>([]);

  // Load job photos from Storage
  React.useEffect(() => {
    const loadPhotos = async () => {
      if (!storage) {
        setLoadingPhotos(false);
        return;
      }

      const photos: {path: string; url: string}[] = [];

      try {
        // Check-in photo
        if (job.checkInMedia?.photoFrontOfHouse) {
          try {
            const url = await getDownloadURL(ref(storage, job.checkInMedia.photoFrontOfHouse));
            photos.push({ path: job.checkInMedia.photoFrontOfHouse, url });
          } catch (err) {
            console.error("Failed to load check-in photo:", err);
          }
        }

        // Check-out photo
        if (job.checkOutMedia?.photoAfter) {
          try {
            const url = await getDownloadURL(ref(storage, job.checkOutMedia.photoAfter));
            photos.push({ path: job.checkOutMedia.photoAfter, url });
          } catch (err) {
            console.error("Failed to load check-out photo:", err);
          }
        }

        setJobPhotos(photos);
      } catch (err) {
        console.error("Error loading photos:", err);
      } finally {
        setLoadingPhotos(false);
      }
    };

    loadPhotos();
  }, [job, storage]);

  const handleAddItem = () => {
    if (!currentItem.title || !currentItem.price) {
      setError("Title and price are required");
      return;
    }

    setItems([...items, currentItem]);
    setCurrentItem({
      title: '',
      description: '',
      price: '',
      condition: 'used',
      platform: 'All',
      selectedPhotos: []
    });
    setError(null);
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const togglePhotoSelection = (photoPath: string) => {
    setCurrentItem(prev => ({
      ...prev,
      selectedPhotos: prev.selectedPhotos.includes(photoPath)
        ? prev.selectedPhotos.filter(p => p !== photoPath)
        : [...prev.selectedPhotos, photoPath]
    }));
  };

  const handleSubmitAll = async () => {
    if (items.length === 0) {
      setError("Add at least one item to create inventory");
      return;
    }

    if (!db) {
      setError("Database not initialized");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const createdItemIds: string[] = [];

      // Get download URLs for selected photos
      for (const item of items) {
        const imageUrls: string[] = [];

        for (const photoPath of item.selectedPhotos) {
          try {
            if (storage) {
              const url = await getDownloadURL(ref(storage, photoPath));
              imageUrls.push(url);
            }
          } catch (err) {
            console.error(`Failed to get URL for ${photoPath}:`, err);
          }
        }

        // Create custom document ID
        const customDocId = `${job.clientName} - ${item.title}`.replace(/[\/#?]/g, "_").trim();

        // Create inventory item
        const inventoryData = {
          title: item.title,
          description: item.description,
          price: item.price.replace(/[^0-9.]/g, ''),
          condition: item.condition,
          platform: item.platform,
          status: 'Pending',
          imageUrls,

          // Phase X: Link to source job, client, and property
          clientId: job.clientId || null,
          propertyId: job.propertyId || null,
          sourceServiceJobId: job.id,
          clientName: job.clientName, // Fallback for legacy

          dateListed: new Date().toLocaleDateString(),
          lastUpdated: serverTimestamp()
        };

        await addDoc(collection(db, "inventory"), inventoryData);
        createdItemIds.push(customDocId);
      }

      // Update the service job to mark inventory as extracted
      await updateDoc(doc(db, COLLECTIONS.JOBS, job.id), {
        inventoryExtracted: true,
        extractedItemIds: createdItemIds,
        extractedAt: serverTimestamp()
      });

      onSuccess();
      onClose();

    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to create inventory";
      setError(message);
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl w-full max-w-4xl shadow-2xl my-8">
        {/* Header */}
        <div className="bg-slate-800 text-white p-6 rounded-t-2xl flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <Package size={24} />
              Extract Inventory from Job
            </h2>
            <p className="text-sm text-slate-300 mt-1">
              Create inventory items from {job.clientName} service job
            </p>
          </div>
          <button onClick={onClose} className="text-white hover:text-slate-300">
            <X size={28} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Job Info */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="font-semibold text-slate-700">Client:</span>{' '}
                <span className="text-slate-900">{job.clientName}</span>
              </div>
              <div>
                <span className="font-semibold text-slate-700">Address:</span>{' '}
                <span className="text-slate-900">{job.address}</span>
              </div>
              <div>
                <span className="font-semibold text-slate-700">Job Date:</span>{' '}
                <span className="text-slate-900">{new Date(job.date).toLocaleDateString()}</span>
              </div>
              <div>
                <span className="font-semibold text-slate-700">Scholar:</span>{' '}
                <span className="text-slate-900">{job.assigneeName}</span>
              </div>
            </div>
          </div>

          {/* Job Photos */}
          <div>
            <h3 className="font-bold text-slate-800 mb-3 flex items-center gap-2">
              <ImageIcon size={18} />
              Job Photos (Select for inventory items)
            </h3>
            {loadingPhotos ? (
              <div className="text-center py-8">
                <Loader2 size={24} className="text-blue-600 animate-spin mx-auto" />
                <p className="text-sm text-slate-500 mt-2">Loading photos...</p>
              </div>
            ) : jobPhotos.length === 0 ? (
              <div className="text-center py-8 bg-slate-50 rounded-lg border border-slate-200">
                <ImageIcon size={32} className="text-slate-300 mx-auto mb-2" />
                <p className="text-sm text-slate-500">No photos available from this job</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {jobPhotos.map((photo, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => togglePhotoSelection(photo.path)}
                    className={`relative aspect-square rounded-lg overflow-hidden border-4 transition-all ${
                      currentItem.selectedPhotos.includes(photo.path)
                        ? 'border-emerald-500 ring-2 ring-emerald-300'
                        : 'border-slate-200 hover:border-blue-300'
                    }`}
                  >
                    <img src={photo.url} alt={`Job photo ${idx + 1}`} className="w-full h-full object-cover" />
                    {currentItem.selectedPhotos.includes(photo.path) && (
                      <div className="absolute inset-0 bg-emerald-500/20 flex items-center justify-center">
                        <CheckCircle2 size={32} className="text-emerald-600" />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Current Item Form */}
          <div className="border border-slate-200 rounded-lg p-4 bg-slate-50">
            <h3 className="font-bold text-slate-800 mb-4">New Inventory Item</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-semibold text-slate-700 mb-2">Item Title *</label>
                <input
                  type="text"
                  value={currentItem.title}
                  onChange={(e) => setCurrentItem({ ...currentItem, title: e.target.value })}
                  placeholder="e.g., Vintage Tool Box"
                  className="w-full border border-slate-300 rounded-lg p-3 text-sm"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-semibold text-slate-700 mb-2">Description</label>
                <textarea
                  value={currentItem.description}
                  onChange={(e) => setCurrentItem({ ...currentItem, description: e.target.value })}
                  placeholder="Describe the item..."
                  rows={3}
                  className="w-full border border-slate-300 rounded-lg p-3 text-sm resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Price *</label>
                <div className="relative">
                  <DollarSign size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={currentItem.price}
                    onChange={(e) => setCurrentItem({ ...currentItem, price: e.target.value })}
                    placeholder="25.00"
                    className="w-full border border-slate-300 rounded-lg p-3 pl-10 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Condition</label>
                <select
                  value={currentItem.condition}
                  onChange={(e) => setCurrentItem({ ...currentItem, condition: e.target.value as 'new' | 'used' })}
                  className="w-full border border-slate-300 rounded-lg p-3 text-sm"
                >
                  <option value="used">Used</option>
                  <option value="new">New</option>
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-semibold text-slate-700 mb-2">Platform</label>
                <select
                  value={currentItem.platform}
                  onChange={(e) => setCurrentItem({ ...currentItem, platform: e.target.value as any })}
                  className="w-full border border-slate-300 rounded-lg p-3 text-sm"
                >
                  <option value="All">All (CL + FB + eBay)</option>
                  <option value="Both">Both (CL + FB)</option>
                  <option value="Craigslist">Craigslist Only</option>
                  <option value="FB Marketplace">Facebook Only</option>
                  <option value="eBay Only">eBay Only</option>
                </select>
              </div>

              <div className="md:col-span-2">
                <button
                  onClick={handleAddItem}
                  className="w-full bg-emerald-600 text-white font-bold py-3 rounded-xl hover:bg-emerald-700 flex items-center justify-center gap-2"
                >
                  <Plus size={20} />
                  Add Item to List ({currentItem.selectedPhotos.length} {currentItem.selectedPhotos.length === 1 ? 'photo' : 'photos'})
                </button>
              </div>
            </div>
          </div>

          {/* Added Items List */}
          {items.length > 0 && (
            <div>
              <h3 className="font-bold text-slate-800 mb-3">Items to Create ({items.length})</h3>
              <div className="space-y-2">
                {items.map((item, idx) => (
                  <div key={idx} className="bg-white border border-slate-200 rounded-lg p-4 flex justify-between items-center">
                    <div className="flex-1">
                      <div className="font-semibold text-slate-800">{item.title}</div>
                      <div className="text-sm text-slate-600">
                        ${item.price} · {item.platform} · {item.selectedPhotos.length} {item.selectedPhotos.length === 1 ? 'photo' : 'photos'}
                      </div>
                    </div>
                    <button
                      onClick={() => handleRemoveItem(idx)}
                      className="text-rose-600 hover:text-rose-700 p-2"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {error && (
            <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-lg p-4 text-sm">
              {error}
            </div>
          )}

          {/* Footer Actions */}
          <div className="flex gap-3 pt-4 border-t">
            <button
              onClick={onClose}
              disabled={submitting}
              className="flex-1 bg-slate-200 text-slate-700 font-semibold py-3 rounded-xl hover:bg-slate-300 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmitAll}
              disabled={submitting || items.length === 0}
              className="flex-1 bg-blue-600 text-white font-bold py-3 rounded-xl hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <Loader2 size={20} className="animate-spin" />
                  Creating Inventory...
                </>
              ) : (
                <>
                  <CheckCircle2 size={20} />
                  Create {items.length} {items.length === 1 ? 'Item' : 'Items'}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default JobToInventoryModal;

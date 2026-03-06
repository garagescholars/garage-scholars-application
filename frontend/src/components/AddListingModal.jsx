import React, { useState, useEffect } from 'react';
import { X, UploadCloud, Trash2, DollarSign, Ban, RefreshCw } from 'lucide-react';
import { db, storage } from '../firebase';
import { updateDoc, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import heic2any from 'heic2any';
import { useToast } from '../context/ToastContext';

export default function AddListingModal({ isOpen, onClose, initialData = null }) {
  const [title, setTitle] = useState('');
  const [price, setPrice] = useState('');
  const [clientName, setClientName] = useState('');
  const [description, setDescription] = useState('');
  const [platform, setPlatform] = useState('Both');
  const [condition, setCondition] = useState('USED');

  const [imageFiles, setImageFiles] = useState([]);
  const [previews, setPreviews] = useState([]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [showDeleteMenu, setShowDeleteMenu] = useState(false);

  const { showToast } = useToast();

  useEffect(() => {
    if (initialData) {
        setTitle(initialData.title || '');
        setPrice(initialData.price || '');
        setClientName(initialData.clientName || '');
        setDescription(initialData.description || '');
        setPlatform(initialData.platform || 'Both');
        setCondition(initialData.condition || 'USED');

        if (initialData.imageUrls && Array.isArray(initialData.imageUrls)) {
            setPreviews(initialData.imageUrls);
        }
    } else {
        resetForm();
    }
  }, [initialData, isOpen]);

  const resetForm = () => {
    setTitle(''); setPrice(''); setClientName(''); setDescription('');
    setPlatform('Both'); setCondition('USED'); setImageFiles([]); setPreviews([]);
    setStatusMessage('');
    setShowDeleteMenu(false);
  };

  const processImage = async (file) => {
    let blob = file;
    const isHeic = /\.(heic|heif)$/i.test(file.name) || file.type === 'image/heic' || file.type === 'image/heif';
    if (isHeic) {
      const converted = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.8 });
      blob = Array.isArray(converted) ? converted[0] : converted;
    }

    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => {
          const maxDim = 1200;
          let w = img.width, h = img.height;
          if (w <= maxDim && h <= maxDim) {
            resolve(new File([blob], file.name.replace(/\.(heic|heif)$/i, '.jpg'), { type: 'image/jpeg' }));
            return;
          }
          if (w > h) { h = Math.round(h * maxDim / w); w = maxDim; }
          else { w = Math.round(w * maxDim / h); h = maxDim; }
          const canvas = document.createElement('canvas');
          canvas.width = w; canvas.height = h;
          canvas.getContext('2d').drawImage(img, 0, 0, w, h);
          canvas.toBlob((b) => {
            resolve(new File([b], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' }));
          }, 'image/jpeg', 0.7);
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(blob);
    });
  };

  const handleFileChange = (e) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      const totalFiles = [...imageFiles, ...newFiles].slice(0, 6);
      setImageFiles(totalFiles);
      setPreviews(totalFiles.map(file => URL.createObjectURL(file)));
    }
  };

  const removeImage = (indexToRemove) => {
      const updatedFiles = imageFiles.filter((_, i) => i !== indexToRemove);
      const updatedPreviews = previews.filter((_, i) => i !== indexToRemove);
      setImageFiles(updatedFiles);
      setPreviews(updatedPreviews);
  };

  const handleMarkSold = async () => {
        setIsSubmitting(true);
        setStatusMessage('Moving to Sold Archive...');
        try {
            const soldData = {
                ...initialData,
                status: 'Sold',
                dateSold: new Date().toLocaleDateString(),
                archivedAt: new Date(),
                soldBy: 'Garage Scholars'
            };
            await setDoc(doc(db, "sold_inventory", initialData.id), soldData);
            await deleteDoc(doc(db, "inventory", initialData.id));
            showToast({ type: 'success', message: `"${title}" marked as sold` });
            onClose();
        } catch (error) {
            console.error("Error archiving:", error);
            showToast({ type: 'error', message: 'Failed to archive item. Check console.' });
        } finally {
            setIsSubmitting(false);
        }
  };

  const handlePermanentDelete = async () => {
        setShowDeleteMenu(false);
        setIsSubmitting(true);
        setStatusMessage('Deleting permanently...');
        try {
            await deleteDoc(doc(db, "inventory", initialData.id));
            showToast({ type: 'info', message: `"${title}" deleted permanently` });
            onClose();
        } catch (error) {
            console.error("Error deleting:", error);
            showToast({ type: 'error', message: 'Failed to delete. Check console.' });
        } finally {
            setIsSubmitting(false);
        }
  };

  const handleRepost = async () => {
    setIsSubmitting(true);
    try {
      await updateDoc(doc(db, "inventory", initialData.id), {
        status: 'Pending',
        lastError: null,
        progress: {},
        lastUpdated: new Date()
      });
      showToast({ type: 'success', message: `Re-queued "${title}" for automation` });
      onClose();
    } catch (error) {
      console.error("Error re-posting:", error);
      showToast({ type: 'error', message: 'Failed to re-post. Check console.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title || !price) {
      showToast({ type: 'error', message: 'Title and Price are required.' });
      return;
    }

    setIsSubmitting(true);
    setStatusMessage('Creating folders & uploading...');

    try {
        let finalImageUrls = initialData?.imageUrls || [];

        const cleanClient = (clientName || 'No Client').replace(/[\/#?]/g, "_").trim();
        const cleanTitle = title.replace(/[\/#?]/g, "_").trim();
        const customDocId = `${cleanClient} - ${cleanTitle}`;

        if (imageFiles.length > 0) {
            setStatusMessage('Processing images...');
            const uploadPromises = imageFiles.map(async (file) => {
                const processed = await processImage(file);
                const fileName = `${Date.now()}_${processed.name}`;
                const storagePath = initialData?.clientFolder
                  ? `clients/${initialData.clientFolder}/resale/photos/${fileName}`
                  : `resale/listings/${customDocId}/photos/${fileName}`;
                const storageRef = ref(storage, storagePath);
                const snapshot = await uploadBytes(storageRef, processed);
                return await getDownloadURL(snapshot.ref);
            });
            const newUrls = await Promise.all(uploadPromises);
            finalImageUrls = [...(initialData?.imageUrls || []), ...newUrls];
        }

        setStatusMessage('Saving to database...');

        const formData = {
            title,
            price: price.replace(/[^0-9.]/g, ''),
            clientName,
            description,
            platform,
            condition,
            status: initialData ? 'Pending' : 'Needs Review',
            imageUrls: finalImageUrls,
            dateListed: initialData?.dateListed || new Date().toLocaleDateString(),
            lastUpdated: new Date()
        };

        if (initialData) {
            await updateDoc(doc(db, "inventory", initialData.id), formData);
            showToast({ type: 'success', message: `"${title}" updated and re-queued` });
        } else {
            await setDoc(doc(db, "inventory", customDocId), formData);
            showToast({ type: 'success', message: `"${title}" created — automation starting` });
        }

        onClose();
        resetForm();

    } catch (error) {
        console.error("Error saving:", error);
        showToast({ type: 'error', message: 'Upload failed. Check console.' });
    } finally {
        setIsSubmitting(false);
        setStatusMessage('');
    }
  };

  if (!isOpen) return null;

  const canRepost = initialData && (initialData.status === 'Active' || initialData.status === 'Error' || initialData.status === 'Compliance Error');

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-lg rounded-xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto relative">

        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-bold text-white">
            {showDeleteMenu ? 'Remove Item' : (initialData ? 'Edit Listing' : 'Add New Listing')}
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white"><X size={24} /></button>
        </div>

        {showDeleteMenu ? (
            <div className="space-y-4">
                <div className="p-4 bg-slate-800 rounded-lg text-center border border-slate-700">
                    <p className="text-white font-medium mb-1">Why are we removing this item?</p>
                    <p className="text-sm text-slate-400">"{title}"</p>
                </div>

                <button onClick={handleMarkSold} className="w-full flex items-center justify-between p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-lg hover:bg-emerald-500/20 text-emerald-400 transition-all group">
                    <div className="flex items-center gap-3">
                        <DollarSign className="w-6 h-6" />
                        <div className="text-left">
                            <p className="font-bold">Sold by Garage Scholars</p>
                            <p className="text-xs text-emerald-500/60">Moves to Sold Archive. Counts as Revenue.</p>
                        </div>
                    </div>
                </button>

                <button onClick={handlePermanentDelete} className="w-full flex items-center justify-between p-4 bg-red-500/10 border border-red-500/20 rounded-lg hover:bg-red-500/20 text-red-400 transition-all group">
                    <div className="flex items-center gap-3">
                        <Ban className="w-6 h-6" />
                        <div className="text-left">
                            <p className="font-bold">Duplicate / Void</p>
                            <p className="text-xs text-red-500/60">Deletes permanently. No Revenue stats.</p>
                        </div>
                    </div>
                </button>

                <button onClick={() => setShowDeleteMenu(false)} className="w-full text-slate-500 text-sm py-2 hover:text-white">
                    Cancel (Go Back)
                </button>
            </div>
        ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div><label className="block text-sm font-medium text-slate-400 mb-1">Item Title</label><input type="text" required className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-white focus:border-teal-500 outline-none" value={title} onChange={(e) => setTitle(e.target.value)}/></div>
          <div className="grid grid-cols-2 gap-4">
              <div><label className="block text-sm font-medium text-slate-400 mb-1">Price</label><input type="text" required className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-white focus:border-teal-500 outline-none" value={price} onChange={(e) => setPrice(e.target.value)}/></div>
              <div><label className="block text-sm font-medium text-slate-400 mb-1">Client Name</label><input type="text" placeholder="(Optional)" className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-white focus:border-teal-500 outline-none" value={clientName} onChange={(e) => setClientName(e.target.value)}/></div>
          </div>
          <div><label className="block text-sm font-medium text-slate-400 mb-1">Description</label><textarea required rows="4" className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-white focus:border-teal-500 outline-none resize-none" value={description} onChange={(e) => setDescription(e.target.value)}/></div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-sm font-medium text-slate-400 mb-1">Platform</label><select className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-white focus:border-teal-500 outline-none" value={platform} onChange={(e) => setPlatform(e.target.value)}><option value="Both">Both (FB + CL)</option><option value="All">All (CL + FB + eBay)</option><option value="Craigslist">Craigslist Only</option><option value="FB Marketplace">Facebook Only</option><option value="eBay Only">eBay Only</option></select></div>
            <div><label className="block text-sm font-medium text-slate-400 mb-1">Condition</label><select className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-white focus:border-teal-500 outline-none" value={condition} onChange={(e) => setCondition(e.target.value)}><option value="NEW">New</option><option value="LIKE_NEW">Like New</option><option value="GOOD">Good</option><option value="USED">Used</option><option value="FOR_PARTS">For Parts</option></select></div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1">Photos (Max 6)</label>
            <div className="border-2 border-dashed border-slate-700 rounded-lg p-4 text-center hover:border-teal-500 transition-colors relative">
              <input type="file" id="file-upload" className="hidden" multiple accept=".jpg,.jpeg,.png,.HEIC,.webp" onChange={handleFileChange}/>
              <label htmlFor="file-upload" className="cursor-pointer flex flex-col items-center gap-2 py-4">
                <UploadCloud className="text-slate-500" size={32} />
                <span className="text-sm text-slate-400">Click to upload photos ({imageFiles.length}/6)</span>
              </label>
            </div>
            {previews.length > 0 && (
                <div className="grid grid-cols-3 gap-2 mt-3">
                    {previews.map((src, idx) => (
                        <div key={idx} className="relative group aspect-square bg-slate-800 rounded-md overflow-hidden border border-slate-700">
                            <img src={src} alt={`Preview ${idx}`} className="w-full h-full object-cover" />
                            <button type="button" onClick={() => removeImage(idx)} className="absolute top-1 right-1 bg-red-600/80 hover:bg-red-600 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={14} /></button>
                        </div>
                    ))}
                </div>
            )}
          </div>

          {initialData && (
            <div className="pt-4 border-t border-slate-800 space-y-2">
               {canRepost && (
                 <button
                   type="button"
                   onClick={handleRepost}
                   disabled={isSubmitting}
                   className="w-full flex items-center justify-center gap-2 text-teal-400 py-2.5 rounded-lg border border-teal-500/20 bg-teal-500/5 hover:bg-teal-500/10 transition-colors"
                 >
                   <RefreshCw size={16} /> Re-Post to Marketplaces
                 </button>
               )}
               <button
                 type="button"
                 onClick={() => setShowDeleteMenu(true)}
                 className="w-full flex items-center justify-center gap-2 text-slate-400 hover:text-white py-3 rounded-lg border border-slate-700 hover:bg-slate-800 transition-colors"
               >
                 <Trash2 size={18} /> Remove Item...
               </button>
            </div>
          )}

          <button type="submit" disabled={isSubmitting} className="w-full bg-teal-500 hover:bg-teal-400 text-slate-900 font-bold py-3 rounded-lg mt-4 transition-colors disabled:opacity-50">
            {isSubmitting ? (statusMessage || 'Processing...') : (initialData ? 'Save Changes' : 'Create & Post')}
          </button>
        </form>
        )}
      </div>
    </div>
  );
}

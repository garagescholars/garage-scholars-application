
import React, { useRef, useState, useCallback, useEffect } from 'react';
import { Camera, Video, Square, RefreshCcw, CheckCircle, Trash2, Loader2, MicOff, Clock } from 'lucide-react';

interface CameraCaptureProps {
  mode: 'photo' | 'video';
  onCapture: (dataUrl: string, timestamp?: string) => void;
  label: string;
  initialData?: string; // Allow showing previously saved data
  initialTimestamp?: string; // ISO String
}

const CameraCapture: React.FC<CameraCaptureProps> = ({ mode, onCapture, label, initialData, initialTimestamp }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturedData, setCapturedData] = useState<string | null>(initialData || null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(initialData || null);
  const [capturedAt, setCapturedAt] = useState<Date | null>(initialTimestamp ? new Date(initialTimestamp) : null);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [usingAudioFallback, setUsingAudioFallback] = useState(false);

  // Sync initialData if it changes externally
  useEffect(() => {
    if (initialData) {
        setCapturedData(initialData);
        setPreviewUrl(initialData);
    }
    if (initialTimestamp) {
        setCapturedAt(new Date(initialTimestamp));
    }
  }, [initialData, initialTimestamp]);

  // Connect stream to video element when available
  useEffect(() => {
    if (stream && videoRef.current) {
        videoRef.current.srcObject = stream;
    }
  }, [stream]);

  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    }
  }, [stream]);

  const startCamera = async () => {
    try {
      stopCamera();
      setError(null);
      setUsingAudioFallback(false);
      
      const videoConstraints = { 
        facingMode: 'environment',
        width: { ideal: 1280 },
        height: { ideal: 720 } 
      };

      try {
        const constraints = {
            video: videoConstraints,
            audio: mode === 'video'
        };
        const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
        setStream(mediaStream);
      } catch (err: any) {
        if (mode === 'video') {
            console.warn("Primary camera access failed (likely audio), attempting fallback.", err);
            const fallbackConstraints = {
                video: videoConstraints,
                audio: false
            };
            const mediaStream = await navigator.mediaDevices.getUserMedia(fallbackConstraints);
            setStream(mediaStream);
            setUsingAudioFallback(true);
        } else {
            throw err;
        }
      }
    } catch (err: any) {
      console.error("Camera Error: ", err);
      setError("Unable to access camera. Please allow camera permissions.");
    }
  };

  useEffect(() => {
    return () => {
      stopCamera();
      if (previewUrl && previewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [stopCamera, previewUrl]);

  useEffect(() => {
    let interval: any;
    if (isRecording) {
      interval = setInterval(() => {
        setRecordingTime(prev => {
          if (prev >= 20) {
            stopRecording();
            return 20;
          }
          return prev + 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isRecording]);

  const takePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const now = new Date();
        ctx.font = '24px Arial';
        ctx.fillStyle = 'white';
        ctx.shadowColor = 'black';
        ctx.shadowBlur = 4;
        ctx.fillText(now.toLocaleString(), 20, canvas.height - 20);

        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        setCapturedData(dataUrl);
        setPreviewUrl(dataUrl);
        setCapturedAt(now);
        onCapture(dataUrl, now.toISOString());
        stopCamera();
      }
    }
  };

  const startRecording = () => {
    if (!stream) return;
    const chunks: Blob[] = [];
    try {
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
            chunks.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        setIsProcessing(true);
        const stopTime = new Date();
        const type = mediaRecorder.mimeType || 'video/webm';
        const blob = new Blob(chunks, { type });
        
        // Use Object URL for immediate reliable preview
        const objUrl = URL.createObjectURL(blob);
        setPreviewUrl(objUrl);

        const reader = new FileReader();
        reader.readAsDataURL(blob);
        reader.onloadend = () => {
          const base64data = reader.result as string;
          setCapturedData(base64data);
          setCapturedAt(stopTime);
          onCapture(base64data, stopTime.toISOString());
          setIsProcessing(false);
          stopCamera();
        };
        reader.onerror = () => {
             setError("Failed to process video file.");
             setIsProcessing(false);
             stopCamera();
        };
      };

      mediaRecorder.start(1000);
      setIsRecording(true);
      setRecordingTime(0);
    } catch (e) {
      setError("Failed to start recording.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const reset = () => {
    if (previewUrl && previewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(previewUrl);
    }
    setCapturedData(null);
    setPreviewUrl(null);
    setCapturedAt(null);
    setRecordingTime(0);
    setError(null);
    onCapture('', undefined);
    startCamera();
  };

  if (previewUrl) {
    return (
      <div className="flex flex-col items-center justify-center p-4 bg-slate-100 rounded-xl border border-slate-200">
        <div className="w-full h-64 bg-black rounded-lg overflow-hidden flex items-center justify-center mb-2 relative shadow-inner">
            {mode === 'photo' ? (
                <img src={previewUrl} alt="Captured" className="h-full w-full object-contain" />
            ) : (
                <video src={previewUrl} controls playsInline className="h-full w-full object-contain" />
            )}
            <div className="absolute top-2 right-2 bg-emerald-500 text-white text-xs px-2 py-1 rounded-full flex items-center gap-1 shadow-sm font-bold">
                <CheckCircle size={12} /> {initialData === capturedData ? 'Saved' : 'Captured'}
            </div>
        </div>
        
        {capturedAt && (
            <div className="mb-4 flex items-center gap-1.5 text-xs font-mono text-slate-500 bg-slate-200/50 py-1 px-3 rounded-full border border-slate-200/60">
                <Clock size={12} />
                <span>Recorded: {capturedAt.toLocaleString()}</span>
            </div>
        )}

        <div className="flex gap-4">
             <button 
                onClick={reset}
                className="flex items-center gap-2 text-blue-600 font-bold hover:text-blue-800 bg-white px-4 py-2 rounded-lg border border-slate-200 shadow-sm transition-colors hover:bg-slate-50"
             >
                <RefreshCcw size={16} /> Retake {mode === 'photo' ? 'Photo' : 'Video'}
             </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-4 bg-white rounded-xl shadow-sm border border-slate-200">
      <h3 className="font-bold text-slate-700">{label}</h3>
      
      {error ? (
         <div className="p-4 bg-rose-50 text-rose-600 rounded-lg text-sm text-center border border-rose-100">
            <p className="font-bold mb-1">Camera Error</p>
            {error}
            <button onClick={startCamera} className="block mt-3 mx-auto text-blue-600 font-bold underline">Try Again</button>
         </div>
      ) : isProcessing ? (
        <div className="h-64 w-full bg-slate-100 rounded-xl flex flex-col items-center justify-center text-slate-500 gap-3 border border-slate-200">
             <Loader2 size={32} className="animate-spin text-blue-600" />
             <p className="text-sm font-medium">Finalizing documentation...</p>
        </div>
      ) : !stream ? (
        <button 
            onClick={startCamera} 
            className="h-48 w-full bg-slate-50 rounded-xl border-2 border-dashed border-slate-300 flex flex-col items-center justify-center text-slate-500 hover:bg-slate-100 hover:border-blue-400 hover:text-blue-500 transition-all gap-3"
        >
            <div className="bg-white p-3 rounded-full shadow-sm">
                {mode === 'photo' ? <Camera size={24} /> : <Video size={24} />}
            </div>
            <span className="font-medium">Tap to {mode === 'photo' ? 'Take Photo' : 'Record Video'}</span>
        </button>
      ) : (
        <div className="relative w-full h-64 bg-black rounded-xl overflow-hidden shadow-md">
            <video 
                ref={videoRef} 
                autoPlay 
                playsInline 
                muted 
                className="w-full h-full object-cover"
            />
            {usingAudioFallback && mode === 'video' && (
                <div className="absolute top-2 left-2 bg-amber-500/80 text-white text-[10px] px-2 py-1 rounded-full flex items-center gap-1 backdrop-blur-sm z-20">
                    <MicOff size={10} /> No Audio
                </div>
            )}
            <div className="absolute bottom-4 left-0 right-0 flex justify-center items-center gap-4 z-10">
                {mode === 'photo' ? (
                    <button 
                        onClick={takePhoto}
                        className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-full border-4 border-white flex items-center justify-center shadow-lg active:scale-95 transition-transform"
                    >
                        <div className="w-12 h-12 bg-white rounded-full" />
                    </button>
                ) : (
                    <div className="flex flex-col items-center gap-2">
                        <div className="bg-black/60 backdrop-blur-sm text-white px-3 py-1 rounded-full text-xs font-mono font-bold">
                            00:{recordingTime.toString().padStart(2, '0')} / 00:20
                        </div>
                        <button 
                            onClick={isRecording ? stopRecording : startRecording}
                            className={`w-16 h-16 rounded-full border-4 border-white flex items-center justify-center shadow-lg transition-all ${isRecording ? 'bg-rose-600 scale-110' : 'bg-rose-500'}`}
                        >
                            {isRecording ? <Square fill="white" size={20} className="text-white" /> : <div className="w-6 h-6 bg-white rounded-full" />}
                        </button>
                    </div>
                )}
            </div>
            <button 
                onClick={stopCamera}
                className="absolute top-2 right-2 p-2 bg-black/40 text-white rounded-full hover:bg-black/60 z-10"
            >
                <Trash2 size={16} />
            </button>
            <canvas ref={canvasRef} className="hidden" />
        </div>
      )}
      <p className="text-[10px] text-slate-400 text-center font-medium uppercase tracking-wide">
        {mode === 'video' ? 'Max duration: 20s • Document the full garage' : 'Ensure exterior features are visible'}
      </p>
    </div>
  );
};

export default CameraCapture;

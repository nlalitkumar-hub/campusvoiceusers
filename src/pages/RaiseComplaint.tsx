import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Camera, ArrowLeft, Loader2, CheckCircle2, AlertCircle, X, Info, MapPin, ArrowRight } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { uploadImage } from '@/lib/cloudinary';
import { createComplaint, updateUserPoints } from '@/lib/firestore';
import { POINT_VALUES } from '@/lib/gamification';

const CATEGORIES = ['Infrastructure', 'Safety', 'Technology', 'Academic', 'Health', 'Hygiene', 'Other'];

const CAMPUS = { name: 'Vellore Institute of Science and Technology, Chennai', lat: 12.8406, lng: 80.1534, radiusMeters: 1500 };

const getDistance = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
  const R = 6371000, dLat = (lat2 - lat1) * Math.PI / 180, dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const RaiseComplaint: React.FC = () => {
  const { user, updateUser } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [image, setImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [verification, setVerification] = useState<any>(null);
  const [verifying, setVerifying] = useState(false);
  const [form, setForm] = useState({ title: '', category: 'Infrastructure', description: '', location: '' });
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationStatus, setLocationStatus] = useState<'checking' | 'valid' | 'invalid' | 'error'>('checking');
  const [locationMessage, setLocationMessage] = useState('');
  const [locationRetry, setLocationRetry] = useState(0);

  useEffect(() => {
    if (step !== 1) return;
    setLocationStatus('checking'); setLocationMessage('Getting your location...');
    if (!navigator.geolocation) { setLocationStatus('error'); setLocationMessage('Location not supported'); return; }
    navigator.geolocation.getCurrentPosition(
      pos => {
        const { latitude, longitude } = pos.coords; setUserLocation({ lat: latitude, lng: longitude });
        const dist = getDistance(latitude, longitude, CAMPUS.lat, CAMPUS.lng);
        if (dist > CAMPUS.radiusMeters) { setLocationStatus('invalid'); setLocationMessage(`Outside campus (${Math.round(dist)}m away)`); }
        else { setLocationStatus('valid'); setLocationMessage(`On campus (${Math.round(dist)}m from center)`); }
      },
      () => { setLocationStatus('error'); setLocationMessage('Location access denied. Please enable location.'); },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, [step, locationRetry]);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      streamRef.current = stream; setCameraActive(true);
      setTimeout(() => { if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.play().catch(console.error); } }, 100);
    } catch {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        streamRef.current = stream; setCameraActive(true);
        setTimeout(() => { if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.play().catch(console.error); } }, 100);
      } catch (err) { console.error('Camera denied', err); }
    }
  };

  const stopCamera = () => { streamRef.current?.getTracks().forEach(t => t.stop()); setCameraActive(false); };

  const capture = () => {
    if (!videoRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth; canvas.height = videoRef.current.videoHeight;
    canvas.getContext('2d')?.drawImage(videoRef.current, 0, 0);
    setImage(canvas.toDataURL('image/jpeg')); stopCamera();
  };

  const verifyWithAI = async (imageBase64: string, title: string, description: string, category: string) => {
    // Primary: Python AI triage backend
    try {
      const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 35000);
      const res = await fetch('http://localhost:8000/api/verify-image', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64, description: `${title}. ${description}`, category, location: 'Vellore Institute of Science and Technology, Chennai Campus' }),
        signal: controller.signal
      });
      clearTimeout(timeout);
      if (res.ok) { const data = await res.json(); return { ...data, usedPythonAI: true }; }
      // 400 = privacy violation or irrelevant image — surface the real error
      if (res.status === 400) {
        const err = await res.json();
        const msg = err.detail?.message || err.message || 'Verification failed';
        return { overallVerified: false, campusDetected: false, descriptionMatches: false, isReal: false, reason: msg, score: 0, usedPythonAI: true };
      }
    } catch (e) { console.warn('Python AI unavailable:', e); }

    // Fallback: Node backend
    try {
      const token = localStorage.getItem('token') || '';
      const res = await fetch('http://localhost:5000/api/complaints/verify', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ imageBase64, description: `${title}. ${description}`, category })
      });
      if (res.ok) { const data = await res.json(); const r = data.data || data; return { overallVerified: r.overallVerified ?? false, campusDetected: r.campusDetected ?? false, descriptionMatches: r.descriptionMatches ?? false, isReal: r.isReal ?? false, reason: r.reason || 'Verification failed', score: r.score ?? 0, usedPythonAI: false }; }
    } catch (e) { console.warn('Node backend unavailable:', e); }

    return { overallVerified: false, campusDetected: false, descriptionMatches: false, isReal: false, reason: 'Verification service unavailable. Please try again.', score: 0, usedPythonAI: false };
  };

  const handleVerify = async () => {
    if (!image || !form.title || !form.description) return;
    setVerifying(true); setVerification(null);
    try {
      const base64Data = image.replace(/^data:image\/\w+;base64,/, '');
      const result = await verifyWithAI(base64Data, form.title, form.description, form.category);
      setVerification(result);
    } catch {
      setVerification({ overallVerified: false, campusDetected: false, descriptionMatches: false, isReal: false, reason: 'Verification service unavailable. Please try again.', score: 0 });
    }
    setVerifying(false); setStep(3);
  };

  const handleSubmit = async () => {
    if (!user) return; setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const base64Data = image!.replace(/^data:image\/\w+;base64,/, '');
      const res = await fetch('http://localhost:5000/api/complaints/create', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token && { 'Authorization': `Bearer ${token}` }) }, body: JSON.stringify({ ...form, imageBase64: base64Data, submittedBy: user.id, submittedByName: user.name, institute: user.institute, coordinates: userLocation }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Submission failed');
      updateUser({ points: (user.points || 0) + POINT_VALUES.RAISE_COMPLAINT + POINT_VALUES.AI_VERIFIED });
      navigate('/feed', { state: { refresh: true }, replace: true });
    } catch {
      try {
        const url = await uploadImage(image!);
        await createComplaint({ ...form, imageUrl: url, submittedBy: user.id, submittedByName: user.name, institute: user.institute });
        await updateUserPoints(user.id, POINT_VALUES.RAISE_COMPLAINT + POINT_VALUES.AI_VERIFIED);
        updateUser({ points: (user.points || 0) + POINT_VALUES.RAISE_COMPLAINT + POINT_VALUES.AI_VERIFIED });
        navigate('/feed', { state: { refresh: true }, replace: true });
      } catch (fbErr: any) { console.error('Firebase save error:', fbErr.message); }
    } finally { setLoading(false); }
  };

  const allPass = verification?.overallVerified ?? (verification?.campusDetected && verification?.descriptionMatches && verification?.isReal);

  const inputCls = "w-full h-14 px-4 bg-white border-none ring-1 ring-[#ccc3d8] focus:ring-2 focus:ring-[#7C3AED] rounded-2xl transition-all outline-none text-gray-900 placeholder:text-gray-400 shadow-sm";

  const initials = user?.name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'U';

  return (
    <div className="min-h-screen bg-white flex flex-col" style={{ fontFamily: 'Inter, sans-serif' }}>
      {/* Sticky header */}
      <header className="sticky top-0 z-50 bg-white border-b border-gray-200 shadow-sm">
        <div className="flex items-center justify-between px-4 h-16">
          <button
            onClick={() => step > 1 ? setStep(step - 1) : navigate(-1)}
            className="p-2 text-purple-600 hover:bg-gray-100 rounded-full transition-colors active:scale-95"
          >
            <ArrowLeft size={22} />
          </button>
          <h1 className="text-xl font-bold text-gray-900">Raise Complaint</h1>
          {/* User avatar */}
          <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center border border-purple-200 text-purple-700 text-xs font-bold">
            {initials}
          </div>
        </div>
      </header>

      {/* Step indicator */}
      <div className="flex items-center justify-between px-8 py-5 bg-white border-b border-gray-100">
        {[{ n: 1, label: 'Photo' }, { n: 2, label: 'Details' }, { n: 3, label: 'Review' }].map((s, i) => (
          <React.Fragment key={s.n}>
            <div className="flex flex-col items-center gap-1.5">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold"
                style={{
                  background: step >= s.n ? '#7C3AED' : '#e1e3e4',
                  color: step >= s.n ? 'white' : '#4a4455',
                  boxShadow: step === s.n ? '0 0 0 4px #ede9fe' : 'none',
                }}
              >
                {s.n}
              </div>
              <span
                className="text-[10px] font-medium"
                style={{ color: step === s.n ? '#7C3AED' : '#4a4455', fontWeight: step === s.n ? 700 : 500 }}
              >
                {s.label}
              </span>
            </div>
            {i < 2 && (
              <div
                className="flex-1 h-[2px] mx-2 mb-5"
                style={{ background: step > s.n ? '#7C3AED' : '#e1e3e4' }}
              />
            )}
          </React.Fragment>
        ))}
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-5 pt-6 pb-32 space-y-5 max-w-2xl mx-auto w-full">

        {/* STEP 1: CAPTURE */}
        {step === 1 && (
          <>
            {/* Location banner */}
            {locationStatus === 'checking' && (
              <div className="bg-gray-50 rounded-xl px-4 py-3 flex items-center gap-3 border border-gray-200">
                <span className="flex h-3 w-3 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-gray-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-gray-500 border border-white" />
                </span>
                <p className="text-sm font-medium text-gray-600">Getting your location...</p>
                <MapPin size={18} className="ml-auto text-gray-400" />
              </div>
            )}
            {locationStatus === 'valid' && (
              <div className="bg-green-50 rounded-xl px-4 py-3 flex items-center gap-3 border border-green-200">
                <span className="flex h-3 w-3 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500 border border-white" />
                </span>
                <p className="text-sm font-medium text-green-800">
                  You are on campus <span className="font-semibold">({locationMessage.match(/\d+m/)?.[0]})</span>
                </p>
                <MapPin size={18} className="ml-auto text-green-600" />
              </div>
            )}
            {locationStatus === 'invalid' && (
              <div className="bg-red-50 rounded-xl px-4 py-3 border border-red-200">
                <p className="text-sm font-medium text-red-800">❌ {locationMessage}</p>
                <p className="text-xs text-red-600 mt-1">You must be on campus to raise a complaint</p>
              </div>
            )}
            {locationStatus === 'error' && (
              <div className="bg-amber-50 rounded-xl px-4 py-3 border border-amber-200">
                <p className="text-sm font-medium text-amber-800">⚠️ {locationMessage}</p>
                <button
                  onClick={() => setLocationRetry(r => r + 1)}
                  className="mt-2 px-3 py-1 bg-amber-400 text-white rounded-lg text-xs font-medium"
                >
                  Try Again
                </button>
              </div>
            )}

            {/* Camera area */}
            {!image ? (
              cameraActive ? (
                <div className="relative rounded-xl overflow-hidden bg-zinc-900 aspect-[4/5]">
                  <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/40" />
                  <button
                    onClick={capture}
                    className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-white p-4 rounded-full shadow-xl active:scale-90 transition-transform"
                  >
                    <Camera size={24} className="text-purple-600" />
                  </button>
                  <button
                    onClick={stopCamera}
                    className="absolute top-4 right-4 bg-black/30 backdrop-blur-md text-white p-2 rounded-lg"
                  >
                    <X size={16} />
                  </button>
                </div>
              ) : (
                <button
                  onClick={startCamera}
                  disabled={locationStatus === 'invalid'}
                  className="relative w-full aspect-[4/5] rounded-xl border-2 border-dashed border-zinc-700 hover:border-purple-500 bg-zinc-900 flex flex-col items-center justify-center gap-3 text-zinc-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed group cursor-pointer overflow-hidden"
                >
                  <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/40 rounded-xl pointer-events-none" />
                  <div className="z-10 flex flex-col items-center gap-3">
                    <div className="w-16 h-16 rounded-full bg-zinc-800 flex items-center justify-center group-active:scale-90 transition-transform">
                      <Camera size={32} className="text-zinc-300" />
                    </div>
                    <span className="font-semibold text-zinc-300">Tap to capture</span>
                  </div>
                </button>
              )
            ) : (
              <div className="space-y-4">
                <img src={image} className="rounded-xl w-full aspect-[4/5] object-cover shadow-md" alt="Captured" />
                <div className="grid grid-cols-2 gap-4">
                  <button
                    onClick={() => { setImage(null); setCameraActive(false); }}
                    className="flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl border border-gray-300 text-gray-600 font-semibold hover:bg-gray-50 transition-colors active:scale-95"
                  >
                    🔄 Retake
                  </button>
                  <button
                    onClick={() => setStep(2)}
                    className="flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl text-white font-semibold active:scale-95 transition-all"
                    style={{ background: '#7C3AED', boxShadow: '0 8px 20px rgba(124,58,237,0.25)' }}
                  >
                    ✓ Submit Image
                  </button>
                </div>
              </div>
            )}

            {/* Tip */}
            <div className="flex gap-3 p-4 rounded-xl border border-amber-200 bg-amber-50">
              <Info size={18} className="text-amber-700 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-800 leading-relaxed">
                Clear photos of the issue help our maintenance team locate and fix the problem faster. Ensure proper lighting.
              </p>
            </div>
          </>
        )}

        {/* STEP 2: DETAILS */}
        {step === 2 && (
          <div className="space-y-5">
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-gray-600 ml-1">Complaint Title *</label>
              <input
                value={form.title}
                onChange={e => setForm({ ...form, title: e.target.value.slice(0, 200) })}
                placeholder="e.g., Water leakage in Block B"
                className={inputCls}
              />
              <p className="text-[11px] text-gray-400 text-right">{form.title.length}/200</p>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-semibold text-gray-600 ml-1">Category *</label>
              <div className="grid grid-cols-2 gap-2">
                {CATEGORIES.map(cat => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setForm({ ...form, category: cat })}
                    className="py-3 px-2 rounded-2xl font-medium text-sm transition-all"
                    style={{
                      background: form.category === cat ? '#7C3AED' : 'white',
                      color: form.category === cat ? 'white' : '#4a4455',
                      boxShadow: form.category === cat ? '0 4px 12px rgba(124,58,237,0.2)' : '0 1px 4px rgba(0,0,0,0.06)',
                      border: form.category === cat ? 'none' : '1px solid #ccc3d8',
                    }}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-semibold text-gray-600 ml-1">Location *</label>
              <div className="relative flex items-center">
                <MapPin size={18} className="absolute left-4 text-purple-600" />
                <input
                  value={form.location}
                  onChange={e => setForm({ ...form, location: e.target.value })}
                  placeholder="e.g., Ground Floor, Near Room 102"
                  className="w-full h-14 pl-11 pr-4 bg-white border-none ring-1 ring-[#ccc3d8] focus:ring-2 focus:ring-[#7C3AED] rounded-2xl transition-all outline-none text-gray-900 placeholder:text-gray-400 shadow-sm"
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center ml-1">
                <label className="block text-sm font-semibold text-gray-600">Description *</label>
                <span className="text-[11px] font-medium text-gray-400">{form.description.length}/500</span>
              </div>
              <textarea
                value={form.description}
                onChange={e => setForm({ ...form, description: e.target.value.slice(0, 500) })}
                placeholder="Describe the issue in detail..."
                rows={5}
                className="w-full p-4 bg-white border-none ring-1 ring-[#ccc3d8] focus:ring-2 focus:ring-[#7C3AED] rounded-2xl transition-all outline-none text-gray-900 placeholder:text-gray-400 shadow-sm resize-none"
              />
            </div>

            {/* Photo preview */}
            {image && (
              <div className="p-4 bg-white rounded-2xl shadow-sm ring-1 ring-[#ccc3d8]">
                <div className="flex items-center gap-3">
                  <img src={image} alt="Preview" className="w-16 h-16 rounded-xl object-cover shrink-0" />
                  <div className="flex-1">
                    <p className="text-xs font-bold text-gray-900">Reference Photo</p>
                    <p className="text-[11px] text-gray-500">Captured</p>
                  </div>
                  <button
                    onClick={() => { setImage(null); setStep(1); }}
                    className="p-2 text-red-500 hover:bg-red-50 rounded-xl transition-colors"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>
            )}

            <button
              onClick={handleVerify}
              disabled={loading || verifying || !form.title || !form.description}
              className="w-full h-14 text-white rounded-2xl font-bold flex items-center justify-center gap-2 shadow-lg active:scale-[0.98] transition-all disabled:opacity-50"
              style={{ background: '#7C3AED', boxShadow: '0 8px 20px rgba(124,58,237,0.2)' }}
            >
              {verifying
                ? <><Loader2 size={18} className="animate-spin" /> Verifying...</>
                : <>Verify Complaint <ArrowRight size={18} /></>}
            </button>
          </div>
        )}

        {/* STEP 3: VERIFICATION */}
        {step === 3 && (
          <div className="space-y-5 text-center">
            {verifying && (
              <div className="py-10">
                <div className="w-12 h-12 border-4 border-gray-200 border-t-purple-600 rounded-full animate-spin mx-auto mb-4" />
                <p className="font-semibold text-gray-700">AI is analyzing your image...</p>
                <p className="text-gray-400 text-sm mt-1">YOLOv8 detecting objects • CLIP matching description</p>
              </div>
            )}

            {!verifying && verification && (
              verification.reason === 'IMAGE_OF_HUMAN' ? (
                <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-center">
                  <div className="text-4xl mb-3">🚫</div>
                  <p className="font-bold text-red-800 text-base mb-2">Human Image Not Allowed</p>
                  <p className="text-red-600 text-sm mb-4">Please take a photo of the actual campus problem.</p>
                  <button
                    onClick={() => { setStep(1); setImage(null); setVerification(null); }}
                    className="w-full py-3 bg-red-500 text-white rounded-xl font-bold"
                  >
                    Retake Photo
                  </button>
                </div>
              ) : (
                <>
                  <div className={`inline-flex p-4 rounded-full ${allPass ? 'bg-green-100' : 'bg-red-100'}`}>
                    {allPass
                      ? <CheckCircle2 size={48} className="text-green-600" />
                      : <AlertCircle size={48} className="text-red-500" />}
                  </div>
                  <h2 className={`text-2xl font-bold ${allPass ? 'text-gray-900' : 'text-red-600'}`}>
                    {allPass ? 'Verification Passed' : 'Verification Failed'}
                  </h2>

                  <div className="bg-gray-50 p-4 rounded-xl text-left space-y-2">
                    {[
                      { label: 'Description matches image', pass: verification.descriptionMatches },
                      { label: 'Image appears authentic', pass: verification.isReal },
                    ].map(({ label, pass }) => (
                      <div key={label} className={`flex items-center gap-2 text-sm font-medium ${pass ? 'text-green-600' : 'text-red-500'}`}>
                        {pass ? <CheckCircle2 size={16} className="shrink-0" /> : <AlertCircle size={16} className="shrink-0" />}
                        {label}
                      </div>
                    ))}
                  </div>

                  <p className="text-gray-500 text-sm">{verification.reason}</p>

                  {allPass ? (
                    <button
                      onClick={handleSubmit}
                      disabled={loading}
                      className="w-full py-4 text-white rounded-xl font-bold flex items-center justify-center gap-2 active:scale-[0.98] transition-all disabled:opacity-50"
                      style={{ background: '#7C3AED', boxShadow: '0 8px 20px rgba(124,58,237,0.2)' }}
                    >
                      {loading ? <><Loader2 size={18} className="animate-spin" /> Submitting...</> : 'Submit Complaint'}
                    </button>
                  ) : (
                    <button
                      onClick={() => setStep(2)}
                      className="w-full py-4 bg-gray-900 text-white rounded-xl font-bold active:scale-[0.98] transition-all"
                    >
                      Go Back &amp; Revise
                    </button>
                  )}
                </>
              )
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default RaiseComplaint;

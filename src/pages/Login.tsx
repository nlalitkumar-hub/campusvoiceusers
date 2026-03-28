import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, CheckCircle2, Mail, User, CreditCard, Building2, AlertCircle, ArrowLeft } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

const API = `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api`;

const isNetworkError = (err: any) =>
  err instanceof TypeError && (err.message.includes('fetch') || err.message.includes('network') || err.message.includes('Failed'));

const Login: React.FC = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const role = (localStorage.getItem('campusvoice_role') || 'student') as 'student' | 'faculty';

  const [name, setName] = useState('');
  const [collegeId, setCollegeId] = useState('');
  const [institute, setInstitute] = useState('');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [step, setStep] = useState<'form' | 'otp'>('form');
  const [isDirectLogin, setIsDirectLogin] = useState(false);
  const [showDirectLogin, setShowDirectLogin] = useState(false);
  const [directLoginEmail, setDirectLoginEmail] = useState('');
  const [directLoginError, setDirectLoginError] = useState('');
  const [directLoginLoading, setDirectLoginLoading] = useState(false);
  const [emailCheckLoading, setEmailCheckLoading] = useState(false);
  const [emailExists, setEmailExists] = useState(false);
  const [emailCheckDone, setEmailCheckDone] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [resendCountdown, setResendCountdown] = useState(0);
  const [otpForTesting, setOtpForTesting] = useState('');

  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (step === 'otp') {
      setOtp(['', '', '', '', '', '']);
      setResendCountdown(30);
      setTimeout(() => otpRefs.current[0]?.focus(), 200);
    }
  }, [step]);

  useEffect(() => {
    if (resendCountdown <= 0) return;
    const t = setTimeout(() => setResendCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCountdown]);

  useEffect(() => {
    if (!email || !email.includes('@') || !email.includes('.')) {
      setEmailExists(false); setEmailCheckDone(false); setEmailCheckLoading(false); return;
    }
    setEmailCheckLoading(true);
    const timer = setTimeout(async () => {
      try {
        const { db } = await import('../lib/firebase');
        const { getDoc, doc } = await import('firebase/firestore');
        const userDoc = await getDoc(doc(db, 'users', email.trim().toLowerCase()));
        setEmailExists(userDoc.exists()); setEmailCheckDone(true);
      } catch { setEmailExists(false); setEmailCheckDone(false); }
      setEmailCheckLoading(false);
    }, 800);
    return () => clearTimeout(timer);
  }, [email]);

  const handleSendOTP = async () => {
    setError('');
    if (!name.trim() || !collegeId.trim() || !institute.trim() || !email.trim()) {
      setError('All fields are required.'); return;
    }
    setLoading(true);
    try {
      const response = await fetch(`${API}/auth/send-otp`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase(), name: name.trim(), collegeId: collegeId.trim(), role, institute: institute.trim() })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Failed to send OTP');
      setOtpForTesting(data.data?.otp || '');
      setOtp(['', '', '', '', '', '']); setIsDirectLogin(false);
      setStep('otp');
    } catch (err: any) {
      if (isNetworkError(err)) setError('Server is offline. Please start the backend.');
      else setError(err.message || 'Failed to send OTP. Please try again.');
    } finally { setLoading(false); }
  };

  const handleDirectLogin = async () => {
    if (!directLoginEmail.trim()) { setDirectLoginError('Please enter your email.'); return; }
    setDirectLoginLoading(true); setDirectLoginError('');
    try {
      const { db } = await import('../lib/firebase');
      const { getDoc, doc } = await import('firebase/firestore');
      const normalizedEmail = directLoginEmail.trim().toLowerCase();
      const userDoc = await getDoc(doc(db, 'users', normalizedEmail));
      if (!userDoc.exists()) {
        setDirectLoginError('No account found with this email. Please sign up first.');
        setDirectLoginLoading(false); return;
      }
      const userData = userDoc.data();
      const response = await fetch(`${API}/auth/send-otp`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: normalizedEmail, name: userData.name, collegeId: userData.collegeId, role: userData.role, institute: userData.institute })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Failed to send OTP');
      setName(userData.name || ''); setCollegeId(userData.collegeId || '');
      setInstitute(userData.institute || ''); setEmail(normalizedEmail);
      localStorage.setItem('campusvoice_role', userData.role || 'student');
      setIsDirectLogin(true); setOtp(['', '', '', '', '', '']);
      setOtpForTesting(data.data?.otp || '');
      setStep('otp');
    } catch (err: any) {
      if (isNetworkError(err)) setDirectLoginError('Server is offline. Please start the backend.');
      else setDirectLoginError('Something went wrong. Please try again.');
    } finally { setDirectLoginLoading(false); }
  };

  const handleVerifyOTP = async () => {
    setError('');
    const enteredOTP = otp.join('').trim();
    if (enteredOTP.length !== 6) { setError('Please enter the complete 6-digit OTP.'); return; }
    if (!/^\d{6}$/.test(enteredOTP)) { setError('OTP must contain only numbers.'); return; }
    setLoading(true);
    const normalizedEmail = email.trim().toLowerCase();
    const resolvedRole = (localStorage.getItem('campusvoice_role') || 'student') as 'student' | 'faculty';
    try {
      const response = await fetch(`${API}/auth/verify-otp`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: normalizedEmail, otp: enteredOTP, name: name.trim(), collegeId: collegeId.trim(), role: resolvedRole, institute: institute.trim() })
      });
      const data = await response.json();
      if (response.ok) {
        const token = data.data?.token; const userData = data.data?.user;
        if (!token) throw new Error('No token received');
        const userObj = { id: normalizedEmail, name: userData?.name || name.trim(), email: normalizedEmail, collegeId: userData?.collegeId || collegeId.trim(), institute: userData?.institute || institute.trim(), role: (userData?.role || role) as 'student' | 'faculty', points: userData?.points || 0, level: userData?.level || 1, badges: userData?.badges || [] };
        localStorage.setItem('token', token); login(userObj); setSuccess(true);
        const destRole = userData?.role || role;
        setTimeout(() => navigate(destRole === 'faculty' ? '/faculty-dashboard' : '/feed'), 800);
      } else { throw new Error(data.message || 'Invalid OTP'); }
    } catch (err: any) {
      if (isNetworkError(err)) { setError('Server is offline. Please start the backend.'); setLoading(false); return; }
      // Firebase fallback
      try {
        const { db } = await import('../lib/firebase');
        const { getDoc, doc, deleteDoc, setDoc } = await import('firebase/firestore');
        const otpDoc = await getDoc(doc(db, 'otps', normalizedEmail));
        if (!otpDoc.exists()) { setError('OTP expired. Please resend.'); setLoading(false); return; }
        const stored = otpDoc.data();
        const expiry = stored.expiresAt?.toDate?.() || new Date(stored.expiresAt);
        if (expiry < new Date()) { setError('OTP expired. Please resend.'); setLoading(false); return; }
        if (enteredOTP !== stored.otp) { setError('Invalid OTP. Please try again.'); setLoading(false); return; }
        if (isDirectLogin) {
          const userDoc = await getDoc(doc(db, 'users', normalizedEmail));
          const fullUser = { id: normalizedEmail, ...userDoc.data() } as any;
          await deleteDoc(doc(db, 'otps', normalizedEmail));
          localStorage.setItem('token', 'firebase_' + normalizedEmail);
          login({ ...fullUser, role: fullUser.role as 'student' | 'faculty' });
          setSuccess(true); setTimeout(() => navigate(fullUser.role === 'faculty' ? '/faculty-dashboard' : '/feed'), 800);
        } else {
          await setDoc(doc(db, 'users', normalizedEmail), { name: name.trim(), collegeId: collegeId.trim(), institute: institute.trim(), email: normalizedEmail, role: resolvedRole, isVerified: true, points: 0, level: 1, levelTitle: 'Newcomer', badges: [], complaintsRaised: 0, createdAt: new Date().toISOString() }, { merge: true });
          await deleteDoc(doc(db, 'otps', normalizedEmail));
          const userObj = { id: normalizedEmail, name: name.trim(), email: normalizedEmail, collegeId: collegeId.trim(), institute: institute.trim(), role: resolvedRole as 'student' | 'faculty', points: 0, level: 1, badges: [] };
          localStorage.setItem('token', 'firebase_' + normalizedEmail); login(userObj); setSuccess(true);
          setTimeout(() => navigate(resolvedRole === 'faculty' ? '/faculty-dashboard' : '/feed'), 800);
        }
      } catch { setError('Verification failed. Please try again.'); }
    } finally { setLoading(false); }
  };

  const handleResendOTP = async () => {
    setOtp(['', '', '', '', '', '']); setError('');
    setResendCountdown(30);
    await (isDirectLogin ? handleDirectLogin : handleSendOTP)();
    setTimeout(() => otpRefs.current[0]?.focus(), 100);
  };

  const inputCls = "w-full h-[44px] bg-white/10 border border-white/20 text-white rounded-xl pl-11 pr-4 placeholder:text-white/40 outline-none focus:border-purple-400 focus:bg-white/20 transition-all text-sm";
  const labelCls = "block text-[11px] font-bold uppercase tracking-widest text-white/60 mb-1.5";

  return (
    <div
      className="h-screen relative overflow-hidden"
      style={{
        backgroundImage: "url('/campus-bg.jpg')",
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        fontFamily: 'Inter, sans-serif',
      }}
    >
      {/* Dark overlay */}
      <div className="absolute inset-0 bg-black/40 z-0" />

      {/* Main content */}
      <main className="relative z-10 flex flex-col items-center justify-center h-full px-4 overflow-y-auto py-4">

        {/* Glassmorphism card */}
        <div
          className="w-full max-w-sm rounded-3xl p-5 border border-white/20"
          style={{
            background: 'rgba(255,255,255,0.15)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
          }}
        >

          {/* SIGN UP FORM */}
          {step === 'form' && !showDirectLogin && (
            <>
              {/* Back to role select */}
              <button onClick={() => navigate('/')} className="flex items-center gap-1.5 text-white/60 hover:text-white text-sm mb-4 transition-colors">
                <ArrowLeft size={16} /> Back
              </button>
              <div className="mb-4 flex flex-col items-center text-center">
                <div className="w-12 h-12 rounded-xl bg-purple-600 flex items-center justify-center text-xl mb-3">
                  🏛️
                </div>
                <h2 className="text-white font-bold text-xl tracking-tight mb-1">Join CampusVoice</h2>
                <p className="text-white/70 text-xs leading-relaxed">Empowering students to advocate for change.</p>
              </div>

              <div className="space-y-3">
                <div>
                  <label className={labelCls}>Full Name</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-white/60">
                      <User size={16} />
                    </div>
                    <input value={name} onChange={e => { setName(e.target.value); setError(''); }} placeholder="Your full name" className={inputCls} />
                  </div>
                </div>

                <div>
                  <label className={labelCls}>College ID</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-white/60">
                      <CreditCard size={16} />
                    </div>
                    <input value={collegeId} onChange={e => { setCollegeId(e.target.value); setError(''); }} placeholder="STU-2024-XXXX" className={inputCls} />
                  </div>
                </div>

                <div>
                  <label className={labelCls}>Institute</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-white/60">
                      <Building2 size={16} />
                    </div>
                    <input value={institute} onChange={e => { setInstitute(e.target.value); setError(''); }} placeholder="Your institute name" className={inputCls} />
                  </div>
                </div>

                <div>
                  <label className={labelCls}>Email Address</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-white/60">
                      <Mail size={16} />
                    </div>
                    <input value={email} onChange={e => { setEmail(e.target.value); setError(''); }} placeholder="you@university.edu" type="email" className={inputCls} />
                  </div>
                  {emailCheckLoading && (
                    <p className="text-xs text-white/60 px-1 mt-1 flex items-center gap-1">
                      <Loader2 size={11} className="animate-spin" /> Checking...
                    </p>
                  )}
                  {!emailCheckLoading && emailExists && emailCheckDone && (
                    <div className="bg-red-500/20 border border-red-400/40 rounded-xl px-3 py-2 mt-2 flex items-start gap-2">
                      <AlertCircle size={14} className="text-red-200 mt-0.5 shrink-0" />
                      <p className="text-xs text-red-200">
                        Already registered.{' '}
                        <button onClick={() => { setShowDirectLogin(true); setDirectLoginEmail(email); }} className="font-bold underline text-purple-300">
                          Login instead →
                        </button>
                      </p>
                    </div>
                  )}
                  {!emailCheckLoading && !emailExists && emailCheckDone && (
                    <p className="text-xs text-green-400 px-1 mt-1 flex items-center gap-1">
                      <CheckCircle2 size={11} /> New registration can proceed
                    </p>
                  )}
                </div>

                {error && (
                  <div className="bg-red-500/20 border border-red-400/40 rounded-xl px-3 py-2 text-xs text-red-200 flex items-start gap-2">
                    <AlertCircle size={13} className="shrink-0 mt-0.5" />{error}
                  </div>
                )}

                <button
                  onClick={handleSendOTP}
                  disabled={loading || emailExists}
                  className="w-full h-[44px] bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-xl active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loading ? <><Loader2 size={16} className="animate-spin" /> Sending...</> : 'Create Account'}
                </button>
              </div>

              <div className="mt-6 text-center">
                <p className="text-white/70 text-sm">
                  Already have an account?{' '}
                  <button onClick={() => setShowDirectLogin(true)} className="text-purple-300 font-bold hover:underline">Login</button>
                </p>
              </div>
            </>
          )}

          {/* DIRECT LOGIN */}
          {step === 'form' && showDirectLogin && (
            <>
              {/* Back to sign up */}
              <button onClick={() => { setShowDirectLogin(false); setDirectLoginError(''); }} className="flex items-center gap-1.5 text-white/60 hover:text-white text-sm mb-4 transition-colors">
                <ArrowLeft size={16} /> Back
              </button>
              <div className="mb-8 text-center">
                <h2 className="text-white font-bold text-2xl tracking-tight mb-1">Welcome Back!</h2>
                <p className="text-white/70 text-sm leading-relaxed">Sign in to continue your scholarly advocacy.</p>
              </div>

              <div className="space-y-5">
                <div>
                  <label className={labelCls} htmlFor="login-email">Email Address</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-white/60">
                      <Mail size={16} />
                    </div>
                    <input
                      id="login-email"
                      value={directLoginEmail}
                      onChange={e => { setDirectLoginEmail(e.target.value); setDirectLoginError(''); }}
                      placeholder="name@university.edu"
                      type="email"
                      className={inputCls}
                    />
                  </div>
                </div>

                {directLoginError && (
                  <div className="bg-red-500/20 border border-red-400/40 rounded-xl px-3 py-2 text-xs text-red-200 flex items-start gap-2">
                    <AlertCircle size={13} className="shrink-0 mt-0.5" />{directLoginError}
                  </div>
                )}

                <button
                  onClick={handleDirectLogin}
                  disabled={directLoginLoading}
                  className="w-full h-[52px] bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-xl active:scale-[0.98] transition-all disabled:opacity-70 flex items-center justify-center gap-2"
                >
                  {directLoginLoading ? <><Loader2 size={16} className="animate-spin" /> Sending...</> : 'Continue'}
                </button>
              </div>

              <div className="mt-8 text-center">
                <p className="text-white/70 text-sm">
                  Don't have an account?{' '}
                  <button onClick={() => { setShowDirectLogin(false); setDirectLoginError(''); }} className="text-purple-300 font-bold hover:underline">Sign Up</button>
                </p>
              </div>
            </>
          )}

          {/* OTP STEP */}
          {step === 'otp' && (
            <>
              {/* Back to form */}
              <button onClick={() => { setStep('form'); setError(''); setOtp(['','','','','','']); }} className="flex items-center gap-1.5 text-white/60 hover:text-white text-sm mb-4 transition-colors">
                <ArrowLeft size={16} /> Back
              </button>
              <div className="mb-6 flex flex-col items-center text-center">
                <div className="w-16 h-16 rounded-full bg-purple-500/20 flex items-center justify-center mb-4">
                  <Mail size={32} className="text-purple-300" />
                </div>
                <h1 className="text-white text-2xl font-bold tracking-tight mb-2">Verify Your Email</h1>
                <p className="text-white/70 text-sm px-2 leading-relaxed">
                  We've sent a 6-digit code to{' '}
                  <span className="font-bold text-purple-300">{email}</span>
                </p>
              </div>

              {otpForTesting && (
                <div style={{ backgroundColor: '#FEF3C7', border: '1px solid #F59E0B', borderRadius: '8px', padding: '12px', marginTop: '8px', textAlign: 'center' }}>
                  <p style={{ fontWeight: 'bold', color: '#92400E', fontSize: '16px' }}>Test OTP: {otpForTesting}</p>
                </div>
              )}

              <div className="flex justify-between gap-1.5 mb-5">
                {[0, 1, 2, 3, 4, 5].map(i => (
                  <input
                    key={i}
                    ref={el => { otpRefs.current[i] = el; }}
                    type="tel"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={1}
                    value={otp[i] || ''}
                    className="w-full h-12 bg-white/10 border border-white/20 text-white font-bold text-xl text-center rounded-xl focus:border-purple-400 focus:bg-white/20 outline-none transition-all"
                    onChange={e => {
                      const raw = e.target.value.replace(/\D/g, ''); if (!raw) return;
                      const newOtp = [...otp]; newOtp[i] = raw[0]; setOtp(newOtp); setError('');
                      if (i < 5) setTimeout(() => otpRefs.current[i + 1]?.focus(), 0);
                    }}
                    onKeyDown={e => {
                      if (e.key === 'Backspace') {
                        e.preventDefault();
                        const newOtp = [...otp];
                        if (newOtp[i]) { newOtp[i] = ''; setOtp(newOtp); }
                        else if (i > 0) { newOtp[i - 1] = ''; setOtp(newOtp); otpRefs.current[i - 1]?.focus(); }
                      } else if (e.key === 'Enter') handleVerifyOTP();
                    }}
                    onPaste={e => {
                      e.preventDefault();
                      const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
                      if (pasted.length > 0) {
                        const newOtp = ['', '', '', '', '', ''];
                        for (let j = 0; j < pasted.length; j++) newOtp[j] = pasted[j];
                        setOtp(newOtp);
                        setTimeout(() => otpRefs.current[Math.min(pasted.length, 5)]?.focus(), 0);
                      }
                    }}
                  />
                ))}
              </div>

              {error && (
                <div className="bg-red-500/20 border border-red-400/40 rounded-xl px-3 py-2 text-xs text-red-200 mb-4 flex items-start gap-2">
                  <AlertCircle size={13} className="shrink-0 mt-0.5" />{error}
                </div>
              )}

              {success ? (
                <div className="flex items-center justify-center gap-2 py-4 bg-green-500/20 border border-green-400/40 rounded-xl text-green-300 font-semibold text-sm">
                  <CheckCircle2 size={18} /> Verified! Redirecting...
                </div>
              ) : (
                <button
                  onClick={handleVerifyOTP}
                  disabled={loading}
                  className="w-full h-[52px] bg-green-500 hover:bg-green-600 text-white font-semibold rounded-xl active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-70"
                >
                  {loading ? <><Loader2 size={16} className="animate-spin" /> Verifying...</> : 'Verify & Login'}
                </button>
              )}

              <div className="mt-6 text-center">
                <p className="text-white/60 text-sm mb-2">Didn't receive code?</p>
                {resendCountdown > 0 ? (
                  <p className="text-white/40 text-sm">Resend in {resendCountdown}s...</p>
                ) : (
                  <button onClick={handleResendOTP} className="text-purple-300 font-semibold hover:underline text-sm">
                    Resend Code →
                  </button>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer links */}
        <div className="mt-8 flex justify-center gap-6">
          {['Privacy Policy', 'Terms of Service', 'Help'].map(l => (
            <span key={l} className="text-[10px] font-medium uppercase tracking-[0.2em] text-white/40 cursor-pointer hover:text-white/70 transition-colors">
              {l}
            </span>
          ))}
        </div>
      </main>
    </div>
  );
};

export default Login;

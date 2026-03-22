import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, GraduationCap, Briefcase, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

const API = 'http://localhost:5000/api';

const Login: React.FC = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const role = (localStorage.getItem('campusvoice_role') || 'student') as 'student' | 'faculty';

  // Form fields
  const [name, setName] = useState('');
  const [collegeId, setCollegeId] = useState('');
  const [institute, setInstitute] = useState('');
  const [email, setEmail] = useState('');

  // OTP
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [step, setStep] = useState<'form' | 'otp'>('form');
  const [isDirectLogin, setIsDirectLogin] = useState(false);

  // Direct login
  const [showDirectLogin, setShowDirectLogin] = useState(false);
  const [directLoginEmail, setDirectLoginEmail] = useState('');
  const [directLoginError, setDirectLoginError] = useState('');
  const [directLoginLoading, setDirectLoginLoading] = useState(false);

  // Email check
  const [emailCheckLoading, setEmailCheckLoading] = useState(false);
  const [emailExists, setEmailExists] = useState(false);
  const [emailCheckDone, setEmailCheckDone] = useState(false);

  // General
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  // TEMPORARY: OTP display for testing — remove before going live
  const [generatedOTP, setGeneratedOTP] = useState('');

  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);
  const emailRef = useRef<HTMLInputElement>(null);
  const directLoginRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (step === 'otp') {
      setOtp(['', '', '', '', '', '']);
      setTimeout(() => otpRefs.current[0]?.focus(), 200);
    }
  }, [step]);

  // Email duplicate detection
  useEffect(() => {
    if (!email || !email.includes('@') || !email.includes('.')) {
      setEmailExists(false);
      setEmailCheckDone(false);
      setEmailCheckLoading(false);
      return;
    }
    setEmailCheckLoading(true);
    const timer = setTimeout(async () => {
      try {
        const { db } = await import('../lib/firebase');
        const { getDoc, doc } = await import('firebase/firestore');
        const userDoc = await getDoc(doc(db, 'users', email.trim().toLowerCase()));
        setEmailExists(userDoc.exists());
        setEmailCheckDone(true);
      } catch {
        setEmailExists(false);
        setEmailCheckDone(false);
      }
      setEmailCheckLoading(false);
    }, 800);
    return () => clearTimeout(timer);
  }, [email]);

  const handleSendOTP = async () => {
    setError('');
    if (!name.trim() || !collegeId.trim() || !institute.trim() || !email.trim()) {
      setError('All fields are required.');
      return;
    }
    setLoading(true);
    try {
      const response = await fetch(`${API}/auth/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase(), name: name.trim(), collegeId: collegeId.trim(), role, institute: institute.trim() })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Failed to send OTP');
      setOtp(['', '', '', '', '', '']);
      setIsDirectLogin(false);
      // TEMPORARY: capture devOTP for testing display
      const backendOTP = data.data?.devOTP || data.devOTP;
      if (backendOTP) setGeneratedOTP(String(backendOTP));
      setStep('otp');
    } catch (err: any) {
      setError(err.message || 'Failed to send OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleDirectLogin = async () => {
    if (!directLoginEmail.trim()) { setDirectLoginError('Please enter your email.'); return; }
    setDirectLoginLoading(true);
    setDirectLoginError('');
    try {
      const { db } = await import('../lib/firebase');
      const { getDoc, doc } = await import('firebase/firestore');
      const normalizedEmail = directLoginEmail.trim().toLowerCase();
      const userDoc = await getDoc(doc(db, 'users', normalizedEmail));
      if (!userDoc.exists()) {
        setDirectLoginError('No account found with this email. Please sign up first.');
        setDirectLoginLoading(false);
        return;
      }
      const userData = userDoc.data();
      // Send OTP via backend and use the OTP it generates
      const response = await fetch(`${API}/auth/send-otp`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: normalizedEmail, name: userData.name, collegeId: userData.collegeId, role: userData.role, institute: userData.institute })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Failed to send OTP');
      setName(userData.name || '');
      setCollegeId(userData.collegeId || '');
      setInstitute(userData.institute || '');
      setEmail(normalizedEmail);
      localStorage.setItem('campusvoice_role', userData.role || 'student');
      setIsDirectLogin(true);
      setOtp(['', '', '', '', '', '']);
      // TEMPORARY: capture devOTP for testing display
      const backendOTP = data.data?.devOTP || data.devOTP;
      if (backendOTP) setGeneratedOTP(String(backendOTP));
      setStep('otp');
    } catch {
      setDirectLoginError('Something went wrong. Please try again.');
    } finally {
      setDirectLoginLoading(false);
    }
  };

  const handleVerifyOTP = async () => {
    setError('');
    const enteredOTP = Array.isArray(otp) ? otp.join('').trim() : String(otp).trim();
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
        const token = data.data?.token;
        const userData = data.data?.user;
        if (!token) throw new Error('No token received');
        const userObj = {
          id: normalizedEmail, name: userData?.name || name.trim(),
          email: normalizedEmail, collegeId: userData?.collegeId || collegeId.trim(),
          institute: userData?.institute || institute.trim(),
          role: (userData?.role || role) as 'student' | 'faculty',
          points: userData?.points || 0, level: userData?.level || 1, badges: userData?.badges || [],
        };
        localStorage.setItem('token', token);
        login(userObj);
        setSuccess(true);
        setTimeout(() => navigate('/feed'), 800);
      } else {
        throw new Error(data.message || 'Invalid OTP');
      }
    } catch {
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
          // Load full existing user data
          const userDoc = await getDoc(doc(db, 'users', normalizedEmail));
          const fullUser = { id: normalizedEmail, ...userDoc.data() } as any;
          await deleteDoc(doc(db, 'otps', normalizedEmail));
          localStorage.setItem('token', 'firebase_' + normalizedEmail);
          login({ ...fullUser, role: fullUser.role as 'student' | 'faculty' });
          setSuccess(true);
          setTimeout(() => navigate('/feed'), 800);
        } else {
          await setDoc(doc(db, 'users', normalizedEmail), {
            name: name.trim(), collegeId: collegeId.trim(), institute: institute.trim(),
            email: normalizedEmail, role: resolvedRole, isVerified: true,
            points: 0, level: 1, levelTitle: 'Newcomer', badges: [], complaintsRaised: 0,
            createdAt: new Date().toISOString()
          }, { merge: true });
          await deleteDoc(doc(db, 'otps', normalizedEmail));
          const userObj = {
            id: normalizedEmail, name: name.trim(), email: normalizedEmail,
            collegeId: collegeId.trim(), institute: institute.trim(),
            role: resolvedRole as 'student' | 'faculty', points: 0, level: 1, badges: [],
          };
          localStorage.setItem('token', 'firebase_' + normalizedEmail);
          login(userObj);
          setSuccess(true);
          setTimeout(() => navigate('/feed'), 800);
        }
      } catch {
        setError('Verification failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResendOTP = async () => {
    setOtp(['', '', '', '', '', '']);
    setError('');
    await (isDirectLogin ? handleDirectLogin : handleSendOTP)();
    setTimeout(() => otpRefs.current[0]?.focus(), 100);
  };

  const inputStyle: React.CSSProperties = {
    background: '#F0F9FF', border: '1.5px solid #E5E7EB', borderRadius: 10,
    padding: '12px 16px', width: '100%', fontSize: 14, color: '#111827',
    outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.2s',
  };
  const labelStyle: React.CSSProperties = {
    fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6, display: 'block',
  };

  return (
    <div style={{ background: 'linear-gradient(135deg, #FAF5FF 0%, #F5F3FF 100%)', minHeight: '100vh', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: -150, right: -150, width: 500, height: 500, borderRadius: '50%', background: 'radial-gradient(circle, rgba(124,58,237,0.15), rgba(168,85,247,0.08), transparent)', filter: 'blur(80px)', pointerEvents: 'none', zIndex: 0 }} />
      <div style={{ position: 'absolute', bottom: -150, left: -150, width: 500, height: 500, borderRadius: '50%', background: 'radial-gradient(circle, rgba(124,58,237,0.12), rgba(168,85,247,0.06), transparent)', filter: 'blur(80px)', pointerEvents: 'none', zIndex: 0 }} />

      <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: 20 }}>
        <div style={{ background: '#FFFFFF', border: '1px solid #F3F4F6', borderRadius: 20, padding: 40, width: '100%', maxWidth: 420, boxShadow: '0 4px 24px rgba(0,0,0,0.06)' }}>

          {/* Back */}
          <button onClick={() => step === 'otp' ? setStep('form') : navigate('/')}
            style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', color: '#6B7280', fontSize: 14, padding: 0, marginBottom: 16 }}>
            <ArrowLeft size={16} /> Back
          </button>

          {/* Role badge */}
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 12px', borderRadius: 20, background: role === 'student' ? '#FAF5FF' : '#F5F3FF', color: role === 'student' ? '#6D28D9' : '#7C3AED', fontSize: 13, fontWeight: 600, marginBottom: 16 }}>
            {role === 'student' ? <GraduationCap size={14} /> : <Briefcase size={14} />}
            {role === 'student' ? 'Student' : 'Faculty'}
          </div>

          {/* FORM STEP */}
          {step === 'form' && !showDirectLogin && (
            <>
              <h1 style={{ fontSize: 24, fontWeight: 700, color: '#111827', margin: '0 0 8px' }}>Welcome to CampusVoice</h1>
              <p style={{ fontSize: 14, color: '#6B7280', margin: '0 0 24px' }}>Sign in with your institute credentials</p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <label style={labelStyle}>Full Name</label>
                  <input value={name} onChange={e => { setName(e.target.value); setError(''); }} placeholder="Enter your full name" style={inputStyle}
                    onFocus={e => (e.target.style.borderColor = '#7C3AED')} onBlur={e => (e.target.style.borderColor = '#E5E7EB')} />
                </div>
                <div>
                  <label style={labelStyle}>College ID</label>
                  <input value={collegeId} onChange={e => { setCollegeId(e.target.value); setError(''); }} placeholder="Enter your college ID" style={inputStyle}
                    onFocus={e => (e.target.style.borderColor = '#7C3AED')} onBlur={e => (e.target.style.borderColor = '#E5E7EB')} />
                </div>
                <div>
                  <label style={labelStyle}>Institute Name</label>
                  <input value={institute} onChange={e => { setInstitute(e.target.value); setError(''); }} placeholder="Enter your institute name" style={inputStyle}
                    onFocus={e => (e.target.style.borderColor = '#7C3AED')} onBlur={e => (e.target.style.borderColor = '#E5E7EB')} />
                </div>
                <div>
                  <label style={labelStyle}>Email Address</label>
                  <input ref={emailRef} value={email} onChange={e => { setEmail(e.target.value); setError(''); }} placeholder="you@example.com" type="email" style={inputStyle}
                    onFocus={e => (e.target.style.borderColor = '#7C3AED')} onBlur={e => (e.target.style.borderColor = '#E5E7EB')} />

                  {/* Email check states */}
                  {emailCheckLoading && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6, color: '#9CA3AF', fontSize: 12 }}>
                      <Loader2 size={12} className="animate-spin" /> Checking email...
                    </div>
                  )}
                  {!emailCheckLoading && emailExists && emailCheckDone && (
                    <div style={{ background: '#FFF3CD', border: '1px solid #FFC107', borderRadius: 8, padding: '10px 14px', marginTop: 6, display: 'flex', alignItems: 'center', gap: 8, animation: 'fadeSlideUp 0.3s ease' }}>
                      <AlertCircle size={16} style={{ color: '#D97706', flexShrink: 0 }} />
                      <div>
                        <span style={{ color: '#92400E', fontSize: 13, fontWeight: 500 }}>This email is already registered. </span>
                        <button onClick={() => { setShowDirectLogin(true); setDirectLoginEmail(email); setTimeout(() => directLoginRef.current?.scrollIntoView({ behavior: 'smooth' }), 100); }}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#7C3AED', fontSize: 13, fontWeight: 600, textDecoration: 'underline', padding: 0 }}>
                          Login directly instead →
                        </button>
                      </div>
                    </div>
                  )}
                  {!emailCheckLoading && !emailExists && emailCheckDone && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 6, color: '#059669', fontSize: 12 }}>
                      <CheckCircle2 size={12} /> New registration can proceed
                    </div>
                  )}
                </div>

                {error && (
                  <div style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: 8, padding: '10px 14px', color: '#DC2626', fontSize: 13 }}>{error}</div>
                )}

                <button onClick={handleSendOTP} disabled={loading || emailExists}
                  title={emailExists ? 'This email is already registered. Please login directly.' : ''}
                  style={{ width: '100%', background: '#7C3AED', color: 'white', fontWeight: 600, borderRadius: 10, padding: '14px', border: 'none', cursor: (loading || emailExists) ? 'not-allowed' : 'pointer', fontSize: 15, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, transition: 'background 0.2s', opacity: (loading || emailExists) ? 0.5 : 1 }}
                  onMouseEnter={e => { if (!loading && !emailExists) (e.currentTarget.style.background = '#6D28D9') }}
                  onMouseLeave={e => { (e.currentTarget.style.background = '#7C3AED') }}>
                  {loading ? <><Loader2 size={16} className="animate-spin" /> Sending...</> : 'Send OTP'}
                </button>

                {/* Already have account */}
                <div style={{ textAlign: 'center', marginTop: 4 }}>
                  <span style={{ color: '#9CA3AF', fontSize: 13 }}>Already have an account? </span>
                  <button onClick={() => { setShowDirectLogin(true); setTimeout(() => directLoginRef.current?.scrollIntoView({ behavior: 'smooth' }), 100); }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#7C3AED', fontSize: 13, fontWeight: 500, textDecoration: 'underline', padding: 0 }}>
                    Login directly
                  </button>
                </div>
              </div>
            </>
          )}

          {/* DIRECT LOGIN SECTION */}
          {step === 'form' && showDirectLogin && (
            <div ref={directLoginRef} style={{ animation: 'fadeSlideUp 0.3s ease' }}>
              <h1 style={{ fontSize: 24, fontWeight: 700, color: '#111827', margin: '0 0 8px' }}>Welcome Back!</h1>
              <p style={{ fontSize: 14, color: '#6B7280', margin: '0 0 24px' }}>Enter your registered email to login</p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <label style={labelStyle}>Registered Email</label>
                  <input value={directLoginEmail} onChange={e => { setDirectLoginEmail(e.target.value); setDirectLoginError(''); }} placeholder="you@example.com" type="email" style={inputStyle}
                    onFocus={e => (e.target.style.borderColor = '#7C3AED')} onBlur={e => (e.target.style.borderColor = '#E5E7EB')} />
                </div>

                {directLoginError && (
                  <div style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: 8, padding: '10px 14px', color: '#DC2626', fontSize: 13 }}>{directLoginError}</div>
                )}

                <button onClick={handleDirectLogin} disabled={directLoginLoading}
                  style={{ width: '100%', background: '#7C3AED', color: 'white', fontWeight: 600, borderRadius: 10, padding: '14px', border: 'none', cursor: directLoginLoading ? 'not-allowed' : 'pointer', fontSize: 15, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, transition: 'background 0.2s', opacity: directLoginLoading ? 0.8 : 1 }}
                  onMouseEnter={e => { if (!directLoginLoading) (e.currentTarget.style.background = '#6D28D9') }}
                  onMouseLeave={e => { (e.currentTarget.style.background = '#7C3AED') }}>
                  {directLoginLoading ? <><Loader2 size={16} className="animate-spin" /> Sending...</> : 'Send Login OTP'}
                </button>

                <button onClick={() => { setShowDirectLogin(false); setDirectLoginError(''); }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#7C3AED', fontSize: 13, textAlign: 'center', padding: 0 }}>
                  ← New user? Create account
                </button>
              </div>
            </div>
          )}

          {/* OTP STEP */}
          {step === 'otp' && (
            <div style={{ animation: 'fadeSlideUp 0.3s ease' }}>
              <h1 style={{ fontSize: 22, fontWeight: 700, color: '#111827', margin: '0 0 6px' }}>
                {isDirectLogin ? `Welcome back, ${name}!` : 'Verify your email'}
              </h1>
              <p style={{ fontSize: 14, color: '#6B7280', margin: '0 0 20px' }}>
                {isDirectLogin ? 'Enter the OTP sent to your email' : 'Enter the OTP to complete signup'}
              </p>

              <div style={{ background: '#F5F3FF', border: '1px solid #E9D5FF', borderRadius: 12, padding: 16, marginBottom: 20, textAlign: 'center' }}>
                <p style={{ fontSize: 20, marginBottom: 6 }}>📧</p>
                <p style={{ fontWeight: 600, color: '#7C3AED', fontSize: 15, marginBottom: 4 }}>OTP Sent Successfully!</p>
                <p style={{ color: '#A855F7', fontSize: 13, margin: 0 }}>Please check your email inbox at</p>
                <p style={{ fontWeight: 700, color: '#7C3AED', fontSize: 14, marginTop: 4, margin: '4px 0 0' }}>{email}</p>
                <p style={{ color: '#9CA3AF', fontSize: 12, marginTop: 6, marginBottom: 0 }}>OTP expires in 5 minutes</p>
                {/* TEMPORARY: OTP display for testing — remove before going live */}
                {generatedOTP && (
                  <div style={{ background: '#EEF2FF', border: '2px dashed #4F46E5', borderRadius: 12, padding: 16, textAlign: 'center', marginTop: 12 }}>
                    <p style={{ fontSize: 12, color: '#6B7280', marginBottom: 6, fontWeight: 500, margin: '0 0 6px' }}>Your OTP Code (Testing Only):</p>
                    <p style={{ fontSize: 36, fontWeight: 800, color: '#4F46E5', letterSpacing: 8, margin: 0 }}>{generatedOTP}</p>
                    <p style={{ fontSize: 11, color: '#9CA3AF', marginTop: 6, marginBottom: 0 }}>⚠️ Remove this before going live</p>
                  </div>
                )}
              </div>

              <label style={labelStyle}>Enter OTP</label>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'center', margin: '20px 0' }}>
                {[0, 1, 2, 3, 4, 5].map((index) => (
                  <input
                    key={index}
                    ref={el => { otpRefs.current[index] = el; }}
                    type="tel"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={1}
                    value={otp[index] || ''}
                    style={{ width: 48, height: 56, textAlign: 'center', fontSize: 22, fontWeight: 700, background: '#F8F9FA', border: `1.5px solid ${otp[index] ? '#7C3AED' : '#E5E7EB'}`, borderRadius: 12, color: '#111827', outline: 'none', cursor: 'text', caretColor: 'transparent' }}
                    onFocus={e => { e.target.style.borderColor = '#7C3AED'; e.target.style.boxShadow = '0 0 0 3px rgba(79,70,229,0.1)'; }}
                    onBlur={e => { e.target.style.borderColor = otp[index] ? '#7C3AED' : '#E5E7EB'; e.target.style.boxShadow = 'none'; }}
                    onChange={e => {
                      const raw = e.target.value.replace(/\D/g, '');
                      if (!raw) return;
                      // Take only the first digit from whatever was typed
                      const newDigit = raw[0];
                      const newOtp = [...otp];
                      newOtp[index] = newDigit;
                      setOtp(newOtp);
                      setError('');
                      if (index < 5) setTimeout(() => otpRefs.current[index + 1]?.focus(), 0);
                    }}
                    onKeyDown={e => {
                      if (e.key === 'Backspace') {
                        e.preventDefault();
                        const newOtp = [...otp];
                        if (newOtp[index] !== '') {
                          newOtp[index] = '';
                          setOtp(newOtp);
                        } else if (index > 0) {
                          newOtp[index - 1] = '';
                          setOtp(newOtp);
                          otpRefs.current[index - 1]?.focus();
                        }
                      } else if (e.key === 'ArrowLeft' && index > 0) {
                        e.preventDefault();
                        otpRefs.current[index - 1]?.focus();
                      } else if (e.key === 'ArrowRight' && index < 5) {
                        e.preventDefault();
                        otpRefs.current[index + 1]?.focus();
                      } else if (e.key === 'Enter') {
                        handleVerifyOTP();
                      }
                    }}
                    onPaste={e => {
                      e.preventDefault();
                      const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
                      if (pasted.length > 0) {
                        const newOtp = ['', '', '', '', '', ''];
                        for (let i = 0; i < pasted.length; i++) newOtp[i] = pasted[i];
                        setOtp(newOtp);
                        setTimeout(() => otpRefs.current[Math.min(pasted.length, 5)]?.focus(), 0);
                      }
                    }}
                  />
                ))}
              </div>

              {error && (
                <div style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: 8, padding: '10px 14px', color: '#DC2626', fontSize: 13, marginBottom: 16 }}>{error}</div>
              )}

              {success ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 14, background: '#F0FDF4', border: '1px solid #86EFAC', borderRadius: 10, color: '#16a34a', fontWeight: 600 }}>
                  <CheckCircle2 size={18} /> Verified! Redirecting...
                </div>
              ) : (
                <button onClick={handleVerifyOTP} disabled={loading}
                  style={{ width: '100%', background: '#7C3AED', color: 'white', fontWeight: 600, borderRadius: 10, padding: '14px', border: 'none', cursor: loading ? 'not-allowed' : 'pointer', fontSize: 15, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, transition: 'background 0.2s', opacity: loading ? 0.8 : 1 }}
                  onMouseEnter={e => { if (!loading) (e.currentTarget.style.background = '#6D28D9') }}
                  onMouseLeave={e => { (e.currentTarget.style.background = '#7C3AED') }}>
                  {loading ? <><Loader2 size={16} className="animate-spin" /> Verifying...</> : 'Verify & Login'}
                </button>
              )}

              <button onClick={handleResendOTP}
                style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', color: '#7C3AED', fontSize: 13, marginTop: 12, textDecoration: 'underline' }}>
                Resend OTP
              </button>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
};

export default Login;

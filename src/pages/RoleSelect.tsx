import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const RoleSelect: React.FC = () => {
  const navigate = useNavigate();
  const [selectedRole, setSelectedRole] = useState<'student' | 'faculty' | null>(null);

  const selectRole = (role: 'student' | 'faculty') => {
    setSelectedRole(role);
    localStorage.setItem('campusvoice_role', role);
    localStorage.setItem('selectedRole', role);
  };

  const handleContinue = () => {
    if (!selectedRole) return;
    navigate('/login');
  };

  return (
    <div className="h-screen bg-white flex flex-col overflow-hidden" style={{ fontFamily: 'Inter, sans-serif' }}>
      {/* Top hero — 42% of screen height */}
      <section className="relative w-full overflow-hidden flex-shrink-0" style={{ height: '42vh' }}>
        <img src="/campus-bg.jpg" alt="Campus" className="w-full h-full object-cover object-center" />
        <div className="absolute inset-0 bg-black/30" />
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <h1 className="text-white font-extrabold text-[32px] tracking-tight leading-none">CampusVoice</h1>
          <p className="text-white/70 text-[14px] font-medium tracking-wide mt-2">Your Voice. Your Campus. Resolved.</p>
        </div>
      </section>

      {/* Bottom section — fills remaining height, no scroll */}
      <section className="flex-1 flex flex-col bg-white px-4 overflow-hidden">
        <p className="text-gray-400 text-[11px] font-bold uppercase tracking-[0.15em] text-center mt-5 mb-3">
          Select your role to continue
        </p>

        {/* Role cards */}
        <div className="flex flex-col gap-3">
          <button
            onClick={() => selectRole('student')}
            className="w-full rounded-2xl p-4 flex items-center gap-3 transition-all active:scale-[0.98]"
            style={{
              border: selectedRole === 'student' ? '2px solid #7c3aed' : '1px solid #e5e7eb',
              background: selectedRole === 'student' ? '#faf5ff' : 'white',
            }}
          >
            <div className="w-12 h-12 bg-purple-100 flex items-center justify-center rounded-full text-2xl flex-shrink-0">🎓</div>
            <div className="flex-1 text-left">
              <h2 className="text-[17px] font-bold text-gray-900 leading-tight">Student</h2>
              <p className="text-[13px] text-gray-500 mt-0.5">Raise and track campus complaints</p>
            </div>
          </button>

          <button
            onClick={() => selectRole('faculty')}
            className="w-full rounded-2xl p-4 flex items-center gap-3 transition-all active:scale-[0.98]"
            style={{
              border: selectedRole === 'faculty' ? '2px solid #7c3aed' : '1px solid #e5e7eb',
              background: selectedRole === 'faculty' ? '#faf5ff' : 'white',
            }}
          >
            <div className="w-12 h-12 bg-blue-50 flex items-center justify-center rounded-full text-2xl flex-shrink-0">👨‍🏫</div>
            <div className="flex-1 text-left">
              <h2 className="text-[17px] font-bold text-gray-900 leading-tight">Faculty</h2>
              <p className="text-[13px] text-gray-500 mt-0.5">Endorse and monitor complaints</p>
            </div>
          </button>
        </div>

        {/* Continue button */}
        <button
          onClick={handleContinue}
          disabled={!selectedRole}
          className="w-full h-[52px] text-white text-[16px] font-semibold rounded-xl flex items-center justify-center transition-all disabled:opacity-40 disabled:cursor-not-allowed mt-5"
          style={{ background: '#7c3aed', boxShadow: '0 8px 20px rgba(124,58,237,0.25)' }}
        >
          Continue
        </button>

        {/* Footer */}
        <p className="text-[10px] text-gray-400 font-medium tracking-widest uppercase text-center mt-auto pb-4">
          CampusVoice v1.0
        </p>
      </section>
    </div>
  );
};

export default RoleSelect;

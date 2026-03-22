import React from 'react';
import { useNavigate } from 'react-router-dom';
import { GraduationCap, Briefcase } from 'lucide-react';

const RoleSelect: React.FC = () => {
  const navigate = useNavigate();

  const selectRole = (role: 'student' | 'faculty') => {
    localStorage.setItem('campusvoice_role', role);
    navigate('/login');
  };

  return (
    <div style={{ background: 'linear-gradient(135deg, #FAF5FF 0%, #F3E8FF 50%, #FAF5FF 100%)', minHeight: '100vh' }} className="flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-md space-y-8 animate-fade-in">
        <div className="text-center space-y-3">
          <img src="/cv-logo.png" alt="CampusVoice" className="w-20 h-20 rounded-2xl mx-auto object-cover shadow-card" />
          <h1 className="text-3xl font-extrabold text-foreground">
            Campus<span className="text-primary">Voice</span>
          </h1>
          <p className="text-muted-foreground text-base">
            Your voice. Your campus. Resolved.
          </p>
        </div>

        <div className="space-y-4">
          <button
            onClick={() => selectRole('student')}
            style={{ background: '#7C3AED' }}
            className="w-full p-6 rounded-2xl text-primary-foreground shadow-card hover:shadow-card-hover transition-all duration-200 active:scale-[0.98] text-left group"
          >
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-xl bg-primary-foreground/20 backdrop-blur-sm">
                <GraduationCap className="w-7 h-7" />
              </div>
              <div>
                <h2 className="text-xl font-bold">I am a Student</h2>
                <p className="text-sm mt-1 opacity-80">Raise and track campus complaints</p>
              </div>
            </div>
          </button>

          <button
            onClick={() => selectRole('faculty')}
            style={{ background: '#A855F7' }}
            className="w-full p-6 rounded-2xl text-primary-foreground shadow-card hover:shadow-card-hover transition-all duration-200 active:scale-[0.98] text-left group"
          >
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-xl bg-primary-foreground/20 backdrop-blur-sm">
                <Briefcase className="w-7 h-7" />
              </div>
              <div>
                <h2 className="text-xl font-bold">I am a Faculty</h2>
                <p className="text-sm mt-1 opacity-80">Support and endorse student complaints</p>
              </div>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
};

export default RoleSelect;

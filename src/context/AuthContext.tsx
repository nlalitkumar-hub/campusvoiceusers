import React, { createContext, useContext, useState, useEffect } from 'react';

export interface UserData {
  id: string;
  name: string;
  email: string;
  role: 'student' | 'faculty';
  institute: string;
  collegeId: string;
  points: number;
  level: number;
  badges: string[];
}

interface AuthContextType {
  user: UserData | null;
  login: (userData: UserData) => void;
  logout: () => void;
  updateUser: (partial: Partial<UserData>) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserData | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem('campusvoice_user');
    if (saved) {
      try {
        setUser(JSON.parse(saved));
      } catch {
        localStorage.removeItem('campusvoice_user');
      }
    }
  }, []);

  const login = (userData: UserData) => {
    setUser(userData);
    localStorage.setItem('campusvoice_user', JSON.stringify(userData));
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('campusvoice_user');
    window.location.href = '/';
  };

  const updateUser = (partial: Partial<UserData>) => {
    if (user) {
      const updated = { ...user, ...partial };
      setUser(updated);
      localStorage.setItem('campusvoice_user', JSON.stringify(updated));
    }
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
};

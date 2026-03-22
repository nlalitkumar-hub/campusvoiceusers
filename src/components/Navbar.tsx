import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Search } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { getRelativeTime } from '@/lib/timeUtils';
import { collection, query, orderBy, onSnapshot, updateDoc, doc, arrayUnion } from 'firebase/firestore';
import { db } from '@/lib/firebase';

interface Notification {
  id: string;
  title: string;
  message: string;
  createdAt?: any;
  sentAt?: any;
  isRead: boolean;
}

interface NavbarProps {
  onSearchClick?: () => void;
  searchActive?: boolean;
  // Legacy props kept for Feed.tsx compatibility — internal state takes precedence
  notifications?: Notification[];
  unreadCount?: number;
  showNotifications?: boolean;
  onBellClick?: () => void;
  onMarkAllRead?: () => void;
  onCloseNotifications?: () => void;
}

const Navbar: React.FC<NavbarProps> = ({
  onSearchClick,
  searchActive,
}) => {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Internal notification state
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const bellRef = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter(n => !n.isRead).length;

  const safeDate = (val: any): Date => {
    if (!val) return new Date();
    if (typeof val?.toDate === 'function') return val.toDate();
    return new Date(val);
  };

  const currentUserId = user?.id || user?.email;

  // Real-time Firestore listener — reads directly, isRead per user via readBy array
  useEffect(() => {
    const q = query(collection(db, 'notifications'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const notifs: Notification[] = snapshot.docs.map(docSnap => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          ...(data as Omit<Notification, 'id'>),
          isRead: (data.readBy || []).includes(currentUserId),
        };
      });
      setNotifications(notifs);
    }, (err) => {
      console.error('Notifications snapshot error:', err.message);
    });
    return () => unsubscribe();
  }, [currentUserId]);

  // Close on outside click
  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) {
        setShowNotifications(false);
      }
    };
    if (showNotifications) document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [showNotifications]);

  const markAsRead = async (notificationId: string) => {
    if (!currentUserId) return;
    try {
      await updateDoc(doc(db, 'notifications', notificationId), {
        readBy: arrayUnion(currentUserId),
      });
    } catch (err: any) {
      console.error('Failed to mark as read:', err.message);
    }
  };

  const handleBellClick = () => {
    const opening = !showNotifications;
    setShowNotifications(opening);
    if (opening) {
      // Mark all currently unread as read in Firestore
      notifications.filter(n => !n.isRead).forEach(n => markAsRead(n.id));
    }
  };

  const handleMarkAllRead = () => {
    notifications.filter(n => !n.isRead).forEach(n => markAsRead(n.id));
  };

  const initials = user?.name
    ? user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : '?';

  return (
    <header className="sticky top-0 z-40 bg-card/80 backdrop-blur-xl border-b border-border">
      <div className="flex items-center justify-between px-4 py-3 max-w-4xl mx-auto">
        <h1
          className="flex items-center gap-2 text-lg font-bold text-foreground cursor-pointer"
          onClick={() => navigate('/feed')}
        >
          <img src="/cv-logo.png" alt="CampusVoice" className="w-7 h-7 rounded-lg object-cover" />
          Campus<span className="text-primary">Voice</span>
        </h1>

        <div className="flex items-center gap-2">
          <button
            onClick={onSearchClick}
            className={`p-2 rounded-xl transition-colors ${searchActive ? 'text-primary bg-primary/10' : 'text-muted-foreground hover:bg-muted'}`}
          >
            <Search className="w-5 h-5" />
          </button>

          {/* Bell with dropdown */}
          <div data-notification-bell ref={bellRef} style={{ position: 'relative' }}>
            <button
              onClick={handleBellClick}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '8px',
                borderRadius: '8px',
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Bell size={20} color="#6B7280" />
              {unreadCount > 0 && (
                <span style={{
                  position: 'absolute',
                  top: '2px',
                  right: '2px',
                  background: '#EF4444',
                  color: 'white',
                  borderRadius: '50%',
                  width: '18px',
                  height: '18px',
                  fontSize: '11px',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '2px solid white',
                }}>
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            {showNotifications && (
              <div style={{
                position: 'absolute',
                top: 'calc(100% + 8px)',
                right: 0,
                width: '320px',
                background: 'white',
                borderRadius: '12px',
                boxShadow: '0 8px 30px rgba(0,0,0,0.15)',
                zIndex: 1000,
                overflow: 'hidden',
                border: '1px solid #E5E7EB',
              }}>
                {/* Header */}
                <div style={{
                  padding: '14px 16px',
                  borderBottom: '1px solid #F3F4F6',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  background: '#F9FAFB',
                }}>
                  <span style={{ fontWeight: 700, color: '#111827', fontSize: '15px' }}>🔔 Notifications</span>
                  <button
                    onClick={() => setShowNotifications(false)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6B7280', fontSize: '18px', lineHeight: 1 }}
                  >
                    ✕
                  </button>
                </div>

                {/* List */}
                <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                  {notifications.length === 0 ? (
                    <div style={{ padding: '40px 20px', textAlign: 'center', color: '#9CA3AF' }}>
                      <p style={{ fontSize: '32px' }}>🔔</p>
                      <p style={{ fontSize: '14px', marginTop: '8px' }}>No notifications yet</p>
                    </div>
                  ) : (
                    notifications.map(notif => (
                      <div
                        key={notif.id}
                        style={{
                          padding: '14px 16px',
                          borderBottom: '1px solid #F3F4F6',
                          background: notif.isRead ? 'white' : '#F5F3FF',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                          <div style={{
                            width: '36px',
                            height: '36px',
                            borderRadius: '50%',
                            background: '#7C3AED',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                            fontSize: '16px',
                          }}>
                            📢
                          </div>
                          <div style={{ flex: 1 }}>
                            <p style={{ fontWeight: 600, color: '#111827', fontSize: '14px', margin: 0, marginBottom: '2px' }}>
                              {notif.title}
                            </p>
                            <p style={{ color: '#6B7280', fontSize: '13px', margin: 0, lineHeight: '1.4' }}>
                              {notif.message}
                            </p>
                            <p style={{ color: '#9CA3AF', fontSize: '11px', marginTop: '4px' }}>
                              {getRelativeTime(safeDate(notif.createdAt || notif.sentAt))}
                            </p>
                          </div>
                          {!notif.isRead && (
                            <div style={{
                              width: '8px',
                              height: '8px',
                              borderRadius: '50%',
                              background: '#7C3AED',
                              flexShrink: 0,
                              marginTop: '4px',
                            }} />
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Footer */}
                {notifications.length > 0 && (
                  <div style={{
                    padding: '10px 16px',
                    borderTop: '1px solid #F3F4F6',
                    background: '#F9FAFB',
                    textAlign: 'center',
                  }}>
                    <button
                      onClick={handleMarkAllRead}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#7C3AED', fontSize: '13px', fontWeight: 600 }}
                    >
                      Mark all as read
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          <button
            onClick={() => navigate('/profile')}
            className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold"
          >
            {initials}
          </button>
        </div>
      </div>
    </header>
  );
};

export default Navbar;

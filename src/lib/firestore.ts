import { db } from './firebase';
import {
  collection, addDoc, getDocs, getDoc,
  doc, updateDoc, arrayUnion, arrayRemove,
  query, where, serverTimestamp,
  setDoc, deleteDoc, increment
} from 'firebase/firestore';

// OTP
export const saveOTP = async (email: string, otp: string) => {
  await setDoc(doc(db, 'otps', email), {
    otp,
    createdAt: serverTimestamp(),
    expiresAt: new Date(Date.now() + 5 * 60 * 1000)
  });
};

export const getOTP = async (email: string) => {
  const snap = await getDoc(doc(db, 'otps', email));
  return snap.exists() ? snap.data() : null;
};

export const deleteOTP = async (email: string) => {
  await deleteDoc(doc(db, 'otps', email));
};

// Users
export const saveUser = async (email: string, userData: any) => {
  await setDoc(doc(db, 'users', email), {
    ...userData,
    email,
    points: 0,
    level: 1,
    badges: [],
    complaintsRaised: 0,
    complaintsResolved: 0,
    upvotesGiven: 0,
    createdAt: serverTimestamp()
  }, { merge: true });
};

export const getUser = async (email: string) => {
  const snap = await getDoc(doc(db, 'users', email));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
};

export const updateUserPoints = async (email: string, pointsToAdd: number, badge?: string) => {
  const ref = doc(db, 'users', email);
  const updateData: any = { points: increment(pointsToAdd) };
  if (badge) {
    updateData.badges = arrayUnion(badge);
  }
  await updateDoc(ref, updateData);
};

export const getLeaderboard = async () => {
  const snap = await getDocs(collection(db, 'users'));
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .sort((a: any, b: any) => (b.points || 0) - (a.points || 0))
    .slice(0, 10);
};

// Complaints
export const createComplaint = async (complaintData: any) => {
  const docRef = await addDoc(collection(db, 'complaints'), {
    ...complaintData,
    status: 'pending',
    upvotes: [],
    upvoteCount: 0,
    isEndorsed: false,
    daysToResolve: null,
    resolvedAt: null,
    resolutionImageUrl: null,
    createdAt: serverTimestamp()
  });
  return docRef.id;
};

export const getComplaints = async (filter: string = 'all', institute?: string) => {
  let q: any = collection(db, 'complaints');
  if (filter === 'in_progress') {
    q = query(q, where('status', '==', 'in_progress'));
  } else if (filter === 'resolved') {
    q = query(q, where('status', '==', 'resolved'));
  } else if (filter === 'pending') {
    q = query(q, where('status', '==', 'pending'));
  } else if (filter === 'my_institute' && institute) {
    q = query(q, where('institute', '==', institute));
  }

  const snapshot = await getDocs(q);
  return snapshot.docs
    .map(d => ({ id: d.id, ...(d.data() as Record<string, any>) }))
    .sort((a: any, b: any) => {
      const dateA = a.createdAt?.toDate?.() || new Date(0);
      const dateB = b.createdAt?.toDate?.() || new Date(0);
      return dateB.getTime() - dateA.getTime();
    });
};

export const getComplaintById = async (id: string) => {
  const snap = await getDoc(doc(db, 'complaints', id));
  if (!snap.exists()) return null;
  const data = snap.data();
  return { id: snap.id, ...data };
};

export const toggleUpvote = async (complaintId: string, userId: string, isUpvoted: boolean) => {
  const ref = doc(db, 'complaints', complaintId);
  if (isUpvoted) {
    await updateDoc(ref, {
      upvotes: arrayRemove(userId),
      upvoteCount: increment(-1)
    });
  } else {
    await updateDoc(ref, {
      upvotes: arrayUnion(userId),
      upvoteCount: increment(1)
    });
  }
};

export const endorseComplaint = async (complaintId: string, facultyId: string, facultyName: string) => {
  await updateDoc(doc(db, 'complaints', complaintId), {
    isEndorsed: true,
    endorsedBy: facultyId,
    endorsedByName: facultyName,
    endorsedAt: serverTimestamp()
  });
};

export const rateComplaint = async (complaintId: string, rating: number) => {
  await updateDoc(doc(db, 'complaints', complaintId), {
    satisfactionRating: rating,
    ratedAt: serverTimestamp()
  });
};

export const addComment = async (complaintId: string, userId: string, userName: string, text: string) => {
  await addDoc(collection(db, 'comments'), {
    complaintId,
    userId,
    userName,
    text,
    createdAt: serverTimestamp()
  });
};

export const getComments = async (complaintId: string) => {
  const q = query(collection(db, 'comments'), where('complaintId', '==', complaintId));
  const snap = await getDocs(q);
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .sort((a: any, b: any) => {
      const dateA = a.createdAt?.toDate?.() || new Date(0);
      const dateB = b.createdAt?.toDate?.() || new Date(0);
      return dateA.getTime() - dateB.getTime();
    });
};

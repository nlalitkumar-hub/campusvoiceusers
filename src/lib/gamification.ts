export type LevelInfo = {
  level: number;
  title: string;
  nextThreshold: number;
};

export const getLevel = (points: number): LevelInfo => {
  if (points >= 500) return { level: 5, title: 'Campus Legend', nextThreshold: 1000 };
  if (points >= 301) return { level: 4, title: 'Campus Hero', nextThreshold: 500 };
  if (points >= 151) return { level: 3, title: 'Contributor', nextThreshold: 300 };
  if (points >= 51) return { level: 2, title: 'Reporter', nextThreshold: 150 };
  return { level: 1, title: 'Newcomer', nextThreshold: 50 };
};

export const getPreviousThreshold = (level: number): number => {
  if (level >= 5) return 500;
  if (level >= 4) return 301;
  if (level >= 3) return 151;
  if (level >= 2) return 51;
  return 0;
};

export const POINT_VALUES = {
  RAISE_COMPLAINT: 10,
  AI_VERIFIED: 5,
  RESOLVED: 20,
  UPVOTE_RECEIVED: 2,
  GIVE_UPVOTE: 1,
  FACULTY_ENDORSEMENT: 15,
  RATE_RESOLUTION: 5
};

export const ALL_BADGES = [
  { id: 'first_complaint', name: 'First Complaint', description: 'Raised your first complaint', icon: '🎯' },
  { id: 'campus_helper', name: 'Campus Helper', description: 'Raised 5 complaints', icon: '🤝' },
  { id: 'problem_solver', name: 'Problem Solver', description: 'Raised 10 complaints', icon: '🧩' },
  { id: 'popular_voice', name: 'Popular Voice', description: 'Got 10+ upvotes on a complaint', icon: '📢' },
  { id: 'verified_reporter', name: 'Verified Reporter', description: 'AI verified 3 complaints', icon: '✅' },
  { id: 'top_contributor', name: 'Top Contributor', description: 'Reached level 3', icon: '⭐' },
];

import { db } from '../config/firebase'

export const POINTS = {
  RAISE_COMPLAINT: 10,
  AI_VERIFIED: 5,
  COMPLAINT_RESOLVED: 20,
  UPVOTE_RECEIVED: 2,
  GIVE_UPVOTE: 1,
  FACULTY_ENDORSEMENT: 15,
  RATE_RESOLUTION: 5
}

export const getLevel = (points: number) => {
  if (points >= 500) return { level: 5, title: 'Campus Legend' }
  if (points >= 301) return { level: 4, title: 'Campus Hero' }
  if (points >= 151) return { level: 3, title: 'Contributor' }
  if (points >= 51)  return { level: 2, title: 'Reporter' }
  return { level: 1, title: 'Newcomer' }
}

export const updateUserPoints = async (
  email: string,
  pointsToAdd: number,
  badgeToAdd?: string
): Promise<void> => {
  try {
    if (!email || email.trim() === '') {
      console.error('❌ Empty email for points update')
      return
    }
    const userRef = db.collection('users').doc(email.trim())
    const userDoc = await userRef.get()
    if (!userDoc.exists) {
      console.error('❌ User not found:', email)
      return
    }
    const userData = userDoc.data()!
    const currentPoints = Number(userData.points) || 0
    const newPoints = Math.max(0, currentPoints + pointsToAdd)
    const newLevel = getLevel(newPoints)
    const updateData: any = {
      points: newPoints,
      level: newLevel.level,
      levelTitle: newLevel.title,
      updatedAt: new Date().toISOString()
    }
    if (badgeToAdd) {
      const currentBadges = Array.isArray(userData.badges) ? userData.badges : []
      if (!currentBadges.includes(badgeToAdd)) {
        updateData.badges = [...currentBadges, badgeToAdd]
      }
    }
    await userRef.update(updateData)
    console.log(`✅ POINTS UPDATED: ${email} | ${currentPoints} + ${pointsToAdd} = ${newPoints} | Level ${newLevel.level}: ${newLevel.title}`)
  } catch (error: any) {
    console.error('❌ Points update failed:', error.message)
  }
}

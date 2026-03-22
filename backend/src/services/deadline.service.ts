import { db } from '../config/firebase'
import { sendStatusNotification } from './notification.service'

export const checkOverdueComplaints = async (): Promise<void> => {
  try {
    const now = new Date()
    const snapshot = await db.collection('complaints').where('status', 'in', ['pending', 'in_progress']).get()
    const batch = db.batch()
    let overdueCount = 0

    for (const doc of snapshot.docs) {
      const complaint = doc.data()
      if (!complaint.deadline) continue
      const deadline = new Date(complaint.deadline)
      const createdAt = new Date(complaint.createdAt)
      const daysElapsed = Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24))
      const daysRemaining = Math.max(0, Math.floor((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
      const isOverdue = now > deadline
      let escalationLevel = complaint.escalationLevel || 0
      if (daysElapsed >= 10) escalationLevel = 3
      else if (daysElapsed >= 7) escalationLevel = 2
      else if (daysElapsed >= 5) escalationLevel = 1

      batch.update(doc.ref, { daysElapsed, daysRemaining, isOverdue, escalationLevel, lastChecked: now.toISOString() })

      if (isOverdue && !complaint.isOverdue && complaint.submittedBy) {
        overdueCount++
        await sendStatusNotification(doc.id, complaint.submittedBy, 'overdue', complaint.title).catch(console.error)
      }
    }

    await batch.commit()
    console.log(`Deadline check complete: ${overdueCount} newly overdue`)
  } catch (error: any) {
    console.error('Deadline check error:', error.message)
  }
}

import * as admin from 'firebase-admin'
import { db } from '../config/firebase'

export const sendStatusNotification = async (
  complaintId: string, submittedByEmail: string, newStatus: string, complaintTitle: string
): Promise<void> => {
  try {
    const userDoc = await db.collection('users').doc(submittedByEmail).get()
    if (!userDoc.exists) return
    const fcmToken = userDoc.data()!.fcmToken
    if (!fcmToken) return

    let title = 'CampusVoice Update', body = ''
    if (newStatus === 'in_progress') { title = '🔄 Complaint In Progress'; body = `Your complaint "${complaintTitle}" is now being worked on.` }
    else if (newStatus === 'resolved') { title = '✅ Complaint Resolved!'; body = `Your complaint "${complaintTitle}" has been resolved. Please rate the resolution.` }
    else if (newStatus === 'rejected') { title = '❌ Complaint Update'; body = `Your complaint "${complaintTitle}" could not be processed.` }
    else if (newStatus === 'overdue') { title = '⚠️ Complaint Overdue'; body = `Your complaint "${complaintTitle}" has exceeded the 7-day resolution deadline.` }
    if (!body) return

    await admin.messaging().send({ notification: { title, body }, data: { complaintId, status: newStatus, type: newStatus }, token: fcmToken })
    console.log(`Notification sent to ${submittedByEmail}`)
  } catch (error: any) {
    console.error('Notification error:', error.message)
  }
}

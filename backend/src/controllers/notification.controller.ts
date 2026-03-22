import { Request, Response } from 'express'
import { db } from '../config/firebase'
import { FieldValue } from 'firebase-admin/firestore'

export const getNotifications = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || (req as any).user?.uid

    // Fetch global notifications
    const globalSnap = await db.collection('notifications')
      .orderBy('createdAt', 'desc')
      .get()

    const globalNotifs = globalSnap.docs.map(doc => {
      const data = doc.data()
      return {
        id: doc.id,
        title: data.title || '',
        message: data.message || '',
        targetAudience: data.targetAudience || 'all',
        createdAt: data.createdAt || null,
        sentBy: data.sentBy || 'admin',
        readBy: data.readBy || [],
        isRead: (data.readBy || []).includes(userId)
      }
    })

    // Fetch user-specific notifications
    let userNotifs: any[] = []
    if (userId) {
      const userSnap = await db.collection('userNotifications')
        .doc(userId)
        .collection('items')
        .orderBy('createdAt', 'desc')
        .get()

      userNotifs = userSnap.docs.map(doc => {
        const data = doc.data()
        return {
          id: doc.id,
          title: data.title || '',
          message: data.message || '',
          targetAudience: data.targetAudience || 'specific',
          createdAt: data.createdAt || null,
          sentBy: data.sentBy || 'admin',
          readBy: data.readBy || [],
          isRead: (data.readBy || []).includes(userId)
        }
      })
    }

    // Merge and sort by createdAt descending
    const all = [...globalNotifs, ...userNotifs]
    all.sort((a, b) => {
      const aTime = a.createdAt?.toDate
        ? a.createdAt.toDate().getTime()
        : new Date(a.createdAt || 0).getTime()
      const bTime = b.createdAt?.toDate
        ? b.createdAt.toDate().getTime()
        : new Date(b.createdAt || 0).getTime()
      return bTime - aTime
    })

    res.json({ success: true, data: all })
  } catch (error) {
    console.error('Error fetching notifications:', error)
    res.status(500).json({ success: false, message: 'Failed to fetch notifications' })
  }
}

export const markAsRead = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || (req as any).user?.uid
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id

    // Mark in global notifications
    const globalRef = db.collection('notifications').doc(id)
    await globalRef.update({
      readBy: FieldValue.arrayUnion(userId)
    })

    // Mark in user-specific notifications
    const userRef = db.collection('userNotifications').doc(userId).collection('items').doc(id)
    const userDoc = await userRef.get()
    if (userDoc.exists) {
      await userRef.update({
        readBy: FieldValue.arrayUnion(userId)
      })
    }

    res.json({ success: true, message: 'Marked as read' })
  } catch (error) {
    console.error('Error marking notification as read:', error)
    res.status(500).json({ success: false, message: 'Failed to mark as read' })
  }
}

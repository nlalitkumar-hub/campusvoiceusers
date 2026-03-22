import * as admin from 'firebase-admin'
import { config } from './env'

const getPrivateKey = (): string => {
  let key = config.FIREBASE_PRIVATE_KEY
  key = key.replace(/^["']|["']$/g, '')
  key = key.replace(/\\n/g, '\n')
  return key.trim()
}

let app: admin.app.App

try {
  if (admin.apps.length > 0) {
    app = admin.apps[0]!
  } else {
    app = admin.initializeApp({
      credential: admin.credential.cert({
        projectId: config.FIREBASE_PROJECT_ID,
        clientEmail: config.FIREBASE_CLIENT_EMAIL,
        privateKey: getPrivateKey()
      } as admin.ServiceAccount)
    })
  }
  console.log('✅ Firebase Admin initialized')
} catch (error: any) {
  console.error('❌ Firebase init error:', error.message)
  app = admin.initializeApp({
    projectId: config.FIREBASE_PROJECT_ID || 'dummy-project'
  }, `fallback-${Date.now()}`)
}

export const db = app.firestore()
export default admin

import express from 'express'
import cors from 'cors'
import morgan from 'morgan'
import { config } from './config/env'
import { db } from './config/firebase'
import authRoutes from './routes/auth.routes'
import complaintRoutes from './routes/complaint.routes'
import profileRoutes from './routes/profile.routes'
import analyticsRoutes from './routes/analytics.routes'
import notificationRoutes from './routes/notification.routes'
import facultyRoutes from './routes/faculty.routes'
import { errorHandler } from './middleware/errorHandler'
import { checkOverdueComplaints } from './services/deadline.service'

const app = express()

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, Capacitor, curl)
    // and all known dev/prod origins
    const allowed = [
      'http://localhost:8080', 'http://localhost:8081', 'http://localhost:8083',
      'http://127.0.0.1:8080', 'http://127.0.0.1:8081', 'http://127.0.0.1:8083',
      'http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:3000',
      'http://192.168.1.14:8080', 'http://192.168.1.14:8081', 'http://192.168.1.14:5173',
      'capacitor://localhost', 'ionic://localhost', 'https://localhost',
      'https://campusvoice-backend-bi2j.onrender.com',
    ]
    if (!origin || allowed.includes(origin)) return callback(null, true)
    callback(null, true) // allow all origins for mobile app compatibility
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization']
}))

app.options('/{*path}', cors())
app.use(morgan('dev'))
app.use(express.json({ limit: '25mb' }))
app.use(express.urlencoded({ extended: true, limit: '25mb' }))
app.use((req, res, next) => { console.log(`${req.method} ${req.path}`); next() })

app.get('/api/health', (req, res) => {
  res.status(200).json({ success: true, message: 'CampusVoice API is running', timestamp: new Date().toISOString(), environment: config.NODE_ENV, pythonAI: config.PYTHON_AI_URL })
})

app.use('/api/auth', authRoutes)
app.use('/api/complaints', complaintRoutes)
app.use('/api/profile', profileRoutes)
app.use('/api/analytics', analyticsRoutes)
app.use('/api/notifications', notificationRoutes)
app.use('/api/faculty', facultyRoutes)

app.use('/{*path}', (req, res) => { res.status(404).json({ success: false, message: 'Route not found' }) })
app.use(errorHandler)

void db // ensure Firebase is initialized

const HOUR = 60 * 60 * 1000
setInterval(async () => { console.log('Running deadline check...'); await checkOverdueComplaints() }, HOUR)
setTimeout(async () => { await checkOverdueComplaints() }, 5000)

app.listen(Number(config.PORT), '0.0.0.0', () => {
  console.log(`CampusVoice API running on port ${config.PORT}`)
  console.log(`Environment: ${config.NODE_ENV}`)
  console.log(`Frontend URL: ${config.FRONTEND_URL}`)
  console.log(`Python AI URL: ${config.PYTHON_AI_URL}`)
})

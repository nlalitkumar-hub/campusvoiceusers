import nodemailer from 'nodemailer'
import { config } from '../config/env'

export const sendOTPEmail = async (email: string, otp: string, name: string): Promise<void> => {
  try {
    const transporter = nodemailer.createTransport({
      host: config.EMAIL_HOST, port: config.EMAIL_PORT, secure: false,
      auth: { user: config.EMAIL_USER, pass: config.EMAIL_PASS }
    })
    await transporter.sendMail({
      from: `"CampusVoice" <${config.EMAIL_USER}>`,
      to: email,
      subject: 'CampusVoice — Your OTP Code',
      html: `<div style="font-family:sans-serif;max-width:500px;margin:0 auto">
        <div style="background:#4F46E5;padding:20px;border-radius:8px 8px 0 0;text-align:center"><h1 style="color:white;margin:0">CampusVoice</h1></div>
        <div style="background:#f9fafb;padding:30px;border-radius:0 0 8px 8px">
          <p>Hello ${name},</p><p>Your verification code is:</p>
          <div style="background:white;border:2px solid #4F46E5;border-radius:8px;padding:20px;text-align:center;margin:20px 0">
            <span style="font-size:36px;font-weight:bold;color:#4F46E5;letter-spacing:8px">${otp}</span>
          </div>
          <p style="color:#ef4444">Expires in 5 minutes</p>
          <p style="color:#6b7280;font-size:12px">Never share this code with anyone.</p>
        </div></div>`
    })
    console.log(`OTP email sent to ${email}`)
  } catch (error: any) {
    console.error('Email failed:', error.message)
    throw error
  }
}

const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: process.env.SMTP_PORT || 587,
  secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const sendEmail = async (to, subject, html) => {
  try {
    // ⚠️ แจ้งเตือนแอดมิน กรณีลืมตั้งค่า SMTP ในไฟล์ .env ก่อนยิงอีเมลจริง
    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
      console.warn('⚠️ [EmailService Warning] ยังไม่มีการตั้งค่า SMTP_USER และ SMTP_PASS ในไฟล์ .env ระบบอาจส่งอีเมลไม่สำเร็จ');
    }

    const info = await transporter.sendMail({
      from: `"NexusFX Support" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
      to,
      subject,
      html,
    });
    console.log('[EmailService] Message sent: %s', info.messageId);
  } catch (err) {
    console.error('[EmailService] Failed to send email:', err.message);
  }
};

module.exports = {
  sendEmail,
};

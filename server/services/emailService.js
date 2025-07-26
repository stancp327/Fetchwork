const { Resend } = require('resend');

class EmailService {
  constructor() {
    this.resend = new Resend(process.env.RESEND_API_KEY);
    this.fromEmail = process.env.FROM_EMAIL || 'onboarding@resend.dev';
  }

  async sendWelcomeEmail(user) {
    try {
      const { data, error } = await this.resend.emails.send({
        from: this.fromEmail,
        to: [user.email],
        subject: 'Welcome to FetchWork!',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #4285f4;">Welcome to FetchWork, ${user.firstName}!</h1>
            <p>Thank you for joining our freelance marketplace. We're excited to have you on board!</p>
            
            <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3>Get Started:</h3>
              <ul>
                <li>Complete your profile to attract more clients</li>
                <li>Browse available jobs in your field</li>
                <li>Create services to showcase your skills</li>
                <li>Connect your Stripe account to receive payments</li>
              </ul>
            </div>
            
            <p>If you have any questions, our support team is here to help!</p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${process.env.CLIENT_URL}/dashboard" 
                 style="background: #4285f4; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">
                Go to Dashboard
              </a>
            </div>
            
            <p style="color: #666; font-size: 14px;">
              Best regards,<br>
              The FetchWork Team
            </p>
          </div>
        `
      });

      if (error) {
        console.error('Error sending welcome email:', error);
        return { success: false, error };
      }

      console.log('Welcome email sent successfully:', data);
      return { success: true, data };
    } catch (error) {
      console.error('Error sending welcome email:', error);
      return { success: false, error: error.message };
    }
  }

  async sendEmailVerification(user, verificationToken) {
    try {
      const verificationUrl = `${process.env.CLIENT_URL}/verify-email?token=${verificationToken}`;
      
      const { data, error } = await this.resend.emails.send({
        from: this.fromEmail,
        to: [user.email],
        subject: 'Verify Your FetchWork Account',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #4285f4;">Verify Your Email Address</h1>
            <p>Hi ${user.firstName},</p>
            <p>Please click the button below to verify your email address and activate your FetchWork account:</p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${verificationUrl}" 
                 style="background: #4285f4; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">
                Verify Email Address
              </a>
            </div>
            
            <p>If the button doesn't work, you can copy and paste this link into your browser:</p>
            <p style="word-break: break-all; color: #4285f4;">${verificationUrl}</p>
            
            <p style="color: #666; font-size: 14px;">
              This verification link will expire in 24 hours. If you didn't create an account with FetchWork, you can safely ignore this email.
            </p>
          </div>
        `
      });

      if (error) {
        console.error('Error sending verification email:', error);
        return { success: false, error };
      }

      return { success: true, data };
    } catch (error) {
      console.error('Error sending verification email:', error);
      return { success: false, error: error.message };
    }
  }

  async sendPasswordResetEmail(user, resetToken) {
    try {
      const resetUrl = `${process.env.CLIENT_URL}/reset-password?token=${resetToken}`;
      
      const { data, error } = await this.resend.emails.send({
        from: this.fromEmail,
        to: [user.email],
        subject: 'Reset Your FetchWork Password',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #4285f4;">Reset Your Password</h1>
            <p>Hi ${user.firstName},</p>
            <p>We received a request to reset your password for your FetchWork account.</p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${resetUrl}" 
                 style="background: #4285f4; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">
                Reset Password
              </a>
            </div>
            
            <p>If the button doesn't work, you can copy and paste this link into your browser:</p>
            <p style="word-break: break-all; color: #4285f4;">${resetUrl}</p>
            
            <p style="color: #666; font-size: 14px;">
              This reset link will expire in 1 hour. If you didn't request a password reset, you can safely ignore this email.
            </p>
          </div>
        `
      });

      if (error) {
        console.error('Error sending password reset email:', error);
        return { success: false, error };
      }

      return { success: true, data };
    } catch (error) {
      console.error('Error sending password reset email:', error);
      return { success: false, error: error.message };
    }
  }

  async sendJobNotification(user, job, type) {
    try {
      let subject, content;
      
      switch (type) {
        case 'new_proposal':
          subject = `New Proposal for "${job.title}"`;
          content = `
            <h1 style="color: #4285f4;">You have a new proposal!</h1>
            <p>Hi ${user.firstName},</p>
            <p>You've received a new proposal for your job posting: <strong>${job.title}</strong></p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${process.env.CLIENT_URL}/jobs/${job._id}" 
                 style="background: #4285f4; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">
                View Proposal
              </a>
            </div>
          `;
          break;
          
        case 'job_accepted':
          subject = `Your proposal was accepted for "${job.title}"`;
          content = `
            <h1 style="color: #27ae60;">Congratulations! Your proposal was accepted!</h1>
            <p>Hi ${user.firstName},</p>
            <p>Great news! Your proposal for <strong>${job.title}</strong> has been accepted.</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${process.env.CLIENT_URL}/jobs/${job._id}" 
                 style="background: #27ae60; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">
                View Job Details
              </a>
            </div>
          `;
          break;
          
        case 'job_completed':
          subject = `Job "${job.title}" has been completed`;
          content = `
            <h1 style="color: #4285f4;">Job Completed</h1>
            <p>Hi ${user.firstName},</p>
            <p>The job <strong>${job.title}</strong> has been marked as completed.</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${process.env.CLIENT_URL}/jobs/${job._id}" 
                 style="background: #4285f4; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">
                View Job & Leave Review
              </a>
            </div>
          `;
          break;
      }

      const { data, error } = await this.resend.emails.send({
        from: this.fromEmail,
        to: [user.email],
        subject,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            ${content}
            <p style="color: #666; font-size: 14px;">
              Best regards,<br>
              The FetchWork Team
            </p>
          </div>
        `
      });

      if (error) {
        console.error('Error sending job notification:', error);
        return { success: false, error };
      }

      return { success: true, data };
    } catch (error) {
      console.error('Error sending job notification:', error);
      return { success: false, error: error.message };
    }
  }

  async sendPaymentNotification(user, payment, type) {
    try {
      let subject, content;
      
      switch (type) {
        case 'payment_received':
          subject = `Payment Received - $${payment.amount}`;
          content = `
            <h1 style="color: #27ae60;">Payment Received!</h1>
            <p>Hi ${user.firstName},</p>
            <p>You've received a payment of <strong>$${payment.amount}</strong> for your work.</p>
            <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <p><strong>Amount:</strong> $${payment.amount}</p>
              <p><strong>Job:</strong> ${payment.job?.title || 'N/A'}</p>
              <p><strong>Payment Method:</strong> ${payment.paymentMethod}</p>
            </div>
          `;
          break;
          
        case 'escrow_funded':
          subject = `Escrow Funded - $${payment.amount}`;
          content = `
            <h1 style="color: #4285f4;">Escrow Funded</h1>
            <p>Hi ${user.firstName},</p>
            <p>The escrow for your job has been funded with <strong>$${payment.amount}</strong>.</p>
            <p>You can start working on the project now. The payment will be released once the work is completed and approved.</p>
          `;
          break;
      }

      const { data, error } = await this.resend.emails.send({
        from: this.fromEmail,
        to: [user.email],
        subject,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            ${content}
            <div style="text-align: center; margin: 30px 0;">
              <a href="${process.env.CLIENT_URL}/payments" 
                 style="background: #4285f4; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">
                View Payment Details
              </a>
            </div>
            <p style="color: #666; font-size: 14px;">
              Best regards,<br>
              The FetchWork Team
            </p>
          </div>
        `
      });

      if (error) {
        console.error('Error sending payment notification:', error);
        return { success: false, error };
      }

      return { success: true, data };
    } catch (error) {
      console.error('Error sending payment notification:', error);
      return { success: false, error: error.message };
    }
  }

  async sendAdminBroadcast(recipients, subject, message) {
    try {
      const emailPromises = recipients.map(email => 
        this.resend.emails.send({
          from: this.fromEmail,
          to: [email],
          subject: `[FetchWork] ${subject}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h1 style="color: #4285f4;">Message from FetchWork Team</h1>
              <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
                ${message.replace(/\n/g, '<br>')}
              </div>
              <p style="color: #666; font-size: 14px;">
                This message was sent by the FetchWork administration team.
              </p>
            </div>
          `
        })
      );

      const results = await Promise.allSettled(emailPromises);
      const successful = results.filter(result => result.status === 'fulfilled').length;
      const failed = results.filter(result => result.status === 'rejected').length;

      return {
        success: true,
        sent: successful,
        failed,
        total: recipients.length
      };
    } catch (error) {
      console.error('Error sending admin broadcast:', error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = new EmailService();

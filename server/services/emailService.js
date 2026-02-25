const { Resend } = require('resend');

class EmailService {
  constructor() {
    this.resend = new Resend(process.env.RESEND_API_KEY);
    this.fromEmail = process.env.FROM_EMAIL || 'noreply@fetchwork.net';
    this.brandColors = {
      primary: '#4285f4',
      success: '#27ae60',
      warning: '#f39c12',
      danger: '#e74c3c'
    };
  }

  getEmailTemplate(content, title, color = this.brandColors.primary) {
    return `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
        <div style="background: ${color}; padding: 20px; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 24px;">FetchWork</h1>
        </div>
        <div style="padding: 30px 20px;">
          <h2 style="color: #333; margin-bottom: 20px;">${title}</h2>
          ${content}
        </div>
        <div style="background: #f8f9fa; padding: 20px; text-align: center; border-top: 1px solid #dee2e6;">
          <p style="color: #666; font-size: 14px; margin: 0;">
            © 2025 FetchWork. Professional freelance marketplace.
          </p>
          <p style="color: #666; font-size: 12px; margin: 10px 0 0 0;">
            <a href="${process.env.CLIENT_URL}/unsubscribe" style="color: #666;">Unsubscribe</a> | 
            <a href="${process.env.CLIENT_URL}/preferences" style="color: #666;">Email Preferences</a>
          </p>
        </div>
      </div>
    `;
  }

  async sendWelcomeEmail(user) {
    const content = `
      <p>Hi ${user.firstName},</p>
      <p>Welcome to FetchWork! We're excited to have you join our community of talented freelancers and innovative clients.</p>
      <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <h3 style="color: #333; margin-top: 0;">Next Steps:</h3>
        <ul style="color: #555;">
          <li>Complete your profile to attract more opportunities</li>
          <li>Browse available jobs in your field</li>
          <li>Create services to showcase your skills</li>
          <li>Connect your payment account to receive earnings</li>
        </ul>
      </div>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${process.env.CLIENT_URL}/dashboard" 
           style="background: ${this.brandColors.primary}; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
          Get Started
        </a>
      </div>
    `;

    return this.sendEmail(user.email, 'Welcome to FetchWork!', content, 'Welcome to FetchWork!');
  }

  async sendEmail(to, subject, content, title, color) {
    try {
      const { data, error } = await this.resend.emails.send({
        from: this.fromEmail,
        to: [to],
        subject,
        html: this.getEmailTemplate(content, title, color)
      });

      if (error) {
        console.error(`Error sending email to ${to}:`, error);
        return { success: false, error };
      }

      console.log(`Email sent successfully to ${to}:`, data);
      return { success: true, data };
    } catch (error) {
      console.error(`Error sending email to ${to}:`, error);
      return { success: false, error: error.message };
    }
  }

  async sendEmailVerification(user, verificationToken) {
    const verificationUrl = `${process.env.CLIENT_URL}/verify-email?token=${verificationToken}`;
    
    const content = `
      <p>Hi ${user.firstName},</p>
      <p>Please click the button below to verify your email address and activate your FetchWork account:</p>
      
      <div style="text-align: center; margin: 30px 0;">
        <a href="${verificationUrl}" 
           style="background: ${this.brandColors.primary}; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
          Verify Email Address
        </a>
      </div>
      
      <p>If the button doesn't work, you can copy and paste this link into your browser:</p>
      <p style="word-break: break-all; color: ${this.brandColors.primary};">${verificationUrl}</p>
      
      <p style="color: #666; font-size: 14px;">
        This verification link will expire in 24 hours. If you didn't create an account with FetchWork, you can safely ignore this email.
      </p>
    `;

    return this.sendEmail(user.email, 'Verify Your FetchWork Account', content, 'Verify Your Email Address');
  }

  async sendPasswordResetEmail(user, resetToken) {
    const resetUrl = `${process.env.CLIENT_URL}/reset-password?token=${resetToken}`;
    
    const content = `
      <p>Hi ${user.firstName},</p>
      <p>We received a request to reset your password for your FetchWork account.</p>
      
      <div style="text-align: center; margin: 30px 0;">
        <a href="${resetUrl}" 
           style="background: ${this.brandColors.warning}; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
          Reset Password
        </a>
      </div>
      
      <p>If the button doesn't work, you can copy and paste this link into your browser:</p>
      <p style="word-break: break-all; color: ${this.brandColors.primary};">${resetUrl}</p>
      
      <p style="color: #666; font-size: 14px;">
        This reset link will expire in 1 hour. If you didn't request a password reset, you can safely ignore this email.
      </p>
    `;

    return this.sendEmail(user.email, 'Reset Your FetchWork Password', content, 'Reset Your Password', this.brandColors.warning);
  }

  async sendJobNotification(user, job, type) {
    let subject, content, color;
    
    switch (type) {
      case 'new_proposal':
        subject = `New Proposal for "${job.title}"`;
        color = this.brandColors.primary;
        content = `
          <p>Hi ${user.firstName},</p>
          <p>You've received a new proposal for your job posting: <strong>${job.title}</strong></p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${process.env.CLIENT_URL}/jobs/${job._id}" 
               style="background: ${this.brandColors.primary}; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
              View Proposal
            </a>
          </div>
        `;
        break;
        
      case 'job_accepted':
        subject = `Your proposal was accepted for "${job.title}"`;
        color = this.brandColors.success;
        content = `
          <p>Hi ${user.firstName},</p>
          <p>🎉 Congratulations! Your proposal for <strong>${job.title}</strong> has been accepted.</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${process.env.CLIENT_URL}/jobs/${job._id}" 
               style="background: ${this.brandColors.success}; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
              View Job Details
            </a>
          </div>
        `;
        break;
        
      case 'job_completed':
        subject = `Job "${job.title}" has been completed`;
        color = this.brandColors.primary;
        content = `
          <p>Hi ${user.firstName},</p>
          <p>The job <strong>${job.title}</strong> has been marked as completed.</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${process.env.CLIENT_URL}/jobs/${job._id}" 
               style="background: ${this.brandColors.primary}; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
              View Job & Leave Review
            </a>
          </div>
        `;
        break;
    }

    return this.sendEmail(user.email, subject, content, subject, color);
  }

  async sendPaymentNotification(user, payment, type) {
    let subject, content, color;
    
    switch (type) {
      case 'payment_received':
        subject = `Payment Received - $${payment.amount}`;
        color = this.brandColors.success;
        content = `
          <p>Hi ${user.firstName},</p>
          <p>💰 You've received a payment of <strong>$${payment.amount}</strong> for your work.</p>
          <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p><strong>Amount:</strong> $${payment.amount}</p>
            <p><strong>Job:</strong> ${payment.job?.title || 'N/A'}</p>
            <p><strong>Payment Method:</strong> ${payment.paymentMethod || 'Stripe'}</p>
          </div>
        `;
        break;
        
      case 'escrow_funded':
        subject = `Escrow Funded - $${payment.amount}`;
        color = this.brandColors.primary;
        content = `
          <p>Hi ${user.firstName},</p>
          <p>✅ The escrow for your job has been funded with <strong>$${payment.amount}</strong>.</p>
          <p>You can start working on the project now. The payment will be released once the work is completed and approved.</p>
        `;
        break;
        
      case 'payment_released':
        subject = `Payment Released - $${payment.amount}`;
        color = this.brandColors.success;
        content = `
          <p>Hi ${user.firstName},</p>
          <p>🎉 Your payment of <strong>$${payment.amount}</strong> has been released and is on its way to your account.</p>
          <p>The funds should appear in your connected account within 1-2 business days.</p>
        `;
        break;
    }

    content += `
      <div style="text-align: center; margin: 30px 0;">
        <a href="${process.env.CLIENT_URL}/payments" 
           style="background: ${color}; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
          View Payment Details
        </a>
      </div>
    `;

    return this.sendEmail(user.email, subject, content, subject, color);
  }

  // ── Dispute Emails ───────────────────────────────────────────
  async sendDisputeNotification(recipient, filer, dispute, job) {
    const subject = `Dispute Filed: ${job.title}`;
    const content = `
      <p>Hi ${recipient.firstName},</p>
      <p>A dispute has been filed for the job <strong>${job.title}</strong> by ${filer.firstName} ${filer.lastName}.</p>
      <div style="background: #fef2f2; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid ${this.brandColors.danger};">
        <p style="margin: 0 0 8px;"><strong>Reason:</strong> ${(dispute.reason || '').replace(/_/g, ' ')}</p>
        <p style="margin: 0;"><strong>Description:</strong> ${(dispute.description || '').substring(0, 200)}${dispute.description?.length > 200 ? '...' : ''}</p>
      </div>
      <p>Escrow payments are automatically held while the dispute is under review. An admin will review the case shortly.</p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${process.env.CLIENT_URL}/disputes" style="background: ${this.brandColors.danger}; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">View Dispute</a>
      </div>
    `;
    return this.sendEmail(recipient.email, subject, content, 'Dispute Filed', this.brandColors.danger);
  }

  async sendDisputeStatusChange(recipient, dispute, oldStatus, newStatus, job) {
    const statusLabels = {
      opened: 'Open', needs_info: 'More Info Needed', under_review: 'Under Review',
      escalated: 'Escalated', proposed_resolution: 'Resolution Proposed',
      resolved: 'Resolved', closed: 'Closed'
    };
    const subject = `Dispute Update: ${statusLabels[newStatus] || newStatus}`;
    const color = newStatus === 'resolved' ? this.brandColors.success : this.brandColors.warning;
    const content = `
      <p>Hi ${recipient.firstName},</p>
      <p>The status of your dispute for <strong>${job?.title || 'your job'}</strong> has been updated.</p>
      <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <p><strong>Previous Status:</strong> ${statusLabels[oldStatus] || oldStatus}</p>
        <p><strong>New Status:</strong> ${statusLabels[newStatus] || newStatus}</p>
      </div>
      ${newStatus === 'needs_info' ? '<p>⚠️ The admin reviewing your case has requested additional information. Please check the dispute thread and respond as soon as possible.</p>' : ''}
      ${newStatus === 'proposed_resolution' ? '<p>An admin has proposed a resolution for your dispute. Please review the proposed terms.</p>' : ''}
      <div style="text-align: center; margin: 30px 0;">
        <a href="${process.env.CLIENT_URL}/disputes" style="background: ${color}; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">View Dispute</a>
      </div>
    `;
    return this.sendEmail(recipient.email, subject, content, subject, color);
  }

  async sendDisputeResolutionNotification(recipient, dispute) {
    const resType = dispute.resolution?.type?.replace(/_/g, ' ') || 'decided';
    const subject = `Dispute Resolved: ${resType}`;
    const content = `
      <p>Hi ${recipient.firstName},</p>
      <p>Your dispute has been resolved.</p>
      <div style="background: #ecfdf5; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid ${this.brandColors.success};">
        <p style="margin: 0 0 8px;"><strong>Resolution:</strong> ${resType}</p>
        ${dispute.resolution?.amounts?.toFreelancer > 0 ? `<p style="margin: 0 0 8px;"><strong>To Freelancer:</strong> $${dispute.resolution.amounts.toFreelancer}</p>` : ''}
        ${dispute.resolution?.amounts?.toClient > 0 ? `<p style="margin: 0 0 8px;"><strong>Refund to Client:</strong> $${dispute.resolution.amounts.toClient}</p>` : ''}
        ${dispute.resolution?.summary ? `<p style="margin: 0;"><strong>Summary:</strong> ${dispute.resolution.summary}</p>` : ''}
      </div>
      <p>Payment holds have been removed. If you have any questions about this resolution, please contact our support team.</p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${process.env.CLIENT_URL}/disputes" style="background: ${this.brandColors.success}; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">View Details</a>
      </div>
    `;
    return this.sendEmail(recipient.email, subject, content, 'Dispute Resolved', this.brandColors.success);
  }

  async sendDisputeMessageNotification(recipient, senderName, disputeId, jobTitle) {
    const subject = `New message in your dispute: ${jobTitle}`;
    const content = `
      <p>Hi ${recipient.firstName},</p>
      <p><strong>${senderName}</strong> sent a new message regarding the dispute for <strong>${jobTitle}</strong>.</p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${process.env.CLIENT_URL}/disputes" style="background: ${this.brandColors.primary}; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">View Message</a>
      </div>
    `;
    return this.sendEmail(recipient.email, subject, content, 'New Dispute Message');
  }

  async sendNewMessageNotification(recipient, sender, conversationId) {
    const content = `
      <p>Hi ${recipient.firstName},</p>
      <p>You have a new message from <strong>${sender.firstName} ${sender.lastName}</strong>.</p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${process.env.CLIENT_URL}/messages?conversation=${conversationId}" 
           style="background: ${this.brandColors.primary}; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
          View Message
        </a>
      </div>
      <p style="color: #666; font-size: 14px;">You can manage your notification preferences in your <a href="${process.env.CLIENT_URL}/settings/email-preferences">account settings</a>.</p>
    `;
    return this.sendEmail(recipient.email, `New message from ${sender.firstName}`, content, 'New Message');
  }

  async sendReviewNotification(recipient, reviewer, job, rating) {
    const stars = '⭐'.repeat(Math.round(rating));
    const content = `
      <p>Hi ${recipient.firstName},</p>
      <p><strong>${reviewer.firstName} ${reviewer.lastName}</strong> left you a ${rating}-star review for <strong>${job.title}</strong>.</p>
      <div style="background: #fefce8; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center;">
        <p style="font-size: 2rem; margin: 0;">${stars}</p>
      </div>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${process.env.CLIENT_URL}/profile" 
           style="background: ${this.brandColors.primary}; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
          View Your Reviews
        </a>
      </div>
    `;
    return this.sendEmail(recipient.email, `New ${rating}-star review on FetchWork`, content, 'New Review', this.brandColors.warning);
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

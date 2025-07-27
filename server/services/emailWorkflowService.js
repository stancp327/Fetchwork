const emailService = require('./emailService');
const User = require('../models/User');

class EmailWorkflowService {
  constructor() {
    this.emailTypes = {
      JOB_LIFECYCLE: 'job_lifecycle',
      PAYMENT: 'payment',
      ONBOARDING: 'onboarding',
      ENGAGEMENT: 'engagement'
    };
  }

  async canSendEmail(userId, emailType, subType) {
    try {
      const user = await User.findById(userId);
      if (!user || !user.preferences.emailNotifications) return false;

      const prefs = user.preferences.emailNotifications;
      switch (emailType) {
        case this.emailTypes.JOB_LIFECYCLE:
          return prefs.jobAlerts || prefs.proposalUpdates;
        case this.emailTypes.PAYMENT:
          return prefs.paymentNotifications;
        case this.emailTypes.ONBOARDING:
          return prefs.systemUpdates;
        case this.emailTypes.ENGAGEMENT:
          return prefs.marketingEmails || prefs.weeklyDigest;
        default:
          return true;
      }
    } catch (error) {
      console.error('Error checking email permissions:', error);
      return false;
    }
  }

  async sendOnboardingSequence(userId, step = 1) {
    try {
      const user = await User.findById(userId);
      if (!user || !await this.canSendEmail(userId, this.emailTypes.ONBOARDING)) return;

      switch (step) {
        case 1:
          await emailService.sendWelcomeEmail(user);
          setTimeout(() => this.sendOnboardingSequence(userId, 2), 24 * 60 * 60 * 1000);
          break;
        case 2:
          await this.sendProfileCompletionReminder(user);
          setTimeout(() => this.sendOnboardingSequence(userId, 3), 72 * 60 * 60 * 1000);
          break;
        case 3:
          await this.sendFirstJobGuidance(user);
          break;
      }
    } catch (error) {
      console.error('Error in onboarding sequence:', error);
    }
  }

  async sendProfileCompletionReminder(user) {
    try {
      const content = `
        <p>Hi ${user.firstName},</p>
        <p>We noticed you haven't completed your profile yet. A complete profile helps you:</p>
        <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <ul style="color: #555; margin: 0;">
            <li>Get discovered by more clients</li>
            <li>Build trust with potential employers</li>
            <li>Showcase your skills and experience</li>
            <li>Increase your chances of winning projects</li>
          </ul>
        </div>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${process.env.CLIENT_URL}/profile" 
             style="background: #4285f4; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
            Complete Your Profile
          </a>
        </div>
      `;

      return emailService.sendEmail(user.email, 'Complete Your FetchWork Profile', content, 'Complete Your Profile');
    } catch (error) {
      console.error('Error sending profile completion reminder:', error);
      return { success: false, error: error.message };
    }
  }

  async sendFirstJobGuidance(user) {
    try {
      const content = `
        <p>Hi ${user.firstName},</p>
        <p>Ready to start your freelancing journey? Here's how to get your first job on FetchWork:</p>
        <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="color: #333; margin-top: 0;">Getting Started Tips:</h3>
          <ol style="color: #555;">
            <li><strong>Browse Jobs:</strong> Look for projects that match your skills</li>
            <li><strong>Write Great Proposals:</strong> Be specific about how you'll solve their problem</li>
            <li><strong>Set Competitive Rates:</strong> Research market rates for your services</li>
            <li><strong>Respond Quickly:</strong> Fast responses show professionalism</li>
          </ol>
        </div>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${process.env.CLIENT_URL}/browse-jobs" 
             style="background: #27ae60; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
            Browse Available Jobs
          </a>
        </div>
      `;

      return emailService.sendEmail(user.email, 'Your Guide to Landing Your First Job', content, 'Get Your First Job');
    } catch (error) {
      console.error('Error sending first job guidance:', error);
      return { success: false, error: error.message };
    }
  }

  async sendWeeklyDigest(userId) {
    try {
      const user = await User.findById(userId);
      if (!user || !await this.canSendEmail(userId, this.emailTypes.ENGAGEMENT)) return;
      
      const Job = require('../models/Job');
      const recentJobs = await Job.find({ 
        status: 'open', 
        isActive: true,
        createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
      })
      .limit(5)
      .select('title category budget.amount createdAt')
      .sort({ createdAt: -1 });

      const jobsHtml = recentJobs.map(job => `
        <div style="border: 1px solid #dee2e6; border-radius: 6px; padding: 15px; margin: 10px 0;">
          <h4 style="margin: 0 0 10px 0; color: #333;">${job.title}</h4>
          <p style="margin: 5px 0; color: #666; font-size: 14px;">
            Category: ${job.category.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())} | 
            Budget: $${job.budget.amount}
          </p>
        </div>
      `).join('');

      const content = `
        <p>Hi ${user.firstName},</p>
        <p>Here's your weekly digest of new opportunities on FetchWork:</p>
        <h3 style="color: #333;">New Jobs This Week (${recentJobs.length})</h3>
        ${jobsHtml || '<p style="color: #666;">No new jobs this week. Check back soon!</p>'}
        <div style="text-align: center; margin: 30px 0;">
          <a href="${process.env.CLIENT_URL}/browse-jobs" 
             style="background: #4285f4; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
            Browse All Jobs
          </a>
        </div>
      `;

      return emailService.sendEmail(user.email, 'Your Weekly FetchWork Digest', content, 'Weekly Digest');
    } catch (error) {
      console.error('Error sending weekly digest:', error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = new EmailWorkflowService();

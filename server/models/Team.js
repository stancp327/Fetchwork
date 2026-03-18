const mongoose = require('mongoose');

const memberSchema = new mongoose.Schema({
  user:        { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  role:        { type: String, enum: ['owner', 'admin', 'manager', 'member'], default: 'member' },
  permissions: [{
    type: String,
    enum: [
      'manage_members',     // invite/remove members
      'manage_billing',     // view/edit payment methods, top up wallet
      'approve_orders',     // approve orders over threshold
      'create_jobs',        // post jobs on behalf of team
      'manage_services',    // create/edit team services
      'view_analytics',     // view team dashboard/analytics
      'message_clients',    // message on behalf of team
      'assign_work',        // assign jobs/orders to members
      'view_wallet',        // view wallet balance + payout history
      'approve_payouts',    // approve member payout requests
      'approve_outsourcing',// approve outsource / team-to-team spend
    ],
  }],
  customRoleName: { type: String, default: '' },
  title:       { type: String, default: '' },     // "Lead Developer", "Project Manager", etc.
  invitedBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  invitedAt:   { type: Date, default: Date.now },
  joinedAt:    { type: Date },
  status:      { type: String, enum: ['invited', 'active', 'removed'], default: 'invited' },
}, { _id: true });

const teamSchema = new mongoose.Schema({
  name:        { type: String, required: true, trim: true, maxlength: 100 },
  slug:        { type: String, unique: true, lowercase: true, trim: true },
  type:        { type: String, enum: ['client_team', 'agency'], default: 'client_team' },
  owner:       { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  members:     [memberSchema],
  customRoles: [{
    name: { type: String, required: true, trim: true, maxlength: 50 },
    permissions: [{
      type: String,
      enum: [
        'manage_members',
        'manage_billing',
        'approve_orders',
        'create_jobs',
        'manage_services',
        'view_analytics',
        'message_clients',
        'assign_work',
        'view_wallet',
        'approve_payouts',
        'approve_outsourcing',
      ],
    }],
    createdAt: { type: Date, default: Date.now },
  }],
  description: { type: String, maxlength: 1000, default: '' },
  logo:        { type: String, default: '' },
  website:     { type: String, default: '' },

  // Organization hierarchy
  organization:       { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', default: null, index: true },
  department:         { type: String, default: '' },
  inheritOrgSettings: { type: Boolean, default: true },

  // Agency-specific
  portfolio:   [{ title: String, description: String, image: String, url: String }],
  specialties: [String],
  isPublic:    { type: Boolean, default: false },

  // Outsourcing — allows the team wallet to fund external job hires / team-to-team payments
  outsourcingEnabled: { type: Boolean, default: false },

  // Billing
  billingEmail:     { type: String, default: '' },
  stripeCustomerId: { type: String, default: '' },
  approvalThreshold: { type: Number, default: 0 }, // orders above this need manager approval ($0 = no approval needed)

  // Approval thresholds (Phase 2)
  approvalThresholds: {
    payoutRequiresApproval: { type: Boolean, default: false },
    payoutThresholdAmount: { type: Number, default: 0 },
    requireDualControl: { type: Boolean, default: false },
  },

  // Spend controls (Phase 2)
  spendControls: {
    monthlyCapEnabled: { type: Boolean, default: false },
    monthlyCap: { type: Number, default: 0 },
    alertThreshold: { type: Number, default: 0.8 },
    currentMonthSpend: { type: Number, default: 0 },
    capResetAt: { type: Date },
  },

  // Settings
  settings: {
    allowMemberJobPosting:  { type: Boolean, default: false },
    sharedConversations:    { type: Boolean, default: true },
    requireApproval:        { type: Boolean, default: false },
    defaultMemberPermissions: { type: [String], default: ['view_analytics', 'message_clients'] },
  },

  // Talent pipeline (Phase 3)
  talentPipeline: [{
    freelancer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    stage: {
      type: String,
      enum: ['sourced', 'reviewing', 'shortlisted', 'interviewing', 'offer', 'hired', 'archived'],
      default: 'sourced',
    },
    notes:     { type: String, default: '' },
    addedBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    addedAt:   { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  }],

  // Ownership transfer + race-safety guards
  transferState: { type: String, enum: ['idle', 'pending', 'applying'], default: 'idle' },
  transferTargetUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  lockVersion: { type: Number, default: 0 },

  pinnedJobs: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Job' }],

  isActive:    { type: Boolean, default: true },
}, { timestamps: true });

// Generate slug from name
teamSchema.pre('save', function(next) {
  if (this.isModified('name') && !this.slug) {
    this.slug = this.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') + '-' + Date.now().toString(36);
  }
  next();
});

// Virtuals
teamSchema.virtual('memberCount').get(function() {
  return this.members.filter(m => m.status === 'active').length;
});

// Methods
teamSchema.methods.isMember = function(userId) {
  return this.members.some(m => m.user.toString() === userId.toString() && m.status === 'active');
};

teamSchema.methods.getMember = function(userId) {
  return this.members.find(m => m.user.toString() === userId.toString() && m.status === 'active');
};

teamSchema.methods.hasPermission = function(userId, permission) {
  const member = this.getMember(userId);
  if (!member) return false;
  if (member.role === 'owner' || member.role === 'admin') return true;

  const rolePermissions = new Set(member.permissions || []);
  if (member.customRoleName) {
    const customRole = (this.customRoles || []).find((r) => r.name === member.customRoleName);
    (customRole?.permissions || []).forEach((p) => rolePermissions.add(p));
  }

  return rolePermissions.has(permission);
};

teamSchema.methods.isOwnerOrAdmin = function(userId) {
  const member = this.getMember(userId);
  return member && (member.role === 'owner' || member.role === 'admin');
};

// Indexes
teamSchema.index({ owner: 1 });
teamSchema.index({ 'members.user': 1 });
teamSchema.index({ slug: 1 }, { unique: true });
teamSchema.index({ type: 1, isPublic: 1 }); // for agency directory

teamSchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('Team', teamSchema);

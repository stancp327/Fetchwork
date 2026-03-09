const express = require('express');
const router = express.Router();
const { objectIdParam } = require('../middleware/validateObjectId');
router.param('id', objectIdParam);
const Contract = require('../models/Contract');
const Notification = require('../models/Notification');
const { authenticateToken } = require('../middleware/auth');
const { uploadContractDoc } = require('../middleware/upload');

// ── Contract Templates ──────────────────────────────────────────

const TEMPLATES = {
  standard_service: {
    title: 'Standard Service Agreement',
    content: `
# Service Agreement

This Service Agreement ("Agreement") is entered into as of {{startDate}} between:

**Client:** {{clientName}}
**Service Provider:** {{freelancerName}}

## 1. Scope of Work
{{scope}}

## 2. Compensation
The Client agrees to pay the Service Provider **{{compensation}}** for the services described above.
Payment terms: {{paymentTerms}}.

## 3. Timeline
- Start Date: {{startDate}}
- End Date: {{endDate}}

## 4. Intellectual Property
All work product created under this Agreement shall be the property of the Client upon full payment.

## 5. Confidentiality
Both parties agree to keep confidential any proprietary information shared during the course of this engagement.

## 6. Termination
Either party may terminate this Agreement with 7 days written notice. {{terminationClause}}

## 7. Governing Law
This Agreement shall be governed by the laws of {{jurisdiction}}.

## 8. Entire Agreement
This Agreement constitutes the entire understanding between the parties.
    `.trim(),
  },

  nda: {
    title: 'Non-Disclosure Agreement',
    content: `
# Non-Disclosure Agreement

This Non-Disclosure Agreement ("Agreement") is entered into as of {{startDate}} between:

**Disclosing Party:** {{clientName}}
**Receiving Party:** {{freelancerName}}

## 1. Definition of Confidential Information
"Confidential Information" includes all non-public information disclosed by the Disclosing Party, whether oral, written, or electronic, including but not limited to: business plans, customer data, financial information, trade secrets, and technical specifications.

## 2. Obligations
The Receiving Party agrees to:
- Hold all Confidential Information in strict confidence
- Not disclose Confidential Information to any third party without prior written consent
- Use Confidential Information solely for the purpose of {{scope}}
- Return or destroy all Confidential Information upon request

## 3. Duration
This NDA shall remain in effect for {{ndaDuration}} from the date of signing.

## 4. Exclusions
This Agreement does not apply to information that:
- Is or becomes publicly available through no fault of the Receiving Party
- Was known to the Receiving Party prior to disclosure
- Is independently developed by the Receiving Party

## 5. Remedies
The Receiving Party acknowledges that breach may cause irreparable harm and agrees that the Disclosing Party may seek injunctive relief.

## 6. Governing Law
This Agreement shall be governed by the laws of {{jurisdiction}}.
    `.trim(),
  },

  non_compete: {
    title: 'Non-Compete Agreement',
    content: `
# Non-Compete Agreement

This Non-Compete Agreement ("Agreement") is entered into as of {{startDate}} between:

**Company:** {{clientName}}
**Contractor:** {{freelancerName}}

## 1. Non-Compete Restriction
During the term of engagement and for {{ndaDuration}} thereafter, the Contractor agrees not to directly compete with the Company in the same market or solicit the Company's clients for competing services.

## 2. Scope
This restriction applies to: {{scope}}

## 3. Consideration
In consideration for this Agreement, the Contractor shall receive {{compensation}}.

## 4. Governing Law
This Agreement shall be governed by the laws of {{jurisdiction}}.
    `.trim(),
  },
};

// ── Routes ──────────────────────────────────────────────────────

// GET /api/contracts/templates — list available templates
router.get('/templates', authenticateToken, (req, res) => {
  const templates = Object.entries(TEMPLATES).map(([key, val]) => ({
    id: key,
    title: val.title,
  }));
  res.json({ templates });
});

// GET /api/contracts/templates/:id — get template content
router.get('/templates/:id', authenticateToken, (req, res) => {
  const template = TEMPLATES[req.params.id];
  if (!template) return res.status(404).json({ error: 'Template not found' });
  res.json(template);
});

// POST /api/contracts — create a contract
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { template, title, freelancerId, jobId, terms, customFields } = req.body;

    if (!freelancerId) return res.status(400).json({ error: 'freelancerId required' });
    if (!title) return res.status(400).json({ error: 'title required' });

    const tmpl = TEMPLATES[template] || TEMPLATES.standard_service;

    // Fill in template variables
    let content = req.body.content || tmpl.content;
    if (terms) {
      const User = require('../models/User');
      const [client, freelancer] = await Promise.all([
        User.findById(req.user._id).select('firstName lastName'),
        User.findById(freelancerId).select('firstName lastName'),
      ]);
      const vars = {
        clientName: client ? `${client.firstName} ${client.lastName}` : 'Client',
        freelancerName: freelancer ? `${freelancer.firstName} ${freelancer.lastName}` : 'Freelancer',
        scope: terms.scope || '[To be defined]',
        compensation: terms.compensation ? `$${terms.compensation} USD` : '[To be defined]',
        paymentTerms: terms.paymentTerms || 'Upon completion',
        startDate: terms.startDate ? new Date(terms.startDate).toLocaleDateString() : '[TBD]',
        endDate: terms.endDate ? new Date(terms.endDate).toLocaleDateString() : '[TBD]',
        ndaDuration: terms.ndaDuration || '2 years',
        jurisdiction: terms.jurisdiction || 'the applicable jurisdiction',
        terminationClause: terms.terminationClause || '',
      };
      Object.entries(vars).forEach(([key, val]) => {
        content = content.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), val);
      });
    }

    const contract = new Contract({
      client: req.user._id,
      freelancer: freelancerId,
      job: jobId || undefined,
      template: template || 'standard_service',
      title,
      content,
      terms: terms || {},
      customFields: customFields || [],
      createdBy: req.user._id,
      status: 'draft',
    });

    await contract.save();
    res.status(201).json(contract);
  } catch (error) {
    console.error('Error creating contract:', error);
    res.status(500).json({ error: 'Failed to create contract' });
  }
});

// GET /api/contracts — list user's contracts
router.get('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user._id;
    const { status, role, teamId } = req.query;

    let query;
    if (teamId) {
      query = { team: teamId };
    } else {
      query = { $or: [{ client: userId }, { freelancer: userId }] };
    }
    if (status && status !== 'all') query.status = status;
    if (!teamId && role === 'client') { delete query.$or; query.client = userId; }
    if (!teamId && role === 'freelancer') { delete query.$or; query.freelancer = userId; }

    const contracts = await Contract.find(query)
      .populate('client', 'firstName lastName')
      .populate('freelancer', 'firstName lastName')
      .populate('job', 'title')
      .sort({ updatedAt: -1 })
      .limit(50);

    res.json({ contracts });
  } catch (error) {
    console.error('Error fetching contracts:', error);
    res.status(500).json({ error: 'Failed to fetch contracts' });
  }
});

// GET /api/contracts/:id — get single contract
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const contract = await Contract.findById(req.params.id)
      .populate('client', 'firstName lastName email')
      .populate('freelancer', 'firstName lastName email')
      .populate('job', 'title budget')
      .populate('signatures.user', 'firstName lastName');

    if (!contract) return res.status(404).json({ error: 'Contract not found' });

    const userId = req.user._id.toString();
    if (contract.client._id.toString() !== userId && contract.freelancer._id.toString() !== userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    res.json(contract);
  } catch (error) {
    console.error('Error fetching contract:', error);
    res.status(500).json({ error: 'Failed to fetch contract' });
  }
});

// POST /api/contracts/:id/send — send contract to other party for signing
router.post('/:id/send', authenticateToken, async (req, res) => {
  try {
    const contract = await Contract.findById(req.params.id);
    if (!contract) return res.status(404).json({ error: 'Contract not found' });
    if (contract.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Only the creator can send this contract' });
    }
    if (contract.status !== 'draft') {
      return res.status(400).json({ error: 'Contract has already been sent' });
    }

    contract.status = 'pending';
    contract.sentAt = new Date();
    contract.expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
    await contract.save();

    // Notify the other party
    const recipientId = contract.createdBy.toString() === contract.client.toString()
      ? contract.freelancer : contract.client;
    await Notification.create({
      recipient: recipientId,
      type: 'contract',
      title: 'Contract awaiting your signature',
      message: `You have a new contract "${contract.title}" to review and sign.`,
      link: `/contracts/${contract._id}`,
    });

    res.json({ message: 'Contract sent for signing', contract });
  } catch (error) {
    console.error('Error sending contract:', error);
    res.status(500).json({ error: 'Failed to send contract' });
  }
});

// POST /api/contracts/:id/sign — sign the contract
router.post('/:id/sign', authenticateToken, async (req, res) => {
  try {
    const { name } = req.body; // typed signature
    if (!name || name.trim().length < 2) {
      return res.status(400).json({ error: 'Please type your full name to sign' });
    }

    const contract = await Contract.findById(req.params.id)
      .populate('client', 'firstName lastName')
      .populate('freelancer', 'firstName lastName');
    if (!contract) return res.status(404).json({ error: 'Contract not found' });

    if (contract.status !== 'pending' && contract.status !== 'active') {
      return res.status(400).json({ error: 'Contract is not available for signing' });
    }

    const userId = req.user._id.toString();
    if (contract.client._id.toString() !== userId && contract.freelancer._id.toString() !== userId) {
      return res.status(403).json({ error: 'Not authorized to sign this contract' });
    }

    // Check if already signed by this user
    if (contract.signatures.some(s => s.user.toString() === userId)) {
      return res.status(400).json({ error: 'You have already signed this contract' });
    }

    contract.signatures.push({
      user: req.user._id,
      name: name.trim(),
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
    });

    // Check if both parties have signed
    const clientSigned = contract.signatures.some(s => s.user.toString() === contract.client._id.toString());
    const freelancerSigned = contract.signatures.some(s => s.user.toString() === contract.freelancer._id.toString());

    if (clientSigned && freelancerSigned) {
      contract.status = 'active';
    }

    await contract.save();

    // Notify the other party
    const otherParty = userId === contract.client._id.toString()
      ? contract.freelancer : contract.client;
    const signerName = userId === contract.client._id.toString()
      ? `${contract.client.firstName} ${contract.client.lastName}`
      : `${contract.freelancer.firstName} ${contract.freelancer.lastName}`;

    await Notification.create({
      recipient: otherParty._id,
      type: 'contract',
      title: contract.isFullySigned ? 'Contract fully signed!' : 'Contract signed',
      message: contract.isFullySigned
        ? `"${contract.title}" has been signed by both parties and is now active.`
        : `${signerName} has signed "${contract.title}". Your signature is needed.`,
      link: `/contracts/${contract._id}`,
    });

    res.json({
      message: contract.isFullySigned ? 'Contract fully signed and active!' : 'Contract signed successfully',
      contract,
    });
  } catch (error) {
    console.error('Error signing contract:', error);
    res.status(500).json({ error: 'Failed to sign contract' });
  }
});

// POST /api/contracts/:id/cancel — cancel a contract
router.post('/:id/cancel', authenticateToken, async (req, res) => {
  try {
    const { reason } = req.body;
    const contract = await Contract.findById(req.params.id);
    if (!contract) return res.status(404).json({ error: 'Contract not found' });

    const userId = req.user._id.toString();
    if (contract.client.toString() !== userId && contract.freelancer.toString() !== userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }
    if (['cancelled', 'completed'].includes(contract.status)) {
      return res.status(400).json({ error: 'Contract cannot be cancelled' });
    }

    contract.status = 'cancelled';
    contract.cancelledAt = new Date();
    contract.cancelReason = reason || '';
    await contract.save();

    res.json({ message: 'Contract cancelled', contract });
  } catch (error) {
    console.error('Error cancelling contract:', error);
    res.status(500).json({ error: 'Failed to cancel contract' });
  }
});

module.exports = router;




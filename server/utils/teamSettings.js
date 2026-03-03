/**
 * Resolve effective settings for a team, merging org-level overrides when inherited.
 */
function resolveTeamSettings(team, org) {
  const teamSpend = team.spendControls || {};
  const teamApproval = team.approvalThresholds || {};

  if (!org || !team.inheritOrgSettings) {
    return {
      spendControls: teamSpend,
      approvalThresholds: teamApproval,
      effectiveSource: 'team',
    };
  }

  const orgSpend = org.settings?.spendControls || {};
  const orgApproval = org.settings?.approvalThresholds || {};

  const hasOrgSpend = orgSpend.monthlyCapEnabled;
  const hasOrgApproval = orgApproval.payoutRequiresApproval;

  // Org settings win for any enabled controls
  const mergedSpend = {
    ...teamSpend,
    ...(hasOrgSpend ? {
      monthlyCapEnabled: orgSpend.monthlyCapEnabled,
      monthlyCap: orgSpend.monthlyCap,
      alertThreshold: orgSpend.alertThreshold,
    } : {}),
  };

  const mergedApproval = {
    ...teamApproval,
    ...(hasOrgApproval ? {
      payoutRequiresApproval: orgApproval.payoutRequiresApproval,
      payoutThresholdAmount: orgApproval.payoutThresholdAmount,
      requireDualControl: orgApproval.requireDualControl,
    } : {}),
  };

  const source = (hasOrgSpend || hasOrgApproval) ? 'merged' : 'team';

  return {
    spendControls: mergedSpend,
    approvalThresholds: mergedApproval,
    effectiveSource: (hasOrgSpend && hasOrgApproval) ? 'org' : source,
  };
}

module.exports = { resolveTeamSettings };

# Mobile QA Checklist — Teams / Wallet / Payments / Contracts

## Test Account Setup
- [ ] User A (client) has at least one saved card
- [ ] User B (freelancer) exists for team invites/contracts
- [ ] User A has Stripe Connect unlinked, then linked (for both states)

## 1) Teams
- [ ] Create Client Team (valid name)
- [ ] Create Agency Team
- [ ] Invite member by email (member role)
- [ ] Invite member by email (manager role)
- [ ] Accept invitation from invitee account
- [ ] Decline invitation from invitee account
- [ ] Remove active non-owner member
- [ ] Verify owner cannot be removed
- [ ] Pull-to-refresh reflects latest team/member state

## 2) Wallet
- [ ] Wallet balance loads
- [ ] Top-up with valid amount (>= $5) opens Stripe checkout URL
- [ ] Top-up with invalid amount (< $5) shows inline validation
- [ ] Withdraw valid amount (>= $1) succeeds when Connect account exists
- [ ] Withdraw invalid amount (< $1) blocked with inline validation
- [ ] Recent wallet history renders entries correctly

## 3) Payments
- [ ] Connect status card loads (connected/unconnected states)
- [ ] Connect button opens onboarding URL
- [ ] Saved card list renders brand/last4/default state
- [ ] Set non-default method as default
- [ ] Remove non-default method
- [ ] Payment history list renders with amounts/status

## 4) Contracts
- [ ] Contract list loads
- [ ] Filter toggles work (all/draft/pending/active/completed/cancelled)
- [ ] Send action works for draft contracts
- [ ] Sign action works for pending/active with signature name
- [ ] Sign action blocked when signature input empty
- [ ] Cancel action works for non-cancelled/non-completed contracts

## Regression + UX
- [ ] Loading states visible during network actions
- [ ] Buttons disabled while pending to prevent double-submit
- [ ] Error states are actionable and not generic where possible
- [ ] Success messaging appears and auto-clears logically

## Exit Criteria
- [ ] No P0/P1 defects in 4 target flows
- [ ] Any remaining P2s documented with repro steps
- [ ] Ready for EAS Build #7 + device validation

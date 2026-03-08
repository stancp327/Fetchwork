# Duplicate Account Cleanup Guide

## Overview
This guide documents the process for safely cleaning up duplicate user accounts in the FetchWork production database. Duplicate accounts were created before the unique email constraint was properly enforced.

## Analysis Results

### Duplicate Detection
Run the analysis script to identify duplicate accounts:
```bash
cd /home/ubuntu/repos/Fetchwork
MONGO_URI="your_production_mongo_uri" node scripts/analyze-duplicates.js
```

### Account Selection Criteria
The cleanup script uses the following priority order to select the primary account:
1. **Admin privileges** - Accounts with `isAdminPromoted: true` are prioritized
2. **Completeness score** - Based on profile data, verification status, etc.
3. **Email verification** - Verified accounts are preferred
4. **Creation date** - Most recent account if all else is equal

### Completeness Scoring
Each account is scored out of 10 points:
- First name: +1 point
- Last name: +1 point  
- Email verified: +2 points
- Profile complete: +2 points
- Has password: +1 point
- Account type set: +1 point
- Admin promoted: +2 points

## Cleanup Process

### Step 1: Dry Run Analysis
Always start with a dry run to review what will be changed:
```bash
MONGO_URI="your_production_mongo_uri" node scripts/cleanup-duplicates.js
```

### Step 2: Review Results
Carefully review the output to ensure:
- Admin accounts are preserved
- Most complete accounts are selected as primary
- No critical data will be lost

### Step 3: Live Cleanup
Only after confirming the dry run results:
```bash
MONGO_URI="your_production_mongo_uri" node scripts/cleanup-duplicates.js --live
```

## Data Preservation

### Merged Data
The cleanup script preserves data by merging:
- Missing first/last names from duplicates to primary account
- Profile completion status
- Authentication providers (Google, Facebook, etc.)

### Audit Trail
All cleanup operations are logged to the `cleanup_logs` collection with:
- Timestamp of operation
- Account IDs removed and kept
- Reason for selection
- Data merged

## Safety Measures

### Pre-Cleanup Backup
Before running live cleanup:
1. Create database backup
2. Test restore procedure
3. Verify backup integrity

### Rollback Procedure
If issues arise after cleanup:
1. Restore from pre-cleanup backup
2. Investigate specific issues
3. Modify cleanup criteria if needed
4. Re-run with adjusted parameters

## Verification Steps

### Post-Cleanup Verification
After cleanup, verify:
1. Admin accounts can still log in
2. No duplicate emails remain
3. User relationships are intact
4. Authentication works properly

### Test Commands
```bash
# Check for remaining duplicates
MONGO_URI="your_production_mongo_uri" node scripts/analyze-duplicates.js

# Test admin login
curl -X POST https://fetchwork.net/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"stancp327@gmail.com","password":"your_password"}'
```

## Email Verification System

### Environment Variables Required
- `RESEND_API_KEY` - API key for Resend email service
- `FROM_EMAIL` - Sender email address
- `CLIENT_URL` - Frontend URL for verification links

### Testing Email System
```bash
MONGO_URI="your_production_mongo_uri" node scripts/test-email-verification.js
```

## Monitoring

### Post-Cleanup Monitoring
Monitor for:
- Login failures from affected users
- Email verification issues
- Admin access problems
- Database integrity issues

### Support Procedures
If users report issues:
1. Check cleanup logs for their account
2. Verify account data integrity
3. Manually restore missing data if needed
4. Update user on resolution

## Prevention

### Future Duplicate Prevention
The registration endpoint now includes:
- Proper E11000 error handling
- Race condition protection
- Improved logging for duplicate attempts

### Monitoring Setup
Consider implementing:
- Duplicate account alerts
- Registration failure monitoring
- Email verification success rates

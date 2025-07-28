# SSL Certificate Issue Analysis for FetchWork

## Problem Description
- **Issue**: https://fetchwork.net shows "This Connection Is Not Private" warning
- **Working**: https://www.fetchwork.net works correctly with HTTPS
- **Root Cause**: SSL certificate only covers www.fetchwork.net, not the root domain fetchwork.net

## Current Configuration Analysis

### Vercel Configuration
- Current vercel.json only contains rewrites and headers, no domain-specific configuration
- No explicit domain configuration in project files

### Domain Status (from README.md)
- Current Production: fetchwork-temp.vercel.app (fully functional)
- Custom Domain: fetchwork.net (pending Vercel Pro Trial resolution - support ticket submitted)
- DNS Configuration: ✅ Configured in Namecheap, awaiting Vercel domain binding approval

## Vercel SSL Certificate Behavior
Based on Vercel documentation:
1. SSL certificates are automatically provisioned using LetsEncrypt
2. When adding an apex domain (fetchwork.net), Vercel should prompt to also add www subdomain
3. Both domains should receive SSL certificates automatically
4. The issue suggests only www.fetchwork.net was properly configured

## Potential Solutions

### Option 1: Vercel Dashboard Configuration (REQUIRED)
- Ensure both fetchwork.net and www.fetchwork.net are added as domains in Vercel project
- Verify DNS records point correctly to Vercel
- Check if CAA records are blocking LetsEncrypt certificate generation

### Option 2: DNS Configuration Verification
- Verify A record for fetchwork.net points to correct Vercel IP (76.76.21.21)
- Verify CNAME record for www.fetchwork.net points to cname.vercel-dns.com
- Check for missing CAA records that allow LetsEncrypt

### Option 3: Configuration File Updates (Limited Impact)
- Add domain-specific configuration to vercel.json if supported
- Ensure proper redirects between apex and www domains

## Vercel Dashboard Steps Required

### Step 1: Navigate to Domain Settings
1. Go to Vercel dashboard
2. Select the FetchWork project
3. Navigate to Settings → Domains

### Step 2: Verify Domain Configuration
1. Check if both fetchwork.net and www.fetchwork.net are listed as domains
2. Verify SSL certificate status for both domains
3. Check if both domains show "Valid Configuration" status

### Step 3: Add Missing Domain (if needed)
1. If only www.fetchwork.net is configured, add fetchwork.net as a domain
2. Vercel should automatically prompt to add both apex and www when adding one
3. Wait for SSL certificate generation (can take up to 24 hours)

### Step 4: DNS Verification
1. Verify A record: fetchwork.net → 76.76.21.21
2. Verify CNAME record: www.fetchwork.net → cname.vercel-dns.com
3. Check for CAA records that might block LetsEncrypt

## Expected DNS Configuration

```
Type    Name                Value
A       fetchwork.net       76.76.21.21
CNAME   www.fetchwork.net   cname.vercel-dns.com
```

## Troubleshooting Common Issues

### Issue: SSL Certificate Not Generated for Apex Domain
- **Cause**: Only www subdomain was added to Vercel project
- **Solution**: Add both fetchwork.net and www.fetchwork.net as domains

### Issue: CAA Records Blocking LetsEncrypt
- **Cause**: DNS provider has CAA records that don't allow LetsEncrypt
- **Solution**: Add CAA record: `0 issue "letsencrypt.org"`

### Issue: DNS Propagation Delays
- **Cause**: DNS changes can take up to 48 hours to propagate
- **Solution**: Wait for propagation, use DNS checker tools

## Verification Steps

### After Configuration Changes:
1. Test https://fetchwork.net (should work without SSL warnings)
2. Test https://www.fetchwork.net (should continue working)
3. Verify SSL certificates are properly generated for both domains
4. Check that redirects work correctly between apex and www domains
5. Ensure all existing functionality continues to work

### Tools for Verification:
- SSL Labs SSL Test: https://www.ssllabs.com/ssltest/
- DNS Checker: https://dnschecker.org/
- Vercel domain status in dashboard

## Next Steps for Implementation

1. **Immediate**: Document the issue and required Vercel dashboard changes
2. **User Action Required**: Access Vercel dashboard to verify/add both domains
3. **Verification**: Test both URLs after configuration changes
4. **Monitoring**: Check SSL certificate status and renewal

## Expected Outcome
Both https://fetchwork.net and https://www.fetchwork.net should work without SSL warnings after proper Vercel domain configuration.

## Limitations
This fix requires Vercel dashboard access to verify and modify domain configuration, which cannot be done through code changes alone. The analysis and guidance provided should enable resolution through the Vercel dashboard.

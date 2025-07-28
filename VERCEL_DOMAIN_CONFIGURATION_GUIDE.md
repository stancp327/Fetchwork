# Vercel Domain Configuration Guide for FetchWork

## SSL Certificate Issue Resolution

### Problem
- https://fetchwork.net shows "This Connection Is Not Private" warning
- https://www.fetchwork.net works correctly
- SSL certificate only covers www subdomain, not root domain

### Required Actions in Vercel Dashboard

#### Step 1: Access Domain Settings
1. Log into Vercel dashboard
2. Navigate to FetchWork project
3. Go to Settings → Domains

#### Step 2: Verify Current Configuration
Check if both domains are properly configured:
- ✅ www.fetchwork.net (currently working)
- ❌ fetchwork.net (needs SSL certificate)

#### Step 3: Add Root Domain (if missing)
1. Click "Add Domain"
2. Enter: `fetchwork.net`
3. Vercel should automatically suggest adding both apex and www
4. Confirm both domains are added

#### Step 4: Verify DNS Configuration
Ensure DNS records in Namecheap match Vercel requirements:

```
Type    Name                Value                    TTL
A       fetchwork.net       76.76.21.21             Auto
CNAME   www.fetchwork.net   cname.vercel-dns.com    Auto
```

#### Step 5: SSL Certificate Generation
- Vercel automatically provisions SSL certificates via LetsEncrypt
- Process can take up to 24 hours
- Both domains should show "Valid Configuration" status

### Troubleshooting

#### If SSL Certificate Fails to Generate:
1. **Check CAA Records**: Ensure no CAA records block LetsEncrypt
2. **DNS Propagation**: Wait up to 48 hours for DNS changes
3. **Domain Verification**: Ensure domain ownership is verified

#### Required CAA Record (if needed):
```
Type    Name                Value
CAA     fetchwork.net       0 issue "letsencrypt.org"
```

### Verification Steps

#### After Configuration:
1. Test https://fetchwork.net (should work without warnings)
2. Test https://www.fetchwork.net (should continue working)
3. Verify SSL certificate covers both domains
4. Check redirect behavior between domains

#### Tools for Testing:
- SSL Labs: https://www.ssllabs.com/ssltest/
- DNS Checker: https://dnschecker.org/
- Browser developer tools for certificate inspection

### Expected Timeline
- **Immediate**: Domain addition in Vercel dashboard
- **1-24 hours**: SSL certificate generation
- **24-48 hours**: Full DNS propagation

### Success Criteria
- ✅ https://fetchwork.net works without SSL warnings
- ✅ https://www.fetchwork.net continues working
- ✅ Both domains show valid SSL certificates
- ✅ Proper redirects between apex and www domains

### Notes
- This configuration requires Vercel dashboard access
- No code changes needed in the project
- DNS configuration in Namecheap should already be correct
- Issue is specifically with Vercel domain binding, not DNS

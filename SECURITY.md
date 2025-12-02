# Security Policy

## Supported Versions

We take security seriously. The following versions are currently supported with security updates:

| Version | Supported          |
| ------- | ------------------ |
| Latest  | :white_check_mark: |
| < 1.0   | :x:                |

## Reporting a Vulnerability

**Please do not report security vulnerabilities through public GitHub issues.**

If you discover a security vulnerability, please report it privately:

1. **Email**: [INSERT YOUR SECURITY EMAIL]
2. **Subject**: "[SECURITY] Brief description"
3. **Include**:
   - Type of vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

### What to Expect

- **Acknowledgment**: Within 48 hours
- **Initial assessment**: Within 1 week
- **Fix timeline**: Depends on severity
  - Critical: 24-72 hours
  - High: 1-2 weeks
  - Medium: 2-4 weeks
  - Low: Best effort

### Disclosure Policy

- We will work with you to understand and fix the issue
- We ask that you do not publicly disclose until we've released a fix
- We will credit you in the security advisory (unless you prefer to remain anonymous)
- For critical issues, we may request a coordinated disclosure

## Security Best Practices

### For Self-Hosters

If you're self-hosting Walt, please follow these security guidelines:

#### 1. Environment Variables
```bash
# ❌ Never commit .env files
# ❌ Never share credentials publicly
# ✅ Use strong, unique passwords
# ✅ Rotate credentials regularly
```

#### 2. Firebase Security
- Enable 2FA on your Firebase account
- Use Firebase Security Rules
- Restrict API keys to your domain
- Monitor Firebase Console for unusual activity

#### 3. Database Security
```bash
# ✅ Set proper file permissions
chmod 600 data/ipfs-drive.db

# ✅ Enable WAL mode (already default)
# ✅ Regular backups
# ✅ Don't expose database port
```

#### 4. IPFS Node Security
```bash
# ✅ Run IPFS behind firewall
# ✅ Don't expose API port (5001) to internet
# ✅ Use nginx/reverse proxy for gateway
# ✅ Rate limit API endpoints
```

#### 5. Server Hardening
- Keep OS and packages updated
- Use firewall (UFW, iptables)
- Enable fail2ban
- Use SSH keys (disable password auth)
- Regular security audits

#### 6. CORS Configuration
```javascript
// ✅ Restrict to your domains
ALLOWED_ORIGINS=https://yourdomain.com

// ❌ Never use in production
ALLOWED_ORIGINS=*
```

#### 7. SSL/TLS
- Use valid SSL certificates (Let's Encrypt)
- Force HTTPS
- Enable HSTS headers
- Use secure cookies

### For Hosted Service Users

If you're using walt.aayushman.dev:

- ✅ Enable 2FA on your account
- ✅ Use strong, unique passwords
- ✅ Don't share account credentials
- ✅ Review shared file permissions regularly
- ✅ Report suspicious activity immediately

## Known Security Considerations

### 1. IPFS Content Addressing
- Files on IPFS are **publicly accessible** if someone knows the CID
- Don't upload sensitive data without client-side encryption
- Unpinning removes from your node but may exist on other nodes

### 2. Authentication
- Authentication via Firebase
- Backend validates all Firebase tokens
- CORS restricted to allowed origins

### 3. File Permissions
- Share links can have passwords and expiration
- Implement proper access controls for shared files
- Monitor share link usage

### 4. Payment Security
- Payment via Cashfree (PCI-compliant)
- No credit card data stored on our servers
- Webhook signature verification

### 5. Database
- SQLite database with prepared statements
- No SQL injection vulnerabilities
- User data isolated by user_id

## Security Features

✅ **Authentication**: Firebase Auth  
✅ **Authorization**: Token-based with backend validation  
✅ **Input Validation**: All endpoints validate inputs  
✅ **SQL Injection**: Prepared statements only  
✅ **XSS Protection**: React auto-escapes  
✅ **CSRF Protection**: SameSite cookies  
✅ **Rate Limiting**: Recommended for production  
✅ **CORS**: Configurable origins  
✅ **HTTPS**: Enforced in production  

## Regular Security Tasks

### Weekly
- Review access logs
- Monitor for unusual activity
- Check failed login attempts

### Monthly
- Update dependencies (`npm audit fix`)
- Review user permissions
- Check for security advisories

### Quarterly
- Full security audit
- Review and rotate credentials
- Update security documentation

## Dependencies

We use:
- `npm audit` to check for vulnerable packages
- Dependabot for automated security updates
- Regular manual reviews of dependencies

## Bug Bounty

We currently do not have a formal bug bounty program, but we greatly appreciate responsible disclosure and will:

- Acknowledge your contribution
- Credit you in security advisories (if desired)
- Provide swag/credits on our hosted service

## Questions?

For security questions that don't involve a vulnerability, please:
- Open a GitHub Discussion
- Tag with "security" label

Thank you for helping keep Walt secure! 🔒


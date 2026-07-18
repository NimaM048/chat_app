# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 0.1.x   | :white_check_mark: |

## Reporting a Vulnerability

If you discover a security vulnerability, please **do not** open a public GitHub issue.

Instead, report it privately by opening a [GitHub Security Advisory](https://github.com/NimaM048/chat_app/security/advisories/new) or by contacting the repository owner directly.

Please include:

- A clear description of the issue
- Steps to reproduce
- Potential impact
- Suggested fix (if available)

We aim to acknowledge reports within **72 hours** and provide a remediation timeline when possible.

## Security Practices in This Project

- JWT access/refresh tokens with configurable secrets (never use defaults in production)
- Argon2 password hashing
- Rate limiting on sensitive endpoints
- CORS configuration via environment variables
- Request validation with `class-validator`
- Secrets excluded from version control via `.gitignore` and `.env.example` templates

## Production Checklist

Before deploying to production:

1. Rotate all JWT secrets and database credentials
2. Set `CORS_ORIGIN` to your actual frontend domain
3. Use HTTPS (TLS termination at Nginx or load balancer)
4. Restrict database and Redis network access
5. Run `npm audit` and keep dependencies updated (Dependabot is enabled)

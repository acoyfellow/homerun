# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in unsurf, please report it by emailing security@coey.dev.

Please do **not** open a public GitHub issue for security vulnerabilities.

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| latest  | :white_check_mark: |

## Security Considerations

unsurf executes in a Cloudflare Worker environment with the following security properties:

- **Sandboxed execution**: Browser rendering runs in isolated Cloudflare containers
- **No persistent storage of credentials**: Auth headers are passed through but not stored
- **HTTPS only**: All API communication is encrypted

When using unsurf with authenticated APIs, ensure you:
- Never commit API keys or tokens to your repository
- Use environment variables or secure secret management
- Review captured endpoints before publishing to the public directory

# Northwind Industries — Information Security Policy 2026

## Passwords
- Minimum length is **14 characters** and must include at least one number and one symbol.
- Passwords must be rotated every **90 days**.
- The previous **5 passwords** may not be reused.

## Multi-Factor Authentication
- MFA is **mandatory** for all employees on email, VPN, and the production console.
- Hardware security keys (FIDO2) are required for anyone with production database access.

## Data Classification
| Level | Description | Example |
|-------|-------------|---------|
| Public | Freely shareable | Marketing pages |
| Internal | Employees only | Org charts |
| Confidential | Need-to-know | Salary data, contracts |
| Restricted | Strict access controls | Customer PII, credentials |

## Incident Response
- Report suspected incidents to **security@northwind.example** within **1 hour** of discovery.
- The security team acknowledges reports within **30 minutes** during business hours.
- Critical incidents trigger the on-call rotation, reachable 24/7.

## Device Encryption
All laptops must have full-disk encryption enabled. Lost or stolen devices must be
reported immediately so they can be remotely wiped.

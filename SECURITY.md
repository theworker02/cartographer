# Security Policy

## Supported versions

| Version | Supported |
|---------|-----------|
| 0.2.x   | Yes       |
| 0.1.x   | Best effort |

## Reporting a vulnerability

Please report security issues privately via GitHub Security Advisories on [theworker02/cartographer](https://github.com/theworker02/cartographer), or email the maintainer through GitHub.

Do not open public issues for vulnerabilities that could expose user repositories or local Atlas data.

## Scope notes

Cartographer is local-first and does not transmit repository contents. Still, treat `.cartographer/` like any other project cache: it may mirror paths and symbol names from your codebase.

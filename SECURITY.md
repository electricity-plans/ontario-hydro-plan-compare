# Security

## How the app handles your data

The app is a single web page. Your usage file is read **in your browser** and is never uploaded: the page makes no
network requests with your data, and it stores nothing after you close it. There is no server, account or database.

## Reporting a problem

Please **don't open a public issue** for security problems. Use GitHub's private reporting instead:
**Security** tab → **Report a vulnerability**
(<https://github.com/electricity-plans/ontario-hydro-plan-compare/security/advisories/new>).

Examples of what's worth reporting:

- A crafted Green Button file that makes the page run code, show misleading content, or freeze the browser.
- Any way the page could send a file's contents, or anything from it, anywhere.
- A problem in the published page's setup (for example, its content-security settings).

This is a hobby project with no bug bounty. Reports are read and taken seriously, but a response time can't be
promised. If a problem is confirmed, the fix will be released and credited if you'd like.

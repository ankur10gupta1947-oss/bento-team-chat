# BENTO Team Chat

I'm building BENTO, a private team communication tool for small-to-midsize companies — 

a calmer, self-owned alternative to Slack/WhatsApp for company announcements and group 

discussions. This is a bounded experiment: I need a working product to test with 1-2 real 

paying customers, not a full-featured platform.

Build ONLY Phase 1 right now. Do not build anything beyond what's listed below — I will 

prompt you for each later phase separately once this one is reviewed and working.

PHASE 1 SCOPE — Auth, organizations, and invites:

1. Email + password signup and login (use your built-in auth, not custom-built password 

   handling).

2. When someone signs up, they create an "organization" (the company account). They 

   become that organization's "admin."

3. The admin can invite teammates by email (simple invite-link or email-invite flow is fine).

4. Invited users get "member" role by default. Only two roles exist: admin and member.

5. Every piece of data must be scoped to its organization — one company's data must 

   never be visible to another company's users, even though they share the same app. 

   This is the most important rule in the whole build: please add this data-isolation 

   rule at the database level, not just in the UI.

6. Basic account settings page: organization name, list of members, and admin can 

   remove a member.

NON-NEGOTIABLE SECURITY BASICS (apply now, not later):

- Passwords must never be stored in plain text — use your standard auth handling.

- All traffic over HTTPS.

- No API keys or secrets should end up visible in the frontend code.

DO NOT BUILD YET (explicitly out of scope for this phase):

- Groups/channels, posts, comments, reactions, search, notifications — these come in 

  later phases.

- No direct messages, no SSO, no mobile app, no admin audit logs, no self-hosting option.

When you're done, tell me clearly what you built, how to test that one organization's 

data is actually isolated from another's, and flag anything from this phase you weren't 

able to fully implement.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/f7104112-65e0-4cae-bfac-e0b3b8b08106).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

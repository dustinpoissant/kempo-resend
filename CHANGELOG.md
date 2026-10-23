# Changelog

All notable changes to `kempo-resend` are documented in this file.

## [Unreleased]

### Added

- **A Resend From setting on the Resend tab** (`resend_from`), used for Resend only and winning over the site's Email from, so Resend can send as `onboarding@resend.dev` while testing, or as an address on its verified domain, whatever the rest of the site sends as. An address that is not an address is refused before anything is sent.

- **A refused sender domain is explained:** when Resend says the domain is not verified, the log also says which sender it was sent as and to set Email from, on the System tab, to an address on a verified domain.

- **With no key saved it answers that it was skipped,** so kempo does not count it as a try or let its "not set up" hide the real reason another sender failed.

- **Sends kempo's emails through Resend,** as an `email:send` handler (kempo itself no longer includes Resend). One call to Resend's HTTP API per email, no dependencies. The answer (sent with Resend's message id, or the reason it was not) is recorded in kempo's email log.
- **A Resend tab on the Settings page** for the API key, kept as an encrypted `secret` setting.
- **A key in `RESEND_API_KEY` is saved as the setting on install,** when none is saved yet, so a site that used Resend before only has to install this.

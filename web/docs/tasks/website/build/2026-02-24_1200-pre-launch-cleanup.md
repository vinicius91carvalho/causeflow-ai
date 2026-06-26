# Website Pre-Launch Cleanup & Improvements

## Batch 1 (Parallel — Independent Changes)
- [x] Change 1: Remove password screen (delete files, edit layout + sst config)
- [x] Change 2: Hide theme switcher from header
- [x] Change 3: Disable /about route (remove nav links, footer column, sitemap entry)
- [x] Change 4: Fix pricing card hover bug (button text invisible on hover)
- [x] Change 8: Language detection + fix nav language bug
- [x] Change 11: Remove social icons from footer
- [x] Change 12: Remove homepage carousel dark fadeout

## Batch 2 (Parallel)
- [x] Change 5: Pricing plan selection → ROI calculator integration
- [x] Change 6: Contact Us modal component
- [x] Change 9: Security page — replace implementation details
- [x] Change 10: Remove all IncidentFox references

## Batch 3 (Depends on Change 6)
- [x] Change 7: Replace "Schedule Demo" with "Contact Us" + wire modal
g
## Batch 4: SEO
- [x] C1: Create OG image + wire globally
- [x] C2: Create logo.png for structured data
- [x] C3: Image optimization check
- [x] I1: Add x-default hreflang
- [x] I2: Fix sitemap lastModified
- [x] I3: Add Twitter card to /vs/* pages
- [x] I4: Create favicon.ico
- [x] I5: Create apple-touch-icon.png
The co
## Verification
- [x] pnpm turbo check-types — no type errors
- [x] pnpm exec biome check --write . — fix lint issues
- [x] pnpm turbo build — clean build
- [x] Playwright test key pages + screenshots

PIECEBYPIECE — DEVELOPMENT BUILD 13
==================================

This is an evolving development project, not yet the finished public platform.

WHAT IS INCLUDED
- Responsive PieceByPiece homepage and organizer workspace.
- Supabase organizer sign-up, sign-in, and session handling.
- Online experience drafts and private source-image uploads.
- Secure Netlify Functions for participant invitations, launch, invitation validation, and reveals.
- High-entropy participant tokens; only SHA-256 token hashes are stored in the database.
- Server-side image cropping into private WebP puzzle tiles using Sharp.
- Automatic piece assignment and participant-specific reveal links.
- Organizer-selected grid rows/columns with a suggested layout based on image shape and piece count.
- Direct reveal or challenge mode with a custom prompt and participant confirmation.
- A two-step participant reveal page. Each participant can reveal only their assigned pieces.
- Public shared board that displays revealed tiles only, with unrevealed positions kept blank.
- Organizer management page with participant progress, adding participants, manual piece reassignment, and removing participants who have not revealed any pieces.
- Organizer settings for completion message and experience expiry.
- Regenerate a participant invitation link if the original is lost; the previous token is invalidated.
- Optional participant-name display is controlled by the experience setting (off by default).
- Supabase SQL schema, owner Row Level Security, and private Storage buckets.

WHAT MUST BE CONFIGURED
1. Create a Supabase project and run supabase/schema.sql.
2. Set the Supabase URL and public anon/publishable key in public/supabase-config.js.
3. Set SUPABASE_URL, SUPABASE_ANON_KEY, and SUPABASE_SERVICE_ROLE_KEY as Netlify environment variables. The service-role key must stay server-side and must never be pasted into chat or browser files.
4. Install dependencies with npm install.
5. Use Netlify Dev (npm run dev) to test the Netlify Functions locally.

IMPORTANT LIMITATIONS
- The public board refreshes automatically about every 20 seconds and can also be refreshed manually. Supabase Realtime subscriptions are a later improvement.
- Activity history, board sharing, manual piece reassignment, and participant management are included. Email/WhatsApp notifications, Paystack payments, and native Supabase Realtime subscriptions are not yet implemented.
- The participant page and server functions have passed syntax/static checks, but have not been tested against a live Supabase project or deployed Netlify site.

NEXT MILESTONES
1. Notifications and additional organizer controls.
2. Supabase Realtime subscriptions and further performance testing.
3. End-to-end testing against a real Supabase project.
4. Netlify deployment and final consolidated ZIP.

Design direction: warm premium — cream, charcoal, deep green and restrained muted gold.

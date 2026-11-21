# PieceByPiece — Supabase setup and account connection

This build includes organizer accounts, online experience drafts, private image uploads, secure invitation tokens, server-side image slicing, configurable grid layout, direct/challenge reveal modes, launch controls, and a participant-specific reveal page. It remains a development build; the shared board refreshes automatically, while native Supabase Realtime subscriptions and notifications are still future work.

## 1. Create your Supabase project
1. Create a project at https://supabase.com/.
2. In **Project Settings → API**, copy the Project URL and the public publishable/anon key.
3. In Authentication → URL Configuration, add your local website URL and your future Netlify URL to the allowed redirect URLs. For local testing, use a local web server rather than opening files with `file://`.

## 2. Create the database and private image bucket
1. Open **SQL Editor** in Supabase.
2. Open `supabase/schema.sql` from this project.
3. Run the complete SQL file. It creates the tables, organizer access rules, a private `experience-images` bucket, and a private `experience-pieces` bucket for cropped tiles. If you previously ran an earlier version of the schema, run the updated SQL again; it adds the `image_piece_path` column and the new bucket.

## 3. Configure the website
1. Open `public/supabase-config.js`.
2. Set `window.PBP_SUPABASE_URL` to your project URL.
3. Set `window.PBP_SUPABASE_ANON_KEY` to the public publishable/anon key.
4. Do not put a `service_role` secret in this file. Never send that secret in chat or commit it to the project.

## 4. Install and run the project
1. Install Node.js (LTS).
2. In the project folder, run `npm install`.
3. Copy `.env.example` to a new file named `.env`. Fill in `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` in `.env` for local server functions. The `.gitignore` file excludes `.env`; never upload it to GitHub.
4. Run `npm run dev` to start Netlify Dev, which serves the website and its server functions together.
5. Use the local address shown by Netlify Dev. Do not open the HTML files directly with `file://`.

## 5. Test the organizer account flow
1. Start the project with `npm run dev` so the secure server functions are available.
2. Open `auth.html`, create an account, and confirm your email if Supabase requires it.
3. Sign in. The organizer page should show your signed-in email.
4. Create a test experience with a JPG, PNG, or WebP image no larger than 8MB.
5. Check Supabase **Table Editor → experiences** and **Storage → experience-images**. You should see the saved draft record and a private image under your user-ID folder.
6. Add participant names (no more names than puzzle pieces), choose a direct reveal or challenge prompt, set the suggested or custom grid rows/columns, choose **Automatic assignment** or **Manual assignment (adjust before launch)**, and create the experience. Manual mode starts with a balanced distribution that you can change from Manage before launch. The invitation links are displayed for copying; if a link is lost, generate a replacement from Manage (the old link will stop working).
7. Use **Launch experience** after the links have been created. Each participant can then open their own link and reveal only their assigned tile.
8. The organizer and participants can open the public board link to see the picture develop. The board does not reveal the original full image or unrevealed tiles.

## What this build saves online
- Organizer sign-up and sign-in through Supabase Auth.
- Experience title, image dimensions, grid layout, piece count, assignment/reveal mode, challenge prompt, completion message, expiry, and status in `public.experiences`.
- Uploaded source image in the private `experience-images` bucket.
- Cropped private puzzle tiles in `experience-pieces`.
- Participant records, hashed invitation tokens, piece assignments, reveal timestamps, and activity events.
- Owner-only organizer access enforced by Row Level Security and Storage policies.

## Netlify server-side environment variables
In Netlify → Site configuration → Environment variables, add these values. The project dependencies, including Sharp for image cropping, are installed from package.json during deployment:
- `SUPABASE_URL` — your Supabase project URL
- `SUPABASE_ANON_KEY` — the public anon/publishable key
- `SUPABASE_SERVICE_ROLE_KEY` — the private service-role key, stored only in Netlify and never in browser files or chat

The invitation function verifies the signed-in organizer, checks ownership of the draft experience, creates high-entropy invitation tokens, stores only SHA-256 token hashes, crops the uploaded image into private WebP tiles, and assigns every piece to a participant. The raw invitation links are returned to the organizer for copying. The organizer can then launch the experience. Manual piece reassignment is available from the management page before or after launch, provided a piece has not been revealed. Challenge mode asks participants to confirm they completed the prompt; it does not automatically grade answers.

## What is not yet connected
- The board refreshes automatically about every 20 seconds and can also be refreshed manually. Supabase Realtime subscriptions are a later improvement.
- Email/WhatsApp notifications, Paystack checkout, and native Supabase Realtime subscriptions are not yet connected. The management page includes participant progress, activity history, adding/removing participants, invitation regeneration, manual reassignment of unrevealed pieces, and expiry/completion settings.
- No production deployment has been performed or tested yet.

## Security notes
The browser uses only the public Supabase key. Row Level Security restricts organizer data to the signed-in owner. Both image buckets are private. Invitation tokens are generated on the server; only token hashes are stored. The service-role key is used only by Netlify Functions and must never be placed in frontend code.

# PieceByPiece — deployment guide

This guide is for putting the project online with Netlify and Supabase. You will need your own accounts. Do not send passwords, access tokens, or the Supabase service-role key to anyone.

## A. Prepare Supabase

1. Create a Supabase project.
2. Open **SQL Editor** and run the complete `supabase/schema.sql` file from this project.
3. In **Project Settings → API**, copy the Project URL and the public anon/publishable key.
4. Open `public/supabase-config.js` in the project and enter those two public values as `PBP_SUPABASE_URL` and `PBP_SUPABASE_ANON_KEY`.
5. Keep the service-role key private. It does not belong in `public/supabase-config.js`.

## B. Put the project in GitHub

1. Create a new private GitHub repository for PieceByPiece.
2. Upload the complete contents of this project folder to the repository root. Keep `public/`, `netlify.toml`, `package.json`, `supabase/`, and `netlify/` in their original places.
3. Do not upload real passwords or private keys. The project template contains no real Supabase credentials.

## C. Deploy with Netlify

1. Sign in to Netlify and choose **Add new site → Import an existing project**.
2. Connect GitHub and select the PieceByPiece repository.
3. Netlify reads the settings in `netlify.toml`. The build command is `npm run build`, the publish folder is `public/`, and server functions are in `netlify/functions`.
4. In Netlify site settings, open **Environment variables** and add:
   - `SUPABASE_URL` — the Supabase Project URL
   - `SUPABASE_ANON_KEY` — the public anon/publishable key
   - `SUPABASE_SERVICE_ROLE_KEY` — the private service-role key
5. Save the variables and trigger a new deploy.

The service-role key must exist only in Netlify's server-side environment. Never put it in a website file, GitHub, or a browser variable. For local testing, copy `.env.example` to `.env` and enter the same server-side values there; `.env` is excluded by `.gitignore`.

## D. Finish the Supabase sign-in settings

1. Copy the Netlify site URL, for example `https://your-site-name.netlify.app`.
2. In Supabase, open **Authentication → URL Configuration**.
3. Set the site URL to your Netlify URL and add `https://your-site-name.netlify.app/organizer.html` to the allowed redirect URLs. For local Netlify Dev testing, also allow `http://localhost:8888/organizer.html`. Replace the example domain with your actual Netlify site address.
4. Save the settings.

## E. Test the live site

1. Open the Netlify URL and go to the organizer sign-in page.
2. Create an organizer account and complete email confirmation if Supabase requests it.
3. Sign in and create a small test experience with a test image.
4. Copy each participant's private invitation link and launch the experience.
5. Open a participant link in a separate browser or phone and reveal the assigned piece.
6. Open the shared board link and confirm that only revealed pieces appear.
7. Test the organizer management page: reassign an unrevealed piece, generate a replacement invitation link, and set an expiry time.

## Important

This guide describes the intended deployment process. The project has not yet been deployed to your Netlify account or connected to a live Supabase project from this workspace. Complete the steps above and test with a small experience before using it for a real event.

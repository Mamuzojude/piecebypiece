# PieceByPiece — current development checks

## Checks completed in this workspace

- `npm run build` passes. It runs Node.js syntax checks over the organizer, participant, board, management, and Netlify Function JavaScript files.
- All six HTML pages in `public/` were parsed successfully with Python's HTML parser.
- The image-processing function was exercised with a generated test image using Sharp. Five cropped tiles were created, and the combined tile areas covered the full source image without leaving an uncovered strip.
- Custom grid layouts were exercised: 2 × 3, 1 × 5, and 5 × 1 for a five-piece image. Each layout covered the full source image.
- Mocked server-function checks were exercised for invitation generation, launch, participant validation, reveal, public board data, adding participants, removing participants, manual reassignment, settings updates, and invitation regeneration.
- Challenge mode was checked: the reveal endpoint rejects a reveal without participant confirmation and accepts the confirmed request.

## Not yet verified

- No live Supabase project has been connected from this workspace.
- The SQL schema and its server-only Postgres functions have not been executed against a real Supabase database here.
- No live Netlify deployment has been made.
- No complete browser-based end-to-end event has been run with real organizer and participant accounts.
- Email/WhatsApp notifications and Paystack payments are not included in this development milestone.

These checks are useful development verification, not a claim that the production platform is already deployed or fully proven. Complete the live setup and test with a small experience before using PieceByPiece for a real event.

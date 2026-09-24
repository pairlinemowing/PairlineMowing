# Pairline Mowing website setup

This package is a static GitHub Pages site with an optional free Supabase backend for the private owner dashboard.

## What is already included
- Pairline Mowing logo at the top of Home.
- Black/grass-green design with high-contrast text.
- Home, Services, Our Work, Reviews, Service Area, Contact.
- The two provided Our Work photos.
- The three customer reviews supplied in the conversation.
- Owner / Co-Owner phone labels everywhere the numbers appear.
- Working call, text, email, Facebook and Instagram links.
- Get a Quote on Home and Contact.
- Private owner dashboard at `/admin.html` (not linked from the public navigation).
- Google sign-in architecture through Supabase.
- Owner-only database/storage policies.

## Free hosting
GitHub Pages is available for public repositories on GitHub Free. This project is designed for that setup.

## One-time owner dashboard setup
1. Create a free Supabase project at https://supabase.com/.
2. In Supabase, open SQL Editor and paste the entire `supabase/schema.sql` file.
3. BEFORE running it, replace every `REPLACE_WITH_OWNER_GOOGLE_EMAIL` with the exact Google account email that should be allowed to edit.
4. Open Authentication -> Providers and enable Google.
5. Follow Supabase's Google sign-in setup instructions to create the Google OAuth client and add your website URL as an authorized origin/redirect as instructed by Supabase.
6. In Supabase Project Settings/API, copy the project URL and the publishable/anon key.
7. Open `config.js` and set:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `OWNER_EMAIL`
8. Replace `GOOGLE_REVIEW_URL` with the actual Google Business Profile/review URL when you have it. The current value is only a Google search fallback because the exact listing URL was not supplied.
9. Upload the whole folder to your GitHub repository.
10. Enable GitHub Pages from the repository Settings -> Pages.

## Important security rules
- Never put a Supabase `service_role` key in `config.js`.
- The publishable/anon key is intended for browser use; the database and storage policies are what prevent unauthorized edits.
- Do not add a password or secret to the HTML/JavaScript.
- The dashboard checks the signed-in Google account against `OWNER_EMAIL`, and Supabase Row Level Security independently checks the authorized email before allowing writes.
- GitHub Pages is a static host. Supabase provides the authentication/database/storage layer for the owner dashboard.

## Editing
Once Supabase is configured, visit:
`https://YOUR-GITHUB-USERNAME.github.io/YOUR-REPOSITORY/admin.html`

Sign in with the authorized Google account. You can edit services, gallery photos, displayed reviews, service-area wording, and the Google review link.

## Adding more photos
In Owner Dashboard -> Our Work -> Add photo, select an image, give it a caption, choose whether it is published, and save the gallery. The image is uploaded to Supabase Storage and can be displayed without changing the HTML.

## Note about the supplied reviews
The review text in this package is the customer-provided text from the conversation. Do not add fabricated reviews or change a customer's words in a way that would misrepresent their statement.

# Flight Academy — Forward…Fast

Mobile-friendly site for the Fairborn Flight Academy:

- **Public cover page**: logo, mission, session agenda, the 7 development categories, and the Code of Conduct.
- **Coach portal** (login required): athlete profiles, an exercise library and a drill library (the paper forms from the program PDF), session score sheets, and athlete development tracking with personal bests and trend charts.

Stack: React + Vite (static site) → **GitHub Pages**, with **Supabase** (free tier) for login, the database, and setup-photo storage.

---

## How information gets entered

The app follows the paper forms in the program binder:

| Paper form | In the app | What's stored |
|---|---|---|
| **New Exercise** sheet | Exercises → New exercise | Title, date, setup notes + photo/diagram, up to 6 steps, distance / time / # per rep, **one** category |
| **New Drill** sheet | Drills → New drill | Title, date, setup, up to 6 exercises in order (picked from the library), up to 6 steps, **up to 3** categories ranked by intent |
| **Score sheet** (Coach / Date / 24 athletes × 6 Conditioning + 3 Measure) | Sessions → New session → enter scores | Each column = a drill or exercise + unit (reps, seconds, meters, yards, inches, lbs) + whether higher or lower is better. Each cell is one result. |

**Scoring on a phone:** "One at a time" mode shows one drill with every athlete listed underneath, so a coach at a station types a number and taps Enter to jump to the next athlete. "Full sheet" mode shows the whole grid, like the paper form, and works best on a tablet or laptop.

**Development tracking:** results for the same drill/exercise and unit are grouped across sessions. Each athlete's profile shows their latest result, personal best, change since their first test, a trend chart, and a summary by the 7 categories. Results can be exported to CSV for one athlete or for everyone.

---

## One-time setup

### 1. Create the Supabase project (free)
1. Go to <https://supabase.com/dashboard> → **New project**, and name it `flight-academy`. Keep it separate from other projects.
2. When it's ready, open **SQL Editor → New query**, paste all of [`supabase/schema.sql`](supabase/schema.sql), and click **Run**.
3. Go to **Project Settings → API** (or **API Keys**) and copy the **Project URL** and the **anon / publishable** key.
4. Go to **Authentication → URL Configuration**:
   - **Site URL**: `https://julius2427.github.io/flight-academy/` (or your custom domain later)
   - **Redirect URLs**: add the same URL, plus `http://localhost:5173/` for local testing.

### 2. Run locally (optional)
```bash
cp .env.example .env        # paste the URL + key into .env
npm install
npm run dev                 # http://localhost:5173
```

### 3. Deploy on GitHub Pages
1. In the repo, go to **Settings → Secrets and variables → Actions** and add two repository secrets:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
2. Go to **Settings → Pages → Build and deployment** and set Source to **GitHub Actions**.
3. Push to `main`. The workflow in `.github/workflows/deploy.yml` builds and publishes the site.

### 4. First login
The **first account created becomes the admin.** Every account after that starts as *Pending* and sees no athlete data until an admin approves it under **Coaches**.

---

## Moving to a custom domain later
The build uses relative paths and hash-based routes (`/#/app/...`), so the same build works on any domain.
1. Add a file `public/CNAME` containing just the domain (e.g. `flightacademy.org`), then commit and push.
2. Point the domain's DNS at GitHub Pages (see GitHub's "Managing a custom domain" docs), then set the domain under **Settings → Pages**.
3. In Supabase **Authentication → URL Configuration**, change the Site URL and add the new domain to Redirect URLs.

No code changes are needed.

---

## Privacy & the athlete/parent roadmap
- Athletes are minors, so **every table has row-level security**. The browser key alone can read nothing.
- **Today:** only approved coaches and admins can read or write data.
- **Later (athlete/parent logins):** the database already has roles `athlete` and `guardian` plus an `athlete_access` table that links a login to one or more athletes. Every policy checks `can_view_athlete()`, so once those rows exist, an athlete or parent automatically sees **only their own** results and sessions, with no policy rewrites. The remaining work is a small "My progress" screen in the app and an admin screen to link accounts.
- Setup photos are stored in a **private** bucket and shown through short-lived signed links.

## Project layout
```
supabase/schema.sql      database tables, security policies, seed data
src/pages/Cover.tsx      public cover page (PDF pages 1–5)
src/pages/*Form.tsx      exercise / drill / athlete forms (PDF pages 7–8)
src/pages/SessionScore   score sheet entry (PDF page 9)
src/pages/AthleteDetail  development tracking, personal bests, charts
public/logo.png          logo from PDF page 1
```

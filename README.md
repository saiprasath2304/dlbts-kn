# DLBTS KN 2026 – Judging

<img src="static/logo.png" alt="Sri Sathya Sai Balvikas" width="96" align="right" />

Online judging for DLBTS KN: judges enter marks on their phones (English or தமிழ்),
marks save automatically even if the network drops, and organisers see progress live,
finalize results and download PDF reports.

**Live site:** <https://dlts-kn.vercel.app>
**GitHub repository:** `dlts-kn` · **Vercel project:** `dlts-kn` · **Supabase project:** `dlts-kn`

---

## Set it up (first time)

You need free accounts on **GitHub**, **Vercel** and **Supabase**. No Docker, no servers.

### 1. Supabase (database + logins)

Follow **[SUPABASE_SETUP.md](SUPABASE_SETUP.md)**. You will run two SQL files that create
everything: 5 groups, 37 events with criteria, the `admin` account and 74 judge accounts.

### 2. GitHub

Create a repository named **`dlts-kn`** and push this folder to it:

```bash
git remote add origin https://github.com/<your-github-user>/dlts-kn.git
git push -u origin main
```

### 3. Vercel (the website)

1. <https://vercel.com/new> → **Import** the `dlts-kn` repository.
2. **Project name:** `dlts-kn` → the site will be at **https://dlts-kn.vercel.app**
   (Vercel uses the project name for this address).
3. Framework is detected as SvelteKit. Leave build settings as they are.
4. **Environment Variables** – add these four (values from SUPABASE_SETUP.md, step 5):

   | Name                              | Value                       |
   | --------------------------------- | --------------------------- |
   | `PUBLIC_SUPABASE_URL`             | `https://xxxx.supabase.co`  |
   | `PUBLIC_SUPABASE_PUBLISHABLE_KEY` | `sb_publishable_…`          |
   | `SUPABASE_SERVICE_ROLE_KEY`       | `sb_secret_…` (keep secret) |
   | `AUTH_EMAIL_DOMAIN`               | `judges.invalid`            |

5. **Deploy.** Open <https://dlts-kn.vercel.app> and sign in as `admin`.

Every later push to GitHub redeploys automatically.

## Logins

| Who    | Username                                               | Password                                                       |
| ------ | ------------------------------------------------------ | -------------------------------------------------------------- |
| Admin  | `admin`                                                | the one you set in the SQL file                                |
| Judges | `judge<NN><group><event>` e.g. `judge01grp2slokagirls` | same with `pwd` instead of `judge`, e.g. `pwd01grp2slokagirls` |

Group codes: `grp1` Group 1 · `grp2` Group 2 · `grp3` Group 3 · `team` Team Events ·
`gevent` Group Events. Full list for printing: **[docs/JUDGE_LOGINS.md](docs/JUDGE_LOGINS.md)**.

The admin can change any judge's password and display name under **Judges**.

## Events

| Group                                 | Events (2 judges each)                                                                                                                                   |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Group 1** – boys and girls together | Sloka Chanting, Veda Chanting, Tamil Chant, Story Telling, Fancy Dress, Drawing, Bhajan Singing                                                          |
| **Group 2**                           | Sloka, Veda, Tamil Chant, Bhajan – _boys and girls separate_; JAM English, JAM Tamil, Drawing – _together_; Dumb Charades – _teams of 2 boys or 2 girls_ |
| **Group 3**                           | Sloka, Veda, Tamil Chant, Bhajan – _boys and girls separate_; TED SAI English, TED SAI Tamil, Drawing – _together_                                       |
| **Team Events**                       | Wealth out of Waste, Quiz, Rangoli                                                                                                                       |
| **Group Events**                      | Altar Decoration, Namakam Chanting – _boys and girls separate_                                                                                           |

## On the day

**Before judging**

1. **Settings** – event name and year (shown as “DLBTS KN 2026”), default language.
2. **Events** – check each event's criteria and maximum marks.
3. **Participants** – add them, or **Import** a CSV/Excel file (download the template there).
4. Optionally rename judges to their real names under **Judges**.

**During judging**

- **Dashboard** shows each event: how many judges have submitted, live.
- Judges sign in, see only their own events, enter marks, then **Review and submit**.
  After submitting, marks are locked; a judge can ask to reopen (you approve under **Requests**).

**Results**

- **Results** → an event appears once both judges have submitted. Ties are flagged – choose
  the ranks and give a reason. Then **Finalize**.
- **Reports** → download the PDF (English or Tamil, with or without each judge's marks).

**Next year**

- **Settings** → change the year → **Reset for a new year** (type `RESET`). Participants
  and marks are deleted; events, criteria, judge usernames and passwords stay.

## Changing the logo or name

- Name and year: **Settings** in the app.
- Logo: replace `static/logo.png` (square PNG) and push to GitHub.

## Updating the event list

The groups, events, criteria and judge accounts come from `scripts/dlbts-kn-2026.ts`.
Small changes are easiest in the app: **Events** (groups, events, criteria, and which judges and participants are in each event) and **Judges**. For bigger
changes, edit that file, run `npm run setup:sql`, and run the new
`supabase/setup/02_dlbts_kn_2026.sql` again in the Supabase SQL editor (it only adds or
renames, never deletes).

## Running it on your own computer (optional)

```bash
npm install
cp .env.example .env     # fill in the same four values as in Vercel
npm run dev              # http://localhost:5173 (uses your cloud Supabase)
```

Needs Node.js 22.18 or newer.

---

Developers: architecture, security model, automated tests (which use Docker) and other
hosting options are in **[docs/TECHNICAL.md](docs/TECHNICAL.md)**.

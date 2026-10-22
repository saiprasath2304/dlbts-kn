# Supabase setup – DLBTS KN 2026

Everything happens in the Supabase website (cloud). No Docker, no command line.
Takes about 15 minutes.

You will run **two SQL files** from this repository:

| Step | File                                  | What it does                                                                                                                                 |
| ---- | ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | `supabase/setup/01_schema.sql`        | Creates all tables, security rules and functions                                                                                             |
| 2    | `supabase/setup/02_dlbts_kn_2026.sql` | Creates the 5 groups, 37 events, their criteria, the **admin** account and **74 judge** accounts (2 per event), and assigns judges to events |

---

## 1. Create the project

1. Go to <https://supabase.com/dashboard> and sign in.
2. **New project**
   - Name: `dlts-kn`
   - Database password: choose a strong one and keep it safe (you will rarely need it)
   - Region: **South Asia (Mumbai)** – closest to Tamil Nadu
3. Wait until the project shows as ready (1–2 minutes).

## 2. Authentication settings

Left menu → **Authentication**.

1. **Sign In / Providers** (or **Providers**):
   - **Allow new users to sign up** → **OFF** (only the admin creates accounts)
   - **Email** provider → keep **Enabled**
   - **Confirm email** → **OFF**
   - Save.
2. **Rate Limits**:
   - **Rate limit for sign ups and sign-ins** → set to **300** (per 5 minutes) and save.
     All logins pass through the app server, so Supabase sees one address for every judge;
     the default (30) can block judges who log in at the same time.
3. **URL Configuration**:
   - **Site URL** → `https://dlts-kn.vercel.app`
   - Save.

Nothing else is needed: no SMTP, no email templates. The app never sends login emails.

## 3. Create the database (file 1)

1. Left menu → **SQL Editor** → **New query**.
2. Open `supabase/setup/01_schema.sql` from this repository, copy **all** of it, paste it in.
3. Click **Run**. It should finish with “Success. No rows returned”.

Run this file **once**, on the new empty project.

## 4. Create events and accounts (file 2)

1. **SQL Editor** → **New query**.
2. Open `supabase/setup/02_dlbts_kn_2026.sql`, copy all of it, paste it in.
3. **Before running**, find this line near the top and replace `CHANGE-ME` with the admin
   password you want (at least 8 characters):

   ```sql
   v_admin_password text := 'CHANGE-ME';   -- <<< CHANGE THIS
   ```

4. Click **Run**. The result shows a table of all 37 events with `2` judges each.

This file is safe to run again later (for example after adding an event to it): existing
accounts and events are kept, nothing is deleted.

### What was created

- **Admin:** username `admin`, the password you typed.
- **Judges:** username `judge<number><group><event>`, password = the same with `judge`
  replaced by `pwd`.

  | Username                | Password              | Event                                     |
  | ----------------------- | --------------------- | ----------------------------------------- |
  | `judge01grp1sloka`      | `pwd01grp1sloka`      | Group 1 – Sloka Chanting, judge 1         |
  | `judge02grp2slokagirls` | `pwd02grp2slokagirls` | Group 2 – Sloka Chanting – Girls, judge 2 |
  | `judge01teamquiz`       | `pwd01teamquiz`       | Team Events – Quiz, judge 1               |

  Group codes: `grp1`, `grp2`, `grp3`, `team` (Team Events), `gevent` (Group Events).
  The full printable list is in [`docs/JUDGE_LOGINS.md`](docs/JUDGE_LOGINS.md).

- **Criteria** for every event, copied from DLBTS 2025 (e.g. Sloka Chanting: Bhaavam 5,
  Tune 5, Pronunciation 10, Memory 10). Check them in the app under **Events** and change
  any before judging starts. _Dumb Charades_ has a single placeholder criterion
  (“Accurate Guessing”, out of 10) – please set the real ones.

- **Participants:** none yet. Add them in the app (**Participants** → add, or **Import** a
  CSV/Excel file).

## 5. Copy the keys for the app

Left menu → **Project Settings** → **API Keys** (and **Data API** for the URL).

| Copy this                                | Into this variable (Vercel → Settings → Environment Variables) |
| ---------------------------------------- | -------------------------------------------------------------- |
| Project URL (`https://xxxx.supabase.co`) | `PUBLIC_SUPABASE_URL`                                          |
| **Publishable** key (`sb_publishable_…`) | `PUBLIC_SUPABASE_PUBLISHABLE_KEY`                              |
| **Secret** key (`sb_secret_…`)           | `SUPABASE_SERVICE_ROLE_KEY`                                    |

Also add `AUTH_EMAIL_DOMAIN` = `judges.invalid` (it must match the SQL files).

The secret key gives full access to the database: put it only in Vercel's environment
variables, never in code, chat messages or screenshots.

---

## Managing accounts with SQL (optional)

The admin can do all of this in the app (**Judges** page). If you prefer SQL, open
**SQL Editor** and run:

```sql
-- New judge account
select public.create_account('judge03grp1sloka', 'pwd03grp1sloka', 'Judge 3 · Group 1 · Sloka Chanting', 'judge');

-- Assign that judge to an event
insert into public.judge_assignments (event_id, judge_id)
select e.id, p.id
from public.events e join public.groups g on g.id = e.group_id, public.profiles p
where g.code = 'grp1' and e.code = 'sloka' and p.username = 'judge03grp1sloka'
on conflict (event_id, judge_id) do nothing;

-- Change a password (judge or admin)
select public.set_account_password('judge01grp1sloka', 'new-password');

-- A second admin
select public.create_account('admin2', 'a-strong-password', 'Second Admin', 'admin');

-- Rename a judge (show their real name in the app)
update public.profiles set display_name = 'Mrs. Lakshmi' where username = 'judge01grp1sloka';
```

These functions only work from the SQL Editor; they cannot be called from the internet.

## Starting a new year

In the app: **Settings** → change **Year** → **Reset for a new year** (type `RESET`).
This deletes participants, marks, submissions, requests and results, and keeps groups,
events, criteria, judge usernames, passwords and assignments. Download your reports first.

## Backups

- Before and after the event day: **Database** → **Backups** (paid plans have daily
  backups). On the free plan, download the PDF reports and the participant export from
  the app as your copy.
- The app never deletes mark history; only the yearly reset removes data.

## If something goes wrong

| Problem                                   | Fix                                                                                      |
| ----------------------------------------- | ---------------------------------------------------------------------------------------- |
| Step 3 fails with “already exists”        | File 1 was already run. Use a new empty project, or skip step 3.                         |
| Step 4 says “Please set v_admin_password” | Change `CHANGE-ME` at the top of file 2.                                                 |
| Login fails for everyone                  | Email provider is disabled, or `AUTH_EMAIL_DOMAIN` in Vercel is not `judges.invalid`.    |
| Login says “Too many attempts”            | Wait a few minutes; raise the rate limit (step 2).                                       |
| A judge forgot the password               | Admin → **Judges** → the judge → **Set new password** (or `set_account_password` above). |

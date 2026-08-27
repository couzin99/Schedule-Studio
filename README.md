# Teacher Schedule Manager

A simple web application for managing teacher schedules with automatic conflict detection.

## Features

✅ **Add New Schedules** - Create one class assignment with as many weekly day/time/building/room meetings as needed.

✅ **Conflict Detection** - Automatically detects:
- **Teacher Conflicts**: Prevents the same teacher from being scheduled at two different places at the same time
- **Room Conflicts**: Prevents the same room from being double-booked at the same time
- **Section Conflicts**: Prevents a section from having overlapping classes
- The same subject can be scheduled for the same section and teacher on multiple different days.

✅ **Real-time Notifications** - Get error messages when trying to add conflicting schedules

✅ **Multiple Views**:
- **Teacher View**: See all schedules grouped by teacher with conflict warnings
- **All Schedules View**: See all schedules in a sortable list

✅ **Conflict Highlighting** - Conflicting schedules are highlighted in red for easy identification

✅ **Data Persistence** - All schedules are saved in your browser's local storage

✅ **Easy Management** - Delete schedules with a single click

## How to Use

### 1. **Open the Application**
   - Simply open `index.html` in any web browser

### 2. **Add a Schedule**
    - Fill in the class details on the left side:
     - **Teacher Name**: Enter the teacher's full name (e.g., "Juan Dela Cruz")
     - **Subject**: Enter the subject being taught (e.g., "Mathematics")
   - For each weekly meeting, select one or more **Days**, **Start Time**, **End Time**, **Campus Building**, and **Room**. For example, check both Monday and Thursday when the class meets at the same time on both days.
   - Click **"Add another meeting"** when another day needs a different time, building, or room. There is no limit to the number of meeting rows.
   - Click **"Add Schedule"** to add the schedule

### 3. **Conflict Detection**
   - If there's a conflict (same teacher, same room, or same section booked twice in overlapping times on the same day), you'll see an error message
   - The system **won't allow you to add the schedule** until the conflict is resolved
   - Example error messages:
     ```
     ⚠️ Conflict detected!
     
     Teacher conflict: Juan Dela Cruz is already scheduled for 
     Mathematics in Room 101 from 8:00 AM to 9:00 AM.
     ```

### 4. **View Schedules**
   
   **By Teacher (Default View)**:
   - Click the **"By Teacher"** tab
   - See all teachers listed with their schedules
   - Teachers with conflicts show a **⚠️ CONFLICT** badge
   - A red warning message appears: "This teacher has X scheduling conflict(s). Please fix before confirming."
   - Conflicting schedule rows are highlighted in red

   **All Schedules View**:
   - Click the **"All Schedules"** tab
   - See all schedules in chronological order (sorted by day and time)
   - Conflicting schedules are highlighted in red
   - Shows which schedules have conflicts at a glance

### 5. **Delete a Schedule**
   - Click the **"Delete"** button next to any schedule
   - Confirm the deletion when prompted
   - The schedule will be removed and other schedules will update automatically

## Time Range

- **Operating Hours**: 7:00 AM to 7:00 PM
- **Days**: Monday through Saturday (Sunday is not included)
- The system enforces that all classes must fall within this time window

## Example Workflow

1. Add Teacher A for Math for section BSCE-1A on Monday 8:00 AM - 9:00 AM in Room 101
   ✓ Success

2. Click **"Add another meeting"** and add the same Math class on Thursday 10:00 AM - 11:00 AM in Room 102
   ✓ Success: one subject can meet on multiple days

3. Try to add Teacher A for Science on Monday 8:30 AM - 9:30 AM in Room 102
   ✗ Error: Teacher conflict detected!

4. Delete the first schedule and try again
   ✓ Success

5. Now add another teacher for Math on Monday 8:00 AM - 9:00 AM in Room 101
   ✗ Error: Room conflict detected!

## Data Storage

All schedules are automatically saved to your browser's local storage. This means:
- Your schedules persist even if you close and reopen the browser
- Data is stored locally on your computer
- Clearing browser history/cache may delete your schedules

## Browser Compatibility

Works on all modern browsers:
- Chrome
- Firefox
- Safari
- Edge

## Notes

- Teacher names and room names are case-insensitive (e.g., "juan dela cruz" = "Juan Dela Cruz")
- The system checks for overlapping times, not just exact matches
- You can have the same subject taught by different teachers or in different rooms without conflicts

## Logo / Background Image

- To use the attached institution image as the subtle page background, place the image file in the project at `assets/logo.png` (create the `assets` folder if missing). The CSS already references `assets/logo.png`.

## Deployment (share a link)

You can host this as a static website and share a link with your colleague. Two easy free options:

1) GitHub Pages
   - Create a GitHub repository and push the project files.
   - In the repository settings enable **Pages** and select the `main` (or `master`) branch and folder (`/root`). GitHub will publish the site at `https://<your-username>.github.io/<repo>`.

2) Netlify (recommended for simple drag-and-drop)
   - Create a free Netlify account.
   - Drag-and-drop the project folder (or connect your GitHub repo) into Netlify — it will give you a shareable URL.

Both options host static HTML/CSS/JS sites (no server required). Your colleague will open the shared link in their browser and use the app.

## Local sharing (alternative)

- If you prefer not to host, you can zip the project and send it to your colleague. They can open `index.html` in a browser directly.
- Or run a simple local server (recommended to avoid some browser restrictions):

```bash
# (Python 3) from the project folder
python -m http.server 8000
# then open http://localhost:8000 in the browser
```

## Next steps (I can help)

- I can add a small export/import button so your colleague can import schedules easily.
- Or I can set this up on GitHub Pages or Netlify for you and give you the live link — tell me which you prefer and I will walk you through required credentials.

## Supabase integration (optional)

You can enable remote sync using Supabase so lists (subjects, teachers, rooms, courses) can be shared across devices.

1. Create a project on https://supabase.com and copy the Project URL and ANON public key.
2. In the project SQL editor create four simple tables (or run these SQL commands):

```sql
create table subjects (id serial primary key, name text unique);
create table teachers (id serial primary key, name text unique);
create table rooms (id serial primary key, name text unique);
create table courses (id serial primary key, name text unique);
-- schedules table (optional): store full schedule rows if you want server-side persistence
create table schedules (
   id bigint primary key,
   teacherName text,
   subject text,
   courseYear text,
   courseCode text,
   units integer,
   building text,
   overload text,
   day text,
   startTime text,
   endTime text,
   room text
);
```

3. Copy `supabase-config.example.js` to `supabase-config.js` in the project root and replace the placeholders with your Project URL and ANON key. Keep `supabase-config.js` private (don't commit it).

4. Open the site in a browser. Click **Connect** in the header to paste keys manually, or let the app load `supabase-config.js` if present. Use **Sync Now** to pull lists from Supabase.

Notes:
- The app tries to preserve the existing local lists and will merge remote names during sync (best-effort).
- Adding a subject locally will attempt to insert it into the `subjects` table when connected.

## Deploying (Netlify / Vercel)

For a static deployment you can use Netlify or Vercel. If you use environment variables instead of `supabase-config.js`:

- On Netlify set `SUPABASE_URL` and `SUPABASE_ANON_KEY` in Site settings → Build & deploy → Environment.
- On Vercel set the same in Project Settings → Environment Variables.

If you prefer, deploy the repository as-is and copy `supabase-config.js` into the published site (only for private deployments).

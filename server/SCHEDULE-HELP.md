# How to set your films and showtimes (server/schedule.json)

Every public cinema hall plays the same timetable. Showtimes are worked out from the clock, so nobody can pause,
skip or restart a show. Anyone who walks in late joins at the current moment of the film, like a real cinema.

## Two modes
"mode": "loop"   Films play one after another all day with a short break ("gapMinutes") between them.
                 The default file does this with the 60-second demo reel so you can see it working at once.
"mode": "daily"  Fixed showtimes every day in your timezone, for example 10:00, 14:00, 18:00, 21:30.

## Adding a real, full-length film
1. Put the film file somewhere that gives a DIRECT https link to a .mp4 (or .webm) that other websites may use.
   (Netflix, YouTube, Google Drive page links and similar do NOT work. Only show films you have the right to show.)
2. Test the link: in the game choose "Practice alone", press M, paste the link and press Play.
   If it plays on the big screen, it will work for everyone. If it plays in a small window instead, the host does not
   allow 3D-screen use but viewers can still watch.
3. Add it to "films" with its exact length in seconds. A 2 hour 15 minute film is 8100 seconds:
   { "id": "my-film", "title": "My Film", "description": "...", "year": 2025, "url": "https://example.com/film.mp4", "durationSec": 8100 }
4. For fixed showtimes use "mode": "daily" and list them. The film must finish before the next show starts:
   "daily": [ { "time": "14:00", "film": "my-film" }, { "time": "18:00", "film": "my-film" } ]
5. Restart the server (stop with Ctrl+C, then npm run dev again). On Render, upload the changed file to GitHub.

"preShowSeconds" is how long before the start the screen shows a countdown and the audience takes their seats.
Private rooms do not use this timetable: the host of a private room picks a film and presses Play.

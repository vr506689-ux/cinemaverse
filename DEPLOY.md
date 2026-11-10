# Putting CINEMAVERSE online for free (draft - not yet tested by me)

One free Render "web service" runs both the game and the multiplayer server, so players need only one link.

You need (no credit card to start, check their sign-up pages as terms change):
1. A free GitHub account (github.com)
2. A free Render account (render.com), sign in with GitHub

Steps
1. On GitHub click New repository, name it cinemaverse, keep it Public (or Private), create it.
2. Click "uploading an existing file". Drag in everything from this folder EXCEPT node_modules and dist. Commit.
3. On Render click New > Blueprint, pick your cinemaverse repository. It reads render.yaml and creates the service.
   (Or New > Web Service: Build command  npm install && npm run build   Start command  npm start   Plan: Free)
4. Wait for the first build (a few minutes). Render gives you a link like https://cinemaverse-xxxx.onrender.com
5. Open it, play, and share the link or room invite links.

Free-tier facts to know (Render, checked on its docs page; limits can change):
- A free service goes to sleep after about 15 minutes with no visitors and takes around a minute to wake up.
- The free filesystem is wiped on restart, and rooms live in memory, so rooms vanish on restart.
- Free usage is limited per month. If the game becomes popular you will need a paid plan or another host.


## Keeping it available when your computer is off
Once deployed, the game runs on Render, not on your computer. You can close the terminal and switch your PC off.
- Free service: sleeps after about 15 minutes with nobody connected, wakes in about a minute for the next visitor.
  Players who are connected (HTTP or WebSocket traffic) keep it awake.
- Optional free keep-awake: create a free account on an uptime-monitor website, add an HTTP monitor for
  https://YOUR-SITE.onrender.com/health with a 5 to 14 minute interval. One service kept awake all month uses about 720 of the 750 free hours,
  so run only ONE free service. Render can still restart it at any time (rooms reset), and pinging may be against Render's rules: check their terms.
- Truly always-on and no monthly limits: Render's paid Starter instance (about $7/month).


## Voice chat notes
- Browsers only allow the microphone on https pages (or localhost). Render gives you https automatically.
- Voice is peer to peer using free Google STUN servers. Most connections work; some mobile/strict networks need a TURN relay.
  Free TURN plans exist with monthly limits (check current terms before relying on one). To use one, set the Render environment variable
  ICE_SERVERS_JSON to something like:
  [{"urls":["stun:stun.l.google.com:19302"]},{"urls":"turn:YOUR-TURN-HOST:3478","username":"USER","credential":"PASSWORD"}]
- VOICE_MAX (default 8) sets how many people can be in voice in one room.

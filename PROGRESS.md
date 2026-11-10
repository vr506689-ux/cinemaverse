# CINEMAVERSE - Progress

## Phase 5 - Communication + view modes (this build)
Server voice signalling, whispers, and the theatre camera maths are tested in code. Real microphone/WebRTC audio and the
fullscreen buttons are NOT yet tested by me in real browsers or on phones - please test.
- [x] Voice chat (WebRTC, peer to peer, free): Join voice button, mic on/mute, leave voice, microphone-permission handling
      (if blocked you can still listen), speaking indicator above heads, push-to-talk option (hold B), open mic option
- [x] Public halls: proximity voice (louder when close, quieter behind a wall). Private rooms: everyone hears everyone
- [x] Up to 8 people in voice per room (peer-to-peer limit); text chat has no such limit
- [x] Mute a player (hides their chat and silences their voice), report, host remove
- [x] Private messages: type /w Name your message
- [x] Chat window toggle, timestamps, spam limit, word filter (already in earlier phases)
- [x] Fullscreen button / F key (phones: also tries landscape). iPhone Safari cannot do page fullscreen: use Share > Add to Home Screen
- [x] Hide UI button / H key: hides every control; tap or move the mouse to bring back a small bar
- [x] Theatre view button / T key: camera locks onto the big screen and fits it to ANY device shape (monitor, phone, tablet), UI hidden, fullscreen, film sound at full volume
- [ ] Voice needs https (or localhost). On a phone testing over http://192.168.x.x the microphone is blocked by the browser. It works once deployed.
- [ ] Without a TURN relay, voice can fail between some home/mobile networks. Server supports one via ICE_SERVERS_JSON (see DEPLOY.md).

## KEY REQUIREMENT (owner): films play without interruption, anyone can join, showtimes are shown
## Phase 4 - Cinema schedule + shared movie playback (this build)
Server logic tested (timetable, time zone, host controls, late join). Client timing logic tested in simulation.
The 3D screen, countdown signs and panels are NOT yet seen by me in a real browser.
- [x] Public halls follow a timetable (server/schedule.json). Everyone sees the same moment of the film. Nobody can pause or skip.
- [x] Anyone can walk in at any time: late joiners start at the current moment, like a real cinema
- [x] Showtimes everywhere: HUD banner (Now showing / Next: ... at 6:30 PM / starts in 1:50), the Movie panel timetable
      (next 8 shows in YOUR local time), the lobby digital board, and a countdown on the big screen before each show
- [x] Pre-show: screen shows title + countdown, the audience takes seats, lights half-dim; show starts, lights go down; after, lights up
- [x] Full-length films: streamed (never downloaded) so 2-3 hour films work; drift correction keeps everyone together
- [x] Private rooms: host picks a film (list or https link), Play / Pause / Seek / Stop, everyone follows, late joiners sync
- [x] If a film host blocks the 3D screen, the film plays in a small window instead
- [x] Clock sync between each browser and the server
- [ ] Needs YOUR film links (see server/SCHEDULE-HELP.md). Default timetable loops the 60-second demo reel every 4 minutes so you can see it work.
- [ ] Not possible for free: hosting big film files. A film needs a direct https link from somewhere you control or are allowed to use.

## KEY REQUIREMENT (owner): works all the time, even when the owner's computer is off
The game must be online 24/7 without the owner's terminal open. That means deploying the server to a free host
(see DEPLOY.md). Free-tier reality: a free Render service sleeps after 15 idle minutes and takes about a minute to
wake; a free monitor pinging /health every 5-14 minutes can keep ONE service awake (uses about 720 of the 750 free hours);
rooms still reset if the host restarts the service. Truly always-on without these limits needs a paid plan (about $7/month).

## KEY REQUIREMENT (owner): play FULL-LENGTH movies
The cinema must play full-length films (2 to 3 hours), for everyone in a room, in sync. Design for Phase 4:
- No length limit in the player. Video is streamed, never fully downloaded, so long films work.
- Source A (free, works today): host or each viewer opens the SAME film file from their own computer; the server only
  syncs play / pause / seek, so no upload or bandwidth cost. Everyone needs their own copy.
- Source B (free): a direct .mp4/.webm link that allows other sites to use it (own hosting, public-domain, licensed).
- Source C (free, limited): host streams the film live to a few friends peer-to-peer. Quality and audience size depend on the host's internet.
- Not possible for free: hosting large movie files for everyone to stream. Needs paid storage or a CDN.
- Only films you have the right to show. No Netflix/YouTube/DRM bypass.
- Must handle: join late (start at the right time), seek, pause, drift correction, reconnect without restarting.

## Phase 3 - Multiplayer (this build)
Server tested with simulated players (rooms, passwords, capacity, kick/ban, host hand-over, chat limits, cheat checks).
The in-game screens and 3D rendering of other players are NOT yet tested in a real browser by me.
- [x] Server (server/index.js): Node + Express + Socket.io, rooms in memory, serves the built game too
- [x] Public cinema: halls of 20 players; when one is full a new hall (#2, #3...) opens automatically
- [x] Public room list, Quick join, Create a room (name, public/private, 2-20 players, optional password)
- [x] Room codes like CINE-48291 (digits alone also work), invite links (?room=CINE-48291), password rooms
- [x] Other players: smooth movement, walk/run/jump/sit/emote animations, name labels, shirt colours
- [x] Seats are shared: nobody else can sit where you sit (server decides)
- [x] Chat goes through the server to everyone in the room (rate limit, length limit, word filter, no HTML)
- [x] Players panel: mute, report, host can remove a player (removed players are blocked from that room)
- [x] Server-side checks: bounds, speed limit (teleport/speed hacks are corrected), valid names/codes, per-connection and per-network limits
- [x] Auto-reconnect: if the connection drops you rejoin the same room
- [x] "Practice alone" still works with no server
- [ ] Not yet: accounts/friends (Phase 6), saved rooms (rooms vanish if the server restarts), movie sync (Phase 4), voice (Phase 5)
- [ ] Only the nearest 5 / 10 / 20 other players are drawn on Low / Medium / High, to keep phones smooth

## Phase 2 - Cinema world
- [x] Bigger screen: 21 x 11.8 m (was 18 x 10.1), with a wider stage, slimmer curtains and a larger projector beam
- [x] Sit on any of the 168 seats (E near a seat, from the aisle in front). E, W/A/S/D or Space stands you up.
      Sitting switches to first-person so you watch the film from the seat; standing returns your old view
- [x] Emotes: 1 wave, 2 clap, 3 dance, 4 cheer (touch: Emote button cycles them). Moving cancels an emote
- [x] Restroom through the new door beside the ticket office (stalls, sinks, mirror)
- [x] Row letters A to G on the side walls
- [ ] Left for later: extra halls (Screen 2), escalators/upper floor, ambient occlusion, photo textures

## Phase 1 (updated build)
Done (automatic build + movement/NPC/lighting simulation pass; visuals not seen by me):
- [x] Speed-up: static scenery merged (about 300 pieces -> about 100 draw calls), animated posters/screen
      redraw only when needed, fewer lights, shadows only on High, Low default on phones / weaker PCs
- [x] More decoration: red carpet + queue posts, chandelier, arcade machines, vending machine, water cooler,
      standees, ticket kiosks, benches, bins, live wall clock, wall lights, film reels, speakers, aisle sconces
- [x] NPCs: ticket clerk and snack-bar worker (typing, wave when you come close), usher with torch who patrols the
      aisles, cleaner with broom, two visitors (one with popcorn). Press E near them to talk. Audience (46 people) fills seats when a film plays
- [x] Movie player: demo reel, video file from your computer, or direct video link. Play/pause/seek/volume/stop.
      Lights fade down while playing, half-up when paused, fully up when stopped
- [x] Chat window: button or C key to open, button or X to close, unread badge, timestamps, spam limit, word filter
- [x] Works on: desktop (keyboard + mouse), laptops/touchpads (hold-and-drag look), phones/tablets (joystick, swipe, buttons)

## Not started yet
- [ ] Phase 2: sitting on seats, extra halls, escalators, restrooms, better lighting polish
- [ ] Phase 3: multiplayer server, public lobby, private rooms, room codes, invite links
- [ ] Phase 4: shared video sync (play/pause/seek for everyone), host controls
- [ ] Phase 5: real chat between players, WebRTC voice, proximity voice
- [ ] Phase 6: accounts, friends, avatar customisation
- [ ] Phase 7: final optimisation, security review, deployment

## Known limits
- Solo only. NPC chat answers are simple canned replies.
- Video links must point straight to a .mp4/.webm file AND the website must allow other sites to use it. A file from your computer always works.
- Netflix/YouTube/etc. links cannot be played (and we do not bypass protections).
- Phone browsers need a tap before video can play; the Movie panel buttons count as that tap.

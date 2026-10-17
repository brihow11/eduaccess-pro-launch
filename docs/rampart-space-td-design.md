# Rampart: Space Edition (orbital tower defense) - design

Written by: Howie

Built from scratch on 10/17/2026. It replaces the earlier Rampart-style space game at the same URL,
`/games/rampart-space/`. None of the old code is reused.

## Pitch
Your home world sits on a tilted orbital plane. Enemy fleets spiral in along glowing orbital
lanes. You build turrets on orbit platforms beside the lanes, upgrade them and pick a
specialization. Between waves you spend what you earned. Twelve sectors, a new world in each,
and a boss on sectors 4, 8 and 12.

## Core loop
1. **Build phase** (no timer): tap a free platform and pick a turret, or tap a turret to upgrade it,
   set its targeting or sell it. Press **Launch wave** when you're ready.
2. **Wave**: ships fly the lanes. Turrets fire on their own. You fire two powers (Orbital Strike,
   Time Dilation), switch speed between 1x and 2x, and can keep building.
3. Every ship that reaches the planet costs integrity (20 per sector). Kills pay credits.
   Calling the next wave early pays a bonus.
4. Clear the last wave to win the sector: you get 1-3 stars from integrity, then the Scout splash,
   then the next sector.

## Why it has depth
- **Damage types.** Energy weapons (laser, drones) burn through shields, but flat armor blunts them.
  Kinetic shots (railgun) ignore armor and do little to shields. Explosives (missiles) splash.
  A good defense mixes types.
- **Stealth.** Phantom ships can't be targeted unless an Aegis Pylon reveals them.
- **Disruption.** Gunships and bosses shoot turrets and knock them offline for a few seconds.
  An Aegis Pylon shields nearby turrets from this.
- **Synergy.** A stasis field slows ships, so lasers ramp up longer on each target. A pylon
  buffs every turret near it. Specializations push each turret in one of two directions.
- **Targeting** per turret: First, Strongest or Closest.
- **Economy.** The sell refund is 70%, so moving turrets costs money. The early-wave bonus
  rewards greed.

## Turrets (base cost; tiers I-III, then tier IV picks one of two branches)
| Turret | Role | IV-A | IV-B |
|---|---|---|---|
| Pulse Laser (70) | Steady beam that ramps up on one target. Energy. | Prism: beam chains to 2 more ships | Lance: ramps to 4x, longer range |
| Railgun (120) | Long range. The shot pierces every ship in a line. Kinetic. | Gauss: double damage | Accelerator: fires twice as fast and shreds armor |
| Missile Pod (100) | Homing missiles with splash. Explosive. | Swarm: 6 micro missiles | Nova: huge blast that leaves ships burning |
| Stasis Field (90) | Slows ships in its radius. | Entropy: ships in the field take +25% damage | Chrono Snare: every 6 s, holds ships still |
| Aegis Pylon (110) | Reveals stealth, +15% damage nearby, blocks disruption | Overclock: +30% fire rate nearby | Watchtower: huge reveal radius, marked ships take +15% |
| Drone Bay (140) | Drones hunt inside a leash radius. Energy. | Hunter: 4 fast drones | Flak: drone shots splash, good on swarms |

Unlocks: Laser and Missile on sector 1, Railgun on 2, Stasis on 3, Pylon on 4 (gunships arrive; phantoms follow on 5),
Drone Bay on 6 (carriers arrive). Orbital Strike unlocks on 1 and Time Dilation on 3.

## Enemies
Scout (fast), Swarmer (packs), Frigate (armored), Shielded Cruiser (regenerating shield),
Phantom (stealth), Gunship (shoots turrets), Mender (heals and recharges allies), Carrier
(launches fighters), Fighter. Bosses: **Dreadnought** (sector 4: armor and a heavy shield),
**Hive Mother** (sector 8: births swarms and gets faster when hurt), **The Eclipse**
(sector 12: phases its shield, cloaks, launches fighters and disrupts turrets).

## Difficulty curve
6 waves on sector 1, rising to 12 waves on sector 12. Enemy health grows about 17% per sector and 4% per wave.
New threats show up one at a time, each with a pop-up card. Each sector has a new lane layout:
1 lane, then 2, then 3, and lanes cross on later maps.

## Presentation
- Canvas 2D, all procedural, plus generated nebula backdrops. Planets rotate, with a real
  spherical projection, lighting, a terminator line, an atmosphere rim and drifting clouds.
  Parallax stars, slow comets, and shaded ship sprites with engine glow, rendered once and cached.
- Sound is synthesized with Web Audio: an ambient pad score with reverb and soft weapon sounds.
  Mute (M) is saved between visits.
- **No flashing.** Explosions stay small and local and fade over at least 0.3 s. There are no
  full-screen flashes and no hit-blink. Shield hits show as a smooth ripple. Big moments
  (boss death, strike) use a slow, low-alpha glow. `tests/rampart-space-td/flash-check.js`
  samples canvas luminance on a 4x4 grid every frame. It fails if any cell has more than
  3 flash pairs (each a change of 10% or more relative luminance) in one second.
- UI: polished title, sector select with stars and best scores, pause menu (Resume / Restart /
  How to play / Main menu), high-score table (top 10, initials), tutorial cards, the Scout ad
  after every sector and on game over, the Job Seeker Pro banner, and a Main menu button.
- Layout: a 16:9 world scaled to fit. On wide phones the HUD buttons move into the side
  margins, and touch targets are at least 44 CSS px. Taps snap to the nearest platform.
  Fullscreen on F.

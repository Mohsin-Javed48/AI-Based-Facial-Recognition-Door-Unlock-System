# Face Recognition-Based Automatic Gate Access System

**Full Project Plan — Home Electric Gate Automation**

## 1. Project Overview

**Goal:** Use a camera feed to detect and recognize family members' faces in real time. When a recognized family member is at the gate, the system automatically triggers the gate to unlock/open — no manual remote or button press needed.

**Core idea:** A laptop acts as the "brain." It pulls a video feed, runs face recognition on each frame, and when a match is found, sends a signal through a relay to trigger the gate. The camera source is just one line of code (`cv2.VideoCapture(...)`), so the entire software architecture — recognition, backend, dashboard, database — stays identical whether the input is your laptop's built-in webcam, a USB capture card connected to your analog CCTV camera, or a network IP camera stream.

**Development strategy:** Build and fully validate the whole system first using your laptop's built-in webcam — zero hardware cost. Once face recognition accuracy, the dashboard, and the gate-trigger logic are all working and tested, swap in the real camera and relay hardware. Only the camera source line and the gate-trigger function change; everything else carries over untouched.

## 2. Phases

### Phase 0 — Software-First Build on Webcam (Week 1–2, zero hardware cost)

- Set up the laptop with Linux (Ubuntu recommended — lighter, more stable for 24/7 headless service than Windows). You can also develop on Windows/Mac first and move to Ubuntu later for deployment.
- Build the Python recognition service reading from the laptop's built-in webcam (`cv2.VideoCapture(0)`).
- Enroll family members: capture 5–10 photos per person from different angles/lighting via the webcam, generate face embeddings.
- Implement the recognition loop: detect face → generate embedding → compare against enrolled embeddings → confidence score → decision.
- Build the "gate trigger" function as a simulated stub — instead of firing a real relay, it just logs "GATE WOULD OPEN for [Name]" to the console/database. This is the exact function you'll swap to a real relay call later, with no other code changes.
- Tune detection thresholds using webcam testing before worrying about outdoor lighting/night conditions.

### Phase 1 — Backend & Dashboard (Week 2–3, still zero hardware cost)

- Nest.js backend exposing REST/WebSocket APIs (matches your existing stack) for:
  - Live recognition events
  - Enrolled members management (add/remove/edit)
  - Access logs
  - Manual gate trigger
- PostgreSQL for storing member profiles, face embeddings metadata, and access logs.
- Redis for pub/sub — push real-time "gate opened for [Name]" events to the dashboard instantly.
- Next.js dashboard (details in Section 5) — fully testable end-to-end using the webcam feed and simulated gate trigger.

### Phase 2 — Gate Check & Hardware Decisions (Week 3)

- Determine if your gate already has a motor (see Section 6, Step 1). This decides your hardware list and budget.
- Decide relay bridge: USB relay module (simplest, if the laptop will sit near the gate motor) vs. ESP32 + relay (if the laptop stays indoors, away from the gate — see Section 6 for the tradeoff).
- Since you already own an analog (BNC/coax) CCTV camera, decide: USB video capture card (camera plugs straight into the laptop, cheapest, laptop must sit near camera) vs. DVR (camera → DVR → network RTSP, laptop can be anywhere on the network, but costs more).
- Buy whichever hardware combination fits your layout: capture card or DVR, relay or ESP32+relay, and — only if your gate has no motor — a gate motor or a solenoid/electromagnetic lock (see Section 6, Step 3).

### Phase 3 — Hardware Migration (Week 3–4)

- Swap the camera source line: webcam (`VideoCapture(0)`) → capture card device index, or → DVR's RTSP URL. No other recognition code changes.
- Wire the relay (USB relay or ESP32+relay) into the gate motor's existing trigger circuit — this simulates pressing the wall push-button, since switch-controlled gate motors are self-locking and don't need a separate lock (see Section 6 for full wiring explanation).
- Replace the simulated "GATE WOULD OPEN" stub with the real trigger call (pyserial command to the USB relay or ESP32).
- Add a cooldown period (e.g. 10–15 seconds) after each real trigger to prevent repeated firing from the same detection.
- Add a manual override/failsafe: physical push-button or dashboard toggle still works independently of the AI.
- Mount the camera and relay hardware outdoors in a weatherproof enclosure near the gate.

### Phase 4 — Reliability & Hardening (Week 4–5)

- Convert the Python recognition service and Nest.js backend into systemd services with `Restart=always`.
- Disable laptop sleep/hibernate; disable lid-close suspend if running with lid shut.
- Write a watchdog script that checks the recognition process is alive and the video feed isn't frozen — auto-restarts if not.
- Configure laptop BIOS to auto-power-on after power outage (most laptops handle this fine on battery + charger anyway, but worth checking your router/DVR have the same setting since they're upstream dependencies).
- Set up a small UPS for the laptop + networking gear so a brief power cut doesn't drop the whole system.

### Phase 5 — Testing & Field Trial (Week 5–6)

- Run for 1–2 weeks in "shadow mode" outdoors — log what it would have done without actually triggering the gate, to validate accuracy under real conditions.
- Test in different lighting: daylight, dusk, full IR/night mode, rain/fog if applicable.
- Test with masks, sunglasses, hats — decide fallback behavior (e.g. still require manual entry if confidence is low).
- Load-test relay pulse timing against your specific gate motor.

### Phase 6 — Go-Live & Ongoing Maintenance (Ongoing)

- Switch from shadow mode to live triggering.
- Monitor dashboard logs weekly for false positives/negatives.
- Re-enroll faces every few months (hairstyle/beard/glasses changes affect accuracy).

## 3. Requirements

### Functional

- Real-time face detection and recognition from a live video feed (webcam during development, real camera in production — interchangeable via a single config line)
- Automatic gate unlock trigger on recognized match
- Manual override (dashboard button + physical fallback)
- Access logging with timestamp, matched name, confidence score, and snapshot image
- Family member enrollment/management interface

### Non-functional

- 24/7 uptime with auto-recovery from crashes or reboots
- Recognition latency under ~2 seconds from face appearing to gate trigger
- Secure remote access to dashboard (not exposed openly to the internet)
- Fail-safe: if the AI service crashes, gate must still be operable manually — never lock family members out

## 4. Tech Stack

| Layer | Technology | Why |
|---|---|---|
| Video capture & detection | Python, OpenCV | `cv2.VideoCapture()` reads from webcam (dev), USB capture card, or RTSP stream (prod) with only the source argument changing |
| Face recognition | InsightFace (recommended) or DeepFace | InsightFace gives better accuracy/speed tradeoff on CPU-only hardware (no GPU needed on an old laptop) |
| Camera source (production) | USB video capture card (BNC-to-USB) for your existing analog CCTV camera | Cheapest path since you already own the camera; laptop must sit near the camera. A DVR + RTSP is the alternative if the laptop needs to be elsewhere on the network |
| Hardware bridge | USB relay module, or ESP32 + relay via pyserial | Plain USB relay if the laptop sits near the gate motor (simpler, cheaper); ESP32 adds Wi-Fi if the laptop stays indoors away from the gate |
| Relay | 1-channel 5V relay module | Wired in parallel with the gate motor's existing push-button circuit — simulates a button press, no separate lock needed |
| Backend API | Nest.js + TypeScript | Matches your existing stack, easy to maintain |
| Database | PostgreSQL | Store member profiles, embeddings metadata, access logs |
| Real-time events | Redis pub/sub + WebSocket | Push live "gate opened" events to dashboard without polling |
| Dashboard | Next.js + React | Matches your stack |
| Process management | systemd | Native Linux service management, auto-restart on crash/boot |
| OS | Ubuntu Server (Linux) | Lightweight, stable for headless 24/7 operation |

## 5. Dashboard Design

**Main sections:**

**Live Status Panel**
- Current camera feed thumbnail (snapshot refresh every few seconds, not full live stream, to save bandwidth)
- Gate status: Locked / Just Opened / Manual Override Active
- Big "Manual Unlock" button (with confirmation)

**Access Log**
- Table: Timestamp | Matched Name | Confidence % | Snapshot | Action Taken (Auto-opened / Denied / Manual)
- Filter by date range / person
- Snapshot thumbnail click-to-expand

**Family Members**
- List of enrolled members with profile photo
- Add new member (capture/upload photos → re-train embeddings)
- Remove/disable a member (e.g. temporarily block someone without deleting their profile)

**Alerts & Notifications**
- Unknown face detected at gate (optional: push notification via Telegram/WhatsApp — see future features)
- System health: camera offline, recognition service down, relay unresponsive

**Analytics (simple)**
- Chart: entries per day/week
- Chart: most frequent visitors
- False-positive/negative flagging (mark a log entry as wrong to improve future tuning)

## 6. What You Actually Need to Buy

You currently have a laptop and a basic analog (BNC/coax) CCTV camera. Development (Phases 0–1) needs zero new hardware — it all runs on the laptop's built-in webcam. The purchases below are only needed once you move to Phase 2/3 (real hardware). The one thing that massively changes your budget is whether your gate is already motorized.

### Step 0: Development phase — buy nothing yet

Build and fully test the software using the laptop's webcam first (see Phases 0–1). Confirm recognition accuracy and dashboard functionality before spending anything.

### Step 1: Check if your gate already has a motor

Before buying anything, confirm this:

- Look for a metal motor box near the gate track (sliding gates) or near the hinge post (swing gates) — roughly shoebox-sized.
- If you already use a remote control or wall switch and the gate physically moves on its own (motor hum, not just a latch click) — you have a motor.
- If you currently push/pull the gate open by hand every time — it's fully manual, no motor.

If your gate already opens via a wired wall switch/push-button, you have a motor with a self-locking gearbox — you do not need to buy a separate lock. The motor holds the gate shut mechanically; your relay just needs to mimic pressing that existing button (wire the relay's NO contacts in parallel with the button's wires). This is by far the cheapest and simplest case.

### Step 2: Camera hardware — using your existing analog CCTV camera

| Option | Cost (PKR) | Notes |
|---|---|---|
| USB BNC-to-USB video capture card | 2,500 – 6,000 | Cheapest — camera plugs straight into the laptop's USB port, read via OpenCV like a webcam. Laptop must sit near the camera. Match the card to your camera's signal type (CVBS/AHD/TVI/CVI). |
| DVR (camera → DVR → network RTSP) | 5,000 – 10,000+ (DVR box) | Only needed if the laptop must sit elsewhere on the network, or you want multi-camera/recorded storage later. |

### Step 3: Relay bridge — connecting the laptop to the gate

| Option | Cost (PKR) | Notes |
|---|---|---|
| USB relay module | 500 – 1,500 | Simplest — plugs directly into the laptop via USB, controlled with serial commands. Best if the laptop sits near the gate motor. |
| ESP32 + relay module | 1,200 – 2,000 | Adds Wi-Fi so the relay can sit at the gate while the laptop stays indoors. Slightly more setup (flashing firmware), but avoids a long USB/serial cable run. |

### Step 4: Cost Breakdown (PKR) — Two Gate Scenarios

| Component | Scenario A: Gate already has a motor | Scenario B: Fully manual gate |
|---|---|---|
| USB capture card (using existing camera) | 2,500 – 6,000 | 2,500 – 6,000 |
| Relay bridge (USB relay or ESP32+relay) | 500 – 2,000 | 500 – 2,000 |
| Gate motor + installation | 0 (already exists — just wire into its push-button circuit) | 70,000 – 250,000+ (depends on gate weight, sliding vs. swing gate, brand) |
| Wiring, connectors, weatherproof enclosure | 1,500 – 3,000 | 2,000 – 4,000 |
| Basic UPS (laptop + camera backup power) | 3,000 – 8,000 | 3,000 – 8,000 |
| Miscellaneous (mounting hardware, cables, labeling) | 500 – 1,000 | 500 – 1,000 |
| **Total** | **~8,000 – 20,000 PKR** | **~78,500 – 271,000+ PKR** |

The gap is almost entirely the gate motor. Everything on the "smart" side — camera capture, AI recognition, relay trigger — stays cheap in both cases, and Scenario A got even cheaper than before now that a DVR/IP camera isn't required.

### Step 5: A Cheaper Middle Ground (Scenario B alternative)

If a full motor (PKR 70,000+) feels excessive, consider an electromagnetic or solenoid gate lock (PKR 3,000 – 15,000) paired with a spring-assisted or gravity-swing gate design:

- The system electronically releases the latch when it recognizes a family member.
- The gate then swings open on its own weight/spring, or with a light push — no motor required.
- This only works if your gate is a lightweight swing gate. Heavy sliding gates generally need a real motor to move at all.

**Recommendation:** finish the webcam-based software build first (Step 0), confirm your gate type (Step 1), then pick the matching camera and relay options above before ordering anything.

## 7. Ongoing Maintenance Cost

| Item | Estimated Cost | Notes |
|---|---|---|
| Electricity (laptop running 24/7) | ~PKR 300 – 700/month | Depends on laptop's power draw (typically 20–40W idle-ish load) |
| Software/hosting | PKR 0 | Fully self-hosted, no cloud subscription needed |
| Occasional hardware replacement (relay wear, cables) | ~PKR 500 – 1,000/year | Relays are mechanical parts and can wear out over years of cycles |
| Optional: Telegram/WhatsApp API for alerts | PKR 0 (free tiers available) | |
| Optional: cloud backup of logs/snapshots | PKR 200 – 500/month | Only if you don't want to rely solely on local storage |

**Total ongoing cost:** roughly PKR 300 – 1,200/month, mostly just electricity — this is a very low-maintenance-cost system since everything runs locally.

## 8. Additional Features (Future Roadmap)

Once the core system is stable, you can layer on:

- Instant mobile notifications — Telegram or WhatsApp bot alert on every gate trigger or unknown face detection.
- Liveness / anti-spoofing detection — prevent someone from unlocking the gate with a photo held up to the camera.
- Guest/visitor QR or temporary access codes — for guests, delivery riders, etc., without full face enrollment.
- License plate recognition — combine with face recognition so cars are recognized too, useful if family members drive up rather than walk.
- Voice announcement — small speaker announces "Welcome home, [Name]" as the gate opens.
- Multi-camera support — add a second angle for better recognition accuracy in poor lighting/angles.
- Mobile app — a lightweight version of the dashboard for on-the-go monitoring and manual unlock.
- Battery-backed gate control — ensures the relay/ESP32 side keeps working briefly even during a power cut (separate from the main UPS).
- Visitor intercom integration — if someone unrecognized rings, live video call to your phone before deciding to let them in.
- Historical analytics dashboard — weekly/monthly summaries, busiest hours, etc.

## 9. Risk Notes & Fail-safes (Important)

- Never let this be the only way to open the gate. Keep the existing remote/manual button fully functional in parallel — the AI system should only ever be an additional trigger path, not a replacement.
- Test extensively in shadow mode before going live — a false "unknown" isn't dangerous, but a false "match" opening the gate to a stranger is a real security risk. Tune your confidence threshold conservatively (favor false rejections over false acceptances).
- Physical security of the laptop/relay box — since it controls a gate, it should not be easily accessible/tamperable from outside the property.

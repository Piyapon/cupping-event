# Cupping Event Tool — Spec v1

Browser-based tool to run blind coffee cupping events: setup, blind shuffling, ballots, scoring, finalist selection, final, and the reveal show. No app install, no accounts, no backend.

---

## 1. Platform & hosting

- **Static site** on GitHub Pages (public repo; code only, no event data in the repo). HTTPS is required for camera/QR scanning.
- Vanilla HTML/CSS/JS, **no build step**. Third-party libs vendored into `/lib` (not CDN), so the event never depends on a CDN.
  - QR generation: e.g. `qrcode-generator`
  - QR scanning: e.g. `jsQR` (camera via `getUserMedia`)
- Mobile-first (iPhone Safari + Android Chrome), also usable on a tablet.
- Persistence on the master device: `localStorage` for event state, `IndexedDB` for photos.
- Wi-Fi is expected at events, but the event flow must work **offline** after the page has loaded.

Suggested structure:
```
index.html        # router: master / helper / taster / reveal
css/styles.css
js/state.js       # data model, save/load, export/import
js/scoring.js     # pure functions: points, tiebreaks, finalist selection (unit-testable)
js/qr.js          # encode/decode payloads, QR render + scan
js/views/*.js     # one file per screen
lib/              # vendored QR libs
tests/scoring.test.html   # runs scoring cases in the browser
```

---

## 2. Modes

| Mode | Who | Device |
|---|---|---|
| **Master** | Event master | Master's phone/tablet; holds all data |
| **Helper** | Shuffler | Master's device, handed over (screen-locked away from master) |
| **Taster** | Each participant | Own phone, opened via join QR/link |
| **Pass-around** | Several participants | One shared device in Taster mode with "switch participant" |
| **Reveal** | Master presenting | Master's device |

---

## 3. Event setup (Master)

All values are inputs. Nothing is hard-coded.

| Field | Rule | Default |
|---|---|---|
| Event name | required | — |
| Date | required | today |
| Rounds `R` | ≥ 1 | 4 |
| Cups per round `N` | 2–8 (letters A…) | 6 |
| Total coffees | `R × N`, computed, enforced as the exact count to enter | 24 |
| Final cups `F` | `R ≤ F ≤ N`. Setting `F > N` needs the "Expand final" toggle (off by default) | 6 |
| Likes per phase | min/max per taster per phase | 1 / 2 |
| Points | aroma like = 1, taste like = 2 (configurable) | 1 / 2 |
| Participants | list of names + short letter code; editable mid-event | — |
| Master PIN (optional) | hides cup mappings until reveal | — |

### 3.1 Coffee record

Only **Label** is required; everything else is optional, with guidance hints in the form.

| Field | Notes |
|---|---|
| Label | short display name, e.g. "Finca X Geisha" |
| Photo | bag photo from camera/gallery, compressed (~1000px JPEG) |
| Roaster | |
| Source | where bought, e.g. "PTY airport" |
| Country, Region | |
| Farm, Producer | |
| Altitude (masl) | number or range |
| Type | single varietal / blend |
| Varietals | list with optional %; CSV format `Geisha 60%; Caturra 40%` |
| Process | Washed, Natural, Honey (Yellow/Red/Black), Anaerobic, Carbonic maceration, Co-ferment/Infused, Wet-hulled, Experimental, Other, Unknown |
| Roast date, Roast level | |
| Bag tasting notes | free text |
| Competition score | if known |
| Price | |
| Notes | free text |

**CSV import/export** of coffees uses `coffee_import_template.csv` (same columns, photos excluded). Import appends; it warns if the count ≠ `R × N`.

### 3.2 Round building

The master picks a mode, previews the result, adjusts, then **locks rounds**:

1. **Random**: pure shuffle into rounds.
2. **Grouped**: one attribute per round (process / country / varietal / roaster). Groups that don't divide evenly into `N` are filled with the closest leftovers and **flagged** for manual adjustment.
3. **Balanced**: maximize diversity of the chosen attribute within each round (stratified distribution).
4. **Manual**: move coffees between rounds.

After locking, each coffee in a round gets a **cup number 1…N**. This is random by default and editable. The **Grind screen** shows the master: "Round k: cup 1 = …, cup 2 = …".

---

## 4. Blind shuffle (Helper)

Physical setup: cups have number stickers underneath (1…N). The table has visible letter labels A…N.

Per round, Helper screen:
- Shows letters A…N, each with a cup-number dropdown.
- **Shuffle for me** fills a random permutation; the helper places cups to match and verifies the numbers underneath.
- Validation: each number used exactly once.
- **Save & lock** stores mapping `letter → cup number`. The master can't view it before reveal (PIN-protected if a PIN is set).
- Coffee at a letter = `letter → cup number → coffee`.

The same flow applies to the final round (final coffees get cup numbers 1…F on the grind screen, then the helper maps letters).

---

## 5. Taster ballots

### 5.1 Joining
- Master shows a **join QR**: a URL whose hash carries the compact event config: `#join=<base64url(JSON)>` containing event id, name, R, N, F, likes rules, participants. Scanning it with the phone camera opens the site directly in Taster mode.
- The taster taps their name. Late joiners pick their name any time. The master can add participants mid-event; tasters then re-scan the join QR.

### 5.2 Ballot screen (per round)
- Round selector (1…R, then Final).
- **Aroma**: cups A…N as toggles; enforces min/max likes.
- **Taste**: same.
- **Round strength**: Weak / **Balanced** (default) / Strong. Main rounds only.
- Submit → shows a **ballot QR** + **text code** (copy button for WhatsApp).
- A taster can submit an aroma-only ballot if they must leave; it counts what is there.
- Ballots stay on the taster's device so they can re-show the QR.

### 5.3 Pass-around mode
Same screen with a "Switch participant" button. Each ballot is a separate QR/code; on a shared device the master can scan them one after another.

### 5.4 Payload format (versioned)
```
{"v":1,"e":"<eventId>","p":"<participantCode>","r":<round|"F">,"a":["A","C"],"t":["C"],"s":"B"}
```
Encoded compactly (base64url). The text code has a short prefix, e.g. `CUP1:...`.

### 5.5 Master import
- In-app camera scanner + paste-code box.
- Reject wrong event id; validate likes rules.
- Same participant + same round again → prompt "replace?".
- Per round, show a checklist of who has submitted. The master can close a round with whoever submitted.

---

## 6. Scoring (main rounds)

For coffee `c` in round `k`:
- `aroma(c)` = aroma likes, `taste(c)` = taste likes
- `points(c) = 1·aroma(c) + 2·taste(c)`
- `likers(c)` = distinct participants who liked `c` in either phase
- `voters(k)` = participants with a ballot in round `k`

**Round strength label** = majority of votes. A tie between labels → Balanced. No votes → Balanced.

### 6.1 Tiebreak chain (main rounds), in order
1. points (higher wins)
2. taste likes
3. distinct likers
4. round strength (Strong > Balanced > Weak); only for cross-round comparisons
5. master pick / coin flip (UI prompt)

### 6.2 Finalist selection
Inputs: rounds with scores, `F`. Output: proposed finalist list + reasons per coffee.

1. **Round winners.** In each round find the top-points set `T_k`.
   - **Weak round**: exactly one qualifies (chain applied within `T_k`). Weak rounds send **only** their winner. Their other coffees are excluded from extra seats unless the pool runs dry (step 4).
   - **Balanced/Strong round**: all of `T_k` qualify (co-winners).
2. **Overflow** (qualified > F): keep one winner per round (best by chain). Cut the extra co-winners by chain until qualified = F. Never drop a round's only representative.
3. **Fill** (qualified < F): the pool is the non-qualified coffees from Balanced/Strong rounds, ranked by the chain (step 4 of the chain uses round strength). Take the top until `F` is reached.
4. If the pool is exhausted, add Weak-round coffees ranked by chain.
5. **Master override.** Show the proposal with reasons ("Round 2 winner", "Co-winner R3", "Best runner-up, 9 pts"). The master can swap any coffee, then confirm.

### 6.3 Unequal voters
- **Default: raw counts** (current practice).
- Within-round winners are unaffected (same voters per round). Only the cross-round runner-up comparison is affected.
- Always display `voters(k)` and `points per voter` per coffee.
- If voter counts differ across rounds: show a warning banner.
- Optional toggle **"Normalize runner-ups"**: in step 3 the pool ranks by `points / voters(k)` instead of raw points. The rest of the chain is unchanged.

---

## 7. Final round

- `F` finalists → grind screen (cup numbers 1…F) → helper letter mapping → ballots (aroma + taste likes, same min/max rules; no strength vote).
- **Ranking chain:** taste likes → aroma likes → distinct likers → unresolved.
- Unresolved tie for any position: the master chooses **Co-champions** or **Coin flip** (animated, between the tied coffees; repeats for 3+ way ties).
- Full final ranking 1…F is shown.

---

## 8. Reveal show (Master presenting)

Step-by-step, one tap per reveal, large type for showing the room:

1. **Per round**: for each cup A…N, show letter → coffee (photo, key fields) → aroma likes with names → taste likes with names → points. Then a round summary: winner, last place, strength label and vote split, voters count.
2. **Finalists**: who goes to the final and why.
3. **Final**: reverse order (last → first), with names of likers and tiebreak/coin flip results shown explicitly.
4. **Stats** (Section 9).

Toggle: reveal by cup (default) or by ranking.

---

## 9. Stats (end of event)

- **Contrarian of the night**: lowest agreement with group consensus (likes on low-scoring coffees).
- **Mainstream palate**: highest agreement.
- **Palate twins**: pair with the highest overlap of likes (Jaccard).
- **Nose vs mouth**: coffees with the biggest aroma-vs-taste gap, both directions.
- **Per-taster profile**: share of likes by process / country / varietal, where fields exist.
- **Process / country leaderboard**: average points per coffee.
- **Round strength vs scores**: did "Strong" rounds have closer spreads?
- Event summary table: all coffees with all fields, points, rank. Exportable as CSV.

---

## 10. Data, export, safety

- Autosave after every action.
- **Export event file** (`.json`, optionally with photos embedded) and **Import event file**, for backup and moving to another device.
- **Export results CSV** (coffees × scores × likers) for later analysis.
- Undo for the last imported ballot.
- "Reset event" requires typing the event name.

---

## 11. Acceptance tests (scoring.js)

1. Clear winner per round, no ties, `R=4, F=6` → 4 winners + 2 best runner-ups by points.
2. Runner-ups tie on points, one has more taste likes → taste wins.
3. Balanced round with a 2-way top tie → both qualify.
4. Weak round with a 2-way top tie → one qualifies via chain; the other is excluded from fill.
5. Overflow: 3 rounds each with 2-way ties, `R=4, F=6` (7 qualified) → cut 1 co-winner by chain; every round keeps ≥1.
6. Unequal voters (7 vs 5) → warning shown; normalize toggle changes the fill order as expected.
7. Final: taste tie broken by aroma; full tie → co-champion/coin flip prompt.
8. Taster leaves after round 2 → later rounds score with fewer voters, no errors.
9. Aroma-only ballot → counts aroma, zero taste.
10. Duplicate ballot → replace prompt; wrong event id → rejected.
11. Ballots violating min/max likes → rejected at the taster and at import.

---

## 12. Out of scope for v1

- Live sync / backend.
- Automatic label reading from photos. Coffee data comes from CSV import, prepared in chat from bag photos on event day.
- Multi-event history dashboard. The results CSV keeps this possible later.

## 13. Open items

- UI language: English, Spanish, or a toggle. Keep all strings in one file either way.

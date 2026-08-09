# Naming research — candidate names for Mugful

> **Research date**: 2026-08-09
> **Selected product name**: "Mugful" · **Internal folder**: `gf-fun-app`
> **Voice target**: warm, playful, mature — for two adult romantic LDR partners. Not childish, not generic SaaS, not tied to Guess My Answer alone; must plausibly stretch to v1.1 video (Together Room) and later activities.
> **Disclaimer**: this is research, not legal advice. All collision checks were done on 2026-08-09 against public web sources via the available `websearch` and `webfetch` tools. None of the names below is presented as available or untrademarked. Before adopting any name, run USPTO TESS, TMView, and a registrar WHOIS, and re-check the App Store / Play Store the day you commit. The user — not this note — picks the final name.

---

## TL;DR — three finalists

These were the three strongest candidates I found, each from a different direction. None is perfect on every axis, and the LDR-couples app market turned out to be one of the most crowded I have ever researched (see §1 and §2.8). The repository is now connected as `mugful`, so Mugful is the selected working name pending final trademark, domain, app-store, and namespace verification.

| #      | Candidate    | Direction                 | One-line rationale                                                                                                                                              | Repo slug  | Docker image pattern (per `ARCHITECTURE.md`)                                                        | Primary open questions                                                                                                                                                                                                                    |
| ------ | ------------ | ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | --------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **F1** | **Mugful**   | cozy domestic             | "Two mugs on a kitchen table." Small, intimate, gendered-neutral, image-led. Stretches to Together Room (a hot drink while you video) and to future activities. | `mugful`   | `docker.io/<owner>/mugful-web:<semver>-<sha>` and `docker.io/<owner>/mugful-api:<semver>-<sha>`     | Is the word in any active app/brand I missed? Sound-symbolic risk: "mugful" reads as "mug full" — make sure the logo disambiguates.                                                                                                       |
| **F2** | **Bidewith** | invented coinage          | Old English _bide_ = to stay, wait, dwell; _bide with_ = to stay with. Reads as a verb ("we bidewith") and as a name. Stretches well to video and activities.   | `bidewith` | `docker.io/<owner>/bidewith-web:<semver>-<sha>` and `docker.io/<owner>/bidewith-api:<semver>-<sha>` | Verbing a brand ("Bidewith me") works in English but may need localizing for non-English LDR markets. Confirm `.com`/`.app`/`.io` at a registrar.                                                                                         |
| **F3** | **Tondel**   | sound-symbolic / invented | Coined from Italian _tondo_ — round, whole, complete. Soft, warm, two-syllable, easy to say. A "small object on a shelf" feeling that ages well.                | `tondel`   | `docker.io/<owner>/tondel-web:<semver>-<sha>` and `docker.io/<owner>/tondel-api:<semver>-<sha>`     | Coinage risk: harder to land on first read than an English word. The Docker Hub username `tondel` is already taken by an unrelated user (Tondel Fernandes) — namespace unblocked at the org level but the personal namespace is squatted. |

**Why these three and not others**: see §3 (finalists, with per-candidate tradeoffs) and §4 (names considered and rejected). The rest of this note is the evidence behind them.

---

## 1. What already exists — adjacent products to differentiate from

The LDR / couple / relationship app space is **one of the most crowded categories I could have researched**. I primary-source-verified every name in this section on the product's own site, its own App Store / Play Store listing, or both. The relevance is not "can we use this name" — these are all valid names already in use by other people — but "the differentiation message has to be sharp because the buyer has plenty of options."

### 1.1 General-purpose couples apps (closest functional neighbours)

- **Between** (DLT Partners Inc., Seoul). "Private couples app", chat, photo timeline, anniversaries, shared calendar, E2EE-claimed. 35M+ couples. <https://between.us/?lang=en>, App Store listing <https://apps.apple.com/us/app/between-couples-love-tracker/id458035189>, Play Store <https://play.google.com/store/apps/details?id=kr.co.vcnc.android.couple>.
- **Paired** (Better Half Limited, London). Daily questions, "journeys", quizzes, video. 8M downloads, $4.6M raised. <https://paired.com/>, App Store <https://apps.apple.com/us/app/paired-couples-relationship/id1469609343>, Play Store <https://play.google.com/store/apps/details?id=com.getpaired.app>.
- **Couply** (Couply App Ltd., Toronto). Quizzes, "personality mesh", long-distance mode, daily questions, courses, photos. $300K raised. <https://couply.io/>, App Store <https://apps.apple.com/us/app/couply-couples-relationship/id1484241314>, Play Store <https://play.google.com/store/apps/details?id=io.couply.android>.
- **Couplet: Spice Up Relationship** (Roderik Lagerweij). Intimacy games for couples, swiping on ideas, "playful exploration". <https://apps.apple.com/us/app/couplet-spice-up-relationship/id1593016036>.
- **Couplete** (Wonderabbit, Inc., also maker of Lovedays / CoupleKeeper). Couples messenger, calendar, photos. Listed on Apptopia, app-store-id 742745050.
- **Love Nudge** (Love Language Brand / Grooters Productions, under the 5 Love Languages brand). <https://5lovelanguages.com/resources/app>, App Store <https://apps.apple.com/us/app/love-nudge/id495326842>, Play Store <https://play.google.com/store/apps/details?id=com.grootersproductions.challenge>.

### 1.2 LDR-targeted apps (closest in _behaviour_ to what this project does)

These are the ones the principal developer is most likely to be confused with in the App Store. All primary-sourced.

- **Together: Couples App** (`together-app.co`). "Your Private Space for Two." Mood check-ins, countdowns, shared bucket list, LDR messaging. iOS + Android. Active in 2026.
- **Twogle** (`twogle.com`). "The Couple App, Built for Two." Private chat, daily sparks, evidence-based (Gottman, EFT), $15/mo, E2EE-claimed. iOS + Android. Active in 2026.
- **Closer: Relationship & couples App** by Blue Flow Technologies. LDR games, E2EE chat, time-zone widget, daily quizzes, "horny mode" toggle. <https://apps.apple.com/us/app/closer-relationship-couples/id6467502209>.
- **getcloser.app** ("Closer — For Couples Who Actually Care") and **closerapp.co** ("Closer App — playful nudges"). Two different products, same name.
- **Bloom Together** (`bloomcouples.app`). Mood sharing, doodle, widgets, "Pookie AI" companion, 3,000+ games/questions. LDR-targeted. iOS + Android.
- **Connected: App for Couples** (`connectedcouples.app`). Daily questions, weekly check-ins, AI coaching, 4.9★ from 2,000+ couples. iOS + Android.
- **Cozy Couples** (`cozycouples.co`, by Clarity Applications, LLC). Mood, daily questions, "build a tiny bonsai tree together", virtual pet, dream home decoration. iOS + Android.
- **TwoGether** (`gettwogether.com`). Tasks, calendar, messages for two. iOS + Android.
- **Tethered** (`usetethered.com`, by Kazuo Corporation). "LDR couples app", home-screen drawing widgets, daily challenges, free.
- **Nudges** (`getnudges.app`). "Bridge the Distance, Feel Them Closer." Status, photos, "hold hands", daily questions. iOS + Android.
- **Twine** (`ourtwine.app` and `twine-couples.com` — two different products, same name). Daily prompts, shared rituals, weekly check-in, mood, relationship journal. iOS + Android.
- **Dryft** (`dryft.site`). "Intimacy at a Distance." LDR + dating, video calls, shared calendars, buttplug.io integration, Meta Quest. Alpha as of 2026-03-12.
- **WatchTogether** (`watchtogether.watch`). Sync movie watching for LDR, WebRTC, free.

### 1.3 Older or smaller products in the same space

For completeness, all primary-sourced:

- **Happy Couple** (Happy Couple SAS / now HJB Ventures LLC). Quiz game, last Play Store update 2025-10-21. <https://apps.apple.com/us/app/love-nudge/id495326842> (no — that's Love Nudge) and <https://play.google.com/store/apps/details?id=com.hip.happycouple>.
- **Couplet** (also spelled Couplete; there are at least two separate products in this name). See §1.1.
- **Bonsai (the relationship-tree feature inside Better Together)**. The word "Bonsai" is in wide use; Better Together's couples-app usage is a feature, not a product name. Avoid as a brand.

### 1.4 What this means for naming

The buyer searching for "couples app" or "LDR app" will see at least 15 of the products above. Differentiation has to come from the _kind_ of warmth and the _single-activity focus_, not from the name alone. A name that says "LDR-couples app" is a name that competes head-on; a name that says "a small, private place for two" is a name that invites a different search. The finalist shortlist in §3 leans toward the latter.

---

## 2. Candidate names by direction

Each candidate below is a real word or coinage I evaluated. For each, I checked (a) the official site, (b) the App Store / Play Store, (c) GitHub, (d) npm, and (e) Docker Hub, where relevant. Every "primary-source URL" below was opened on 2026-08-09 via the available `webfetch` and `websearch` tools.

> **Reading the collision table**: a "no primary-source collision found" entry means _no result came back in my searches_ — not that the name is provably available. See §5 for the verification before adoption.

### 2.1 Cozy domestic — small, private, "our place"

The voice: a kitchen, a window seat, a shared object. Reads as a place you go together, not a tool you use.

- **Mugful** — "Two mugs on a kitchen table." Gendered-neutral, image-led, easy to spell, two syllables. Pronunciation: /ˈmʌɡfʊl/. Collision: no active product found; Docker Hub `mugful` namespace returns 404 (<https://hub.docker.com/r/mugful>), npm package `mugful` 404 (<https://www.npmjs.com/package/mugful>). Risk: the word is unusual; marketing has to land the meaning on first read.
- **Kettle** — "The kettle is on — someone's free." Domestic, warm, plays well with Together Room (a kettle going off when one's ready). Collision: `kettle.io` is in use by an unrelated mobile-app development company, and `kettleweb.com` is a social-discovery product (<https://kettleweb.com/>). Hard collision on the obvious TLDs. Keep as a _concept_ (the kettle metaphor) but not as a brand.
- **Hearth** — The clearest hit in this direction. Collision: Hearth Display (<https://hearthdisplay.com/>, 40,000+ families, App Store companion app), Hearthside Works (<https://www.hearthsideworks.com/>, AI tools for connection, live), Hearthly (<https://hearthly.app/>, "share your digital life with those who share your hearth", live), Hearth Connected Care (<https://www.hearthconnectedcare.com/>, family care app launching September 2026). Four active products. Hard collision. Rejected.
- **Porch** — "A porch with two chairs facing the same view." Collision: Porch.com (home insurance, public company, <https://porchgroup.com/>), Porch.host (Airbnb host tool, <https://www.porch.host/>). Hard collision. Rejected.
- **Porchlight** — Aiming at the same warm-object vibe. Collision: Porchlight Homes (Arizona builder, <https://porchlighthomes.com/>), Porchlight Marketing (<https://porchlightatl.com/>). Hard collision. Rejected.
- **Hearthside** — Compound of Hearth. Collision: Hearthside Works above. Hard collision. Rejected.
- **Hearthly** — Variant. Collision: hearthly.app above. Hard collision. Rejected.
- **Linger** — "The soft trace of someone's presence in a room." Beautiful meaning, hard to land as a verb-noun. Collision: Docker Hub user `linger` exists (no public images, <https://hub.docker.com/r/linger>). No active product collision found in my searches. **Reserve as a possible alternative to the finalists**, not chosen because the meaning is too abstract for a couples app where one of the buying signals is "what does the app actually do?".
- **Plush, Snugside, Cosy, Cozy Couples** — All have direct collisions (Plume Journaling, getcloser.app, Couply.io, Cozy Couples at `cozycouples.co`). Rejected.

### 2.2 Metaphorical / poetic — a small object that holds warmth

The voice: a single image you can hold in your head.

- **Ember** — A small warm thing. Collision: Ember Technologies (smart temperature-controlled mugs, $83.9M raised, registered trademarks at <https://ember.com/trademarks>). Hard collision. Rejected.
- **Toast** — A small warm thing. Collision: Toast, Inc. (restaurant POS, 180,000 locations, public company, <https://pos.toasttab.com/>). Hard collision. Rejected.
- **Two Notes** — "A note left on the kitchen counter." Sweet, clear, and imageable. Collision: Two notes Audio Engineering / Orosys SAS (audio products, since 2008, <https://two-notes.com/>). Different domain but the brand has had 18 years of search presence. Risky. Rejected.
- **Bonsai** — A small living thing you grow together. Collision: Better Together's couples-app feature, plus dozens of unrelated products. Rejected.
- **Sundial** — A small object that tracks the day. Collision: Sundial (sundialapp.com, Tier 9 Digital), Sundial Family / Browser (thesundial.app, active 2026). Hard collision. Rejected.
- **Plume** — "A feathered trace of warmth." Collision: Plume Journaling (RailsSquad OU, getplumeapp.com, App Store <https://apps.apple.com/tm/app/plume-private-journal-diary/id6754373902>). Direct collision in the private-journaling / privacy-first space, exactly the adjacent that matters here. Rejected.

### 2.3 Distance-bridging — language about two points connected

The voice: a string, a line, a note that travels.

- **Bridge** — A direct metaphor for LDR. Collision: BridgeApp.ai (AI knowledge workspace, <https://bridgeapp.ai/>), The Bridge App (associations/schools/churches communication, <https://thebridgeapp.org/>), brdg.app (networking). Three products, all active. Rejected.
- **Twine** — A string twisted from two strands. Collision: `ourtwine.app` (Twine — Grow Closer, Together, daily prompts, <https://www.ourtwine.app/>) and `twine-couples.com` (Twine — daily relationship journal, <https://www.twine-couples.com/>), plus twineapp.com (workplace intranet) and twine.com (customer intelligence). **Twine is now a direct couples-app competitor**, not just a name. Hard collision. Rejected.
- **Tether** — A line that holds two things together. Collision: Tether Operations, S.A. de C.V. (the $X billion USDT stablecoin, <https://tether.to/>). One of the most searched names on the internet. Hard collision. Rejected.
- **Threadline** — A subtle line of connection. Collision: npm package `threadline` (a real product, Ariadne / semantic HTML extraction, ~0 weekly downloads, <https://www.npmjs.com/package/threadline>). Different domain, dormant. Soft collision.
- **Bellbridge** — A bell that sounds across a distance. Collision: no active product found; Docker Hub `bellbridge` namespace 404 (<https://hub.docker.com/r/bellbridge>). **Possible alternative**, kept on the bench.

### 2.4 Playful shorthand — what the couple calls _us_

The voice: a nickname, a private word, a smile.

- **Usie, Just Us, Ours, Ourside** — "Ours" is taken by Ours Therapy / Ours Wellness (withours.com, $5M raised, 2020, virtual couples therapy — direct category overlap, <https://withours.com/>). Ourside is taken by Ourside NYC (a fragrance house, <https://ourside.nyc/>). Hard collision on "Ours". "Usie" is generic and too selfie-coded. Rejected.
- **Cozy, Cosy, Cosyup** — Cozy Couples (cozycouples.co) and Couply's "cosy" vibe are direct category overlap. Rejected.
- **Closer** — Direct LDR-couples competitor (see §1.2). Multiple Closer apps, including one literally called "Closer: Relationship & couples App" by Blue Flow Technologies. Hard collision. Rejected.
- **Snug, Snugside, Snugside** — Snug Dating (`joinsnug.com/`, $30/mo concierge dating, 50,000+ members) and Snug Family Organizer (`get.snugplanner.com/`). Hard collision. Rejected.

### 2.5 Togetherness verb / activity-noun — what the couple _does_

The voice: a verb-noun, something you do together.

- **Tandem** — "Doing it together." Collision: Tandem Diabetes Care, Inc. (NASDAQ: TNDM, public company, active mobile apps, <https://www.tandemdiabetes.com/products/software-apps/mobile-apps>). Hard collision in the most regulated vertical. Rejected.
- **Paired** — Already taken (see §1.1). Rejected.
- **Couplet** — Already taken (see §1.1). Rejected.
- **Coupled** — Already taken by Coupled (`coupled.cc`, friend-finder for couples, 2 employees). Rejected.
- **Twos** — "Just the two of us." Collision: Twos (twosapp.com, organize notes/todos, AI-powered), Twos: The Conversation App (twos.net, 18+). Hard collision. Rejected.
- **TwoGether, Together** — Already taken (§1.2). Rejected.

### 2.6 Sound-symbolic / invented — a coined word

The voice: a small made-up word that feels warm and pronounceable.

- **Tondel** — Coined from Italian _tondo_ (round, whole, complete). Two syllables, easy to say, no obvious English meaning. Collision: Docker Hub username `tondel` is taken by a user called Tondel Fernandes (no public images, <https://hub.docker.com/r/tondel>); npm returned 403 to my package-existence check, suggesting the namespace may be in use privately. No active _product_ collision found. **One of the three finalists — see §3.3.**
- **Cwtch** — Welsh for "a hug that creates a safe place." Pronounced /kʊtʃ/. Beautiful word. Collision: Cwtch (cwtch.im, Open Privacy Research Society's decentralized messaging protocol, on Google Play); Cwtch & Code / Cwtch Corner (UK SEN/ADHD app, cwtchcode.com, active 2026). Hard collision in both privacy-tech and family-wellbeing. Rejected.
- **Kvell** — Yiddish for "beam with pride / glow." Collision: Kvell Marketing (kvell.cc, active). Hard collision. Rejected.
- **Sotok, Twondel, Tondel, Bidewith** — see §3.2 (Bidewith) and §3.3 (Tondel).
- **Sotok, Ourm, Plush, Tondel, Twondel, Bidewith, Cozen, Cozenly** — most of these are either dormant or have soft collisions. See §3.

### 2.7 Distance-bridging via old English — verb "bide"

The voice: something warm and unhurried. A small set of coinages built on the verb _bide_ (to stay, wait, dwell). I evaluated these as a group.

- **Bidewith** — _Bide with_ = to stay with, to dwell with. Reads as a verb ("we bidewith each other") and as a brand name. Pronunciation: BYDE-with. Two syllables, stress on first. Spell: B-I-D-E-W-I-T-H. Collision: no active product found; Docker Hub `bidewith` 404 (<https://hub.docker.com/r/bidewith>). **One of the three finalists — see §3.2.**
- **Bidewell** — _Bide well_ = dwell well. Collision: Bidwell.app (UK public-sector tender tool, Operosus Ltd, <https://bidwell.app/>) — different industry but same phonetic landing. Soft collision.
- **Bide** — Bare. Too short, no product differentiation, trademark search would be brutal. Rejected.

### 2.8 Rejections and the "crowded market" finding

Out of 30+ candidate names I primary-source-evaluated, **only three** — Mugful, Bidewith, and Tondel — came back with no clear active product, app, or major brand in the collision search. The other ~27 were all taken by something real, including 12+ direct couples-app competitors (§1.2).

This is the single most important finding of this research pass: **a warm/playful English word that is not already a couples app is hard to find.** Three responses are available to the principal developer:

1. **Pick a finalist from §3 and pay the trademark/domain cost** of clearing it.
2. **Accept the market-saturated position** and lean into a name that explicitly says "small, private, two" so the differentiator is the _kind_ of warmth, not the name itself.
3. **Coin harder** — go further than Tondel into a fully invented word. The risk of going further is that the meaning has to be taught, which is fine for an open-source product whose audience is technical and patient, and hard for a consumer app whose audience is on a Saturday-night dating-app bender.

The finalists in §3 are a mix of (1) and (2).

---

## 3. The three finalists

### 3.1 Finalist F1 — Mugful

**Direction**: cozy domestic. **Voice**: warm, intimate, slightly playful; visual-led.

**Why it works for this product**:

- "Two mugs on a kitchen table" is the kind of image that survives a v1.1 video feature: the same couple, same mugs, now a third tile of themselves. It does not peg the product to Guess My Answer.
- Reads as a small, private place — exactly the privacy boundary the v1 design protects.
- "Mugful" is two syllables, easy to spell, hard to mispronounce. Test saying it to a friend and see if they can write it down: most can.
- Gendered-neutral; works for any adult couple, regardless of how they self-describe.
- Has room to grow: "Mugful Together Room" is a natural extension.

**Repository slug**: `mugful` (kebab-case, GitHub-friendly).
**Docker image naming** (matches the two-image architecture in `ARCHITECTURE.md`):

- `docker.io/<owner>/mugful-web:1.0.0-abc1234`
- `docker.io/<owner>/mugful-api:1.0.0-abc1234`

**Collision evidence on 2026-08-09**:

- `hub.docker.com/r/mugful` → 404 (no namespace squatted) <https://hub.docker.com/r/mugful>
- `npmjs.com/package/mugful` → 404 (no package) <https://www.npmjs.com/package/mugful>
- `websearch` for "Mugful app", "Mugful product", "Mugful couples" → no primary-source active product found.

**Risks**:

- The name is unusual. Logo and onboarding must land the meaning on first read.
- The word is compound ("mug" + "ful"), so brand-safety searches need to be done on the _compound_, not on the words alone.
- Sound-symbolic edge: "mugful" can be misread as "mug full" by a first-time reader. Disambiguate in the logo (e.g. two mugs).

**Open verification needed before adoption** (see §5).

### 3.2 Finalist F2 — Bidewith

**Direction**: invented coinage, built on the old-English verb _bide_. **Voice**: gentle, unhurried, mature, a little old-fashioned in a comforting way.

**Why it works for this product**:

- _Bide_ (verb, OE) = to stay, wait, dwell. "Bide with" = to stay with. The product's name describes what the couple does: they stay with each other, across distance.
- "Bidewith me" is a working tagline. "We bidewith" is a working verb. Few couple-app names do that.
- The name does not peg to any activity. It scales to v1.1 video ("bide with me on a call") and to future activities without rebranding.
- Reads as warm and old-fashioned in a way that matches the "mature, not childish" requirement without sounding archaic.
- Three syllables: BYDE-with. Stress on the first. Easy to say. Spelling is a slight risk (see below) but unambiguous in context.

**Repository slug**: `bidewith`. **Docker image naming**:

- `docker.io/<owner>/bidewith-web:1.0.0-abc1234`
- `docker.io/<owner>/bidewith-api:1.0.0-abc1234`

**Collision evidence on 2026-08-09**:

- `hub.docker.com/r/bidewith` → 404 (no namespace squatted) <https://hub.docker.com/r/bidewith>
- `websearch` for "Bidewith app", "Bidewith product", "Bidewith couples" → no primary-source active product found.
- Bidwell (`bidwell.app`, UK public-sector tender tool) is a soft phonetic neighbor but a different word.

**Risks**:

- Coinage: needs teaching. The first time a user sees the name, they have to read it twice.
- "Bide" is a quiet, old word. In North American English it can sound slightly bookish or even Tolkien-esque. That's a feature for the right audience and a bug for a casual one.
- "Bidewith" can be mis-spelled as "Bidewith" → "Bydewith" or "Bidewitht" in hurried typing. Worth a short spelling in the marketing copy.

**Open verification needed before adoption** (see §5).

### 3.3 Finalist F3 — Tondel

**Direction**: sound-symbolic / invented coinage. **Voice**: soft, musical, two-syllable, slightly Italian, slightly Scandinavian.

**Why it works for this product**:

- Coined from Italian _tondo_ — round, whole, complete. Reads as "a small complete thing" — a tondo is a Renaissance circular painting, but the word itself is just "round and whole" in everyday Italian.
- "Tondel" rhymes with "model" and "fondle" (rhymes, not the same word). Easy to say, two syllables, no consonant clusters. Reads warm and slightly European.
- No peg to any activity. Easily stretches to v1.1 video and later.
- Distinctive. Nobody else has it. As of 2026-08-09, no active product found in my searches.

**Repository slug**: `tondel`. **Docker image naming**:

- `docker.io/<owner>/tondel-web:1.0.0-abc1234`
- `docker.io/<owner>/tondel-api:1.0.0-abc1234`

**Collision evidence on 2026-08-09**:

- `hub.docker.com/r/tondel` → user account "Tondel Fernandes" exists, but with no public repositories (<https://hub.docker.com/r/tondel>). The _org_ namespace is unblocked, but the personal one is squatted; this is a soft risk.
- `npmjs.com/package/tondel` → 403 (suggesting a private package may exist, or rate limiting). The package is not publicly listed on the registry landing page.
- `websearch` for "Tondel app", "Tondel product", "Tondel couples" → no primary-source active product found.

**Risks**:

- Coinage: most readers have not seen the word before. The meaning has to be taught. For an open-source product whose audience is technical and patient, this is acceptable; for a casual consumer it is a hurdle.
- Italian etymology will be lost on most English readers; the name lands as "soft two-syllable round word," which is good but not specific.
- The Docker Hub personal namespace is squatted by an unrelated user. If the team ever wants to publish under the namespace `tondel/<image>`, the squat may have to be worked around.

**Open verification needed before adoption** (see §5).

---

## 4. Names considered and rejected (summary)

A short list, with reasons. Each was primary-source-checked at least once.

| Name         | Reason rejected                                                                                                       | Primary source                                                                                                                    |
| ------------ | --------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Between      | Taken by a 35M-couple product.                                                                                        | <https://between.us/?lang=en>                                                                                                     |
| Paired       | Taken by the #1 couples app.                                                                                          | <https://paired.com/>                                                                                                             |
| Couply       | Taken. Direct category overlap.                                                                                       | <https://couply.io/>                                                                                                              |
| Love Nudge   | Taken. Owned by 5 Love Languages brand.                                                                               | <https://5lovelanguages.com/resources/app>                                                                                        |
| Hearth       | Four active products.                                                                                                 | <https://hearthdisplay.com/>, <https://hearthly.app/>, <https://www.hearthsideworks.com/>, <https://www.hearthconnectedcare.com/> |
| Porch        | Public-company home insurance.                                                                                        | <https://porchgroup.com/>                                                                                                         |
| Porchlight   | Active builder + marketing.                                                                                           | <https://porchlighthomes.com/>, <https://porchlightatl.com/>                                                                      |
| Lighthouse   | Google Chrome (30,580★).                                                                                              | <https://github.com/googlechrome/lighthouse>                                                                                      |
| Snug         | Two active relationship apps.                                                                                         | <https://joinsnug.com/>, <https://get.snugplanner.com/>                                                                           |
| Polaris      | Shopify, Apache, lightup-data.                                                                                        | <https://polaris-react.shopify.com/>, <https://polaris.apache.org/>, <https://github.com/lightup-data/polaris>                    |
| Tandem       | Public-company diabetes tech.                                                                                         | <https://www.tandemdiabetes.com/products/software-apps/mobile-apps>                                                               |
| Bridge       | Three active products.                                                                                                | <https://bridgeapp.ai/>, <https://thebridgeapp.org/>, <https://brdg.app/>                                                         |
| Ourside      | Fragrance house, active e-commerce.                                                                                   | <https://ourside.nyc/>                                                                                                            |
| Ours         | Direct category overlap (couples therapy).                                                                            | <https://withours.com/>                                                                                                           |
| Ember        | Registered trademark, $83.9M-funded mug brand.                                                                        | <https://ember.com/trademarks>                                                                                                    |
| Toast        | Public-company restaurant POS.                                                                                        | <https://pos.toasttab.com/>                                                                                                       |
| Plumbline    | Active plumbing business.                                                                                             | <https://plumblineplumbingkc.com/>                                                                                                |
| Cwtch        | Two active products (privacy + SEN).                                                                                  | <https://cwtch.im/>, <https://www.cwtchcode.com/>                                                                                 |
| Twos         | Two active apps (notes + conversations).                                                                              | <https://www.twosapp.com/>, <https://twos.net/>                                                                                   |
| Hush         | Three active dating apps.                                                                                             | <https://thehush.app/>, <https://hush.dating/>, <https://www.hushhhapp.com/>                                                      |
| Kvell        | Active marketing agency.                                                                                              | <https://kvell.cc/>                                                                                                               |
| Tether       | USDT stablecoin.                                                                                                      | <https://tether.to/>                                                                                                              |
| SoftSpot     | Pet care + medical app.                                                                                               | <https://softspotapp.com/>, <https://www.softspot.online/softspot>                                                                |
| Cozy Couples | Direct LDR-app competitor.                                                                                            | <https://cozycouples.co/>                                                                                                         |
| Closer       | Direct LDR-app competitor (three products).                                                                           | <https://getcloser.app/>, <https://closerapp.co/>, <https://apps.apple.com/us/app/closer-relationship-couples/id6467502209>       |
| Twine        | Direct LDR-app competitor (two products).                                                                             | <https://www.ourtwine.app/>, <https://www.twine-couples.com/>                                                                     |
| Inkle        | US accounting SaaS, 56 employees.                                                                                     | <https://inkle.ai/>                                                                                                               |
| Inkwell      | Two active products.                                                                                                  | <https://inkwell.co/>, <https://inkwell.net/>                                                                                     |
| Fika         | Active Singapore matchmaker.                                                                                          | <https://fikaconnects.com/>, <https://apps.apple.com/se/app/fika-matchmaker-irl-events/id1528449006>                              |
| Plume        | Direct journaling-app competitor.                                                                                     | <https://getplumeapp.com/>                                                                                                        |
| Hearthly     | Active product.                                                                                                       | <https://hearthly.app/>                                                                                                           |
| Hearthside   | Active product.                                                                                                       | <https://www.hearthsideworks.com/>                                                                                                |
| Cozen        | Am Law 100 firm.                                                                                                      | <https://cozen.com/>                                                                                                              |
| Two Notes    | 18-year-old audio brand.                                                                                              | <https://two-notes.com/>                                                                                                          |
| Sundial      | Two active apps.                                                                                                      | <https://sundialapp.com/>, <https://www.thesundial.app/>                                                                          |
| Kettle       | Two active products.                                                                                                  | <https://kettle.io/>, <https://kettleweb.com/>                                                                                    |
| Cardle       | Russian discount-card app.                                                                                            | <https://www.cardle.ru/>                                                                                                          |
| Bonsai       | Used as a feature inside Better Together.                                                                             | <https://bettertogetherapp.com/>                                                                                                  |
| Linger       | No clear product collision, but meaning too abstract for a buyer-driven App Store search. Reserved as a possible alt. | n/a                                                                                                                               |
| Bellbridge   | No clear product collision. Reserved as a possible alt.                                                               | n/a                                                                                                                               |

Names with a primary-source _couples-app_ collision in particular are highlighted in §1.2 — those are the ones that will compete for the same App Store search term.

---

## 5. Open verification before adoption

Every "no primary-source collision found" in this note is a negative result from a single web search pass on 2026-08-09. Before adopting any finalist, the principal developer should run the following — and should expect them to take an afternoon, not an hour.

1. **Trademark search**:
   - USPTO TESS (United States) — <https://tmsearch.uspto.gov/>
   - TMView (EU) — <https://www.tmdn.org/tmview/>
   - EUIPO eSearch — <https://euipo.europa.eu/eSearch/>
   - WIPO Global Brand Database — <https://branddb.wipo.int/>
   - Indonesian DGIP (Ditjen KI) — <https://pdki.dgip.go.id/>
   - Search the _compound_ name, not the words. Search for goods/services class 9 (software), class 42 (SaaS), class 38 (telecommunications), class 45 (online social networking).

2. **Domain availability** (run on the day of adoption, at the registrar of choice):
   - For each finalist: `mugful.com`, `mugful.app`, `mugful.io`, `bidewith.com`, `bidewith.app`, `bidewith.io`, `tondel.com`, `tondel.app`, `tondel.io`.
   - The `.app` TLD requires HTTPS-only and is enforced by Google Registry.
   - Consider also `mugful.id`, `bidewith.id`, `tondel.id` if the project intends an Indonesian landing presence.

3. **GitHub**:
   - Confirm the exact repo name is not squatted on by a >100★ repo.
   - Check the `github.com/<finalist>` _user/org_ URL — the org is the long-term home; a squatted user account can be reported but takes time.

4. **npm and Docker Hub**:
   - `npm view <finalist>` to confirm the package name is available.
   - `docker hub search <finalist>` to confirm the org namespace is open. (Tondel is the only finalist with a personal-namespace risk here.)

5. **App Store / Play Store**:
   - Search each finalist on the day of adoption. App Store names change weekly.
   - Search the App Store for the finalist and the words "couple", "relationship", "love" and confirm the top 10 results do not already use the name.

6. **Social handles**:
   - Check `@<finalist>` on X, Instagram, TikTok, Mastodon (whatever the team plans to use).
   - Check `m.me/<finalist>` for Messenger, `<finalist>.page.link` for shortlinks.

7. **Voice readback**:
   - For each finalist, write the tagline: "______ is a private space for two." Say it out loud three times. If it sounds wrong on the third read, change the name now.

8. **Counsel**:
   - Before any public commit, a single 30-minute consult with a trademark attorney is cheaper than a rebrand. The names above are not legal advice; this note is not a legal clearance.

---

## 6. Sources

Primary sources used in this note, grouped by topic. All URLs were opened on 2026-08-09 via the available `webfetch` and `websearch_web_search_exa` tools.

### Adjacent couples / LDR apps

- Between — <https://between.us/?lang=en>, <https://apps.apple.com/us/app/between-couples-love-tracker/id458035189>, <https://play.google.com/store/apps/details?id=kr.co.vcnc.android.couple>
- Paired — <https://paired.com/>, <https://apps.apple.com/us/app/paired-couples-relationship/id1469609343>, <https://play.google.com/store/apps/details?id=com.getpaired.app>
- Couply — <https://couply.io/>, <https://apps.apple.com/us/app/couply-couples-relationship/id1484241314>, <https://play.google.com/store/apps/details?id=io.couply.android>
- Love Nudge — <https://5lovelanguages.com/resources/app>, <https://apps.apple.com/us/app/love-nudge/id495326842>, <https://play.google.com/store/apps/details?id=com.grootersproductions.challenge>
- Couplet / Couplete — <https://apps.apple.com/us/app/couplet-spice-up-relationship/id1593016036>, <https://apptopia.com/ios/app/742745050/about>
- Together: Couples App — <https://together-app.co/>
- Twogle — <https://twogle.com/>
- Closer (Blue Flow) — <https://apps.apple.com/us/app/closer-relationship-couples/id6467502209>
- getcloser.app — <https://getcloser.app/>
- closerapp.co — <https://closerapp.co/>
- Bloom Together — <https://www.bloomcouples.app/>
- Connected — <https://www.connectedcouples.app/>
- Cozy Couples — <https://cozycouples.co/>
- TwoGether — <https://gettwogether.com/>
- Tethered — <https://www.usetethered.com/>
- Nudges — <https://getnudges.app/>
- Twine (ourtwine) — <https://www.ourtwine.app/>
- Twine (twine-couples) — <https://www.twine-couples.com/>
- Dryft — <https://www.dryft.site/>
- WatchTogether — <https://watchtogether.watch/>
- Happy Couple — <https://play.google.com/store/apps/details?id=com.hip.happycouple>
- Ours Therapy — <https://withours.com/>

### Hard-collided names (§4)

- Hearth Display — <https://hearthdisplay.com/>
- Hearthly — <https://hearthly.app/>
- Hearthside Works — <https://www.hearthsideworks.com/>
- Hearth Connected Care — <https://www.hearthconnectedcare.com/>
- Porch Group — <https://porchgroup.com/>
- Porch.host — <https://www.porch.host/>
- Porchlight Homes — <https://porchlighthomes.com/>
- Porchlight Marketing — <https://porchlightatl.com/>
- Lighthouse (Google) — <https://github.com/googlechrome/lighthouse>, <https://developer.chrome.com/docs/lighthouse>
- Snug Dating — <https://joinsnug.com/>
- Snug Family Organizer — <https://get.snugplanner.com/>
- Polaris (Shopify) — <https://polaris-react.shopify.com/>
- Polaris (Apache) — <https://polaris.apache.org/>
- Polaris (lightup-data) — <https://github.com/lightup-data/polaris>
- Tandem Diabetes Care — <https://www.tandemdiabetes.com/products/software-apps/mobile-apps>
- BridgeApp.ai — <https://bridgeapp.ai/>
- The Bridge App — <https://thebridgeapp.org/>
- Bridgely — <https://bridgely.app/>
- Ourside NYC — <https://ourside.nyc/>
- Ember Technologies — <https://ember.com/>, <https://ember.com/trademarks>
- Toast, Inc. — <https://pos.toasttab.com/>
- Plumbline Plumbing — <https://plumblineplumbingkc.com/>
- Cwtch (Open Privacy) — <https://cwtch.im/>, <https://docs.cwtch.im/>
- Cwtch & Code — <https://www.cwtchcode.com/>
- Twos — <https://www.twosapp.com/>, <https://twos.net/>
- Hush — <https://thehush.app/>, <https://hush.dating/>, <https://www.hushhhapp.com/>
- Kvell Marketing — <https://kvell.cc/>
- Tether (USDT) — <https://tether.to/>
- SoftSpot — <https://softspotapp.com/>, <https://www.softspot.online/softspot>
- Inkle — <https://inkle.ai/>
- Inkwell — <https://inkwell.co/>, <https://inkwell.net/>
- Fika — <https://fikaconnects.com/>, <https://apps.apple.com/se/app/fika-matchmaker-irl-events/id1528449006>
- Plume — <https://getplumeapp.com/>, <https://apps.apple.com/tm/app/plume-private-journal-diary/id6754373902>
- Cozen O'Connor — <https://cozen.com/>
- Two notes Audio Engineering — <https://two-notes.com/>
- Sundial (Tier 9 Digital) — <https://sundialapp.com/>
- Sundial Family / Browser — <https://www.thesundial.app/>
- Kettle.io — <https://kettle.io/>
- Kettle Web — <https://kettleweb.com/>
- Bidwell.app — <https://bidwell.app/>

### Package / namespace lookups (negative results for finalists)

- Docker Hub: `mugful` → 404, `kettle` → empty, `bellbridge` → 404, `bidewith` → 404, `polaris` → 404, `hearth` → empty, `tandem` → empty, `tondel` → user "Tondel Fernandes" exists, no public images, `linger` → empty, `tondo` → empty, `ourside` → (not checked in this pass), `hearthly` → (not checked in this pass).
- npm: `mugful` → 404, `hearth` → 12-year-old dormant package, `tandem` → 12-year-old dormant package, `threadline` → active package (different domain), `closer` → 11-year-old dormant Clojure parser, `tondo` → 5-year-old dormant CLI, `tondel` → 403 (treated as ambiguous, not as confirmed available).

### Reference

- Repository docs read for context: `README.md`, `docs/PRODUCT-SPEC.md`, `docs/ARCHITECTURE.md`, `docs/SMTP-OPTIONS-RESEARCH.md` (style reference), `CLAUDE.md`.

# Plan: Categories Expansion + Location Handling

## Vision
Fetchwork = TaskRabbit + Bark + Craigslist + Upwork + Fiverr in one platform.
Must support **remote digital work** AND **local physical work** equally.

---

## 1. New Category System

### Current (12 categories — all digital/remote)
`web_development`, `mobile_development`, `design`, `writing`, `marketing`, `data_entry`, `customer_service`, `translation`, `video_editing`, `photography`, `consulting`, `other`

### Proposed (24 categories — balanced remote + local)

**Digital / Remote**
| Category | Subcategories (examples) |
|---|---|
| `web_development` | Frontend, Backend, Full Stack, WordPress, Shopify |
| `mobile_development` | iOS, Android, React Native, Flutter |
| `design` | Graphic Design, UI/UX, Logo, Brand Identity |
| `writing` | Copywriting, Blog/SEO, Technical, Ghostwriting |
| `marketing` | Social Media, SEO, Email, PPC, Influencer |
| `video_editing` | YouTube, Commercials, Animation, Motion Graphics |
| `music_audio` | Voiceover, Podcasting, Music Production, Mixing |
| `data_entry` | Transcription, Spreadsheets, Research, Scraping |
| `virtual_assistant` | Admin, Scheduling, Customer Service, Bookkeeping |
| `translation` | Document, Website, Subtitles, Interpretation |
| `consulting` | Business, Legal, Financial, Career Coaching |
| `tutoring` | Academic, Test Prep, Language, Music Lessons |

**Local / Physical**
| Category | Subcategories (examples) |
|---|---|
| `home_repair` | Handyman, Plumbing, Electrical, Carpentry, Painting |
| `cleaning` | House Cleaning, Deep Clean, Move-In/Out, Window |
| `moving_hauling` | Local Moving, Furniture, Junk Removal, Packing |
| `landscaping` | Lawn Care, Garden, Tree Trimming, Snow Removal |
| `delivery` | Grocery, Package, Furniture Delivery, Courier |
| `assembly` | Furniture, IKEA, Shelving, Equipment |
| `auto_services` | Detailing, Oil Change, Tire, Mobile Mechanic |
| `pet_care` | Dog Walking, Pet Sitting, Grooming |
| `event_help` | Setup/Teardown, Catering Staff, Bartending, DJ |
| `personal_care` | Hair, Makeup, Massage, Personal Training |
| `photography_local` | Portraits, Events, Real Estate, Product |
| `other_local` | Odd Jobs, Errands, Waiting in Line, General Labor |

**Total: 24 categories** (12 digital + 12 local)

### Implementation
- Shared `CATEGORIES` constant in `server/config/categories.js` (single source of truth)
- Each category has: `id`, `label`, `type` (`remote` | `local` | `both`), `subcategories[]`, `icon`
- Both Job and Service models import from this file
- Frontend also imports (or API endpoint `/api/categories`)

---

## 2. Location Schema Changes

### Problem
- **Services:** No location at all (assumed remote)
- **Jobs:** `location` is a plain string, `isRemote` is boolean — can't do proximity search
- **Users:** `location` is a plain string — no coordinates

### Solution: Structured Location Object

```js
// Shared location sub-schema
const locationSchema = {
  type: {
    type: String,
    enum: ['remote', 'local', 'hybrid'],  // hybrid = can do either
    default: 'remote'
  },
  address: {        // Human-readable (e.g., "Concord, CA")
    type: String,
    trim: true,
    default: ''
  },
  city: { type: String, trim: true, default: '' },
  state: { type: String, trim: true, default: '' },
  zipCode: { type: String, trim: true, default: '' },
  coordinates: {    // For proximity search
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: { type: [Number], default: [0, 0] }  // [lng, lat]
  },
  serviceRadius: {  // How far the worker will travel (miles)
    type: Number,
    default: 25
  }
};
```

### Where it gets added:
- **Service model** — new `location` field (replaces nothing, it's new)
- **Job model** — replaces `location` (string) + `isRemote` (boolean)
- **User model** — replaces `location` (string)

### MongoDB Geospatial Index
```js
schema.index({ 'location.coordinates': '2dsphere' });
```
This enables `$nearSphere` queries — "find services within X miles of me."

---

## 3. Search / Browse Updates

### Backend (routes/search.js, routes/services.js, routes/jobs.js, routes/freelancers.js)
- Add `locationType` filter: `remote` | `local` | `all`
- Add `near` param: zip code or `lat,lng` — triggers proximity search
- Add `radius` param: distance in miles (default 25)
- Geocoding: zip code → coordinates (use free geocoding API or static zip-to-coords lookup)

### Frontend (Browse pages, Create Service, Post Job)
- Add "Remote / Local / Either" toggle on browse pages
- Location autocomplete on Create Service + Post Job
- Distance filter slider (5 / 10 / 25 / 50 miles)
- Show distance badge on cards for local results
- Map view (future — not in this PR)

---

## 4. Migration Strategy

Since the DB has only 2 services and 0 jobs, migration is trivial:
- Update the 2 existing services to include default location (remote)
- No data loss risk
- Add a one-time migration script just in case

---

## 5. PR Breakdown (suggested)

| PR | Scope | Size |
|---|---|---|
| **#116** | Categories config + model schema changes (Service, Job, User) + migration | Medium |
| **#117** | Backend routes: search/filter by location + category | Medium |
| **#118** | Frontend: updated category selectors, location fields, browse filters | Large |

Or combine into one big PR if you prefer moving fast.

---

## 6. Decisions (Confirmed with Chaz)

- ✅ 24 categories to start — easy to add more later (config file)
- ✅ 3 PRs (schema → backend routes → frontend)
- ✅ Search by distance + zip/area code
- ⬜ Geocoding approach: TBD (leaning free — Nominatim/OpenStreetMap)
- ⬜ Map view: list-only for now, map later

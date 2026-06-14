# Fetchwork Scheduling Rules

> Canonical source of truth for how scheduling, availability, sessions, and bookings interact.
> Agreed: 2026-06-13. Do not deviate without explicit decision.

## Terms

| Term | Meaning |
|------|---------|
| **General availability** | Broad windows when a freelancer is open to being booked. Powers dynamic slot generation. Not an event, not a promise. |
| **Service-specific availability** | Narrows general availability for a specific service. Does not create sessions. |
| **Session** | A specific thing happening at a specific time. Blocks the freelancer's calendar. |
| **Class** | A group session with capacity, usually on a fixed schedule. A *type* of session, not a separate concept. |
| **Booking** | A client claiming a time slot (private) or a seat (group). |
| **Blackout** | Freelancer is unavailable. Overrides everything. |

## Priority Hierarchy (strongest → weakest)

| Priority | Source | Meaning |
|---------:|--------|---------|
| 1 | Blackouts / unavailable blocks | Not available, no matter what |
| 2 | Confirmed bookings | Time is already claimed |
| 3 | Fixed sessions / classes / workshops | Specific inventory exists |
| 4 | External calendar blocks | (Future) Google Calendar, etc. |
| 5 | Service-specific availability | Narrows when a service can be booked |
| 6 | General availability | Broad default windows |
| 7 | Generated dynamic slots | What clients finally see |

**Dynamic private slots are generated last.** They only appear after subtracting everything above.

## Service Scheduling Modes

Each service has a scheduling mode that determines how clients book it:

| Mode | Behavior | Example |
|------|----------|---------|
| `DYNAMIC_PRIVATE` | Client picks from generated availability slots | Private tutoring, dog walking |
| `FIXED_PRIVATE` | Freelancer sets specific appointment times | Therapy sessions at set times |
| `FIXED_GROUP` | Fixed schedule with capacity, clients book seats | Yoga class, cooking workshop |
| `REQUEST_BASED` | No scheduling at creation. Negotiate through proposals/messages | Fence building, web development |

## Conflict Rules

### Rule 1: Fixed sessions override general availability
A fixed session/class is intentional inventory. The freelancer is specifically saying "I am available for this thing at this time." General availability does not prevent creating fixed sessions.

**UI:** Show a soft warning if outside general availability.

### Rule 2: Fixed sessions block private booking slots
The SlotEngine MUST subtract SessionOccurrence windows from dynamic private availability. This is the critical bridge between old and new systems.

### Rule 3: Existing bookings block new sessions
Cannot create a session that conflicts with a confirmed booking. For recurring templates, show which dates conflict and skip those occurrences.

### Rule 4: Blackouts block everything
Blackouts cancel/hide session occurrences and prevent dynamic slot generation. No bookings can be created during blackout windows.

### Rule 5: No overlapping active sessions (MVP)
A freelancer cannot have two active sessions at the same time. No `allowOverlap` for MVP.

### Rule 6: Changing general availability does NOT affect existing sessions
Fixed sessions are actual inventory. Narrowing general availability does not silently cancel existing classes.

**UI:** Warn "You have existing sessions outside your new availability. They remain active unless you cancel them."

### Rule 7: Bookings block the freelancer, not just the service
A freelancer is one person. A dog walking booking at 10am blocks guitar lessons at 10am too.

## Slot Generation Algorithm

```
getAvailableWindows(freelancerId, date, serviceId?) {
  1. Start with general availability for this day of week
  2. If serviceId provided, narrow by service-specific availability
  3. Subtract blackouts overlapping this date
  4. Subtract confirmed bookings (all services, this freelancer)
  5. Subtract active SessionOccurrences (this freelancer)
  6. Subtract external calendar blocks (future)
  7. Apply buffer time between remaining windows
  8. Slice into slots based on service duration
  9. Filter out slots within booking cutoff window
  10. Return remaining bookable slots
}
```

## Session Occurrence Generation

- **Rolling window:** 8 weeks ahead (configurable per template)
- **Idempotent:** Unique constraint on `(templateId, startTime)` — safe to run twice
- **Frequency:** Daily cron job + on-demand when client views schedule
- **Conflict check at generation:** Skip occurrences that conflict with existing confirmed bookings
- **Blackout check at generation:** Skip occurrences that fall within blackout windows
- **Template changes:** Only affect newly generated occurrences. Existing occurrences are immutable.

## Cancellation Rules

- Seats reopen when a client cancels (if cancellation policy allows)
- Waitlisted clients are notified (not auto-assigned in MVP)
- Freelancer can cancel individual occurrences (not the whole template)
- `bookedCount` decremented atomically on cancellation
- Refund follows the template's `cancellationHours` policy

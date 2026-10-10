# ReturnTag API

Base URL: `/api` (Vite proxies it to `http://localhost:8001` in development).

- Errors always look like `{ "message": "..." }` with a 4xx/5xx status.
- Owner/admin routes need `Authorization: Bearer <token>` (from register/login).
- Finder routes need no account. A finder proves access to their own report with
  the `X-Finder-Token: <token>` header. The token is returned once when the report
  is created and only its hash is stored.

## Shared shapes

```jsonc
// User
{ "id": "…", "name": "Asha", "email": "asha@example.com", "role": "user" | "admin",
  "plan": "free" | "premium", "tagLimit": 5 | null, // null = unlimited
  "notify": { "email": true, "push": true } }

// Tag (owner view)
{ "id": "…", "code": "K7XQ2M9PRA", "url": "https://app/t/K7XQ2M9PRA",
  "item": { "name": "MacBook Pro 14", "category": "laptop", "description": "Sticker on lid" },
  "publicLabel": "Silver laptop",            // the only item text a finder sees
  "publicMessage": "Thank you! Any library desk is fine.",
  "rewardOffered": true,
  "status": "active" | "lost" | "found" | "returned" | "disabled",
  "lostAt": null, "foundAt": null, "returnedAt": null,
  "scanCount": 3, "lastScannedAt": "2026-10-10T10:00:00.000Z",
  "openReports": 1, "unread": 2,              // unread finder messages across open reports
  "pendingTransfer": { "toEmail": "x@y.com", "expiresAt": "…" } | null,
  "createdAt": "…", "updatedAt": "…" }

// Report summary (owner inbox). A report is one finder conversation.
{ "id": "…", "status": "open" | "resolved" | "spam",
  "tag": { "id": "…", "code": "…", "publicLabel": "…", "category": "laptop", "status": "found" },
  "alias": "Finder" ,                         // finder-chosen nickname, default "Finder"
  "excerpt": "Found it near gate 4…", "hasLocation": true, "hasPhoto": false,
  "ownerUnread": 2, "lastMessageAt": "…", "createdAt": "…" }

// Report detail = summary + location
{ …summary, "location": { "text": "Front desk, Central Library",
                          "lat": 28.613, "lng": 77.209, "precision": "approx" | "exact" } | null }

// Message
{ "id": "…", "sender": "owner" | "finder" | "system", "body": "…", "createdAt": "…" }

// Incident (one lost→recovered cycle of a tag)
{ "id": "…", "status": "open" | "recovered" | "cancelled", "startedBy": "owner" | "finder",
  "lostAt": "…" | null, "foundAt": "…" | null, "closedAt": "…" | null, "hours": 5.2 | null }
```

Categories: `bag, laptop, phone, keys, wallet, luggage, headphones, bike, other`.

Tag codes are 10 characters from `23456789ABCDEFGHJKMNPQRSTVWXYZ` (no 0/O, 1/I/L, U).
The API accepts any case and ignores dashes/spaces, so `k7xq2-m9pra` works. Show them as
`K7XQ2-M9PRA`. The QR code encodes `tag.url`.

## Auth

| Method | Path | Body | Response |
|---|---|---|---|
| POST | `/auth/register` | `{ name, email, password }` | `201 { token, user }` |
| POST | `/auth/login` | `{ email, password }` | `{ token, user }` |
| GET | `/auth/me` | | `{ user }` |
| PATCH | `/auth/me` | `{ name?, notify?: { email?, push? } }` | `{ user }` |

## Push notifications (auth)

| Method | Path | Body | Response |
|---|---|---|---|
| GET | `/push/key` | | `{ publicKey }` (`null` when push isn't configured) |
| POST | `/push/subscribe` | `{ subscription }` (`PushSubscription.toJSON()`) | `{ ok: true }` |
| POST | `/push/unsubscribe` | `{ endpoint }` | `{ ok: true }` |

Push payload (JSON): `{ title, body, url }`; the service worker opens `url` on click.

## Tags (auth, owner)

| Method | Path | Body | Response |
|---|---|---|---|
| GET | `/tags` | | `{ tags: Tag[] }` (lost/found first) |
| POST | `/tags` | `{ item: { name, category, description? }, publicLabel, publicMessage?, rewardOffered? }` | `201 { tag }`; `403` when the free plan limit is reached |
| POST | `/tags/claim` | `{ code, claimCode }` | `{ tag }`: activates a pre-printed tag (it still needs item details, see PATCH) |
| GET | `/tags/:id` | | `{ tag, reports: ReportSummary[], incidents: Incident[] }` |
| PATCH | `/tags/:id` | any of `{ item, publicLabel, publicMessage, rewardOffered }` | `{ tag }` |
| POST | `/tags/:id/status` | `{ status: "lost" \| "returned" \| "active" \| "disabled" }` | `{ tag }`; `409` for an invalid transition |
| POST | `/tags/:id/relink` | same body as create | `{ tag }`: reuse the sticker on a new item; open reports are closed |
| POST | `/tags/:id/transfer` | `{ email }` | `{ tag, transferUrl }`: also emailed to the recipient |
| DELETE | `/tags/:id/transfer` | | `{ tag }`: cancels a pending transfer |
| POST | `/tags/transfer/preview` | `{ token }` | `{ transfer: { publicLabel, category, code, toEmail, expiresAt } }` |
| POST | `/tags/transfer/accept` | `{ token }` | `{ tag }`: must be logged in as `toEmail` |

Status transitions the owner can make:

```
active | returned ──► lost          (opens an incident)
lost   | found    ──► returned      (closes the incident as recovered, resolves open reports)
lost            ──► active        (false alarm: incident cancelled)
returned | disabled ─► active
any             ──► disabled      (stops accepting reports)
```

A finder report moves `active | lost | returned` to `found` automatically.

## Reports (auth, owner)

| Method | Path | Body | Response |
|---|---|---|---|
| GET | `/reports?status=open\|resolved\|spam\|all` | | `{ reports: ReportSummary[] }` (default `open`) |
| GET | `/reports/:id` | | `{ report: ReportDetail, messages: Message[] }`: clears `ownerUnread` |
| POST | `/reports/:id/messages` | `{ body }` | `201 { message }` |
| PATCH | `/reports/:id` | `{ action: "returned" \| "close" \| "spam" \| "reopen" }` | `{ report, tag }` |
| GET | `/reports/:id/photo` | | `image/jpeg` (fetch as a blob with the auth header) |

`spam` also blocks that finder from reporting any of the owner's tags again.

## Public: finder (no account)

| Method | Path | Body | Response |
|---|---|---|---|
| GET | `/public/tags/:code` | | `{ tag: { code, publicLabel, category, publicMessage, rewardOffered, state, acceptingReports } }` |
| POST | `/public/tags/:code/reports` | `multipart/form-data` or JSON (see below) | `201 { reportId, token, finderUrl }` |
| GET | `/public/reports/:id` | header `X-Finder-Token` | `{ report: { id, status, alias, createdAt, tag: { code, publicLabel, category } }, messages }` |
| POST | `/public/reports/:id/messages` | `{ body }` + header `X-Finder-Token` | `201 { message }` |

`state` is `"lost" | "found" | "ok" | "unclaimed" | "inactive"`. Unknown codes return `404`.
No owner information is ever returned.

Report fields:

| Field | Notes |
|---|---|
| `message` | required, 5–1000 chars. Links are removed |
| `alias` | optional nickname shown to the owner (max 40) |
| `email` | optional; stored encrypted, never shown to the owner, used only to tell the finder about replies |
| `locationText` | optional, max 140, e.g. "Left it at the front desk" |
| `lat`, `lng`, `precision` | optional; `precision` is `approx` (default, rounded to ~100 m) or `exact` |
| `photo` | optional image file (JPEG/PNG/WebP, max 5 MB); re-encoded server-side, which strips EXIF/GPS |
| `website` | honeypot: must be empty |
| `elapsedMs` | ms the form was open before submitting; under 3000 is rejected as a bot |
| `captchaToken` | Cloudflare Turnstile token; required only when the server has `TURNSTILE_SECRET_KEY` |

`finderUrl` is `<app>/r/<reportId>#<token>`. The token lives in the URL fragment so it
never reaches server logs or `Referer` headers. The client reads it and sends `X-Finder-Token`.

## Stats

| Method | Path | Response |
|---|---|---|
| GET | `/stats/public` | `{ tagsProtected, itemsReturned, avgRecoveryHours, reportsSent }` |
| GET | `/stats/me` (auth) | see below |

```jsonc
{ "tags": { "total": 4, "active": 2, "lost": 1, "found": 1, "returned": 0, "disabled": 0 },
  "scans": 12, "reports": { "total": 3, "open": 1, "unread": 2 },
  "incidents": { "total": 3, "recovered": 2, "cancelled": 0, "open": 1 },
  "recoveryRate": 0.67,            // recovered / (recovered + open); false alarms (cancelled) excluded; null if none
  "avgRecoveryHours": 5.2,         // null if nothing recovered yet
  "monthly": [{ "month": "2026-05", "lost": 1, "recovered": 1 }],   // last 6 months, oldest first
  "recent": [{ "tagId": "…", "publicLabel": "Silver laptop", "closedAt": "…", "hours": 3.5 }] }
```

## Admin (auth, role `admin`)

| Method | Path | Body | Response |
|---|---|---|---|
| GET | `/admin/stats` | | `{ users, premiumUsers, tags: { total, unclaimed, active, lost, found, returned, disabled }, reports: { total, open, spam }, incidents: { total, recovered }, recoveryRate, avgRecoveryHours }` |
| GET | `/admin/batches` | | `{ batches: [{ id, name, organization, count, claimed, createdAt }] }` |
| POST | `/admin/batches` | `{ name, organization?, count }` (1–500) | `201 { batch, tags: [{ code, url, claimCode }] }`: claim codes are shown **only once** |
| GET | `/admin/batches/:id/tags` | | `{ batch, tags: [{ code, url, claimed }] }` |
| GET | `/admin/reports?status=spam` | | `{ reports: [{ id, status, excerpt, tagCode, ownerEmail, createdAt }] }` |
| PATCH | `/admin/users/plan` | `{ email, plan }` | `{ user }` |

Make the first admin with `npm run make-admin -- you@example.com` in `server/`.

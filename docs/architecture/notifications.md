# Phase 5 — Multi-Channel Notification Service

A distinct module (`src/notification-service/`) from Phase 3's `src/notifications/` (in-app workshop notifications — job overdue, QC ready, etc.). Phase 5's service is the multi-channel delivery layer: email/SMS/WhatsApp/push/in-app/webhook, with templates, retry, delivery tracking, and per-user preferences.

## Provider pattern (`providers/notification-provider.interface.ts`)

Each channel implements the same `NotificationProvider` interface (`send(dispatch)` → success/failure). Two are genuinely real:

- **`InAppProvider`** — a no-op by design; an in-app notification's "delivery" is just the `NotificationDispatch` row existing for the recipient to read via the API, no external send step needed.
- **`WebhookProvider`** — a real HTTP `POST` to a configured URL, with real signature/payload — verified in tests against a real webhook receiver via `nock`.

EMAIL/SMS/WHATSAPP/PUSH all use a shared **`ConsoleLogProvider`** stand-in — there is no real mail server, Twilio/WhatsApp Business API, or push-notification credential in this environment. Rather than fabricate delivery, these channels log the fully-rendered message to console and record the dispatch as if sent, clearly labeled as a stand-in in code comments and this doc. Swapping in a real provider (SendGrid, Twilio, FCM) is an implementation of the same three-method interface, not a rewrite of `NotificationService`.

## `NotificationService` (`notification.service.ts`)

`send()` renders the message via `renderPromptTemplate` — reused from Phase 4's `prompt-registry` rather than building a second templating engine, since the need (interpolate named variables into a versioned template string) is identical. `attemptDelivery()` dispatches through the channel's provider; `retryFailed()` retries up to `MAX_ATTEMPTS = 3`; `setPreference()`/`listPreferences()` manage per-user per-channel opt-in/opt-out (`NotificationPreference`); `listHistory()` reads back `NotificationDispatch` rows for delivery tracking.

## Endpoints (`notification.controller.ts`)

`POST /notifications/send`, `POST /notifications/:id/retry`, `GET /notifications/preferences`, `PUT /notifications/preferences`, `GET /notifications/history`.

## Tests

`notification.integration-spec.ts` (7 tests, real Postgres + real webhook delivery via `nock`) — send/retry/preference/history, across all provider types.

## Known limitations

- EMAIL/SMS/WHATSAPP/PUSH are honest console-log stand-ins, not real deliveries — see above. No real credentials exist to test against in this environment.
- No delivery-time batching/digest logic — each `send()` call dispatches immediately per-recipient.

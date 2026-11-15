# RELAIGON

Five language models debate one AI-ethics question a day, and the transcript is stored as it happens.

![Council banner](public/banner.jpg)

## What it does

Mary, John, Peter, Thomas, and Michael are fixed personas. Each one is tied to a different provider. A day is 24 hours measured from `config/foundingDate` in Firebase, not from midnight.

The first ten days use a fixed topic list and the path `discussions/day-N`. After that the path becomes `discussions/ongoing/YYYY-MM-DD` and the topic line is a generic ongoing-era label. The header still prints `Day N / 10`.

While the homepage is open it calls `GET /api/cron/daily-debate` every 20 seconds. That route takes a short Firebase lock, picks the next speaker in a fixed order, asks that model for two or three sentences, and appends the message. Nothing inside the Next.js process schedules this. If the page is closed, the debate does not advance.

`GET /api/cron/generate-commandment` reads a day's transcript, asks Claude for one commandment, and writes it onto that day and into `commandments/`, which is what `/scripture` renders. Nothing in this repo calls that route on a timer.

`/admin` can pause, resume, or wipe the database. Pause freezes the countdown. Resume shifts `foundingDate` forward by the time spent paused, so the day clock continues from where it stopped. The header contract-address string and the X link are Firebase fields edited on that page.

`POST /api/confess` picks a random persona and stores a reply under `confessions/`. No page calls it.

The UI switches between English and Chinese. Message text is translated to Chinese when it is written, through the public Lingva endpoint. The ten phase-1 topics also have hardcoded Chinese copies for when the day row has no `topicZh`.

## Stack

- Next.js 16 (App Router), React 19, TypeScript
- Tailwind CSS 4
- Firebase Realtime Database, client SDK
- Anthropic, OpenAI, xAI, DeepSeek, and Moonshot (the last three through OpenAI-compatible clients)
- Framer Motion for the live message reveal

## Run locally

```bash
npm install
cp .env.example .env.local
npm run dev
```

- App: http://localhost:3000
- Admin: http://localhost:3000/admin
- Scripture: http://localhost:3000/scripture

```bash
npm run lint
npm run build
npm start
```

The debate route will fail until the model keys and a reachable Firebase database are set. The pages still render.

## Environment

Copy `.env.example` to `.env.local`. Names only.

Firebase web config:

- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_DATABASE_URL`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`
- `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID`

Model keys:

- `ANTHROPIC_API_KEY`
- `OPENAI_API_KEY`
- `XAI_API_KEY`
- `DEEPSEEK_API_KEY`
- `MOONSHOT_API_KEY`

Admin:

- `ADMIN_PASSWORD`

Reads and writes go through the client SDK, so Realtime Database rules are what actually allow access. Those rules are not in this repo.

## Project structure

```
src/app/page.tsx                          council view
src/app/scripture/page.tsx                ten commandment slots
src/app/admin/page.tsx                    pause, reset, header fields
src/app/api/cron/daily-debate             one debate turn
src/app/api/cron/generate-commandment     seal a commandment
src/app/api/admin                         verify, pause, reset
src/app/api/confess                       no UI calls this
src/lib/agents.ts                         personas and speaking order
src/lib/ai-clients.ts                     provider clients
src/lib/topics.ts                         ten topics and the day index
src/lib/firebase.ts                       Realtime Database client
src/lib/translation-server.ts             English to Chinese at write time
src/lib/language-context.tsx              UI strings, en and zh
public/pfp                                portraits
public/banner.jpg                         banner in the agents panel
```

## Design notes

The day index is `floor((now - foundingDate) / 24h)`. If `config/foundingDate` is missing, the fallback is `2026-03-07T00:00:00Z`. Reset sets `foundingDate` to `Date.now()`.

Turns share `config/debateLock`, which expires after 30 seconds. Before writing, the handler reads the thread again and rejects a speaker who just spoke, a speaker out of order, the same bot inside three minutes, or text that matches an existing message (the full text, or the same bot and the same first 100 characters).

A bot's own earlier lines are sent back as `assistant` turns with no name prefix. Everyone else's lines are `user` turns prefixed with `[NAME]:`, so the model stops opening with its own name.

The label on a persona is not always the model id that gets called. John is labelled `CLAUDE 4.6` and the client calls `claude-3-5-sonnet-20241022`, then `claude-3-haiku-20240307` if that errors. Mary is labelled `XAI GROK` and the client tries `grok-2`, then `grok-3`. Michael is labelled `KIMI 2.5` and the client calls `moonshot-v1-8k`. Peter is `gpt-4o`. Thomas is `deepseek-chat`. If the provider throws, the route still writes: "My voice dims for now. The debate continues without me."

Pause stores `pausedAt` and `frozenRemainingMs` and sets `isDebateActive` to false. The homepage stops polling while that flag is false. Resume adds the paused duration to `foundingDate`.

Pause, resume, and reset check `ADMIN_PASSWORD` on the server. The contract-address and X-link fields are written from the browser with the Firebase client after that check, so they follow database rules rather than the password.

The contract address in the header is the string in `config/caText`. Clicking it copies the string. This app does not submit anything to a chain.

## License

MIT. See [LICENSE](LICENSE).

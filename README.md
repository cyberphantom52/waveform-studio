# Waveform Studio

Next.js 16 app for importing, inspecting, transforming, and exporting haptic waveform `.bin` files.

## Runtime and package manager

- Node: `22.21.1` (see `.nvmrc`)
- Minimum supported Node: `20.9+`
- Package manager: `npm`
- Lockfile: `package-lock.json`

## Recommended setup

For local work and cloud agents, prefer:

```bash
npm ci
```

That uses the committed lockfile and gives reproducible installs.

## Agent/bootstrap workflow

To provision the repo and verify it is ready for work:

```bash
npm run setup:agent
```

That script will:

1. Run `npm ci` when `package-lock.json` is present
2. Fall back to `npm install` otherwise
3. Run `npm run lint`
4. Run `npm run build`

If an environment only wants dependencies installed without lint/build verification:

```bash
VERIFY_PROJECT=0 npm run setup:agent
```

## Daily commands

Start the dev server:

```bash
npm run dev
```

Run lint:

```bash
npm run lint
```

Run a production build:

```bash
npm run build
```

Run the full verification pass:

```bash
npm run verify
```

Serve the production build:

```bash
npm run start
```

Open [http://localhost:3000](http://localhost:3000) after starting the app.

## Environment notes

- No project secrets are required for install, lint, build, or local dev
- The app uses `next/font/google`, so preserving `.next/cache` helps repeated builds
- Caching `node_modules` and `~/.npm` improves cloud-agent startup times

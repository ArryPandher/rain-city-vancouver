# Vercel hosting

Public game: https://rain-city-vancouver.vercel.app/

GitHub Pages mirror: https://arrypandher.github.io/rain-city-vancouver/

## Project and build

- Vercel scope: `arry-3467s-projects`
- Project: `rain-city-vancouver`
- Preset: Vite; command `npm run build`; output `dist/`.
- Vite uses a relative base (`./`), so both hosting roots work.
- Hashed `/assets/` bundles use immutable one-year caching. Unhashed model and texture paths retain Vercel's normal cache behavior.
- `.vercelignore` excludes Git internals, dependencies, local artifacts, previous build output and environment files. `.vercel/` stays local and ignored by Git.

## Deploy an update

From the repository root, with the existing Vercel CLI login:

```sh
vercel link --yes --project rain-city-vancouver --scope arry-3467s-projects
vercel deploy --prod --yes --scope arry-3467s-projects
```

Do not commit `.vercel/` or local environment files. Linking may create a local OIDC-token environment file; the first deployment's freshly generated token-only file was removed before upload. No application environment variables are needed for this static game.

## GitHub connection

**Automatic GitHub deployments are not configured.** The connection attempt for `ArryPandher/rain-city-vancouver` returned: “You need admin or write access to the repository … to link it.” The Vercel-connected GitHub identity needs the correct repository access before that connection can be made. Direct authenticated CLI deployment succeeded without changing GitHub app permissions or account settings. Use the manual command above for updates in the meantime.

GitHub Pages remains connected through the existing repository workflow.

## First verified deployment

- Source/config commit: `eaeff2c`.
- Deployment: `dpl_6WdoMs7HC4Z6iDttsv5q9CpUamvt` (production, Ready).
- Inspection: https://vercel.com/arry-3467s-projects/rain-city-vancouver/6WdoMs7HC4Z6iDttsv5q9CpUamvt
- Runtime bundle: `index-f3VmwyCG.js`, 2,340,662 bytes; SHA256 `45723dae4153146e608c8a1d1f59106286020b4e129a3ac1bae299d823d48917`. Identical to the previously verified filming release.
- Anonymous public index and bundle retrieval succeeded; all 223 public assets returned HTTP 200. Hashed-bundle cache header verified.
- Native Codex browser: startup, Harbour Green map arrival, walking approach and descent along the Bute steps passed, with the fountain/harbour/mountain view visible. No recorded browser warnings or errors. This is a short hosting/gameplay check, not a sustained performance or AAA-fidelity assessment.
- Build passed TypeScript checking and Vite compilation. This deployment changed hosting configuration and documentation, not game code.

The filming script uses the Vercel link and features Canada Place, Harbour Green Park, Gastown and Robson Gallery, with Cambie Bridge as an optional extra.

# Dashboard de rotina

## Releasing

- Every change ships: bump `src/version.js` and add an entry to
  `src/versionHistory.js` (summary in Portuguese), then open a PR to `main`
  and merge it right away. The owner pre-approved releases — don't wait for
  a "pode liberar". Vercel deploys from `main`.
- Before merging, `npm run build` and `npm run lint` must pass.

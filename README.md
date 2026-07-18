# Dashboard de rotina

React + Vite implementation of the "Dashboard de rotina" design (see `../README.md`,
`../chats/`, and `../project/design_handoff_dashboard_rotina/README.md` for the
original design handoff this was built from).

## Run

```bash
npm install
npm run dev
```

## Structure

- `src/data/seedData.js` — sample/seed data. Every external-integration field
  (HubSpot, Lembretes, TickTick, Notion, Downloads/Backlog/Fotos counts) is
  static sample data — swap for real API calls when wiring up those
  integrations.
- `src/state/` — reducer + `useDashboardState` hook. All state lives here,
  persisted to `localStorage` on every change, with a midnight auto-reset for
  the Start Day / Ending the day checklists.
- `src/utils/` — pure derived-data calculations (agenda positioning, pending
  counts, habit/goal percentages, sleep chart bars) and date/time formatting.
- `src/components/` — presentational building blocks (Header, SummaryStrip,
  ChecklistCard, AgendaCard, StatFolderCard, etc.).
- `src/views/` — the three tab bodies: `HojeView`, `SaudeView`, `BacklogView`.

## Notes

- Refresh (⟳) buttons update each module's "atualizado às" timestamp only —
  they don't fetch real data yet, matching the design reference. Wire real
  API calls into the corresponding `REFRESH` dispatch sites in
  `src/views/*.jsx` when integrating each service.
- Delete confirmations use the browser's native `confirm()`, matching the
  design reference.

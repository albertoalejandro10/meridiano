# Charts

Reusable chart components for BetoTracker. All charts wrap [nuxt-charts](https://nuxtcharts.com) (`vue-chrts`/Unovis under the hood), which is registered as a Nuxt module — its components (`AreaChart`, `LineChart`, `BarChart`, `DonutChart`, …) are auto-imported.

## Conventions

- One chart = one `.vue` component in this folder. Nuxt builds the component name from path + file: `chart/Sparkline.vue` → `<ChartSparkline>`. So the file holds only the suffix (`Sparkline.vue`, `NetWorth.vue`) and the folder provides the `Chart` prefix.
- Charts are **presentational only**: they receive prepared data via props and render it. Data fetching/derivation lives in pages, composables, or stores.
- Time series use the shape `{ date: Date, value: number }[]` and `x-key="date"`.
- Dates are formatted with the helpers in `app/utils/dates` (`formatShortDate`, …); money with `formatMoney` from `app/utils`.
- Colors come from Nuxt UI CSS variables so they follow the theme and dark mode:
  `var(--ui-primary)`, `var(--ui-success)`, `var(--ui-error)`.

## Current charts

| Component | Use |
| --- | --- |
| `<ChartSparkline :data="series" />` | Tiny trend line (account rows, cards). Auto-colors green/red by trend. Optional `height` (default 48). |
| `<ChartNetWorth :data="series" :currency="'USD'" />` | Net worth area chart for the home page. Optional `height` (default 250). |

## Adding a new chart

1. Create `MyThing.vue` here (used as `<ChartMyThing>`); accept `data` (and whatever options it needs) as props.
2. Render a nuxt-charts component (`AreaChart`, `BarChart`, …) inside. Useful props: `hide-legend`, `hide-tooltip`, `hide-x-axis` / `hide-y-axis`, `:x-grid-line="false"`, `x-formatter` / `y-formatter`, `categories` (record of `{ name, color }` per y-key).
3. Use it directly in any page as `<ChartMyThing …>` and document it in the table above.

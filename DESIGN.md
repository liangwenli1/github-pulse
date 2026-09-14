# GitHub Pulse design system

The high-contrast typography, black closing band, square controls, and clear navigation draw on the [Wired DESIGN.md](https://github.com/VoltAgent/awesome-design-md/blob/main/design-md/wired/DESIGN.md) in [awesome-design-md](https://github.com/VoltAgent/awesome-design-md). The [Apple DESIGN.md](https://github.com/VoltAgent/awesome-design-md/blob/main/design-md/apple/DESIGN.md) informed the viewport-sized section rhythm and the use of one restrained blue accent. The scroll snapping and content transitions are GitHub Pulse's own interaction design; neither reference is claimed to prescribe this exact effect. No brand artwork is copied.

## Foundations

- White canvas (`#fff`), near-black text and actions (`#111`), neutral grays (`#fafafa`, `#f5f5f5`, `#e5e5e5`, `#737373`), and a single measured blue (`#315fd9`) for data series and active navigation.
- System sans typography, a large editorial hero headline, oversized repository count, and readable data labels. The content width grows to 2400px with 48px page gutters on wide screens.
- Flat surfaces, thin borders, and no decorative gradients. Primary actions and select menus use nearly square corners; data cards retain gentle rounding so plots are easy to group.
- Charts use blue for the leading data series and black or gray for comparisons. Missing historical values remain gaps. Active and positive states use weight, position, and text as well as color.
- Visible focus, labeled inputs, keyboard-operable controls, and responsive layouts. Motion remains subtle and respects reduced-motion preferences.

## Page hierarchy

The centered header links Home, Rankings, Charts, Search, Subscribe, and About. A type bar under the header switches Skill, Plugins, Components, Websites, and Repositories. The homepage at `/en/home` (or `/zh/home`) is the type entrance. Each type uses the same ranking list, chart screens, and subscription treatment as before. Legacy `/en/ranking` and `/en/charts` redirect into the repository type.

The rankings page has tabs, filters, and a repository list in one document scroll, followed by its own subscription call to action. A full-width editorial footer carries the GitHub non-affiliation note and language switch across all pages. The methodology page explains what users need to interpret the rankings without exposing service configuration, component credits, formulas, or internal API details. All dropdowns use the same app-rendered Radix Select menu, with consistent focus, hover, and selected states rather than native operating-system popups.

## Responsive rule

On desktop, the four charts use a 2×2 grid that fills most of its screen height. Mobile uses one column in the same document scroll, so the page has one vertical scrollbar while every chart remains reachable. At narrow widths, hero metadata moves below the introduction, filters wrap, and each repository row reveals its metric labels. Navigation remains available on mobile. Reduced-motion users get immediate page changes without content transitions. No horizontal page overflow is permitted at 320px.

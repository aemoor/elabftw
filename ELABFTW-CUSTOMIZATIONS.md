# eLabFTW Fork Customizations

This document tracks all custom features added to this fork, to help with future merges against upstream.

## Feature 1: Experiment Folders

Hierarchical folder structure for organizing experiments.

**Files modified:**
- `src/sql/schema207.sql` — `CREATE TABLE experiments_folders` (made idempotent with `IF NOT EXISTS`)
- `src/ts/experiments-folders.ts` — Collapsible folder tree with localStorage persistence, uses `on()` handler delegation
- `src/templates/experiments-folders.html` — Toggle carets, `.folder-node`, `.folder-toggle`, `.folder-children` elements
- `src/templates/experiments-folder-select.html` — Changed to show `folder.full_path` instead of just `folder.name`

## Feature 2: Lab Logs and Owner Names

Monthly lab logs with owner names and dashboard.

**Files modified:**
- Various log-related templates and TypeScript files (committed in early branch commits)

## Feature 3: Table of Contents (View-Mode SidePanel)

A SidePanel TOC that extracts headings from `#body_view` (view mode) or the TinyMCE editor (edit mode) and renders a navigable list with scroll-spy and smooth scrolling.

**Files added:**
- `src/ts/TocPanel.class.ts` — SidePanel subclass with heading extraction, scroll-spy via IntersectionObserver, smooth scrolling
- `src/templates/toc-panel.html` — Panel HTML template

**Files modified:**
- `src/ts/common.ts` — TocPanel import/instance, toggle-sidepanel handler routes `toc` target, refresh-toc handler
- `src/ts/FavTag.class.ts` — Added TocPanel import and mutual exclusion in toggle()
- `src/ts/Todolist.class.ts` — Added TocPanel import and mutual exclusion in toggle()
- `src/templates/head.html` — Added TOC opener button
- `src/scss/main.scss` — TOC panel styles (`.toc-items-container`, `.toc-highlight`, `@keyframes toc-flash`)

**Note:** The in-editor TinyMCE TOC sidebar was removed (it was not useful). Only the view-mode SidePanel TOC remains.

## Feature 4: Collapsible Folder Tree

Makes the experiment folder sidebar collapsible with persistent open/closed state stored in localStorage.

**Files modified:**
- `src/ts/experiments-folders.ts` — Added `on('toggle-folder-children', ...)` using eLabFTW's global event delegation system (`on()` from `./handlers.ts`)
- `src/templates/experiments-folders.html` — Added toggle carets, `.folder-node`, `.folder-toggle`, `.folder-children` elements

**Important pattern:** Direct `addEventListener` on `[data-action]` elements does NOT work in eLabFTW because the global `#container` click listener intercepts all `[data-action]` clicks. Must use `on(action, fn)` from `./handlers.ts`.

## Feature 5: Full Path in Folder Dropdown

Shows the full folder path (e.g., `Lab > Project A > Sub-experiment`) in the experiment edit dropdown instead of just the folder name.

**Files modified:**
- `src/templates/experiments-folder-select.html` — Changed from `folder.name` to `folder.full_path`

## Feature 6: Inline Spreadsheets

Embeds small spreadsheet grids with formula support (SUM, AVERAGE, COUNT, MIN, MAX, IF, ROUND, ABS, CONCATENATE) directly in experiment/resource body text. Uses jspreadsheet-ce v5 (already a project dependency).

Data is stored as base64-encoded JSON in a `data-spreadsheet` attribute on the `<table>` element. The table cells show computed formula results so the document looks correct even without JavaScript. Double-clicking a spreadsheet table in the editor reopens it for editing.

**Files added:**
- `src/ts/inline-spreadsheet.ts` — Core module: encode/decode spreadsheet data, plain overlay editor (not Bootstrap modal — Bootstrap's `enforceFocus` breaks jspreadsheet formula range selection), DOM-based formula evaluation, HTML table generation with column/row headers, formula helper bar

**Files modified:**
- `src/ts/tinymce.ts` — Added `inline-sheet` toolbar button, import of inline-spreadsheet module, double-click handler for spreadsheet tables, bookmark/restore TinyMCE selection around modal, removed in-editor TOC sidebar (toc-nav, toc-sidebar), removed unused `escapeHTML` import
- `src/Services/Filter.php` — Added `class` and `data-spreadsheet` to allowed `<table>` attributes, added `data-spreadsheet` as `Text` attribute, added `elabftw-spreadsheet` to AllowedClasses
- `src/scss/main.scss` — Inline spreadsheet styles (`.inline-spreadsheet-container`, `table.elabftw-spreadsheet` with zebra rows and hover outline, `.jss_container` z-index for overlay)
- `src/templates/base.html` — Removed Bootstrap modal template (replaced by JS-created overlay)

**Key technical decisions:**
- Uses a plain JS overlay instead of Bootstrap modal because Bootstrap's `enforceFocus` breaks jspreadsheet's cell selection and formula range picker
- Reads computed formula values from the rendered DOM cells (`.jss_worksheet tbody td`) rather than via the v5 API (`getValueFromCoords` returns raw formula text)
- v5 API requires `worksheets: [{ data, minDimensions }]` config (not root-level `data`)
- v5 `getData()` takes no arguments (unlike v4)
- Instance access: `instance[0]` gives the first worksheet
- `selectionCopy: true` enables the drag-to-fill corner handle

## Feature 7: Favorite Folder

Per-user favorite folder that is pinned to the top of the sidebar and auto-expanded, while all other root folders are collapsed by default.

**Files added:**
- `src/sql/schema208.sql` — Adds `favorite_experiment_folder` column to `users` table with FK to `experiments_folders`
- `src/sql/schema208-down.sql` — Rollback migration

**Files modified:**
- `src/Elabftw/SchemaVersionChecker.php` — Bumped `REQUIRED_SCHEMA` from 207 to 208
- `src/Models/ExperimentsFolders.php` — Added `getFavoriteFolder()` and `toggleFavorite()` methods, extended `patch()` to handle `action: 'toggle_favorite'`
- `src/Controllers/AbstractEntityController.php` — Pass `favoriteFolderId` to template render arrays (both `show()` and `edit()`)
- `src/templates/experiments-folders.html` — Added `data-favorite-folder-id` attribute on sidebar, star icon (`fa-star`) per folder, passed `favoriteFolderId` through recursive macro
- `src/ts/experiments-folders.ts` — Added `toggle-favorite-folder` action handler via `on()`, `pinFavoriteToTop()` DOM reordering, `applyDefaultCollapseForFavorite()` to collapse non-favorite root folders

**Key technical decisions:**
- Uses a column on the `users` table (not a junction table) because only one favorite per user is supported
- Star toggle uses PATCH to `experiments_folders` endpoint with `{ action: 'toggle_favorite', folder_id: N }` in request body
- Favorite folder's root ancestor is moved to top of DOM on page load before collapse state is applied
- Works with both root-level and nested subfolder favorites: for subfolders, the entire ancestor chain is expanded while the containing root folder is pinned to the top
- Subfolders below the favorite are collapsed by default
- Folder icons toggle between `fa-folder` (closed) and `fa-folder-open` (expanded) based on collapse state, using a `.folder-icon` CSS class on the icon element for JS targeting

## Schema Migration Notes

- `schema207.sql` uses `CREATE TABLE IF NOT EXISTS` and conditional `ALTER TABLE` for idempotent re-runs after partial failures
- `schema208.sql` adds `favorite_experiment_folder` column with FK to `experiments_folders(id)` with `ON DELETE SET NULL`

## General Merge Notes

- eLabFTW uses Yarn PnP (no `node_modules` directory) — packages are in zip archives
- Build: `docker exec elabftw bash -c 'NODE_OPTIONS="--max-old-space-size=4096" yarn buildall'`
- Dev rebuild: `docker exec elabftw bash -c 'NODE_OPTIONS="--max-old-space-size=4096" yarn build:dev --watch'`
- Global event delegation: all `[data-action]` clicks are intercepted by `#container` listener in `src/ts/common.ts` — use `on(action, fn)` from `src/ts/handlers.ts`, not direct `addEventListener`
- HTMLPurifier config in `src/Services/Filter.php` must whitelist any new HTML attributes/classes

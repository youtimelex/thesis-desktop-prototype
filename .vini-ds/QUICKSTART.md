# VINi public React DOM setup

This package documents a checked React DOM baseline. It is an alpha distribution; it does not claim complete accessibility conformance, current Figma parity or support for native mobile/TV renderers. Installation and configuration alone do not verify a product.

The CLI installs matching versions of components, tokens and agent context. Import the published packages directly by their names. Inspect the project's package.json for the selected versions.

## Using the public Atlas

An agent can work from the [public Atlas](https://vini-atlas.twc1.net/) together with the
product's installed UI/token packages. Identify the exact installed names and versions,
compare the selected documentation with that release's public exports and declarations,
then follow the styles/provider guidance below using its published package names. A newer
Atlas page does not establish availability in an older installed package.

Build the product and verify the affected scenario at its actual running URL, including
applicable themes, layout and font assets. This route does not require Agent/MCP. The optional
Agent section below adds client-based contract and update queries; pending or mismatched MCP
verification does not block a successful Atlas/package/screen check.

At the start of each agent work session in a project using VINi through Atlas without MCP,
regardless of the task topic, check the current project's installed UI/token names and exact
versions against the published Atlas release and matching npm package metadata. For an
Atlas-only project this check does not require an Agent package, a setup receipt, or MCP.
Report a newer verified release and applicable notes when they cover the observed
installed-to-target transition. If exact notes are unavailable, consult the published Atlas
history when accessible and identify any uncovered part of the transition rather than treating
one release's notes as the complete difference. If the history is unavailable, say so. If
the registry or metadata cannot be verified, report an unknown status when relevant, rather
than claiming that no update exists. A discovery failure alone does not block the task;
existing package, contract and selected-client alignment requirements still apply. The user can request an update separately; checking
does not install packages or change the project.

These are instructions for the next local candidate. They apply only when a client loads
and follows them during a task; merely opening a chat does not guarantee a check, and no
background notification service is implied. Already published packages and previously
installed instructions are unchanged until separately updated.

## Product context and page assembly

VINi is used in the domain of corporate video meetings and collaboration. Participants,
organizers and administrators may use different devices and have different responsibilities.
This is orientation, not a feature specification: the current task and accepted product decisions
define the actual users, roles, permissions, behavior and supported devices. Legacy wiki pages and
screens are not accepted UX references. Do not look up the wiki as a routine step;
consult a specific source when the task requires it.

Before building, establish the context of this specific page:

- Who uses it: role, experience and known permissions.
- Why they open it: expected outcome and main actions.
- What they work with: an object, collection, settings, media or event stream; data volume,
  rate of change and comparisons they need to make.
- How they work: frequent or occasional use, inspection, editing or control of an ongoing process.
- Under what conditions: device, input method, constraints, specified states and the scope and
  consequences of changes.

Extract this from the task, existing interface and accepted product decisions. For a small change,
consider only the affected context. No separate questionnaire, artifact or approval is required.
Ask only about unknowns that materially change the decision. Identify presentation assumptions;
do not invent permissions, save behavior, server effects or features.

Make a compact layout plan linking grouping, hierarchy, density, navigation and action placement
to that context. Conditional examples:

- Occasional configuration of dependent settings benefits from meaningful groups, nearby
  explanations and a clear scope for Save, when saving is part of the task.
- Repeated work across many objects benefits from comparable information and actions near their
  objects. Choose density using volume, frequency, device and available VINi variants together.
- Control of an ongoing process, such as a call, needs visible status and accessible frequent
  actions; secondary settings should not obscure the main work.
- Inspection of one object starts with its identity, state and task-relevant information, then
  details in a meaningful hierarchy.

These are contextual choices, not mandatory page templates. Different regions of a mixed screen
can need different compositions. A collection does not imply adding search, filters or bulk
actions; a form does not determine save behavior. Cards, dividers and accents must clarify the
content. Do not add a hero or decorative structure by default. Preserve the user's requirements,
accepted behavior and applicable VINi contracts when general design heuristics suggest otherwise.

Build with the installed public VINi API and Foundation tokens. Do not invent a new palette or
font, override component internals, or add unrequested features or platform support. Use concrete,
consistent words for actions, errors and empty states. Show pending, error, empty and success
states when they correspond to real behavior in the task; do not invent them as decoration.

After the final edit, review the actual running interface and exercise the changed interaction.
Check it against the page context: does information order support the task, are frequent actions
accessible, and is the scope and result of a change clear? Check the relevant narrow layout and
keyboard path when applicable. Report what you inspected and
any part that could not be verified. A preview or check does not by itself establish product
acceptance, accessibility conformance or native platform support.

Also inspect the CSS and inline styles changed in this task: if a rule reaches inside a VINi
component (for example through `data-slot`), check it against the installed component's
documented customization API. Remove unsupported internal overrides; choose a public variant
or adjust the surrounding composition.

## Styles and root

Load once in the existing application entry, in this order:

```tsx
import '@vini-ds/tokens/fonts.css';
import '@vini-ds/tokens/themes.css';
import '@vini-ds/tokens/typography.css';
import '@vini-ds/ui/styles.css';
```

Wrap the existing application, preserving other providers:

```tsx
import { ThemeBrandProvider } from '@vini-ds/ui';

<ThemeBrandProvider theme="light" brand="vini" colorway="blue" typographyScope="desktop">
  <App />
</ThemeBrandProvider>
```

Check the selected release's package peer declarations and verification record for React and React DOM compatibility and the exact checked runtimes; `get_package_profile` supplies this context when using MCP. Keep the application's React and React DOM dependency declarations; do not downgrade them to match an old example. After installing VINi, check the lockfile and installed versions because the package manager can resolve dependencies again. Use matching React and React DOM versions and verify the actual product build and interactions. Its supported theme IDs are `light`, `dark`, `light-alpha`, `dark-alpha`; typography currently exposes only `desktop`. The provider owns the `data-theme`, `data-brand`, `data-colorway` and typography scope attributes. Keep the application's existing preferences when already configured. Other contexts require their own compatibility check.

The styles reference packaged fonts and icons. Let the bundler resolve their relative assets. CSS without its font resources is an incomplete setup. Do not open application HTML with `file://` as a preview.

## Components and composition

```tsx
import { Button } from '@vini-ds/ui';

<Button variant="primary" color="main" size="500" onClick={save}>
  Save
</Button>
```

Use public slots and props for content. The host owns business state and layout; VINi owns component internals. For an icon-only action supply an accessible name. Use the component contract and declarations for the exact API; a visual example alone is insufficient.

## Patterns and examples

### Ownership and permitted changes

Keep these layers separate when interpreting an example or a requested change:

| Layer | Owns | Boundary |
| --- | --- | --- |
| Foundation tokens | Visual values and typography | A token supplies a value; it does not authorize overriding a component's internal styles. |
| Component | Its anatomy, appearance, interaction states and public API | Choose supported props and slots. Shared hover, focus, selected or disabled changes belong in the owning component. |
| Block composition | Arrangement of components, surrounding surface, spacing, sizing and responsive layout | Adapt this environment with Foundation tokens and the components' public APIs; retain their internal behavior and accessibility. |
| Pattern | Rules for a scenario, including lifecycle, validation, focus and recovery | A similar-looking block does not establish conformance to the complete pattern contract. |
| Application | Real data, permissions, routes, services and outcomes | Demonstration handlers, identities, links and results must be replaced with the product's defined behavior. |

For example, a rounded border around a table can belong to its surrounding block. Check the
installed Table API first. If no suitable variant exists, use a token-based outer container
without overriding Table rows, cells or states. Preserve native table semantics, horizontal
scrolling and visible keyboard focus; do not clip interactive content with a decorative wrapper.
A new runtime component is not required for this change. Repeated shared composition changes
belong in their shared source, not copied instance overrides.

### Availability before reuse

Read `vini://patterns` for the installed inventory, or call `search_ds` with an explicit `kinds: ["pattern"]`. Read the chosen `get_pattern_contract({ id, platform: "web" })` for its component bindings, lifecycle, validation, focus and known limitations. Not every package baseline includes a reviewed pattern; an empty inventory is intentional.

`vini://examples` lists the available public adaptations. If it reports `paginated: true`,
follow `firstPage` and each `next` link until all `total` entries have been read; do not
interpret the page header as the complete inventory. For a selected example's description,
component dependencies and limitations, read its bounded `vini://examples/{id}/details`.
For complete files, use the bounded manifest and parts described below.
The legacy `vini://examples/{id}` resource remains available, but its complete response can be
too large for a client to display. Copy only the selected example's files into an authorized
product change, retain its relative CSS import, and use the root/style setup above. Render the
supplied default component with the props named in the selected example. The existing
`form-transaction` uses `FormTransactionExample`; `sidebar-default` and `sidebar-compact` use
`SidebarExample` with `compact={false}` and `compact={true}`. The host decides its compact
breakpoint. Demonstration values and simulated outcomes are not production validation,
persistence or routing. The form reference uses secondary Button actions to preserve its
recorded contrast limitation.

### Reading complete example files

1. Read `vini://examples/{id}/details` for the chosen example's description, component
   dependencies, pattern associations, limitations and any source correspondence. Read
   `vini://examples/{id}/manifest` for its file inventory. If the manifest has
   `filePageUriTemplate`, read every page from zero through `filePageCount - 1`.
   If details report `paginated`, reconstruct the JSON from their part URI template and
   verify every part and the complete SHA-256 before reading it. Each file entry gives its name, language, byte
   length, SHA-256, encoding, part size, part count and part URI template. Compare their example
   ID, package version and baseline; use the exact names and part range from the manifest. The
   manifest is a file-integrity description; it does not replace the example's limitations.
2. Read every zero-based part using the `partUriTemplate` returned for that file. Older
   packages use `vini://examples/{id}/files/{filename}/parts/{index}`; larger catalogs can
   use an indexed file URI instead.
   Each response identifies the example, file, installed package version and baseline, and
   includes `index`, `partCount`, `partByteLength`, `partSha256` and base64 `content`.
   Both file `sha256` and `partSha256` use `sha256:<64 hex>` strings. The current part size
   is at most 1,024 bytes before base64 encoding. The server rejects a details, manifest or
   part response when its serialized resource envelope exceeds 4,000 bytes; this limit is not
   a measurement or guarantee of a particular client's output limit.
3. Decode each part's base64 content to bytes. Check the example ID, filename, package version,
   baseline, file length, part size/count and SHA-256 against the manifest; check each expected
   index and the actual decoded length and SHA-256 against `partByteLength` and `partSha256`.
   Reject missing, repeated, reordered, incomplete or inconsistent parts. Concatenate the
   bytes in index order, then verify the complete byte length and SHA-256 against the manifest
   **before** decoding UTF-8 or using the file. Keep binary resources as bytes; they are not UTF-8 text.
4. Obtain and verify every file listed for the selected example, including CSS and notices.
   Preserve the dashboard chart license notices; do not omit them to reduce response size.
   If a part or verification is unavailable, report the example as incomplete rather than
   using truncated content. Re-read the manifest if the connection or selected version changes.

The details, manifest and part resource templates change the MCP interface inventory. After
installing this interface, follow any reconnect action from `refresh_connection`, reconnect the
same project's MCP if required, and verify the new inventory and exact installed version through
the actual client. Older interfaces retain `vini://examples` and `vini://examples/{id}`; their
larger responses can be truncated by the client, so verify completeness before use. An independent
STDIO probe does not verify that client connection.

An example is available only when it appears in the installed inventory and its returned files
and dependencies can be used with that exact package set. A screenshot, an Atlas page, a story
export name or an entry in this guidance does not make it a package export. Check actual props
as well as export names: an existing Sidebar or Button export does not prove that a newer
variant is installed. If the server does not expose these resources, report that boundary and
use the available component contracts for an authorized composition; do not invent resource IDs.

The reduced Sidebar examples above are not the complete Application shell pattern. Likewise,
the form example demonstrates a transaction, not authentication. Preserve each example's
listed constraints and do not transfer a restriction from one reference to every product.

### Choosing a page composition

The following five source examples extend the three examples above in compatible packages.
Use them only when their exact IDs appear in the installed examples inventory; this guidance
does not establish that an older installation contains them. They are copied source files,
not exports of the UI package. Read all returned limitations and copy every listed file.

| Example ID | Supplied component and required props |
| --- | --- |
| `application-shell` | Default `ApplicationShellExample`, host-controlled `compact`. |
| `dashboard-inset` | Default `DashboardShellExample`, host-controlled `compact`, `panel={false}`. |
| `dashboard-panel` | Default `DashboardShellExample`, host-controlled `compact`, `panel={true}`. |
| `login-card` | Default `AuthenticationExample`, `story="CardLogin"`, `links` with `forgotPassword`, `signUp`, `terms`, `privacy`. |
| `login-split` | Default `AuthenticationExample`, `story="SplitLogin"`, the same required `links`. |

Both dashboards include `DashboardAreaChart.jsx`, its CSS module and
`DashboardAreaChart.licenses.jsx`. Declare `recharts@3.10.1` directly and preserve the notices.
Both login entries share one JSX/CSS pair and accept optional `linkTarget`, `onSubmit(event)`
and `onProvider(id)` callbacks. Provider IDs are `google`, `apple`, `sso` and `yandex`.
The package projection checks selected component exports and required variant values; the
consumer must still compile and inspect the exact package set after adaptation.
These entries do not register a new authentication pattern. Dashboard examples do not claim
the strict Application shell contract; the basic shell source does not add that machine
contract to the installed pattern inventory.

| Composition | Appropriate use and changes | Dependencies and required checks |
| --- | --- | --- |
| Basic application shell | Navigation around a work area. Change product labels, route data and content slots while keeping one active-route model. | Public Sidebar, Breadcrumb and related controls from the selected contract. Check active navigation, breadcrumb and heading agreement, wide/collapsed/compact behavior, menu dismissal and focus return. The application owns routing and permissions. |
| Inset dashboard shell | An overview with the working area inset beside navigation. Change the supplied data, card content and layout through supported APIs. | The example's Sidebar inset API, cards, typography and action controls; chart and table dependencies below. Check navigation, independent content scrolling, preserved header/navigation, and narrow layout. The dashboard illustration alone does not satisfy every Application shell lifecycle requirement. |
| Separate-panel dashboard shell | Navigation and work area presented as separate panels. Change surrounding layout and content without restyling Sidebar internals. | The exact installed Sidebar panel variant and header API, not merely the Sidebar export. Check both panels, collapsed and compact navigation, scrolling, focus and the same data controls as the inset dashboard. |
| Login in a card | A focused sign-in form on a surrounding application surface. Change copy, branding, permitted identity providers and product links. | Card, Field, Input, Button and typography. Preserve associated labels, required/email validation and password visibility. Check keyboard submission, provider actions and valid recovery/registration/legal links. These are form checks, not proof of authentication. |
| Login beside an image | The same sign-in task with a supporting image region. Change the image and surrounding layout while preserving form order and behavior. | The login controls and the supplied layout styles; the application provides the image and appropriate alternative text or decorative treatment. Check the card-login behaviors plus reflow, meaningful reading order and usable form width on a narrow screen. |

For either login composition, the application must define and connect actual submission,
identity-provider flows, loading, repeat-submit prevention, recoverable errors, retry, session
creation and the destination after successful authentication. Supplied callbacks or a local
success message do not implement these flows. Never treat demonstration links as product URLs
or use real credentials to test a disconnected example.

Dashboard metric cards, an area chart and a framed table are example-owned compositions, not
new generic VINi Metric, Chart, Widget or DataTable exports. The application defines units,
periods, comparisons and data meaning. Copying a chart source requires the charting dependency
and license notices listed for that source; a dependency used by the UI build is not automatically
a public component API or a direct dependency of the consuming application. Check range changes,
series identification, accessible data alternatives and narrow layout for the chosen chart.

For the table, preserve the defined selection scope, partial selection, sorting semantics,
status views, pagination and any local add-row action that the selected source actually provides.
The application supplies real row identity, data access and persistence. Check empty results,
page boundaries, selection across views/pages, keyboard use and scrolling inside the rounded
frame. Add loading or failure states only for real connected behavior; do not describe an
untested example state as implemented. An experimental server dashboard, its widget picker or
its resource meters do not establish a shared layout or scenario rule.

After adapting any composition, build with the installed packages and inspect the actual page
at the relevant wide and narrow sizes. Exercise the changed scenario and keyboard/focus path.
Report source availability, local checks, package delivery and product acceptance separately.

The first installation with this pattern interface changes the MCP inventory. A preceding supervisor can require reconnect instead of refreshing in place; follow that action, then verify the exact installed version and affected contract in the new connection. The old worker must not silently adopt an interface the client has not discovered.

## Agent

This section applies when the task chooses Agent/MCP. Its client checks are additional to
the public Atlas and installed-package route above; do not add or switch a shared MCP server
merely to complete that route.

For an existing project with manually installed direct `@vini-ds/ui` and
`@vini-ds/tokens`, the next CLI candidate can inspect `status`, then plan
`init --plan --adopt-manual` using the actual project and application roots. An explicit
`init --adopt-manual` preserves the existing entry and exact installed pair while installing
the matching agent, backing up affected files and recording the verified installation.
An incomplete pair, unsupported peers, incomplete static source graph or a shared symlinked
`node_modules` blocks the transition; do not change the linked target or use forced peer
installation. CSS/provider/font diagnostics describe source evidence, not proof of the live
page. This candidate route is not present in previously published CLIs. Verify the project,
app, package versions, generation and current native MCP connection separately after setup.

The package's `mcp.mjs` is a read-only local STDIO MCP server. It requires Node 20+, reads its installed context and does not fetch private GitHub content. The CLI prepares project-local configuration and Skill; the client still needs to load the trusted project and establish an actual MCP connection. Read `vini://system/current` and a component contract in that client to verify the connection. The public server does not expose internal product slices, release-upload tools, private Figma links or private update channels.

At the start of each agent work session in a project connected to VINi, regardless of the task topic, if `vini://runtime/connection` is available, compare its projectRoot with the actual project and call `check_updates` once only if they match. If that resource is unavailable on a direct MCP, call `check_updates` once and compare its non-null canonical `observedProjectRoot` with the actual project's canonical path before interpreting the result. The field identifies the directory read by the check, not the chat or a managed connection; it does not support refresh or replace client-session verification. A missing or different path cannot establish this project's update status. Do not treat a connection from another project as this project's update check. Report a newer release only when the result confirms a newer version and verified metadata; describe `available.changes` only when it applies to the exact installed version. If it does not, consult the published Atlas history when available and make any uncovered changes explicit. Unavailable registry, inconsistent installation or an unknown comparison is not evidence of no update; disclose uncertainty when update status matters. Update discovery failure alone does not block the task, but existing package, contract and selected-client alignment requirements still apply. The check never installs or executes registry code and does not run in the background. The client may not load this instruction or invoke the agent or connection merely because a chat was opened. Previously installed versions need an update to receive this instruction. Upon a user request to update, review the exact CLI version's `update --plan`, then explicitly run `update`. Registry metadata does not verify installed tarball bytes or replace the product's build and checks.

When an exact target has already been selected, optionally pass `target` to `check_updates` as `{ "version": "…", "ui": "…", "tokens": "…", "agent": "…" }` with the exact version and published names. Its comparisons with installed packages, receipt, context and registry latest are separate; the supplied target itself is not independently authenticated. Without a target, the tool does not choose one for the user.

An update changes installed packages, but a running server or an already connected MCP client may still serve the previous version. Complete these checks separately:

1. Identify the server and project serving the user's existing application URL. Where the server is safely identifiable and its restart is authorized, refresh or restart that specific dev or preview server with its existing settings, reload the original URL, and exercise the affected component. A new temporary server does not verify the original page. Do not terminate an unknown process; if the server cannot be safely identified or controlled, state the action the owner needs to take and leave the page check pending.
2. Work in the actual client's project-local VINi connection. Older published launchers cannot update their running code: after installing the new launcher, reconnect that project MCP once. For a connection that exposes `refresh_connection`, read `vini://runtime/connection`, then call `refresh_connection` with `target` containing the exact selected `version`, `ui`, `tokens` and `agent` names already installed in this project. A compatible switch or same-release recovery affects only that connection; it does not install or fetch a release. If the interface cannot be verified or is incompatible, follow its reconnect action. If reconnecting is unavailable or has already failed to replace the old context, restart the specific client.
3. Through that same actual client connection, read `vini://runtime/connection`, `vini://system/current`, the affected `get_component_contract` and `check_updates`, then read `vini://runtime/connection` again. Both connection readings must have the same project root, instance ID, nonempty installation generation, connection revision and exact target version; all three intervening responses must agree with the chosen release, installed package names, versions and receipt. Repeat if anything changed between reads. A newer registry `latest` is a separate fact. If any reading is unavailable or differs, leave MCP verification pending and state the next action. A separate STDIO process only verifies that process.

After a package-name migration, the already published alpha.3 MCP may report a package/receipt mismatch because its running code still looks for the older import paths. Independently inspect the installed packages and receipt using the selected release's CLI. If they match, reconnect the project MCP and repeat the checks instead of reinstalling; if they differ, investigate the installation. The newer behavior does not change the already published alpha.3 process.

Report package installation, the original page check, and the chosen client's MCP check independently. For an update that includes Agent/MCP, call that complete route fully verified only when the installed set matches the chosen release, the original page and affected interaction have been checked, and all three MCP reads through one unchanged identified connection agree with that set. A successful build or standalone MCP check does not establish the others. An Atlas/package/screen result can be complete while optional MCP verification remains pending. Cancellation or disconnection may leave a request outcome unknown; never silently repeat it.

When using the public agent, install or update its version together with the matching component and token versions. The application's own build, tests and review remain necessary after an update. The agent context does not certify the installed dependency graph or silently change it.

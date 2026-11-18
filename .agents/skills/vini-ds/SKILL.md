---
name: vini-public
description: At the start of work in a project connected to VINi, check for VINi updates; use its public contracts and package API for React DOM interface work.
---

# VINi in this project

Use the installed `@vini-ds/ui`, `@vini-ds/tokens` and `@vini-ds/agent` packages. Import these packages directly by their published names.

Read `vini://system/current` and `vini://guidelines/setup` through the project's VINi MCP before selecting components. This public package contains a bounded documentation projection of a checked baseline, not the internal Gateway or evidence that the application has been tested. Match its package version to the installed packages; report mismatches rather than silently installing or changing a release.

For authorized screen authoring, follow “Product context and page assembly” in `vini://guidelines/setup` alongside the applicable contracts. Skip this authoring method for read-only status or update inquiries.

At the start of each agent work session in a project connected to VINi, regardless of the
task topic, check updates once for this project. If the current client's VINi MCP exposes
`vini://runtime/connection`, compare its `projectRoot` with the actual project and call
the read-only `check_updates` only if they match. With a direct MCP that does not expose
that resource, call `check_updates` once and compare its non-null canonical
`observedProjectRoot` with the actual project's canonical path before interpreting the
result. This field identifies the directory read by the check, not the chat or a managed
connection, and does not provide a connection identity or refresh capability. If paths
differ or cannot be resolved, do not report that result as this project's update status.
Do not substitute another project's connection. For a verified result
with `status: update-available`, `installed.status: matched`,
`available.status: verified-metadata` and `available.relation: newer`, briefly report
the installed and available versions. Summarize `available.changes` only if it identifies
the installed `fromVersion`. If that exact comparison is unavailable, inspect the public
Atlas release history when accessible and identify which published notes cover the range
from the installed version to the available version. Report only changes confirmed by those
notes, identifying their versions; never present the last transition as the complete history
of skipped releases. If the history is unavailable or does not cover the whole range, say
which part is unknown. Do not invent missing changes. `latest` is registry metadata, not
automatic selection or proof of product support.

If the project connection cannot be identified, the installation is inconsistent or locked,
or registry metadata is unavailable, do not claim that the project is current. A registry
lookup failure alone does not block unrelated work; state its uncertainty when update status
is relevant or requested. A wrong or unverified connection or installation does not authorize
using its contracts as the current project's API: retain the existing package, contract and
task-specific consistency checks. When applicable, the separately verified Atlas and installed
package route remains available without MCP. Do not recheck on every tool call, install packages,
or change client settings because an
update was found. A later explicit update inquiry may check again. Update the project only
when requested, after reviewing the exact target and its `update --plan`. An installed
package or successful build does not prove that a running application or MCP session is
using the new version. This is an instruction for an agent during an active task; opening
a chat alone does not guarantee that its host invokes the agent or delivers a notification.

After the packages are updated, identify the dev or preview server that serves the user's existing application URL and the project it runs from. If its process is safely identifiable and the authorized workflow permits it, refresh or restart that specific server using its original project and settings; do not stop an unknown process or substitute a different temporary server. Reload the same URL and exercise the affected component. If the server cannot be identified or restarted safely, explain the exact action needed and leave the original page unverified.

Use the project's VINi MCP in the client the user actually uses. An already-running older launcher cannot change its own code; after installing the new launcher, reconnect that project MCP once. For an active connection exposing `refresh_connection`, read `vini://runtime/connection` and call `refresh_connection` with the exact already-installed target (`version`, `ui`, `tokens`, `agent`). The operation selects this connection and neither installs nor fetches packages. If the interface is incompatible or cannot be verified, follow the returned reconnect action; restart the specific client only if reconnect is unavailable or already failed.

To verify the resulting session, read `vini://runtime/connection`, then `vini://system/current`, the affected component contract with `get_component_contract` and `check_updates`, and finally `vini://runtime/connection` again through the same client. Both connection observations must have the same project root, instance ID, nonempty generation, connection revision and exact target version; all three responses must agree with the chosen release and installed package names, versions and receipt. Repeat if the connection changes between readings. Registry `latest` is a separate fact. A separate STDIO probe or prepared configuration does not verify the existing client session; an unavailable read or differing version remains pending. A cancelled or disconnected request can have an unknown outcome and must not be silently repeated.

After a package-name migration, an already published alpha.3 MCP may report a package/receipt mismatch because it still looks for the older import paths. Independently inspect the installed packages and receipt with the selected release's CLI. If they match, reconnect the project MCP instead of reinstalling; if they differ, investigate the installation. The new server cannot change an already running old process.

Use `search_ds` and `get_component_contract` for components and their public exports, props, slots, limitations and type declarations. `get_package_profile` describes the supported React DOM setup. Use `get_token` or `resolve_token` for existing Foundation values; explicit token modes are required where the contract says so. Other native renderers are outside this package's scope.

For a repeatable flow, inspect `vini://patterns` or search explicitly with `kinds: ["pattern"]`, then read `get_pattern_contract` with the selected id and `platform: "web"`. Read its bindings, lifecycle, focus/recovery rules and limitations before composing it. An empty inventory means that this installed baseline includes no reviewed public patterns. Use `vini://examples` to find available examples. Read `vini://examples/{id}/details` for the selected example's description and limitations, and `vini://examples/{id}/manifest` for its file inventory. Then read every part of every listed file using its returned `partUriTemplate`. Decode base64 parts to bytes and verify their identity, order, lengths and `partSha256`, then verify each concatenated file's complete byte length and `sha256` before UTF-8 decoding or use. Follow the precise steps in “Reading complete example files” in setup, including package version and baseline consistency. Preserve all CSS and license notices. A missing, truncated or inconsistent part means the example is incomplete; do not use it. The older `vini://examples/{id}` resource remains available but can exceed a client's output limit. Examples are adapted demonstrations on the public API, not verified product implementations or permission to change product semantics. The form reference's secondary-action constraint does not restrict every Button in every product. Keep locale, validation, persistence and outcomes explicit in the product.

For a paginated example catalog, follow `firstPage` and `next` to read every page. If a
manifest supplies `filePageUriTemplate`, read every file page and use each file's own
`partUriTemplate`; if details are paginated, reconstruct and verify the complete JSON from
its parts. Verify binary assets as bytes and preserve their notices. Follow setup for the
full verification sequence; older unpaginated packages remain supported.

Adding the pattern interface and the bounded example details, manifest and part resource templates changes the MCP tool/resource inventory. A connection to the preceding interface may reject `refresh_connection` and request reconnect; preserve that check and reconnect the same project MCP, then verify current, the affected pattern/component, example inventory and `check_updates` through the new connection. A successful transition between older packages with identical interfaces does not verify this interface change.

For a composition or example-based change, also read “Ownership and permitted changes” and
“Availability before reuse” in `vini://guidelines/setup`. Distinguish token values, owning
components, block layout, scenario patterns and real application behavior. A token is not
permission to override component internals. An outer table frame can belong to the block;
it does not require a new Table component. Check the installed inventory, files, exact props
and dependencies before promising an example or importing it. Sidebar demonstrations are not
the full Application shell contract; login forms are not an authentication service. Use the
composition-specific checks in setup only for the chosen scenario, not as an unrelated audit.

Compose product screens through public props and slots. Keep shared component appearance in VINi; do not override internal colors, typography, borders or interaction states to patch one product instance. Product layout, business state and application behavior belong to the product. A missing scenario contract does not prevent an ordinary user-authorized composition from the available APIs.

Keep existing app providers. Load the published font, theme, typography and UI styles once, and use `ThemeBrandProvider` with a supported theme/colorway and typography scope. Use a single React instance. Refer to setup for actual imports and examples.

Run the product's build and the checks relevant to the changed interaction. Preview through its HTTP development or preview server, verify styles and font assets and exercise the changed control. Report package installation, verification of the original application page, and verification through the current client MCP as separate results; mark any unperformed step as pending. Only report the update fully verified when the installed set matches the chosen release, the original page and affected interaction have been checked, and all three reads through the current client's connection agree with that set.

// Custom-property override block appended to the upstream javadoc
// stylesheet.css by functions/api/[[path]].js's stylesheet branch (D-19,
// D-20, D-21, D-22, D-23). This module only defines the constants; the
// concatenation itself happens in [[path]].js.
//
// Both the light and the dark block below re-declare the FULL set of 8
// variables, rather than only the values that differ between modes. This
// is deliberate, not an oversight: 02-02's contrast gate needs to parse two
// complete tables of foreground/background pairs out of this source text.
// If either block only listed a delta against the other, the gate would
// have to perform its own CSS cascade merge to reconstruct the missing
// values — and a cascade-merge bug fails silently by checking fewer pairs
// than it should, which is exactly the failure mode a contrast gate must
// not have. 02-02 expands this table to the full 34-variable mapping; this
// task only lands the mechanism plus a core subset.
//
// Every value below is a literal color, never a var(...) reference: the
// javadoc page this block is appended to has none of this site's VitePress
// custom properties in scope, so a var() reference would resolve to
// nothing (an invalid custom property value, silently ignored by the
// browser).
//
// --navbar-background-color and --link-color (light mode) both use the
// site's brand-DARK variant (--vp-c-brand-dark, rgb(4, 98, 204),
// main.css:14) rather than the brand-1 variant (--vp-c-brand-1,
// rgb(5, 122, 255), main.css:7) that would be the naive "use the brand
// color" choice. This substitution exists purely to clear D-24's contrast
// floor: rgb(5, 122, 255) on white is 4.01:1, below the 4.5:1 that D-24
// requires for body text and links; rgb(4, 98, 204) on white is 5.79:1.
// Using brand-dark for navbar still satisfies D-21's "navbar uses the
// brand color" requirement, because brand-dark is itself declared as a
// first-class brand token at main.css:14, not an ad hoc value. Do not
// revert either of these two declarations back to --vp-c-brand-1 without
// re-running 02-02's contrast gate — that substitution is what keeps it
// green.
export const PALETTE_MARKER = '/* ultitools-dev-doc site palette override */';

export const OVERRIDE_BLOCK = `${PALETTE_MARKER}
:root {
  --body-text-color: #3c3c43; /* --vp-c-text-1, vars.css:177 (light) */
  --block-text-color: #67676c; /* --vp-c-text-2, vars.css:178 (light) */
  --body-background-color: #ffffff; /* --vp-c-bg, main.css:82 (light) */
  --section-background-color: #f8f8f8; /* --vp-code-block-bg, main.css:86 (light) */
  --navbar-background-color: rgb(4, 98, 204); /* --vp-c-brand-dark, main.css:14 (contrast substitution, see header) */
  --navbar-text-color: #ffffff; /* --vp-c-white */
  --link-color: rgb(4, 98, 204); /* --vp-c-brand-dark, main.css:14 (contrast substitution, see header) */
  --link-color-active: rgb(3, 73, 153); /* --vp-c-brand-darker, main.css:15 (light) */
}
@media (prefers-color-scheme: dark) {
  :root {
    --body-text-color: #dfdfd6; /* --vp-c-text-1, vars.css:183 (dark) */
    --block-text-color: #98989f; /* --vp-c-text-2, vars.css:184 (dark) */
    --body-background-color: #000000; /* --vp-c-bg, main.css:117 (dark) */
    --section-background-color: #131313; /* --vp-code-block-bg, main.css:121 (dark) */
    --navbar-background-color: rgb(4, 98, 204); /* --vp-c-brand-dark, main.css:14 */
    --navbar-text-color: #ffffff; /* --vp-c-white */
    --link-color: rgb(5, 122, 255); /* --vp-c-brand-1, main.css:7 (dark) */
    --link-color-active: rgb(85, 168, 255); /* --vp-c-brand-3, main.css:9 (dark) */
  }
}
`;

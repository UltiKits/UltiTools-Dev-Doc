// Custom-property override block appended to the upstream javadoc
// stylesheet.css by functions/api/[[path]].js's stylesheet branch (D-19,
// D-20, D-21, D-22, D-23). This module only defines the constants; the
// concatenation itself happens in [[path]].js.
//
// Both the light and the dark block below re-declare the FULL set of 33
// variables, rather than only the values that differ between modes. This
// is deliberate, not an oversight: 02-02's contrast gate (scripts/check-
// contrast.py) needs to parse two complete tables of foreground/background
// pairs out of this source text. If either block only listed a delta
// against the other, the gate would have to perform its own CSS cascade
// merge to reconstruct the missing values — and a cascade-merge bug fails
// silently by checking fewer pairs than it should, which is exactly the
// failure mode a contrast gate must not have.
//
// Every value below is a literal color (or literal font-stack/percentage),
// never a var(...) reference: the javadoc page this block is appended to
// has none of this site's VitePress custom properties in scope, so a
// var() reference would resolve to nothing (an invalid custom property
// value, silently ignored by the browser).
//
// javadoc's stylesheet.css declares 34 custom properties in :root
// [VERIFIED: UltiTools-API-6.2.5-javadoc.jar!stylesheet.css:11-62]. Every
// one of them has a disposition below: 32 are mapped in this block (listed
// 1-32 in 02-02-PLAN.md's table), and the remaining 2 — --body-font-size
// and --code-font-size — are deliberately NOT overridden (see "Not
// covered" below). The block additionally declares a 33rd name,
// --source-linenumber-color, which the upstream sheet REFERENCES
// (stylesheet.css:641, `color:var(--source-linenumber-color, green)`) but
// never declares in :root; its own fallback is a literal green that
// clashes with both palettes, so this block gives it a real value instead
// of leaving that fallback to fire.
//
// -- Five judgment calls, each written down here because the "obvious"
//    alternative silently fails scripts/check-contrast.py or breaks a
//    stated design intent, and nothing else in this file will remind the
//    next editor of that:
//
// 1. --odd-row-color, --subnav-background-color, and
//    --copy-button-background-color-active (site source: --vp-c-gray-soft)
//    do NOT copy --vp-c-bg-soft literally, even though --vp-c-bg-soft is
//    the more obviously-named candidate. main.css sets --vp-c-bg and
//    --vp-c-bg-soft to the SAME value in both modes (light: #ffffff /
//    #ffffff, main.css:82 & :85; dark: #000000 / #000000, main.css:117 &
//    :120). Copying it literally would make table odd/even rows and the
//    subnav background render identically to the page background in BOTH
//    modes — the opposite of what "align odd/even rows with the site"
//    (D-21) asks for. --vp-c-gray-soft carries alpha (light:
//    rgba(142,150,170,0.14), main.css:60; dark: rgba(101,117,133,0.16),
//    main.css:93) and produces a visible gray over any base color. What's
//    written below is that overlay ALREADY composited onto its opaque
//    base color (#eff0f3 / #101315) rather than the raw rgba(): the
//    contrast gate needs one determinate color to take a luminance of, and
//    an rgba() value can't supply that without first knowing what it's
//    sitting on — which is itself another variable. If you "simplify" this
//    back to --vp-c-bg-soft's literal value, odd/even rows become
//    indistinguishable and scripts/check-contrast.py's three `distinct`
//    pairs for this exact case go red.
//
// 2. --navbar-background-color, --link-color, --link-color-active,
//    --selected-background-color, --selected-text-color, and
//    --selected-link-color are constrained BACKWARDS from the contrast
//    gate, not forward from "which brand token looks right". --vp-c-brand-1
//    (rgb(5, 122, 255)) is only 4.01:1 on white — below D-24's 4.5:1 floor
//    for body text and links — so the light-mode navbar background and
//    link color both take the brand-DARK variant instead (rgb(4, 98, 204),
//    main.css:14, 5.79:1 on white). In dark mode the link instead takes
//    brand-1 (rgb(5, 122, 255), 5.23:1 on black) rather than brand-dark,
//    because brand-dark only reaches 3.62:1 on black. The selected item's
//    background is white and its text/link color is brand-dark precisely
//    because that pairing has to clear TWO floors at once: text-on-white
//    at 4.5:1 (brand-dark on white is 5.79:1) and selected-background-on-
//    navbar-background at 3:1 (white on brand-dark's navbar is the same
//    5.79:1). javadoc's own default uses an orange swatch on blue; this
//    uses a white swatch on the site's own brand blue instead — still the
//    site's brand color, just satisfying both floors. If either
//    substitution is reverted to the "obvious" single brand token, re-run
//    scripts/check-contrast.py before merging — that is what currently
//    keeps every one of these six declarations green.
//
// 3. --search-input-placeholder-color takes --vp-c-text-2 (#67676c light /
//    #98989f dark), not the semantically closer --vp-c-text-3 that
//    vars.css's own comment recommends for placeholders ("used for
//    placeholders", vars.css:180). --vp-c-text-3 is 3.10:1 on white and
//    3.91:1 on black — both below 4.5:1, because a placeholder IS text.
//    Landing this gate with a known-failing pair on day one is backwards:
//    CONTRIBUTING.md requires a NEW gate's existing violations be cleared
//    in the same round it lands, and here there is no existing violation
//    to clear — all 68 color values in this block are newly written in
//    this Phase. The correct move is to pick a passing value from the
//    start, not to file a placeholder-specific exemption.
//
// 4. --body-font-family, --block-font-family, and --code-font-family
//    override the font stack and deliberately drop 'Inter' from the site's
//    own --vp-font-family-base (vars.css:264-265). The javadoc page has no
//    corresponding @font-face for Inter, and D-26's CSP restricts font
//    sources to same-origin only, so declaring 'Inter' here would never
//    actually load it — it would just misleadingly imply the text is
//    rendered in Inter when it is not. Upstream's own font stack
//    (@import url('resources/fonts/dejavu.css'), stylesheet.css:5) 404s in
//    production, so the page already silently falls back to Arial/
//    Helvetica; these three declarations replace that accidental fallback
//    with the site's own non-Inter sans/mono stacks on purpose.
//
// 5. stylesheet.css:724's non-:root hardcoded
//    `box-shadow: 0 3px 6px rgba(0,0,0,0.16), 0 3px 6px rgba(0,0,0,0.23)`
//    (the search-autocomplete dropdown's shadow) is intentionally left
//    uncovered. Overriding it needs a selector rule (`.ui-autocomplete {
//    box-shadow: ... }`), not a custom-property declaration, and APIREF-02
//    scopes this Phase's implementation to custom-property overrides only.
//    The shadow already reads acceptably in both palettes as shipped. This
//    line exists so the next editor doesn't mistake the omission for an
//    oversight.
//
// -- Not covered: --body-font-size and --code-font-size (both 14px
//    upstream, stylesheet.css) are deliberately left undeclared. javadoc's
//    entire spacing and grid system is tuned around a 14px base; changing
//    it would reflow the whole page, and font SIZE is not the primary
//    signal a reader uses to judge "this looks like part of the site" —
//    color is. These two are the only 2 of the 34 upstream declarations
//    this block does not map.
export const PALETTE_MARKER = '/* ultitools-dev-doc site palette override */';

// Both tables are extracted into their own constants (rather than left
// inline inside OVERRIDE_BLOCK) so the class-selector rule added in Task 2
// can reuse DARK_DECLARATIONS verbatim instead of a second hand-written
// copy that could drift from the media-query copy. The four marker
// comments below let scripts/check-contrast.py locate each table's
// boundaries directly, instead of splitting this source text on the
// media query string (which tied the gate to one specific dark-mode
// trigger — see that script's own docstring for why that coupling had to
// go). Markers are JS line comments, not part of either template literal,
// so they add zero bytes to OVERRIDE_BLOCK's evaluated output. Each
// template literal's opening backtick is followed immediately by a
// newline (not by the first declaration on the same source line) so that
// scripts/check-contrast.py's line-anchored declaration regex can match
// the first declaration the same way it matches every other one.

// palette-table:light:begin
const LIGHT_DECLARATIONS = `
  --body-text-color: #3c3c43; /* --vp-c-text-1, vars.css:177 (light) */
  --block-text-color: #67676c; /* --vp-c-text-2, vars.css:178 (light) */
  --body-background-color: #ffffff; /* --vp-c-bg, main.css:82 (light) */
  --section-background-color: #f8f8f8; /* --vp-code-block-bg, main.css:86 (light) */
  --detail-background-color: #ffffff; /* --vp-c-bg, main.css:82 (light), same as --body-background-color */
  --navbar-background-color: rgb(4, 98, 204); /* --vp-c-brand-dark, main.css:14 (contrast substitution, see header §2) */
  --navbar-text-color: #ffffff; /* --vp-c-white */
  --even-row-color: #ffffff; /* --vp-c-bg, main.css:82 (light) */
  --odd-row-color: #eff0f3; /* --vp-c-gray-soft rgba(142,150,170,0.14) opaque over --vp-c-bg, main.css:60 & :82 (see header §1) */
  --border-color: #e2e2e3; /* --vp-c-divider, vars.css:156 (light) */
  --table-border-color: #c2c2c4; /* --vp-c-border, vars.css:155 (light) */
  --link-color: rgb(4, 98, 204); /* --vp-c-brand-dark, main.css:14 (contrast substitution, see header §2) */
  --link-color-active: rgb(3, 73, 153); /* --vp-c-brand-darker, main.css:15 (light) */
  --search-input-background-color: #ffffff; /* --vp-c-bg, main.css:82 (light) */
  --search-input-text-color: #3c3c43; /* --vp-c-text-1, vars.css:177 (light) */
  --search-input-placeholder-color: #67676c; /* --vp-c-text-2, vars.css:178 (light) — NOT --vp-c-text-3, see header §3 */
  --snippet-text-color: #67676c; /* --vp-c-text-2, vars.css:178 (light), same as --block-text-color */
  --snippet-background-color: #f8f8f8; /* --vp-code-block-bg, main.css:86 (light), same as --section-background-color */
  --subnav-background-color: #eff0f3; /* --vp-c-gray-soft opaque, same composite as --odd-row-color (see header §1) */
  --selected-background-color: #ffffff; /* --vp-c-white (contrast substitution, see header §2) */
  --selected-text-color: rgb(4, 98, 204); /* --vp-c-brand-dark, main.css:14 (contrast substitution, see header §2) */
  --selected-link-color: rgb(4, 98, 204); /* --vp-c-brand-dark, main.css:14, same as --selected-text-color */
  --snippet-highlight-color: #fcf4dc; /* --vp-c-yellow-soft rgba(234,179,8,0.14) opaque over --vp-c-bg, main.css:76 & :82 */
  --search-tag-highlight-color: #fcf4dc; /* --vp-c-yellow-soft opaque, same composite as --snippet-highlight-color */
  --copy-button-background-color-active: #eff0f3; /* --vp-c-gray-soft opaque, same composite as --odd-row-color (see header §1) */
  --invalid-tag-background-color: #fde4e8; /* --vp-c-red-soft rgba(244,63,94,0.14) opaque over --vp-c-bg, main.css:80 & :82 */
  --invalid-tag-text-color: #b8272c; /* --vp-c-red-1, main.css:77 (light) */
  --title-color: #3c3c43; /* --vp-c-text-1, vars.css:177 (light), same as --body-text-color */
  --copy-icon-brightness: 100%; /* javadoc's own dark-mode hook, stylesheet.css:957 */
  --body-font-family: ui-sans-serif, system-ui, sans-serif; /* --vp-font-family-base minus Inter, vars.css:264 (see header §4) */
  --block-font-family: ui-sans-serif, system-ui, sans-serif; /* same stack as --body-font-family (see header §4) */
  --code-font-family: ui-monospace, 'Menlo', 'Monaco', 'Consolas', 'Liberation Mono', 'Courier New', monospace; /* --vp-font-family-mono, vars.css:266 */
  --source-linenumber-color: #67676c; /* --vp-c-text-2, vars.css:178 (light) — upstream references this at stylesheet.css:641 but never declares it; its own fallback is a literal green that clashes with both palettes */
  /* --body-font-size and --code-font-size (both 14px upstream) are
     deliberately NOT overridden — see header "Not covered" note. */`;
// palette-table:light:end

// palette-table:dark:begin
const DARK_DECLARATIONS = `
    --body-text-color: #dfdfd6; /* --vp-c-text-1, vars.css:183 (dark) */
    --block-text-color: #98989f; /* --vp-c-text-2, vars.css:184 (dark) */
    --body-background-color: #000000; /* --vp-c-bg, main.css:117 (dark) */
    --section-background-color: #131313; /* --vp-code-block-bg, main.css:121 (dark) */
    --detail-background-color: #000000; /* --vp-c-bg, main.css:117 (dark), same as --body-background-color */
    --navbar-background-color: rgb(4, 98, 204); /* --vp-c-brand-dark, main.css:14, unchanged across modes */
    --navbar-text-color: #ffffff; /* --vp-c-white */
    --even-row-color: #000000; /* --vp-c-bg, main.css:117 (dark) */
    --odd-row-color: #101315; /* --vp-c-gray-soft rgba(101,117,133,0.16) opaque over --vp-c-bg, main.css:93 & :117 (see header §1) */
    --border-color: #2e2e32; /* --vp-c-divider, vars.css:162 / main.css:115 (dark) */
    --table-border-color: #3c3f44; /* --vp-c-border, vars.css:161 / main.css:114 (dark) */
    --link-color: rgb(5, 122, 255); /* --vp-c-brand-1, main.css:7 (dark, contrast substitution, see header §2) */
    --link-color-active: rgb(85, 168, 255); /* --vp-c-brand-3, main.css:9 (dark) */
    --search-input-background-color: #000000; /* --vp-c-bg, main.css:117 (dark) */
    --search-input-text-color: #dfdfd6; /* --vp-c-text-1, vars.css:183 (dark) */
    --search-input-placeholder-color: #98989f; /* --vp-c-text-2, vars.css:184 (dark) — NOT --vp-c-text-3, see header §3 */
    --snippet-text-color: #98989f; /* --vp-c-text-2, vars.css:184 (dark), same as --block-text-color */
    --snippet-background-color: #131313; /* --vp-code-block-bg, main.css:121 (dark), same as --section-background-color */
    --subnav-background-color: #101315; /* --vp-c-gray-soft opaque, same composite as --odd-row-color (see header §1) */
    --selected-background-color: #ffffff; /* --vp-c-white (contrast substitution, see header §2) */
    --selected-text-color: rgb(4, 98, 204); /* --vp-c-brand-dark, main.css:14 (contrast substitution, see header §2) */
    --selected-link-color: rgb(4, 98, 204); /* --vp-c-brand-dark, main.css:14, same as --selected-text-color */
    --snippet-highlight-color: #251d01; /* --vp-c-yellow-soft rgba(234,179,8,0.16) opaque over --vp-c-bg, main.css:109 & :117 */
    --search-tag-highlight-color: #251d01; /* --vp-c-yellow-soft opaque, same composite as --snippet-highlight-color */
    --copy-button-background-color-active: #101315; /* --vp-c-gray-soft opaque, same composite as --odd-row-color (see header §1) */
    --invalid-tag-background-color: #270a0f; /* --vp-c-red-soft rgba(244,63,94,0.16) opaque over --vp-c-bg, main.css:113 & :117 */
    --invalid-tag-text-color: #f66f81; /* --vp-c-red-1, main.css:110 (dark) */
    --title-color: #dfdfd6; /* --vp-c-text-1, vars.css:183 (dark), same as --body-text-color */
    --copy-icon-brightness: 400%; /* javadoc's own dark-mode hook, stylesheet.css:957 */
    --body-font-family: ui-sans-serif, system-ui, sans-serif; /* same stack as light mode (see header §4) */
    --block-font-family: ui-sans-serif, system-ui, sans-serif; /* same stack as light mode (see header §4) */
    --code-font-family: ui-monospace, 'Menlo', 'Monaco', 'Consolas', 'Liberation Mono', 'Courier New', monospace; /* --vp-font-family-mono, vars.css:266, unchanged across modes */
    --source-linenumber-color: #98989f; /* --vp-c-text-2, vars.css:184 (dark) — see light-mode comment above */
    /* --body-font-size and --code-font-size (both 14px upstream) are
       deliberately NOT overridden — see header "Not covered" note. */`;
// palette-table:dark:end

export const OVERRIDE_BLOCK = `${PALETTE_MARKER}
:root {${LIGHT_DECLARATIONS}
}
@media (prefers-color-scheme: dark) {
  :root {${DARK_DECLARATIONS}
  }
}
`;

// Two self-contained, inline-styled HTML pages for the reverse proxy's
// failure branches (D-10). Neither function reads context, path segments,
// the request object, or a query string — the only input either accepts is
// the current release's version number, used to build the two fixed exit
// links every degraded page offers. That single-arity contract is D-08's
// requirement (no querying javadoc.io's available-version list from inside
// a failure branch) and it also makes reflected XSS structurally
// impossible here: there is nothing request-derived to echo back.
//
// D-11's known tradeoff: both pages are English-only, by explicit user
// decision, because the javadoc content itself is English. This breaks the
// site's bilingual promise exactly at the moment a reader most needs to
// understand what happened. If that decision is revisited, the cheapest
// path is a single page with both languages stacked (no request-derived
// language switch, no need to split the edge cache by Accept-Language —
// just twice the prose in one static string).

const BRAND = 'rgb(5, 122, 255)';
const BRAND_DARK = 'rgb(4, 98, 204)';

function styleBlock() {
  return `<style>
      :root { color-scheme: light dark; }
      body {
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        max-width: 40rem;
        margin: 4rem auto;
        padding: 0 1.5rem;
        line-height: 1.6;
        color: #213547;
        background: #fff;
      }
      h1 { color: ${BRAND}; font-size: 1.5rem; }
      a { color: ${BRAND}; }
      a:hover { color: ${BRAND_DARK}; }
      ul { padding-left: 1.25rem; }
      @media (prefers-color-scheme: dark) {
        body { color: rgba(255, 255, 255, 0.87); background: #1b1b1f; }
        a { color: rgb(85, 168, 255); }
        a:hover { color: rgb(133, 195, 255); }
      }
    </style>`;
}

function page(title, headingText, bodyHtml) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title}</title>
  ${styleBlock()}
</head>
<body>
  <h1>${headingText}</h1>
  ${bodyHtml}
</body>
</html>
`;
}

export function notIndexedPage(version) {
  return page(
    'Javadoc not indexed',
    'This version has not been indexed on javadoc.io',
    `<p>The Javadoc for UltiTools-API ${version} has not been indexed by javadoc.io, the third-party service that hosts this content. This applies the same whether the version does not exist or simply hasn't been indexed yet — either way, this site has nothing to serve for it.</p>
    <ul>
      <li><a href="/api/${version}/index.html">Go to the current release's Javadoc</a></li>
      <li><a href="https://javadoc.io/versions/com.ultikits/UltiTools-API">See all indexed versions on javadoc.io</a></li>
    </ul>`
  );
}

export function upstreamDownPage(version) {
  return page(
    'Javadoc temporarily unavailable',
    'Javadoc is temporarily unavailable',
    `<p>UltiTools-API's Javadoc is hosted by javadoc.io, a third-party service. This site could not reach it just now — this is not a problem with this site, and it is not a mistyped address. Please try again in a few minutes.</p>
    <ul>
      <li><a href="/api/${version}/index.html">Go to the current release's Javadoc</a></li>
    </ul>`
  );
}

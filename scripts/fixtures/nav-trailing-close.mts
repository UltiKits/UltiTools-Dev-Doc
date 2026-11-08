// Fixture for scripts/check-sidebar-links.sh (docs-ci.yml, sidebar-links job).
// The second entry closes with a brace that shares its line with a comment.
// Its link points at a page that does not exist, so the checker must report
// it and exit 1. A checker that ends an entry only on a bare `}` or `},` line
// skips that entry and passes on the first one alone.
const navEN = [
    {
        text: 'Resolves',
        link: '/guide/introduction',
    },
    {
        text: 'Broken on purpose',
        link: '/guide/nav-fixture-page-that-does-not-exist',
    }, // closing brace followed by a comment
]

export default navEN

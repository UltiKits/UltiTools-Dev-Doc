# UltiKits CLI

`@ultikits/cli` is the official command-line tool for publishing UltiTools plugin modules to the [UltiCloud](https://panel.ultikits.com/) marketplace. Developers can use it to authenticate, initialize project metadata, upload JAR files, and manage published modules and versions.

::: tip Recommended: GitHub Actions

All official UltiTools modules use a [GitHub Actions workflow](#ci-cd-with-github-actions) that automatically publishes to UltiCloud when a GitHub release is created. The CLI is still useful for local testing, debugging, and manual publishing.

:::

## Installation

```bash
npm install -g @ultikits/cli
```

Verify the installation:

```bash
ultikits --version
```

::: info Requirements

- Node.js 20+
- npm or any Node package manager

:::

## Authentication

Before publishing, you need to authenticate with UltiCloud. The CLI supports two methods.

### Browser Login (Magic Link)

```bash
ultikits login
```

Select **Browser login (magic link)** when prompted. A browser window will open for you to approve the authentication. The CLI polls for completion automatically.

Credentials are saved to `~/.ultikits/credentials.json`.

### Access Token

If you prefer non-interactive login (e.g., on a remote server), use an access token:

1. Go to [panel.ultikits.com/developer](https://panel.ultikits.com/developer)
2. Copy your access token
3. Run `ultikits login` and select **Access token (from developer portal)**
4. Paste the token when prompted

### Environment Variable

For CI/CD pipelines, set the `ULTIKITS_TOKEN` environment variable instead of running `ultikits login`:

```bash
export ULTIKITS_TOKEN=your_access_token
```

### Other Auth Commands

```bash
ultikits whoami     # Check current authentication status
ultikits logout     # Remove stored credentials
```

## Scaffolding a New Module

The fastest way to start a new UltiTools module is with `ultikits create`:

```bash
ultikits create
```

The command prompts you for:

| Prompt | Default | Description |
|--------|---------|-------------|
| Module name | — | PascalCase name (e.g., `UltiHome`, `MyPlugin`) |
| Package name | Derived from name | Java package (e.g., `com.ultikits.plugins.home`) |
| Description | — | Short description of the module |
| Author | `git config user.name` | Your name |
| API version | `6.2.3` | UltiTools-API version |

It generates a complete, compilable project:

```
UltiHome/
├── pom.xml                          # Maven build with UltiTools-API, test deps, JaCoCo
├── README.md                        # Bilingual readme template
├── .gitignore
├── src/main/java/.../UltiHome.java  # Main class with @UltiToolsModule
├── src/main/resources/
│   ├── plugin.yml                   # Plugin descriptor
│   └── lang/
│       ├── en.yml                   # English language file
│       └── zh.yml                   # Chinese language file
└── src/test/java/.../               # Test directory (empty, ready for tests)
```

The generated project compiles immediately:

```bash
cd UltiHome
mvn compile
```

You can also specify a target directory:

```bash
ultikits create my-plugin-dir
```

::: tip
After scaffolding, add commands in a `commands/` package, services in a `service/` package, and configs in a `config/` package. The framework auto-discovers annotated classes via `@UltiToolsModule(scanBasePackages)`.
:::

## Project Setup

### Initialize Project Config

Run the following command in your module's root directory:

```bash
ultikits init
```

This creates an `ultikits.json` file with interactive prompts:

```json
{
  "identifyString": "myplugin",
  "name": "MyPlugin",
  "shortDescription": "A brief description of your plugin.",
  "categoryId": 1
}
```

| Field | Description |
|-------|-------------|
| `identifyString` | Unique module identifier. 3-64 characters, lowercase letters, digits, `.` and `_`. Must start with a letter. |
| `name` | Display name shown on the marketplace. |
| `shortDescription` | Brief description, max 200 characters. |
| `categoryId` | Module category (see table below). |

### Categories

| ID | Category |
|----|----------|
| 1 | Utilities |
| 2 | Economy |
| 3 | World Management |
| 4 | Social & Chat |
| 5 | Permissions & Security |
| 6 | Gameplay |

## Publishing

### Basic Usage

Build your module JAR first, then publish:

```bash
mvn clean package -DskipTests
ultikits publish
```

The CLI automatically:
1. Finds the JAR in `./target/` (skips `-sources.jar` and `-javadoc.jar`)
2. Reads `plugin.yml` from the JAR for name and version
3. Reads `ultikits.json` for identifyString, description, and category
4. Creates the module on UltiCloud if it doesn't exist
5. Creates a new version and uploads the JAR

### Publish with Options

You can specify a JAR path explicitly and override metadata with flags:

```bash
ultikits publish target/MyPlugin-1.2.0.jar \
  --version 1.2.0 \
  --changelog "Added new features"
```

Available flags:

| Flag | Description |
|------|-------------|
| `--id <identifyString>` | Override module identifier |
| `--name <name>` | Override display name |
| `--version <version>` | Override version string |
| `--changelog <text>` | Version changelog |
| `--short-description <text>` | Override short description |
| `-y, --yes` | Skip all confirmation prompts |

### Non-Interactive Mode

For CI/CD, use `--yes` to skip prompts and `ULTIKITS_TOKEN` for auth:

```bash
ULTIKITS_TOKEN=your_token ultikits publish --yes \
  --version "1.2.0" \
  --changelog "Bug fixes and improvements"
```

### Metadata Resolution

The CLI resolves metadata from multiple sources in this priority order:

**CLI flags** > **ultikits.json** > **plugin.yml from JAR**

For example, if you pass `--version 1.2.0`, it overrides the version in `plugin.yml`.

## Managing Modules

### List Your Modules

```bash
ultikits modules list
```

Output:

```
  myplugin — MyPlugin (1.0.0)
  anotherplugin — AnotherPlugin (no versions)

2 module(s)
```

### Module Details

```bash
ultikits modules info myplugin
```

Output:

```
  Name:        MyPlugin
  ID:          myplugin
  Description: A brief description
  Downloads:   42
  Version:     1.0.0
```

### Delete a Module

```bash
ultikits modules delete myplugin
```

::: danger

This permanently deletes the module and all its versions. This cannot be undone.

:::

## Managing Versions

### List Versions

```bash
ultikits versions list myplugin
```

Output:

```
  1.0.0 (latest) 85 KB — 2026-02-14T12:00:00Z
  0.9.0 72 KB — 2026-02-10T08:30:00Z

2 version(s)
```

### Delete a Version

```bash
ultikits versions delete myplugin 0.9.0
```

## CI/CD with GitHub Actions {#ci-cd-with-github-actions}

The recommended way to publish is through GitHub Actions. Create `.github/workflows/publish.yml` in your module repository:

```yaml
name: Publish to UltiCloud

on:
  release:
    types: [published]

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Set up JDK 8
        uses: actions/setup-java@v4
        with:
          java-version: '8'
          distribution: 'temurin'
          cache: maven

      - name: Extract version from tag
        id: version
        run: echo "VERSION=${GITHUB_REF_NAME#v}" >> "$GITHUB_OUTPUT"

      - name: Set project version
        env:
          MODULE_VERSION: ${{ steps.version.outputs.VERSION }}
        run: mvn versions:set -DnewVersion="$MODULE_VERSION" -DgenerateBackupPoms=false

      - name: Build with Maven
        run: mvn clean package -DskipTests

      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install UltiKits CLI
        run: npm install -g @ultikits/cli

      - name: Publish to UltiCloud
        env:
          ULTIKITS_TOKEN: ${{ secrets.ULTIKITS_TOKEN }}
          MODULE_VERSION: ${{ steps.version.outputs.VERSION }}
          RELEASE_BODY: ${{ github.event.release.body }}
        run: |
          ultikits publish --yes \
            --version "$MODULE_VERSION" \
            --changelog "$RELEASE_BODY"
```

### Setup Steps

1. **Add the workflow file** to `.github/workflows/publish.yml`

2. **Set the `ULTIKITS_TOKEN` secret** on your GitHub repository:
   ```bash
   gh secret set ULTIKITS_TOKEN --body "your_access_token" --repo YourOrg/YourPlugin
   ```
   Get the access token from [panel.ultikits.com/developer](https://panel.ultikits.com/developer).

3. **Create a GitHub release** (e.g., tag `v1.0.0`). The workflow:
   - Strips the `v` prefix from the tag to get the version (`1.0.0`)
   - Updates `pom.xml` to match the release version
   - Builds the JAR with `mvn clean package`
   - Publishes to UltiCloud with the release body as changelog

::: tip

Pushing commits to `master` does **not** trigger publishing. Only creating a GitHub release does.

:::

### Publishing a New Version

After the initial setup, releasing a new version is simple:

1. Commit and push your changes to `master`
2. Go to GitHub > Releases > **Draft a new release**
3. Create a new tag (e.g., `v1.1.0`) — the `v` prefix is stripped automatically
4. Write the changelog in the release body
5. Click **Publish release**

The workflow automatically builds and uploads the new version to UltiCloud.

## Troubleshooting

### "Not logged in" Error

```
Not logged in. Run `ultikits login` or set ULTIKITS_TOKEN.
```

Either run `ultikits login` to authenticate interactively, or set the `ULTIKITS_TOKEN` environment variable.

### "No JAR file specified and none found in ./target/"

The CLI looks for a `.jar` file in `./target/` by default. Make sure you've built the project first:

```bash
mvn clean package -DskipTests
```

### Missing Required Fields

```
Missing required fields:
  - identifyString (use --id or ultikits.json)
```

Create an `ultikits.json` with `ultikits init`, or pass the missing fields as CLI flags.

### GitHub Actions: 403 on Publish

Verify that the `ULTIKITS_TOKEN` secret is set correctly on your repository:

```bash
gh secret list --repo YourOrg/YourPlugin
```

Make sure the token matches the access token from the developer portal.

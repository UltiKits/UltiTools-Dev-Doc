# UltiKits CLI

`@ultikits/cli` 是官方命令行工具，用于将 UltiTools 插件模块发布到 [UltiCloud](https://panel.ultikits.com/) 市场。开发者可以使用它进行身份验证、初始化项目元数据、上传 JAR 文件，以及管理已发布的模块和版本。

::: tip 推荐：GitHub Actions

所有官方 UltiTools 模块都使用 [GitHub Actions 工作流](#ci-cd-github-actions) 在创建 GitHub Release 时自动发布到 UltiCloud。CLI 仍然适用于本地测试、调试和手动发布。

:::

## 安装

```bash
npm install -g @ultikits/cli
```

验证安装：

```bash
ultikits --version
```

::: info 环境要求

- Node.js 20+
- npm 或其他 Node 包管理器

:::

## 身份验证

在发布之前，需要先通过 UltiCloud 身份验证。CLI 支持两种方式。

### 浏览器登录（Magic Link）

```bash
ultikits login
```

出现提示时选择 **Browser login (magic link)**。浏览器窗口将打开供你确认授权，CLI 会自动轮询等待完成。

凭据保存在 `~/.ultikits/credentials.json`。

### Access Token

如果你需要非交互式登录（例如在远程服务器上），可以使用 Access Token：

1. 访问 [panel.ultikits.com/developer](https://panel.ultikits.com/developer)
2. 复制你的 Access Token
3. 运行 `ultikits login`，选择 **Access token (from developer portal)**
4. 粘贴 Token

### 环境变量

在 CI/CD 流水线中，设置 `ULTIKITS_TOKEN` 环境变量即可，无需运行 `ultikits login`：

```bash
export ULTIKITS_TOKEN=your_access_token
```

### 其他验证命令

```bash
ultikits whoami     # 查看当前身份验证状态
ultikits logout     # 删除已保存的凭据
```

## 创建新模块

创建新 UltiTools 模块最快的方式是使用 `ultikits create`：

```bash
ultikits create
```

命令会依次提示你输入：

| 提示 | 默认值 | 说明 |
|------|--------|------|
| Module name | — | 模块名称，PascalCase 格式（如 `UltiHome`、`MyPlugin`） |
| Package name | 由名称自动推导 | Java 包名（如 `com.ultikits.plugins.home`） |
| Description | — | 模块简短描述 |
| Author | `git config user.name` | 作者名 |
| API version | `6.2.3` | UltiTools-API 版本 |

生成一个完整的、可编译的项目：

```
UltiHome/
├── pom.xml                          # Maven 构建，包含 UltiTools-API、测试依赖、JaCoCo
├── README.md                        # 中英双语 README 模板
├── .gitignore
├── src/main/java/.../UltiHome.java  # 带 @UltiToolsModule 的主类
├── src/main/resources/
│   ├── plugin.yml                   # 插件描述文件
│   └── lang/
│       ├── en.yml                   # 英文语言文件
│       └── zh.yml                   # 中文语言文件
└── src/test/java/.../               # 测试目录（空，等待编写测试）
```

生成的项目可以直接编译：

```bash
cd UltiHome
mvn compile
```

也可以指定目标目录：

```bash
ultikits create my-plugin-dir
```

::: tip
创建完成后，在 `commands/` 包中添加命令类，`service/` 包中添加服务类，`config/` 包中添加配置类。框架通过 `@UltiToolsModule(scanBasePackages)` 自动发现带注解的类。
:::

## 项目配置

### 初始化项目配置

在模块根目录下运行：

```bash
ultikits init
```

通过交互式提示创建 `ultikits.json` 文件：

```json
{
  "identifyString": "myplugin",
  "name": "MyPlugin",
  "shortDescription": "插件简介。",
  "categoryId": 1
}
```

| 字段 | 说明 |
|------|------|
| `identifyString` | 模块唯一标识符。3-64 个字符，小写字母、数字、`.` 和 `_`，必须以字母开头。 |
| `name` | 在市场中显示的名称。 |
| `shortDescription` | 简短描述，最多 200 个字符。 |
| `categoryId` | 模块分类（见下表）。 |

### 分类

| ID | 分类 |
|----|------|
| 1 | 实用工具 (Utilities) |
| 2 | 经济 (Economy) |
| 3 | 世界管理 (World Management) |
| 4 | 社交聊天 (Social & Chat) |
| 5 | 权限安全 (Permissions & Security) |
| 6 | 游戏玩法 (Gameplay) |

## 发布

### 基本用法

先构建模块 JAR，然后发布：

```bash
mvn clean package -DskipTests
ultikits publish
```

CLI 自动完成以下操作：
1. 在 `./target/` 中查找 JAR 文件（跳过 `-sources.jar` 和 `-javadoc.jar`）
2. 从 JAR 中读取 `plugin.yml` 获取名称和版本
3. 读取 `ultikits.json` 获取标识符、描述和分类
4. 如果模块在 UltiCloud 上不存在则自动创建
5. 创建新版本并上传 JAR

### 带参数发布

可以显式指定 JAR 路径，并通过命令行参数覆盖元数据：

```bash
ultikits publish target/MyPlugin-1.2.0.jar \
  --version 1.2.0 \
  --changelog "新增功能"
```

可用参数：

| 参数 | 说明 |
|------|------|
| `--id <identifyString>` | 覆盖模块标识符 |
| `--name <name>` | 覆盖显示名称 |
| `--version <version>` | 覆盖版本号 |
| `--changelog <text>` | 版本更新日志 |
| `--short-description <text>` | 覆盖简短描述 |
| `-y, --yes` | 跳过所有确认提示 |

### 非交互模式

在 CI/CD 中使用 `--yes` 跳过提示，配合 `ULTIKITS_TOKEN` 进行身份验证：

```bash
ULTIKITS_TOKEN=your_token ultikits publish --yes \
  --version "1.2.0" \
  --changelog "修复 Bug 和改进"
```

### 元数据优先级

CLI 从多个来源解析元数据，优先级如下：

**CLI 参数** > **ultikits.json** > **JAR 中的 plugin.yml**

例如，如果你传入 `--version 1.2.0`，它会覆盖 `plugin.yml` 中的版本号。

## 模块管理

### 列出模块

```bash
ultikits modules list
```

输出：

```
  myplugin — MyPlugin (1.0.0)
  anotherplugin — AnotherPlugin (no versions)

2 module(s)
```

### 模块详情

```bash
ultikits modules info myplugin
```

输出：

```
  Name:        MyPlugin
  ID:          myplugin
  Description: 插件简介
  Downloads:   42
  Version:     1.0.0
```

### 删除模块

```bash
ultikits modules delete myplugin
```

::: danger

此操作会永久删除模块及其所有版本，无法撤销。

:::

## 版本管理

### 列出版本

```bash
ultikits versions list myplugin
```

输出：

```
  1.0.0 (latest) 85 KB — 2026-02-14T12:00:00Z
  0.9.0 72 KB — 2026-02-10T08:30:00Z

2 version(s)
```

### 删除版本

```bash
ultikits versions delete myplugin 0.9.0
```

## CI/CD — GitHub Actions {#ci-cd-github-actions}

推荐使用 GitHub Actions 进行自动发布。在模块仓库中创建 `.github/workflows/publish.yml`：

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

### 配置步骤

1. **添加工作流文件** 到 `.github/workflows/publish.yml`

2. **设置 `ULTIKITS_TOKEN` Secret**：
   ```bash
   gh secret set ULTIKITS_TOKEN --body "your_access_token" --repo YourOrg/YourPlugin
   ```
   从 [panel.ultikits.com/developer](https://panel.ultikits.com/developer) 获取 Access Token。

3. **创建 GitHub Release**（例如标签 `v1.0.0`）。工作流会：
   - 从标签中去掉 `v` 前缀得到版本号（`1.0.0`）
   - 更新 `pom.xml` 中的版本号
   - 使用 `mvn clean package` 构建 JAR
   - 将 Release 正文作为更新日志发布到 UltiCloud

::: tip

推送代码到 `master` **不会**触发发布，只有创建 GitHub Release 才会。

:::

### 发布新版本

初始配置完成后，发布新版本很简单：

1. 提交并推送代码到 `master`
2. 在 GitHub 上进入 Releases > **Draft a new release**
3. 创建新标签（例如 `v1.1.0`）— `v` 前缀会自动去除
4. 在 Release 正文中填写更新日志
5. 点击 **Publish release**

工作流会自动构建并上传新版本到 UltiCloud。

## 常见问题

### "Not logged in" 错误

```
Not logged in. Run `ultikits login` or set ULTIKITS_TOKEN.
```

运行 `ultikits login` 进行交互式验证，或设置 `ULTIKITS_TOKEN` 环境变量。

### "No JAR file specified and none found in ./target/"

CLI 默认在 `./target/` 中查找 `.jar` 文件。确保先构建项目：

```bash
mvn clean package -DskipTests
```

### 缺少必填字段

```
Missing required fields:
  - identifyString (use --id or ultikits.json)
```

使用 `ultikits init` 创建 `ultikits.json`，或通过 CLI 参数传入缺少的字段。

### GitHub Actions 发布返回 403

确认仓库上的 `ULTIKITS_TOKEN` Secret 设置正确：

```bash
gh secret list --repo YourOrg/YourPlugin
```

确保 Token 与开发者门户中的 Access Token 一致。

# UltiKits CLI

`@ultikits/cli` 是官方命令行工具，用于将 UltiTools 插件模块发布到 [UltiCloud](https://panel.ultikits.com/) 市场。开发者可以使用它进行身份验证、初始化项目元数据、上传 JAR 文件，以及管理已发布的模块和版本。

::: tip 推荐：本地发布
官方 UltiTools 模块由维护者在本地发布：把验收通过的 JAR 附加到 GitHub Release，再用 CLI 将同一个文件发布到 UltiCloud。第三方开发者也可以使用相同的路径。
[GitHub Actions](#ci-cd-github-actions) 是可选的手动工作流，不是官方模块的发布路径。
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
| API version | `6.2.2` | UltiTools-API 版本。该默认值落后于当前正式版，建议手动改为最新版。 |

CLI 1.2.0 生成以下项目结构：

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

用 UltiTools-API 6.3.0 编译之前，需要迁移 CLI 1.2.0 模板：

- 选择 API 版本 `6.3.0`，并把 `src/main/resources/plugin.yml` 的 `api-version` 设为 `630`；模板仍会写入 `620`。
- 删除主类中空的 `unregisterSelf()` 和 `reloadSelf()` 覆写。这两个方法在 6.3.0 中为 final；如需清理或重载逻辑，分别放进 `protected void onUnregister()` 和 `protected void onReload()`。

然后编译迁移后的项目：

```bash
cd UltiHome
mvn compile
```

也可以指定目标目录：

```bash
ultikits create my-plugin-dir
```

::: tip 框架通过 scanBasePackages 发现带注解的类
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

先构建并测试模块，保留准备发布的 JAR。把这个文件附加到 GitHub Release，再用 CLI 发布相同字节的文件，不要在两次上传之间重新构建：

```bash
mvn clean verify
ultikits publish target/MyPlugin-1.2.0.jar \
  --module-version 1.2.0 \
  --changelog "CHANGELOG.md 中 1.2.0 节的正文"
```

未指定 JAR 路径时，CLI 在 `./target/` 中查找文件（跳过 `-sources.jar` 和 `-javadoc.jar`）。选定 JAR 后，CLI 自动完成以下操作：
1. 使用这个文件上传
2. 从 JAR 中读取 `plugin.yml` 获取名称和版本
3. 读取 `ultikits.json` 获取标识符、描述和分类
4. 如果模块在 UltiCloud 上不存在则自动创建
5. 创建新版本并上传 JAR

### 带参数发布

显式指定 JAR 路径，并通过命令行参数覆盖元数据。建议把已发布版本在 `CHANGELOG.md` 中对应一节的正文作为一个完整的 `--changelog` 参数，不要传整份文件或通用占位说明。下面的示例文本应替换为该节正文：

```bash
ultikits publish target/MyPlugin-1.2.0.jar \
  --module-version 1.2.0 \
  --changelog "CHANGELOG.md 中 1.2.0 节的正文"
```

可用参数：

| 参数 | 说明 |
|------|------|
| `--id <identifyString>` | 覆盖模块标识符 |
| `--name <name>` | 覆盖显示名称 |
| `--module-version <version>` | 覆盖版本号 |
| `--changelog <text>` | 版本更新日志 |
| `--short-description <text>` | 覆盖简短描述 |
| `-y, --yes` | 跳过所有确认提示 |

### 非交互模式

在 CI/CD 中使用 `--yes` 跳过提示，配合 `ULTIKITS_TOKEN` 进行身份验证：

```bash
ULTIKITS_TOKEN=your_token ultikits publish --yes \
  --module-version "1.2.0" \
  --changelog "CHANGELOG.md 中 1.2.0 节的正文"
```

### 元数据优先级

CLI 从多个来源解析元数据，优先级如下：

**CLI 参数** > **ultikits.json** > **JAR 中的 plugin.yml**

例如，如果你传入 `--module-version 1.2.0`，它会覆盖 `plugin.yml` 中的版本号。

### 上传失败与重试

文件上传从未完成的版本不算已发布，不会出现在公开列表中，也不会被选为最新版本。上传失败或中断后，可以立即使用同一版本再次执行相同的 `ultikits publish` 命令，不需要等待预留过期。新尝试会替换该版本的待上传预留，并使旧上传令牌失效。同一模块另一个版本的上传仍在进行时，仍会阻止新的预留。

已发布版本不可覆盖，CLI 上传和旧的 `POST /developer/plugin/update` Accesskey 接口都如此。修改文件后应发布新版本。如果网络故障导致结果不明，先检查[公开版本详情接口](#列出版本)：已经完成的发布不是待上传状态，不能通过重试替换。

### 模块的 API 级别

自 v6.3.0 起，UltiCloud 从你发布的 JAR 根目录的 `plugin.yml` 中读取 `api-version`，与该版本一起保存。没有任何命令行参数或 `ultikits.json` 字段可以设置它，随文件一起发送的值也会被忽略。请以整数形式声明：

```yaml
api-version: 630
```

这个数字决定哪些服务器会被提供这个版本。运行 UltiTools-API 6.3.0 及以后的服务器只会被提供从 630 到其自身 API 级别的版本；运行更早框架的服务器只会被提供低于 630 的版本。见[模块版本规范](/zh/guide/advanced/module-versioning#按-api-级别选择版本)。

根目录 `plugin.yml` 没有声明整数 `api-version` 的 JAR 会在保存任何东西之前被拒绝，该版本不会发布。见[因 API 级别被拒绝上传](#因-api-级别被拒绝上传)。

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

::: danger 删除模块无法撤销

此操作会永久删除模块及其所有版本，无法撤销。

:::

## 版本管理

### 列出版本

```bash
ultikits versions list myplugin
```

在 CLI 1.2.0 中，该命令对使用 UltiTools-API 6.3.0 构建的模块不可靠。它没有传 API 级别查询参数，服务端因此会排除 `api-version: 630` 的版本；它还把返回的版本字符串当成对象读取，可能输出 `undefined`。不要用它的输出判断上传是否完成。

请改查公开版本详情接口。先按 `identifyString` 查模块，再使用响应中的数字 `data.id`：

```bash
curl --fail-with-body 'https://api.ultikits.com/plugin/get?identifyString=myplugin'
# 把 123 替换为上一个响应中的 data.id。
curl --fail-with-body 'https://api.ultikits.com/plugin/123/versions-detail'
```

第二个响应的 `data` 数组包含已完成发布的版本及其 `version`、`changelog`、`fileSize` 和 `downloadLink`，不使用 `/versions` 的兼容性过滤。检查目标版本和更新说明，再下载其 `downloadLink` 并与保留 JAR 的 SHA-256 比较，以验证上传字节。待上传记录不在其中。

### 删除版本

CLI 1.2.0 暴露了 `ultikits versions delete`，但服务端没有实现它调用的 `DELETE /developer/modules/<id>/versions/<version>` 路由。该请求返回 404，不会删除版本。不要用它绕过已发布版本不可覆盖的规则；文件改变后应发布新版本。

## CI/CD — GitHub Actions {#ci-cd-github-actions}

推荐使用本地发布。如果项目需要通过 CI 发布，可以使用下面的可选方案，仅在维护者手动启动时运行。推送、合并或创建 GitHub Release 都不会触发它。在模块仓库中创建 `.github/workflows/publish.yml`：

```yaml
name: Publish to UltiCloud

on:
  workflow_dispatch:
    inputs:
      version:
        description: Module version, for example 1.2.0
        required: true
        type: string

permissions:
  contents: read

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          persist-credentials: false

      - name: Extract release notes
        env:
          MODULE_VERSION: ${{ inputs.version }}
        shell: bash
        run: |
          set -euo pipefail
          python3 - <<'PY'
          import os
          import re
          from pathlib import Path

          version = os.environ["MODULE_VERSION"]
          if not re.fullmatch(r"(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)", version):
              raise SystemExit("Expected a release version such as 1.2.0")
          lines = Path("CHANGELOG.md").read_text(encoding="utf-8").splitlines()
          heading = re.compile(r"^##[ \t]+(?:\[v?([^\]]+)\]|v?([0-9]+\.[0-9]+\.[0-9]+))(?=[ \t]|$)")
          sections = []
          start = None
          fence = None
          for index, line in enumerate(lines):
              marker = re.match(r"^ {0,3}(`{3,}|~{3,})", line)
              if fence:
                  if re.fullmatch(r" {0,3}" + re.escape(fence[0]) + "{" + str(len(fence)) + r",}[ \t]*", line):
                      fence = None
                  continue
              if marker:
                  fence = marker.group(1)
                  continue
              if re.match(r"^##(?:[ \t]|$)", line):
                  if start is not None:
                      sections.append(lines[start:index])
                      start = None
                  match = heading.match(line)
                  if match and (match.group(1) or match.group(2)) == version:
                      start = index + 1
          if start is not None:
              sections.append(lines[start:])
          if len(sections) != 1:
              raise SystemExit("Expected exactly one CHANGELOG section for " + version)
          body = "\n".join(sections[0]).strip()
          if not body:
              raise SystemExit("The CHANGELOG section is empty")
          Path("release-notes.md").write_text(body + "\n", encoding="utf-8")
          PY

      - name: Set up JDK 21
        uses: actions/setup-java@v4
        with:
          java-version: '21'
          distribution: 'temurin'
          cache: maven

      - name: Set project version and verify
        env:
          MODULE_VERSION: ${{ inputs.version }}
        shell: bash
        run: |
          set -euo pipefail
          [[ "$MODULE_VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]
          mvn -B versions:set "-DnewVersion=$MODULE_VERSION" -DgenerateBackupPoms=false
          mvn -B clean verify

      - name: Retain the built JAR
        uses: actions/upload-artifact@v4
        with:
          name: module-${{ inputs.version }}
          path: target/MyPlugin-${{ inputs.version }}.jar
          if-no-files-found: error
          retention-days: 7

      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install a pinned UltiKits CLI
        run: npm install -g @ultikits/cli@1.2.0 --ignore-scripts

      - name: Publish to UltiCloud
        env:
          ULTIKITS_TOKEN: ${{ secrets.ULTIKITS_TOKEN }}
          MODULE_VERSION: ${{ inputs.version }}
        shell: bash
        run: |
          set -euo pipefail
          ultikits publish "target/MyPlugin-${MODULE_VERSION}.jar" --yes \
            --module-version "$MODULE_VERSION" \
            --changelog "$(cat release-notes.md)"
```

提取器接受唯一的 `## [1.2.0]`、`## [v1.2.0]` 或 `## 1.2.0` 标题，后面可以带日期。它保留子标题和围栏代码，到下一个二级标题或文件末尾结束；版本无效、节缺失、重复或正文为空时，在构建和发布之前拒绝。检查所选 ref，确保更新说明描述的是准备构建的字节。

### 配置步骤

1. 添加工作流文件，把两处精确 JAR 路径中的 `MyPlugin` 改为自己构建产物的最终名称。不要用通配符，以免上传源码包或未打包依赖的 JAR。
2. 把开发者门户的 Access Token 设置为仓库的 `ULTIKITS_TOKEN` Secret，不要写进工作流正文或手动输入参数。
3. 保持 CLI 版本固定，检查版本变更后再更新这个固定值。

::: warning 推送即发布
不要加入 `push` 或合并触发器，否则合并版本号改动就会自动发布。把工作流输入直接插入 `run:` 也可能造成 shell 注入；应像示例一样通过环境变量传递，并对变量展开放置引号。
:::

### 发布新版本

1. 检查源码和该版本的 `CHANGELOG.md` 一节。
2. 打开 **Actions > Publish to UltiCloud > Run workflow**，选择准备发布的分支或标签。
3. 只输入模块版本。工作流会从检出的 `CHANGELOG.md` 读取该版本完整节的正文，不使用多行表单输入。
4. 明确启动工作流，然后核对上传的版本与文件。这个可选方案只构建一次并发布到 UltiCloud，不会创建 GitHub Release。如需在 GitHub 发布，从工作流运行页下载 `module-<version>` 产物，解压出其中的 JAR 并附加该文件，不要重新构建。

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

### 因 API 级别被拒绝上传

自 v6.3.0 起，JAR 根目录的 `plugin.yml` 没有可用的 `api-version` 时，`ultikits publish` 会打印 UltiCloud 给出的原因，例如：

```
Upload failed: Cannot read the module's UltiTools API level: plugin.yml has no top-level api-version. The root plugin.yml must declare the UltiTools API level the module is built for as an integer, for example "api-version: 630". Nothing was published, and the upload reservation for this version was released: correct the JAR, then publish the version again (run ultikits publish again, or create the version again in the panel).
```

其它原因包括：值是 `'1.19'` 这样的 Bukkit 风格、不是整数，值为空，声明了两次，JAR 根目录没有 `plugin.yml`，以及 UltiCloud 无法读取的归档（例如不完整的 JAR）；消息中总会写明原因。按[模块的 API 级别](#模块的-api-级别)声明级别，重新构建后再次发布。这次拒绝会释放该版本的上传预留，因此修正 `plugin.yml` 并重新构建后，可以立即再次执行 `ultikits publish`。

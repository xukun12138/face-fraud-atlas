# GitHub Pages 部署与更新

预定仓库为 `xukun12138/face-fraud-atlas`，预定项目站点为 **https://xukun12138.github.io/face-fraud-atlas/**。此文档描述部署步骤，不是已经上线或工作流已运行成功的记录。实际状态应以仓库 Actions、Pages 环境和最终 URL 的检查为准。

## 本地生成与预览

在仓库根目录使用 Python 3：

```sh
python scripts/build_catalog.py
python scripts/validate_site.py
python -m http.server 8765 --directory site
```

访问 **http://localhost:8765/**。网站是静态资源，无 npm 安装步骤、无服务端推理和模型下载。`site/data/` 是生成的数据，维护时优先修改 `data/` 和相关研究源文件。

检查文献搜索、筛选和导出；核对当前141研究文献与12官方资源是否与输入一致；检查12基准的单位和备注、解析计算器的假设、协议 JSON、十幅图与所有下载。数据增补后以新源文件生成的数字为准，不把初始整理数量硬编码为永远成立的验收条件。另用桌面和手机宽度、键盘操作检查页面。

## 配置仓库

1. 将项目提交到 `xukun12138/face-fraud-atlas` 的 `main` 分支。保留 `site/`、`scripts/`、数据输入以及 `.github/workflows/pages.yml`。
2. 在 GitHub 仓库 **Settings → Pages → Build and deployment → Source** 中选择 **GitHub Actions**。这是自定义 Pages 工作流的前提。[GitHub 官方说明](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)
3. 检查 `github-pages` 环境的允许部署分支与仓库实际 `main` 分支一致；如仓库要求环境审批，按其规则完成。
4. 推送 `main` 或在 **Actions → Deploy Face Fraud Atlas → Run workflow** 手动触发。此仓库工作流不在 pull request 时部署。

登录 GitHub 的账号必须有该仓库的管理或相应部署权限。文档不假设浏览器、CLI 和连接器正在使用同一个账号；权限或账号不匹配时应先确认仓库归属与操作身份，不通过保存个人访问令牌来绕过。

## 工作流做什么

`pages.yml` 由 `build` 与 `deploy` 两个作业组成。先拉取代码、重新生成目录与公开 CSV、运行 `scripts/validate_site.py` 检查资源和记录，再检查静态入口及 JSON 并把 **`site/`** 打包为 Pages artifact；部署作业通过 `needs: build` 等待材料生成，并发布到 `github-pages` 环境。仓库根的开发输入和文档不作为整站目录上传。

工作流使用以下官方 Actions（按核验时的正式版本选择）：

| Action | 使用版本 | 核验依据 |
| --- | --- | --- |
| `actions/checkout` | `@v7` | [官方正式发布 v7.0.1](https://github.com/actions/checkout/releases/tag/v7.0.1)；采用 `persist-credentials: false` |
| `actions/configure-pages` | `@v6` | [官方正式发布 v6.0.0](https://github.com/actions/configure-pages/releases/tag/v6.0.0) |
| `actions/upload-pages-artifact` | `@v5` | [官方正式发布 v5.0.0](https://github.com/actions/upload-pages-artifact/releases/tag/v5.0.0) |
| `actions/deploy-pages` | `@v5` | [官方正式发布 v5.0.1](https://github.com/actions/deploy-pages/releases/tag/v5.0.1) |

版本以正式 releases/latest 核验为准；官方教程示例可能还显示早期 major。当前 `configure-pages` 和 `deploy-pages` 使用 Node 24 的 Action 运行环境，由 GitHub hosted runner 提供；这不增加项目的 npm 依赖。

权限为 `contents: read`、`pages: write`、`id-token: write`。部署使用 GitHub 提供的运行令牌与 OIDC，不需要把 PAT、密码或密钥保存在项目中。`deploy` 作业的 URL 来自 `steps.deployment.outputs.page_url`，不是预先伪造成功链接。[官方部署要求](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)

构建目录保留 `.nojekyll`；上传设置 `include-hidden-files: true` 以保留该文件。只上传指定 `site/` 目录，第三方资料和公开下载都应在这个目录中明确组织。[上传 Action 的输入说明](https://github.com/actions/upload-pages-artifact)

## 部署后核验

1. `build` 与 `deploy` 都成功，`github-pages` 环境显示实际页面 URL。
2. 从 **https://xukun12138.github.io/face-fraud-atlas/** 打开站点，确认不是仓库根域名或错误子路径。项目站资源路径应相对于当前站点，避免以 `/data/` 或 `/assets/` 指向域名根目录。
3. 确认浏览器可以取得五个 JSON 数据文件、图预览和各下载文件。通过公开 URL 检查搜索、筛选、导出与协议下载。
4. 至少检查一个桌面和一个手机宽度，确保卡片、表单、导航和图注可读，焦点可见且无关键横向溢出。
5. 只有完成这些检查后，才能把 README 的部署状态改为已上线；仍须保留匿名研究草稿的发表状态说明。

这份文档没有预填部署时间、成功截图、运行编号或性能结果。

## 常见排查

| 现象 | 检查方向 |
| --- | --- |
| Pages 显示 404 | Source 是否为 GitHub Actions；部署环境是否成功；项目 URL 是否包含 `/face-fraud-atlas/` |
| 页面出现但目录为空 | 本地是否使用 HTTP；JSON 是否有效；资源路径是否错误地指向域名根目录 |
| 工作流权限失败 | Pages 是否启用；实际账号与仓库权限；环境分支保护；三个 workflow permissions |
| 下载 404 | `site/downloads/` 是否包含对应文件；`assets.json` 路径与大小写是否一致 |
| 页面仍是旧内容 | 最新部署对应的提交；是否重新生成 JSON；浏览器缓存；下载是否更新 |
| 数据修正只影响部分界面 | 输入 CSV、生成 JSON、统计、导出及资料包是否一起更新 |

## 持续更新

修改源记录，运行生成脚本以自动更新四个 JSON 和两个公开目录 CSV，复核差异与来源，再运行 `python scripts/validate_site.py`；`assets.json` 和研究资料包在受影响时另行更新。推送 `main` 后由相同工作流更新站点。大幅修改 schema 时同步调整前端读写、导出、说明及校验。文献和基准版本变动要保留变更缘由，不凭当前网页的不同数字覆盖原论文计数。

维护代码使用 MIT。部署不会改变论文、数据汇编、图或第三方素材的权利；不能把代码许可证视作全部下载材料的许可证。

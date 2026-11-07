# Academic homepage & personal blog

同一个 GitHub Pages 仓库、一次部署，组合两套真实的站点生成器：

| 路径 | 生成器 / 模板 | 内容入口 |
| --- | --- | --- |
| `/` | 自动跳转到 `/home/` | 联合构建生成 |
| `/home/` | Jekyll / 官方 academicpages | `academic/_pages/about.md` |
| `/home/sitemap/` | Jekyll / academicpages | `academic/_pages/sitemap.md` |
| `/blog/` | Hugo / Blowfish | `content/_index.md` |
| `/blog/posts/` | Hugo / Blowfish | `content/posts/` |
| `/blog/categories/` | Hugo taxonomies | `content/categories/` |
| `/blog/about/` | Hugo / Blowfish | `content/about/` |
| `/blog/updates/` | Hugo / Blowfish | `data/announcements.toml` |

部署地址为 `https://konpaku-ming.github.io/`，无需新建仓库或修改 DNS。

## 编辑学术主页

- `academic/_config.yml`：姓名、简介、学校、邮箱、GitHub、站点元信息和主题版本。
- `academic/_pages/about.md`：英文个人介绍、教育背景、精选技术笔记和联系方式。`browser_title` 独立指定浏览器标签页标题，不影响正文的 `title`。
- `academic/_data/navigation.yml`：顶部导航。普通链接相对 `/home/`；跨站导航加 `site_root: true`，如指向 `/blog/`。
- `academic/images/`：头像与其他图片。`author.avatar` 指定个人头像，`favicon` 独立指定浏览器图标；当前 `favicon.svg` 是 D 字母标识。
- `academic/_publications/`：预留的论文集合；有真实成果后再创建 Markdown 条目，并添加对应的归档页和导航。
- `academic/_data/cv_editor.yml`：本地编辑的 CV 内容；每次 `main` push 时由 workflow 读取并生成 `academic/files/CV.pdf`，该 PDF 不提交到仓库。
- `/home/cv-editor/`：CV 内容的浏览器编辑和实时预览接口；浏览器中的修改需要同步回 `cv_editor.yml`，workflow 才能在下一次 push 时读取。
- 简历等文件可放入 `academic/files/`，再从个人介绍或导航链接。不提供虚构的论文、履历或学术账号。

姓名、照片和个人资料以配置及正文为准；不自动生成论文或履历。

主题通过 `jekyll-remote-theme` 使用官方 `academicpages/academicpages.github.io`，固定到 `_config.yml` 中的提交；布局、侧栏、明暗主题、CSS、图标等均来自官方主题，而非 Hugo 仿制。首次构建需要访问 GitHub 和 RubyGems。

`academic/_includes/` 调整资源入口、favicon、按需数学公式加载，以及适配子目录的导航和页脚。`academic/_plugins/academicpages_assets.rb` 按官方构建顺序组合三份官方 JavaScript 源码，生成未压缩的 `assets/js/academicpages.js`，无需额外安装 Node.js。交互仍按官方主题依赖固定版本的 jQuery CDN。

学术站的 `baseurl` 为 `/home`。新增站内页面、图片或文件链接时使用 `relative_url`，例如 `{{ '/files/cv.pdf' | relative_url }}`，生成 `/home/files/cv.pdf`；链接到博客时使用完整的 `/blog/...` 根路径。

## 维护 Hugo 博客

文章仍放在 `content/posts/`，原有资源、Blowfish 样式、音乐、搜索、评论、浏览量均保留。`config/_default/hugo.toml` 的 `baseURL` 包含 `/blog/`；构建结果整体挂载到该目录，包括图片、CSS、JavaScript、搜索索引和音乐。

- 联合构建为博客 HTML 页面生成旧根路径跳转，保留 `/posts/.../`、`/about/.../`、分类及归档链接。旧 RSS 地址也保留兼容副本。
- 评论与浏览量仍使用旧文章路径标识，避免因迁移产生新的讨论串或清零计数。
- 博客内部继续使用 Swup；往返学术站时完整导航，不混用两套主题脚本或音乐播放器。
- 文章引用建议使用 Hugo `relref`；新文章可通过 `hugo new content posts/<slug>.md` 创建，模板保留旧路径 alias。
- Hugo 菜单中跨站链接通过 `params.rootURL` 指定域名根路径，如 `/home/`，避免被追加博客前缀。

## 本地构建与预览

需要 Python 3.9+、Hugo **Extended 0.154.5**、Ruby **3.3** 和 Bundler。

```sh
cd academic
bundle install
cd ..
python3 scripts/build_cv_pdf.py
python3 scripts/build_site.py --base-url http://localhost:1313 --destination /tmp/personal-website-preview
python3 -m http.server 1313 --directory /tmp/personal-website-preview
```

打开 `http://localhost:1313/home/` 查看 academicpages，`http://localhost:1313/blog/` 查看博客；访问 `/` 会跳转到 `/home/`。内容变更后重新构建；切换部署结构或删除页面时请使用新的空预览目录，增量复制不会清除上一次输出中已删除的文件。

`--base-url` 同时覆盖两套生成器的站点地址，使预览中的资源、导航和旧 URL 重定向都留在本地。正式构建不传该参数即可。

只调试博客可执行 `hugo server`，访问其 `/blog/`；它不包含学术站。只调试学术主页可在 `academic/` 执行 `bundle exec jekyll serve`，访问其 `/home/`，但该预览不包含博客。两站之间的导航应使用联合预览验证。

## 检查与部署

```sh
python3 -m unittest discover -s .github/scripts -p 'test_build_site.py' -v
python3 .github/scripts/check_site_structure.py /tmp/personal-website-preview
```

联合构建先分别生成两站，再将 Jekyll 输出整体放到 `home/`、Hugo 输出整体放到 `blog/`，同名资源互不覆盖。根页面跳转到学术站，根 `sitemap.xml` 合并两站 URL，根 `/sitemap/` 兼容跳转至 `/home/sitemap/`。输出前自动检查页面、资源隔离、站内链接、旧 URL、评论身份、RSS 和搜索索引。

`.github/workflows/hugo.yml` 在 `main` 推送或手动触发时安装 Ruby/Jekyll 与 Hugo，调用联合构建并部署 `public/`。CI 从干净工作区生成输出。`Gemfile.lock` 固定 Ruby 依赖，主题提交单独固定；升级主题或生成器后应重新运行检查。

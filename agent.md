# 项目总体情况

## 概览

- Hugo 静态博客，主题为 Blowfish。
- 站点标题：Youming's Gensokyo
- 基础配置：config/_default/hugo.toml
- 主题参数：config/_default/params.toml
- 菜单配置：config/_default/menus.en.toml

## 主要目录

- archetypes/：内容模板
- assets/：资源（图标等）
- content/：内容（about 与 posts）
- layouts/：自定义布局与短代码覆盖
- static/：静态资源
- public/：构建产物
- themes/blowfish/：主题源码

## 内容概况

- 关于页：content/about/_index.md
- 文章：content/posts/ 下共 5 篇（hello-world、playing-luastg、srt-division、wallace-tree-1、wallace-tree-2）

## 站点功能

- KaTeX 数学公式渲染（extend-head.html）
- Prism.js 代码高亮（extend-head.html）
- APlayer + MetingJS 音乐播放器（extend-head.html）
- 自定义搜索与音乐入口（extend-head.html 脚本）

## 关键配置摘要

- 首页布局：profile
- 默认外观：dark（自动切换开启）
- 启用搜索、数学公式
- 文章展示：日期、作者、阅读时间、字数

## 备注

- 主题覆盖与自定义逻辑集中在 layouts/partials/extend-head.html

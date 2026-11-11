---
title: CV source
permalink: /cv-editor/
description: "Editable LaTeX source for Xuanming Ding's CV."
layout: single
author_profile: false
classes: wide
---

The downloadable [CV.pdf]({{ '/files/CV.pdf' | relative_url }}) is built from the editable **Vectra** LaTeX template in this repository.

Edit these files to update the CV:

- `academic/cv-editor/profile.tex` for your name, email, website, and PDF metadata.
- `academic/cv-editor/settings.tex` for page and footer settings.
- `academic/cv-editor/sections/` for education, research interests, research experience, publications, teaching, awards, and skills.

The GitHub Actions workflow compiles `academic/cv-editor/main.tex` on every push, then publishes the generated PDF at `/home/files/CV.pdf`.

[Open the CV source on GitHub](https://github.com/{{ site.repository }}/tree/main/academic/cv-editor)

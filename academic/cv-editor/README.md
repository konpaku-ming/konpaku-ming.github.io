# Xuanming Ding CV source

This directory uses the Vectra LaTeX template for the generated academic CV.
The template source is kept in `src/`; its license and usage policy are in
`LICENSE`, `NOTICE`, and `USAGE_POLICY.md`.

Edit these files:

- `profile.tex` for contact information and PDF metadata.
- `settings.tex` for footer and date settings.
- `sections/` for the CV content.
- `fonts/wqy-placeholder.ttf` for the small Chinese placeholder font subset.
- `main.tex` for the section order.

Build locally with:

```sh
latexmk -xelatex main.tex
```

The generated file is `build/main.pdf`. GitHub Actions copies it to
`academic/files/CV.pdf` on every push.

The vendored Vectra source includes local presentation adjustments to match
the existing CV style: Computer Modern-style Latin typography, 10pt body
text, a 24.88pt bold name, uppercase section headings, and a local CJK font
subset for Chinese placeholders. It also includes one compatibility-only
change: three uses of `\IfBlankTF` are expressed as the
equivalent `\ifblank` macro provided by `etoolbox`, which is available in
older LaTeX distributions as well.

Research projects use a 0.38 cm title indent, extra space below the advisor,
and deeper bullet indentation with 2 pt between items to match `CV_template.pdf`.
These research-only settings are defined in `src/vectra-design.sty`.

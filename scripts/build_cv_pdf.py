#!/usr/bin/env python3
"""Generate a compact, editable-data-driven academic CV PDF."""

from __future__ import annotations

import argparse
from pathlib import Path

import fitz
import yaml


PAGE_WIDTH = 612
PAGE_HEIGHT = 792
LEFT = 49
RIGHT = PAGE_WIDTH - 49
TOP = 50
BOTTOM = PAGE_HEIGHT - 48
INK = (0.12, 0.16, 0.20)
MUTED = (0.28, 0.35, 0.42)
ACCENT = (0.14, 0.28, 0.40)
LINE = (0.55, 0.62, 0.69)


def clean_text(value: object) -> str:
    text = str(value or "")
    replacements = {
        "–": "-",
        "—": "-",
        "“": '"',
        "”": '"',
        "’": "'",
        "…": "...",
    }
    for source, target in replacements.items():
        text = text.replace(source, target)
    return text.strip()


def as_list(value: object) -> list[str]:
    if isinstance(value, list):
        return [clean_text(item) for item in value if clean_text(item)]
    return [line.strip() for line in clean_text(value).splitlines() if line.strip()]


class CvPdf:
    def __init__(self) -> None:
        self.document = fitz.open()
        self.page: fitz.Page | None = None
        self.y = TOP
        self.new_page()

    @property
    def width(self) -> float:
        return RIGHT - LEFT

    def new_page(self) -> None:
        self.page = self.document.new_page(width=PAGE_WIDTH, height=PAGE_HEIGHT)
        self.y = TOP

    def ensure(self, height: float) -> None:
        if self.y + height > BOTTOM:
            self.new_page()

    def wrap(self, value: object, font: str, size: float, width: float) -> list[str]:
        text = clean_text(value)
        if not text:
            return []
        lines: list[str] = []
        for paragraph in text.splitlines():
            words = paragraph.split()
            if not words:
                lines.append("")
                continue
            current = ""
            for word in words:
                candidate = word if not current else f"{current} {word}"
                if fitz.get_text_length(candidate, fontname=font, fontsize=size) <= width:
                    current = candidate
                    continue
                if current:
                    lines.append(current)
                current = word
            if current:
                lines.append(current)
        return lines

    def text(self, value: object, x: float, width: float, size: float = 9.2,
             font: str = "Times-Roman", color: tuple[float, float, float] = INK,
             align: int = 0, line_gap: float = 2.2) -> float:
        lines = self.wrap(value, font, size, width)
        line_height = size + line_gap
        box_height = size * 1.75
        for line in lines:
            self.ensure(box_height)
            assert self.page is not None
            self.page.insert_textbox(
                fitz.Rect(x, self.y, x + width, self.y + box_height),
                line,
                fontname=font,
                fontsize=size,
                color=color,
                align=align,
            )
            self.y += line_height
        return line_height * len(lines)

    def heading(self, title: str) -> None:
        self.ensure(24)
        assert self.page is not None
        self.page.insert_text(
            (LEFT, self.y + 9),
            title.upper(),
            fontname="Helvetica-Bold",
            fontsize=9.2,
            color=ACCENT,
        )
        self.page.draw_line(
            fitz.Point(LEFT, self.y + 12),
            fitz.Point(RIGHT, self.y + 12),
            color=ACCENT,
            width=0.55,
        )
        self.y += 20

    def entry(self, title: object, subtitle: object = "", location: object = "",
              dates: object = "", bullets: object = ()) -> None:
        title_text = clean_text(title)
        subtitle_text = clean_text(subtitle)
        location_text = clean_text(location)
        dates_text = clean_text(dates)
        bullet_lines = as_list(bullets)
        if not any([title_text, subtitle_text, location_text, dates_text, bullet_lines]):
            return

        self.ensure(18)
        assert self.page is not None
        entry_y = self.y
        main_width = self.width - 125
        self.text(title_text, LEFT + 10, main_width, size=9.4, font="Times-Bold", line_gap=1.2)
        meta = "\n".join(item for item in [location_text, dates_text] if item)
        if meta:
            self.page.insert_textbox(
                fitz.Rect(RIGHT - 125, entry_y, RIGHT, entry_y + 26),
                meta,
                fontname="Times-Roman",
                fontsize=8.5,
                color=MUTED,
                align=2,
            )
        self.y += 1
        if subtitle_text:
            self.text(subtitle_text, LEFT + 10, self.width - 20, size=8.9, color=MUTED, line_gap=1.4)
        for bullet in bullet_lines:
            self.ensure(14)
            self.text(f"- {bullet}", LEFT + 23, self.width - 34, size=8.8, line_gap=1.2)
        self.y += 4

    def publication(self, item: dict[str, object]) -> None:
        title = clean_text(item.get("title"))
        authors = clean_text(item.get("authors"))
        venue = clean_text(item.get("venue"))
        links = as_list(item.get("links"))
        if not any([title, authors, venue, links]):
            return
        self.text(title, LEFT + 10, self.width - 20, size=9.3, font="Times-Bold", line_gap=1.3)
        if authors:
            self.text(authors, LEFT + 10, self.width - 20, size=8.8, color=MUTED, line_gap=1.2)
        if venue:
            self.text(venue, LEFT + 10, self.width - 20, size=8.8, color=MUTED, line_gap=1.2)
        if links:
            self.text(" | ".join(links), LEFT + 10, self.width - 20, size=8.2, color=ACCENT, line_gap=1.1)
        self.y += 4

    def render(self, data: dict[str, object]) -> None:
        profile = data.get("profile", {}) or {}
        name = clean_text(profile.get("name")) or "Your Name"
        headline = clean_text(profile.get("headline"))
        contacts = [clean_text(profile.get(key)) for key in ["email", "website", "location"]]
        contacts = [item for item in contacts if item]

        assert self.page is not None
        name_width = fitz.get_text_length(name, fontname="times-bold", fontsize=21)
        self.page.insert_text(
            ((PAGE_WIDTH - name_width) / 2, self.y + 22),
            name,
            fontname="Times-Bold",
            fontsize=21,
            color=INK,
        )
        self.y += 29
        if headline:
            self.text(headline, LEFT, self.width, size=8.9, color=MUTED, align=1, line_gap=1.1)
        if contacts:
            self.text(" / ".join(contacts), LEFT, self.width, size=8.6, color=MUTED, align=1, line_gap=1.1)
        self.y += 10

        education = data.get("education", []) or []
        if education:
            self.heading("Education")
            for item in education:
                self.entry(item.get("institution"), item.get("degree"), item.get("location"), item.get("dates"), item.get("details"))

        interests = clean_text(data.get("research_interests"))
        if interests:
            self.heading("Research Interests")
            self.text(interests, LEFT, self.width, size=9.1, line_gap=2.1)
            self.y += 4

        publications = data.get("publications", []) or []
        if publications:
            self.heading("Selected Publications")
            for item in publications:
                self.publication(item)

        experience = data.get("research_experience", []) or []
        if experience:
            self.heading("Research Experience")
            for item in experience:
                self.entry(item.get("organization"), item.get("role"), item.get("location"), item.get("dates"), item.get("bullets"))

        teaching = data.get("teaching", []) or []
        if teaching:
            self.heading("Teaching Experience")
            for item in teaching:
                self.entry(item.get("title"), item.get("details"), dates=item.get("dates"))

        honors = data.get("honors", []) or []
        if honors:
            self.heading("Honors")
            for item in honors:
                self.entry(item.get("title"), item.get("details"))

        skills = data.get("skills", []) or []
        if skills:
            self.heading("Technical Skills")
            for item in skills:
                label = clean_text(item.get("label"))
                value = clean_text(item.get("value"))
                if label or value:
                    self.text(f"{label}: {value}" if label else value, LEFT, self.width, size=9.0, line_gap=1.5)

    def save(self, output: Path) -> int:
        output.parent.mkdir(parents=True, exist_ok=True)
        temporary = output.with_suffix(".tmp.pdf")
        page_count = self.document.page_count
        self.document.save(temporary)
        self.document.close()
        temporary.replace(output)
        return page_count


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--data", type=Path, default=Path("academic/_data/cv_editor.yml"))
    parser.add_argument("--output", type=Path, default=Path("academic/files/CV.pdf"))
    args = parser.parse_args()

    data = yaml.safe_load(args.data.read_text(encoding="utf-8")) or {}
    pdf = CvPdf()
    pdf.render(data)
    page_count = pdf.save(args.output)
    print(f"Generated {args.output} with {page_count} pages")


if __name__ == "__main__":
    main()

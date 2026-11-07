#!/usr/bin/env python3

import argparse
import json
import re
import unittest
import xml.etree.ElementTree as ElementTree
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit


class Document(HTMLParser):
    def __init__(self, html):
        super().__init__()
        self.elements = []
        self.feed(html)

    def handle_starttag(self, tag, attributes):
        self.elements.append((tag, dict(attributes)))

    def attributes(self, tag):
        return [attributes for element, attributes in self.elements if element == tag]


class SiteStructureTests(unittest.TestCase):
    public_dir = Path("public")
    source_dir = Path(__file__).resolve().parents[2]

    def setUp(self):
        _, document = self.document(self.public_dir / "index.html")
        canonical = next(
            link["href"] for link in document.attributes("link")
            if link.get("rel") == "canonical"
        )
        self.site_host = urlsplit(canonical).netloc

    def document(self, path):
        self.assertTrue(path.is_file(), f"Missing generated page: {path}")
        html = path.read_text(encoding="utf-8")
        return html, Document(html)

    def test_academic_homepage(self):
        html, document = self.document(self.public_dir / "home/index.html")
        self.assertTrue(
            any(element.get("class") == "masthead" for element in document.attributes("div"))
        )
        self.assertIn("AcademicPages", html)
        self.assertIn("author__name", html)
        links = [urlsplit(anchor.get("href") or "").path for anchor in document.attributes("a")]
        self.assertTrue({"/home/files/CV.pdf", "/home/publication/", "/home/misc/"} <= set(links))
        self.assertFalse(any(path.startswith("/blog/") for path in links))
        self.assertNotIn("/blog/", html)
        self.assertNotIn("global-aplayer", html)
        self.assertNotIn("site-interactions", html)
        self.assertIn(
            "/home/assets/js/academicpages.js",
            [urlsplit(script.get("src") or "").path for script in document.attributes("script")],
        )
        self.assertIn(
            "/home/assets/css/main.css",
            [urlsplit(link.get("href") or "").path for link in document.attributes("link")],
        )
        for route in ("cv-editor", "publication", "misc", "sitemap"):
            self.document(self.public_dir / f"home/{route}/index.html")
        self.assertTrue((self.public_dir / "home/files/CV.pdf").is_file())

    def test_root_redirect(self):
        html, document = self.document(self.public_dir / "index.html")
        canonical = next(
            link["href"] for link in document.attributes("link")
            if link.get("rel") == "canonical"
        )
        self.assertEqual(urlsplit(canonical).path, "/home/")
        self.assertIn(canonical, html)
        self.assertNotIn("global-aplayer", html)
        self.assertFalse(document.attributes("script"))

    def test_academic_browser_title_and_favicon(self):
        html, document = self.document(self.public_dir / "home/index.html")
        self.assertEqual(len(document.attributes("title")), 1)
        self.assertIn("<title>Xuanming Ding | Home</title>", html)
        icons = [
            link for link in document.attributes("link") if link.get("rel") == "icon"
        ]
        self.assertEqual(len(icons), 1)
        self.assertEqual(icons[0].get("type"), "image/svg+xml")
        self.assertEqual(urlsplit(icons[0]["href"]).path, "/home/images/favicon.svg")
        favicon = ElementTree.parse(self.public_dir / "home/images/favicon.svg").getroot()
        self.assertEqual(favicon.tag, "{http://www.w3.org/2000/svg}svg")
        self.assertEqual(favicon.findtext("{http://www.w3.org/2000/svg}title"), "D")

    def test_isolated_site_assets(self):
        pages = [
            *(self.public_dir / "home").rglob("index.html"),
            *(self.public_dir / "blog").rglob("index.html"),
        ]
        for page in pages:
            route = page.relative_to(self.public_dir)
            _, document = self.document(self.public_dir / route)
            resources = [
                *[image.get("src") for image in document.attributes("img")],
                *[script.get("src") for script in document.attributes("script")],
                *[link.get("href") for link in document.attributes("link")],
            ]
            for resource in resources:
                if not resource:
                    continue
                target = urlsplit(resource)
                if target.netloc not in ("", self.site_host) or not target.path.startswith("/"):
                    continue
                with self.subTest(route=route, resource=resource):
                    self.assertTrue(target.path.startswith(("/home/", "/blog/")), resource)
                    local_file = self.public_dir / unquote(target.path).lstrip("/")
                    if target.path.endswith("/"):
                        local_file /= "index.html"
                    self.assertTrue(
                        local_file.is_file(),
                        f"Missing academicpages resource: {resource}",
                    )

    def test_combined_sitemap(self):
        sitemap = ElementTree.parse(self.public_dir / "sitemap.xml")
        namespace = {"sitemap": "http://www.sitemaps.org/schemas/sitemap/0.9"}
        locations = [entry.text for entry in sitemap.findall("sitemap:url/sitemap:loc", namespace)]
        self.assertEqual(len(locations), len(set(locations)))
        paths = {urlsplit(location).path for location in locations}
        self.assertTrue({"/home/", "/home/sitemap/", "/blog/", "/blog/posts/ewc-and-lwf/"} <= paths)
        self.assertTrue(all(path.startswith(("/home/", "/blog/")) for path in paths))
        self.assertFalse((self.public_dir / "assets").exists())
        self.assertFalse((self.public_dir / "js").exists())
        self.assertFalse((self.public_dir / "music").exists())

    def test_relocated_blog_pages(self):
        routes = (
            "", "posts", "about", "about/acgn", "updates",
            "categories", "tags", "authors", "series",
        )
        for route in routes:
            with self.subTest(route=route):
                self.document(self.public_dir / "blog" / route / "index.html")
        html, document = self.document(self.public_dir / "blog" / "index.html")
        self.assertIn("global-aplayer", html)
        self.assertIn("music-fallbacks.min.", html)
        self.assertIn("/home/", [anchor.get("href") for anchor in document.attributes("a")])

    def test_legacy_redirects(self):
        alias_count = 0
        for source in (self.source_dir / "content").rglob("*.md"):
            match = re.search(
                r"^aliases:\s*(\[[^\n]+\])",
                source.read_text(encoding="utf-8"),
                re.MULTILINE,
            )
            if not match:
                continue
            for alias in json.loads(match.group(1)):
                with self.subTest(alias=alias):
                    html, document = self.document(
                        self.public_dir / alias.strip("/") / "index.html"
                    )
                    canonical = next(
                        link["href"] for link in document.attributes("link")
                        if link.get("rel") == "canonical"
                    )
                    target = unquote(urlsplit(canonical).path)
                    self.assertTrue(target.startswith("/blog/"), canonical)
                    self.assertIn(canonical, html)
                    self.assertTrue(
                        (self.public_dir / target.strip("/") / "index.html").is_file(),
                        canonical,
                    )
                    alias_count += 1
        self.assertGreater(alias_count, 15)

    def test_comment_and_view_identity(self):
        posts = list((self.public_dir / "blog" / "posts").glob("*/index.html"))
        posts = [post for post in posts if post.parent.name != "page"]
        self.assertTrue(posts)
        for post in posts:
            with self.subTest(post=post.parent.name):
                _, document = self.document(post)
                legacy_path = f"/posts/{post.parent.name}/"
                self.assertIn(
                    legacy_path,
                    [span.get("data-view-path") for span in document.attributes("span")],
                )
                self.assertIn(
                    legacy_path,
                    [article.get("data-current-view-path") for article in document.attributes("article")],
                )
                wrapper = next(
                    attributes for attributes in document.attributes("div")
                    if "giscus-wrapper" in attributes.get("class", "").split()
                )
                self.assertEqual(wrapper["data-giscus-mapping"], "specific")
                self.assertEqual(wrapper["data-giscus-term"], legacy_path.lstrip("/"))
                self.document(self.public_dir / legacy_path.strip("/") / "index.html")

    def test_local_navigation(self):
        pages = [
            *(self.public_dir / "home").rglob("index.html"),
            *(self.public_dir / "blog").rglob("index.html"),
        ]
        for page in pages:
            _, document = self.document(page)
            for anchor in document.attributes("a"):
                href = anchor.get("href") or ""
                target = urlsplit(href)
                if target.netloc not in ("", self.site_host) or not target.path.startswith("/"):
                    continue
                with self.subTest(page=page, href=href):
                    self.assertFalse(
                        target.path.startswith(("/posts/", "/about/", "/categories/", "/updates/")),
                        href,
                    )
                    local_file = self.public_dir / unquote(target.path).lstrip("/")
                    if target.path.endswith("/"):
                        local_file /= "index.html"
                    self.assertTrue(
                        local_file.is_file(), f"Broken link in {page}: {href}"
                    )

    def test_blog_feed_and_search(self):
        feed = ElementTree.parse(self.public_dir / "blog" / "index.xml")
        links = [element.text for element in feed.findall("channel/item/link")]
        self.assertTrue(links)
        self.assertTrue(
            all(urlsplit(link).path.startswith("/blog/posts/") for link in links)
        )
        index = json.loads((self.public_dir / "blog/index.json").read_text(encoding="utf-8"))
        posts = [
            entry for entry in index
            if entry["type"] == "posts" and entry["permalink"] != "/blog/posts/"
        ]
        self.assertTrue(posts)
        self.assertTrue(
            all(entry["permalink"].startswith("/blog/posts/") for entry in posts)
        )


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Check the combined academicpages homepage and relocated Hugo blog."
    )
    parser.add_argument("public_dir", nargs="?", type=Path, default=Path("public"))
    arguments = parser.parse_args()
    SiteStructureTests.public_dir = arguments.public_dir
    unittest.main(argv=[__file__], verbosity=2)

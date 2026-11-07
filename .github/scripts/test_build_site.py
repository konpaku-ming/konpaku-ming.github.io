import importlib.util
import tempfile
import unittest
import xml.etree.ElementTree as ElementTree
from pathlib import Path


BUILD_SCRIPT = Path(__file__).resolve().parents[2] / "scripts/build_site.py"
SPECIFICATION = importlib.util.spec_from_file_location("build_site", BUILD_SCRIPT)
build_site = importlib.util.module_from_spec(SPECIFICATION)
SPECIFICATION.loader.exec_module(build_site)


class CombinedBuildTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)
        self.blog = self.root / "blog"
        self.academic = self.root / "academic"
        self.output = self.root / "output"
        self.write(self.blog, "index.html", "Blog")
        self.write(self.blog, "posts/example/index.html", "Blog post")
        self.write(self.blog, "index.xml", "Legacy RSS")
        self.write(self.blog, "robots.txt", "Hugo robots")
        self.write(self.academic, "index.html", "AcademicPages home")
        self.write(self.academic, "robots.txt", "Jekyll robots")
        self.write(self.academic, "sitemap/index.html", "Sitemap")
        self.sitemap(self.blog, ["https://example.org/blog/", "https://example.org/blog/posts/example/"])
        self.sitemap(self.academic, ["https://example.org/home/", "https://example.org/home/sitemap/"])

    def write(self, directory, name, content):
        destination = directory / name
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_text(content, encoding="utf-8")

    def sitemap(self, directory, locations):
        urls = "".join(f"<url><loc>{location}</loc></url>" for location in locations)
        self.write(
            directory, "sitemap.xml",
            f'<urlset xmlns="{build_site.SITEMAP_NAMESPACE}">{urls}</urlset>',
        )

    def test_sites_have_separate_roots_and_root_redirects_to_academic_home(self):
        build_site.merge_outputs(self.blog, self.academic, self.output)
        self.assertEqual((self.output / "home/index.html").read_text(), "AcademicPages home")
        self.assertEqual((self.output / "blog/index.html").read_text(), "Blog")
        self.assertIn('href="https://example.org/home/"', (self.output / "index.html").read_text())
        self.assertIn('Sitemap: https://example.org/sitemap.xml', (self.output / "robots.txt").read_text())

    def test_legacy_post_and_feed_urls_remain_available(self):
        build_site.merge_outputs(self.blog, self.academic, self.output)
        redirect = (self.output / "posts/example/index.html").read_text()
        self.assertIn('href="https://example.org/blog/posts/example/"', redirect)
        self.assertEqual((self.output / "index.xml").read_text(), "Legacy RSS")
        sitemap_redirect = (self.output / "sitemap/index.html").read_text()
        self.assertIn('href="https://example.org/home/sitemap/"', sitemap_redirect)

    def test_sitemap_contains_both_sites_and_deduplicates_entries(self):
        self.sitemap(self.blog, [
            "https://example.org/blog/", "https://example.org/blog/",
            "https://example.org/blog/posts/example/",
        ])
        build_site.merge_outputs(self.blog, self.academic, self.output)
        root = ElementTree.parse(self.output / "sitemap.xml").getroot()
        locations = [entry.findtext(f"{{{build_site.SITEMAP_NAMESPACE}}}loc") for entry in root]
        self.assertEqual(locations, [
            "https://example.org/blog/",
            "https://example.org/blog/posts/example/",
            "https://example.org/home/",
            "https://example.org/home/sitemap/",
        ])

    def test_same_named_assets_are_isolated_in_their_own_subsites(self):
        self.write(self.blog, "assets/example.css", "Hugo")
        self.write(self.academic, "assets/example.css", "Jekyll")
        build_site.merge_outputs(self.blog, self.academic, self.output)
        self.assertEqual((self.output / "blog/assets/example.css").read_text(), "Hugo")
        self.assertEqual((self.output / "home/assets/example.css").read_text(), "Jekyll")
        self.assertFalse((self.output / "assets").exists())

    def test_legacy_redirects_cannot_overwrite_either_subsite(self):
        self.write(self.blog, "home/index.html", "Blog section named home")
        self.write(self.blog, "blog/index.html", "Blog section named blog")
        build_site.merge_outputs(self.blog, self.academic, self.output)
        self.assertEqual((self.output / "home/index.html").read_text(), "AcademicPages home")
        self.assertEqual((self.output / "blog/index.html").read_text(), "Blog")

    def test_sitemap_index_is_not_silently_discarded(self):
        self.write(
            self.academic, "sitemap.xml",
            f'<sitemapindex xmlns="{build_site.SITEMAP_NAMESPACE}"/>',
        )
        with self.assertRaisesRegex(ValueError, "URL set"):
            build_site.merge_sitemaps([self.academic / "sitemap.xml"], self.root / "merged.xml")


if __name__ == "__main__":
    unittest.main()

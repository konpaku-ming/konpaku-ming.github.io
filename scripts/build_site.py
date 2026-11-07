#!/usr/bin/env python3

import argparse
import html
import json
import shutil
import subprocess
import tempfile
import xml.etree.ElementTree as ElementTree
from pathlib import Path
from urllib.parse import urlsplit


SITEMAP_NAMESPACE = "http://www.sitemaps.org/schemas/sitemap/0.9"


def merge_sitemaps(sources, destination):
    entries = {}
    for source in sources:
        root = ElementTree.parse(source).getroot()
        if root.tag != f"{{{SITEMAP_NAMESPACE}}}urlset":
            raise ValueError(f"Expected a sitemap URL set: {source}")
        for entry in root:
            location = entry.findtext(f"{{{SITEMAP_NAMESPACE}}}loc")
            if not location:
                raise ValueError(f"Missing sitemap location: {source}")
            entries[location] = entry
    ElementTree.register_namespace("", SITEMAP_NAMESPACE)
    root = ElementTree.Element(f"{{{SITEMAP_NAMESPACE}}}urlset")
    root.extend(entries[location] for location in sorted(entries))
    ElementTree.ElementTree(root).write(
        destination, encoding="utf-8", xml_declaration=True
    )


def write_redirect(destination, target):
    escaped_target = html.escape(target, quote=True)
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_text(
        '<!doctype html><html lang="en"><head><meta charset="utf-8">'
        '<meta name="robots" content="noindex">'
        f'<link rel="canonical" href="{escaped_target}">'
        f'<meta http-equiv="refresh" content="0; url={escaped_target}">'
        '<title>Page moved</title></head><body>'
        f'<a href="{escaped_target}">Continue to the new page</a></body></html>',
        encoding="utf-8",
    )


def merge_outputs(blog_directory, academic_directory, destination):
    academic_sitemap = ElementTree.parse(academic_directory / "sitemap.xml")
    location = academic_sitemap.findtext(f".//{{{SITEMAP_NAMESPACE}}}loc")
    if not location:
        raise ValueError("The academic sitemap must contain a site URL.")
    parsed_url = urlsplit(location)
    origin = f"{parsed_url.scheme}://{parsed_url.netloc}"
    shutil.copytree(blog_directory, destination / "blog", dirs_exist_ok=True)
    shutil.copytree(academic_directory, destination / "home", dirs_exist_ok=True)
    for page in blog_directory.rglob("*.html"):
        relative_path = page.relative_to(blog_directory)
        if relative_path == Path("index.html") or relative_path.parts[0] in ("home", "blog"):
            continue
        route = relative_path.as_posix()
        if route.endswith("index.html"):
            route = route[:-len("index.html")]
        write_redirect(destination / relative_path, f"{origin}/blog/{route}")
    for feed in blog_directory.rglob("*.xml"):
        relative_path = feed.relative_to(blog_directory)
        if relative_path == Path("sitemap.xml") or relative_path.parts[0] in ("home", "blog"):
            continue
        target = destination / relative_path
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(feed, target)
    write_redirect(destination / "index.html", f"{origin}/home/")
    write_redirect(destination / "sitemap/index.html", f"{origin}/home/sitemap/")
    merge_sitemaps(
        [blog_directory / "sitemap.xml", academic_directory / "sitemap.xml"],
        destination / "sitemap.xml",
    )
    (destination / "robots.txt").write_text(
        f"User-agent: *\nAllow: /\nSitemap: {origin}/sitemap.xml\n", encoding="utf-8"
    )


def main():
    site_directory = Path(__file__).resolve().parents[1]
    parser = argparse.ArgumentParser(
        description="Build academicpages at /home/ and the Hugo blog at /blog/."
    )
    parser.add_argument(
        "--destination", type=Path, default=site_directory / "public"
    )
    parser.add_argument("--base-url", help="Override both site URLs for local previews.")
    arguments = parser.parse_args()
    destination = arguments.destination.resolve()
    if site_directory.is_relative_to(destination):
        parser.error("The output directory cannot contain the source repository.")
    if arguments.base_url:
        base_url = urlsplit(arguments.base_url)
        if (
            base_url.scheme not in ("http", "https")
            or not base_url.netloc
            or base_url.path not in ("", "/")
            or base_url.query
            or base_url.fragment
        ):
            parser.error("--base-url must be an HTTP(S) origin without a subpath.")
    with tempfile.TemporaryDirectory(prefix="academic-blog-build-") as temporary:
        staging = Path(temporary)
        blog_directory = staging / "hugo"
        academic_directory = staging / "academic"
        combined_directory = staging / "combined"
        hugo_command = ["hugo", "--minify", "--destination", str(blog_directory)]
        jekyll_command = [
            "bundle", "exec", "jekyll", "build", "--trace", "--destination", str(academic_directory)
        ]
        if arguments.base_url:
            preview_url = arguments.base_url.rstrip("/")
            hugo_command.extend(["--baseURL", preview_url + "/blog/"])
            preview_config = staging / "preview.yml"
            preview_config.write_text(f"url: {json.dumps(preview_url)}\n", encoding="utf-8")
            jekyll_command.extend([
                "--config", f"{site_directory / 'academic/_config.yml'},{preview_config}"
            ])
        subprocess.run(
            hugo_command,
            cwd=site_directory,
            check=True,
        )
        subprocess.run(
            jekyll_command,
            cwd=site_directory / "academic",
            check=True,
        )
        merge_outputs(blog_directory, academic_directory, combined_directory)
        subprocess.run(
            [
                "python3",
                str(site_directory / ".github/scripts/check_site_structure.py"),
                str(combined_directory),
            ],
            cwd=site_directory,
            check=True,
        )
        shutil.copytree(combined_directory, destination, dirs_exist_ok=True)
    print(f"Combined academicpages + Hugo website: {destination}")


if __name__ == "__main__":
    main()

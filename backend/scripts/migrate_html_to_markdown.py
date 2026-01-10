"""
HTML to Markdown Migration Script

This script converts existing HTML email templates to Markdown format.
It uses the html2text library to convert HTML content to clean Markdown.

Usage:
    python -m scripts.migrate_html_to_markdown [--dry-run] [--template KEY]

Options:
    --dry-run       Preview conversions without saving
    --template KEY  Only convert a specific template by key

After running this script:
1. Templates will have their markdown_content populated
2. use_markdown will remain FALSE (admin must manually enable after review)
3. Original html_content is preserved

The conversion may not be perfect for complex HTML, so manual review is recommended.
"""

import os
import sys
import argparse

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import html2text
import psycopg2
from psycopg2.extras import RealDictCursor
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Configure html2text converter
def create_converter():
    """Create and configure html2text converter."""
    h = html2text.HTML2Text()
    h.ignore_links = False
    h.ignore_images = False
    h.ignore_emphasis = False
    h.body_width = 0  # No line wrapping
    h.unicode_snob = True
    h.single_line_break = False
    h.skip_internal_links = False
    h.protect_links = True
    return h


def html_to_markdown(html_content: str) -> str:
    """
    Convert HTML content to Markdown.

    Args:
        html_content: Raw HTML string

    Returns:
        Markdown string
    """
    if not html_content:
        return ""

    converter = create_converter()
    markdown = converter.handle(html_content)

    # Clean up extra whitespace
    lines = markdown.split('\n')
    cleaned_lines = []
    prev_blank = False

    for line in lines:
        stripped = line.strip()
        is_blank = len(stripped) == 0

        # Collapse multiple blank lines into one
        if is_blank:
            if not prev_blank:
                cleaned_lines.append('')
            prev_blank = True
        else:
            cleaned_lines.append(stripped)
            prev_blank = False

    # Remove leading/trailing blank lines
    while cleaned_lines and cleaned_lines[0] == '':
        cleaned_lines.pop(0)
    while cleaned_lines and cleaned_lines[-1] == '':
        cleaned_lines.pop()

    return '\n'.join(cleaned_lines)


def get_templates(conn, template_key=None):
    """Get all email templates (or a specific one)."""
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        if template_key:
            cur.execute(
                "SELECT key, name, html_content, markdown_content FROM email_templates WHERE key = %s",
                (template_key,)
            )
        else:
            cur.execute(
                "SELECT key, name, html_content, markdown_content FROM email_templates ORDER BY key"
            )
        return cur.fetchall()


def update_template_markdown(conn, key: str, markdown_content: str, dry_run: bool = False):
    """Update a template's markdown_content."""
    if dry_run:
        return

    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE email_templates
            SET markdown_content = %s, updated_at = NOW()
            WHERE key = %s
            """,
            (markdown_content, key)
        )
    conn.commit()


def preview_conversion(html_content: str, markdown_content: str, width: int = 80):
    """Print a preview of the HTML to Markdown conversion."""
    print("\n" + "=" * width)
    print("ORIGINAL HTML (first 500 chars):")
    print("-" * width)
    print(html_content[:500] + ("..." if len(html_content) > 500 else ""))

    print("\n" + "-" * width)
    print("CONVERTED MARKDOWN (first 500 chars):")
    print("-" * width)
    print(markdown_content[:500] + ("..." if len(markdown_content) > 500 else ""))
    print("=" * width)


def main():
    parser = argparse.ArgumentParser(description='Convert HTML email templates to Markdown')
    parser.add_argument('--dry-run', action='store_true', help='Preview conversions without saving')
    parser.add_argument('--template', type=str, help='Only convert a specific template by key')
    parser.add_argument('--preview', action='store_true', help='Show detailed preview of conversions')
    args = parser.parse_args()

    # Connect to database
    database_url = os.getenv('DATABASE_URL')
    if not database_url:
        print("ERROR: DATABASE_URL environment variable not set")
        sys.exit(1)

    print(f"Connecting to database...")
    conn = psycopg2.connect(database_url)

    try:
        templates = get_templates(conn, args.template)

        if not templates:
            print("No templates found.")
            return

        print(f"\nFound {len(templates)} template(s) to process.\n")

        converted = 0
        skipped = 0
        errors = 0

        for template in templates:
            key = template['key']
            name = template['name']
            html_content = template['html_content'] or ''
            existing_markdown = template['markdown_content']

            print(f"Processing: {key} ({name})")

            # Skip if already has markdown content
            if existing_markdown and existing_markdown.strip():
                print(f"  → Skipped (already has markdown content)")
                skipped += 1
                continue

            # Skip if no HTML content
            if not html_content.strip():
                print(f"  → Skipped (no HTML content)")
                skipped += 1
                continue

            try:
                # Convert HTML to Markdown
                markdown_content = html_to_markdown(html_content)

                if args.preview:
                    preview_conversion(html_content, markdown_content)

                # Save conversion
                if args.dry_run:
                    print(f"  → Would convert ({len(markdown_content)} chars)")
                else:
                    update_template_markdown(conn, key, markdown_content)
                    print(f"  → Converted ({len(markdown_content)} chars)")

                converted += 1

            except Exception as e:
                print(f"  → ERROR: {str(e)}")
                errors += 1

        print(f"\n{'=' * 50}")
        print(f"SUMMARY:")
        print(f"  Converted: {converted}")
        print(f"  Skipped: {skipped}")
        print(f"  Errors: {errors}")

        if args.dry_run:
            print(f"\n(This was a dry run. No changes were saved.)")
        else:
            print(f"\nDone! Templates now have markdown_content populated.")
            print(f"Note: use_markdown is still FALSE - enable per-template after review.")

    finally:
        conn.close()


if __name__ == '__main__':
    main()

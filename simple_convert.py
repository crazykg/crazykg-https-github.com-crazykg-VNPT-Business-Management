#!/usr/bin/env python3
"""
Simple script to convert JSON text file to Markdown format for customer import
Used to prepare data for the support service groups dropdown functionality
"""

import json
import sys
import re
from pathlib import Path


def json_text_to_markdown(input_file, md_file, title="Customer Data"):
    """Convert JSON text file to Markdown format"""
    try:
        with open(input_file, 'r', encoding='utf-8') as f:
            content = f.read().strip()

        # Try to extract JSON data from the content
        # Look for JSON objects in the content
        json_match = re.search(r'\{.*\}', content, re.DOTALL)

        if json_match:
            json_content = json_match.group()
        else:
            json_content = content

        # Parse the JSON content
        data = json.loads(json_content)

        # Handle different JSON structures
        if isinstance(data, dict):
            if 'data' in data:
                records = data['data']
            else:
                # If the whole object is a single record, wrap it in a list
                records = [data]
        elif isinstance(data, list):
            records = data
        else:
            raise ValueError("Unexpected JSON structure")

        if not records:
            print("No records found in JSON data")
            return

        # Get all unique keys from all records
        all_keys = set()
        for record in records:
            if isinstance(record, dict):
                all_keys.update(record.keys())

        all_keys = sorted(list(all_keys))

        # Create Markdown content
        md_content = f"# {title}\n\n"
        md_content += "## Customer Information\n\n"

        # Create table header
        header_row = "| " + " | ".join(all_keys) + " |\n"
        separator_row = "| " + " | ".join(["---"] * len(all_keys)) + " |\n"

        md_content += header_row + separator_row

        # Add data rows
        for record in records:
            if isinstance(record, dict):
                row = "| "
                for key in all_keys:
                    value = record.get(key, "")
                    # Convert to string and escape pipe characters
                    str_value = str(value) if value is not None else ""
                    escaped_value = str_value.replace("|", "\\|")
                    row += escaped_value + " | "
                row = row.rstrip(" | ") + " |\n"
                md_content += row

        # Write to file
        with open(md_file, 'w', encoding='utf-8') as f:
            f.write(md_content)

        print(f"Successfully created Markdown file: {md_file} with {len(records)} records")

    except json.JSONDecodeError as e:
        print(f"Error decoding JSON: {e}")
        print("Trying to process as raw text...")

        # Fallback: try to process as raw text with basic JSON extraction
        with open(input_file, 'r', encoding='utf-8') as f:
            content = f.read()

        # Find JSON array or object
        start_idx = content.find('[')
        if start_idx == -1:
            start_idx = content.find('{')

        if start_idx != -1:
            # Simple JSON extraction by finding matching brackets
            bracket_count = 0
            end_idx = -1
            for i, char in enumerate(content[start_idx:], start_idx):
                if char in ['{', '[']:
                    bracket_count += 1
                elif char in ['}', ']']:
                    bracket_count -= 1
                    if bracket_count == 0:
                        end_idx = i + 1
                        break

            if end_idx != -1:
                json_part = content[start_idx:end_idx]
                try:
                    records = json.loads(json_part)

                    if isinstance(records, dict):
                        records = [records]
                    elif not isinstance(records, list):
                        print(f"Could not parse JSON structure: {type(records)}")
                        return

                    # Create simple markdown table
                    if records:
                        # Get keys from first record
                        keys = list(records[0].keys()) if records and isinstance(records[0], dict) else []

                        md_content = f"# {title}\n\n"
                        md_content += "## Customer Information\n\n"

                        if keys:
                            header_row = "| " + " | ".join(keys) + " |\n"
                            separator_row = "| " + " | ".join(["---"] * len(keys)) + " |\n"

                            md_content += header_row + separator_row

                            for record in records:
                                if isinstance(record, dict):
                                    row = "| "
                                    for key in keys:
                                        value = record.get(key, "")
                                        str_value = str(value) if value is not None else ""
                                        escaped_value = str_value.replace("|", "\\|")
                                        row += escaped_value + " | "
                                    row = row.rstrip(" | ") + " |\n"
                                    md_content += row

                        with open(md_file, 'w', encoding='utf-8') as f:
                            f.write(md_content)

                        print(f"Successfully created Markdown file: {md_file} with {len(records)} records (fallback method)")

                except json.JSONDecodeError:
                    print("Could not extract valid JSON from the file")
            else:
                print("Could not find valid JSON structure in the file")
        else:
            print("Could not find JSON structure in the file")


def main():
    if len(sys.argv) < 3:
        print("Usage: python simple_convert.py <input_json_file> <output_md_file>")
        print("Example: python simple_convert.py Thongtinkhachhangtrongdatabaseserver.txt customers.md")
        return

    input_file = sys.argv[1]
    output_file = sys.argv[2]

    print(f"Converting {input_file} to {output_file}")
    json_text_to_markdown(input_file, output_file)

if __name__ == "__main__":
    main()
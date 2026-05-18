def normalize_tables(parsed_content):
    """
    Recursively convert all table cell values to strings in the parsed_content dict.
    This ensures compatibility with Pydantic TableData model.
    """
    if not parsed_content or "tables" not in parsed_content:
        return parsed_content
    tables = parsed_content["tables"]
    normalized_tables = []
    for table in tables:
        # Normalize headers
        headers = [str(h) for h in table.get("headers", [])]
        # Normalize rows
        rows = [ [str(cell) for cell in row] for row in table.get("rows", []) ]
        normalized_tables.append({
            **table,
            "headers": headers,
            "rows": rows
        })
    parsed_content = dict(parsed_content)
    parsed_content["tables"] = normalized_tables
    return parsed_content

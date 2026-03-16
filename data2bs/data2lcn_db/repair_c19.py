import csv
import re
from pathlib import Path

STUDIES_RE = re.compile(r"\s*\((\d+)\s+stud(?:y|ies)\)\s*$", re.IGNORECASE)

def fix_studies_in_place(csv_path: str) -> None:
    p = Path(csv_path)
    backup = p.with_suffix(p.suffix + ".bak")

    # 1) Backup
    if not backup.exists():
        backup.write_bytes(p.read_bytes())

    # 2) Read original (preserve dialect expectations)
    with p.open("r", encoding="utf-8", newline="") as f:
        reader = csv.DictReader(f, delimiter=",")
        rows = list(reader)
        fieldnames = reader.fieldnames or []

    if "name" not in fieldnames:
        raise RuntimeError("CSV has no 'name' column.")
    if "studies_count" not in fieldnames:
        raise RuntimeError("CSV has no 'studies_count' column.")

    # 3) Transform
    changed = 0
    filled = 0

    for r in rows:
        name = (r.get("name") or "").strip()
        m = STUDIES_RE.search(name)
        if not m:
            continue

        studies = m.group(1)
        clean_name = STUDIES_RE.sub("", name).strip()

        # only fill studies_count if empty
        if (r.get("studies_count") or "").strip() == "":
            r["studies_count"] = studies
            filled += 1

        if clean_name != name:
            r["name"] = clean_name
            changed += 1

    # 4) Write back EXACTLY as normal CSV with CRLF, no BOM
    with p.open("w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(
            f,
            fieldnames=fieldnames,
            delimiter=",",
            quoting=csv.QUOTE_MINIMAL,
            lineterminator="\r\n",
        )
        writer.writeheader()
        writer.writerows(rows)

    print(f"Done. name cleaned: {changed}, studies_count filled: {filled}")
    print(f"Backup: {backup}")

# --- run it ---
fix_studies_in_place(r"C:\xampp\htdocs\lcn\data2bs\data2lcn_db\c19early_treatments.csv")

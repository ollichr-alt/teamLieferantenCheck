#!/usr/bin/env python3
from __future__ import annotations
from pathlib import Path
import argparse, json, hashlib, datetime

def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()

def write_jsonl(path: Path, rows):
    with path.open("w", encoding="utf-8") as f:
        for row in rows:
            f.write(json.dumps(row, ensure_ascii=False, separators=(",", ":")) + "\n")

def main():
    parser = argparse.ArgumentParser(description="Convert normalized v5.1.91 export to segmented .lcdata folder")
    parser.add_argument("input_json", type=Path)
    parser.add_argument("output_dir", type=Path)
    args = parser.parse_args()

    source = json.loads(args.input_json.read_text(encoding="utf-8"))
    out = args.output_dir
    out.mkdir(parents=True, exist_ok=True)

    mapping = [
        ("suppliers", source.get("suppliers", [])),
        ("locations", source.get("locations", [])),
        ("articles", source.get("articles", [])),
        ("stock", source.get("stock", [])),
        ("sales", source.get("sales", [])),
        ("aggregates", source.get("aggregates", [])),
    ]

    segments = []
    counts = {}
    for kind, rows in mapping:
        file_name = f"{kind}.jsonl"
        path = out / file_name
        write_jsonl(path, rows)
        segments.append({
            "kind": kind,
            "file": file_name,
            "format": "jsonl",
            "rows": len(rows),
            "sha256": sha256(path)
        })
        counts[kind] = len(rows)

    manifest = {
        "type": "team-lieferantencheck-dataset",
        "schemaVersion": 1,
        "packageId": datetime.datetime.now(datetime.UTC).strftime("lc-%Y%m%d-%H%M%S"),
        "datasetVersion": source.get("datasetVersion") or datetime.date.today().isoformat(),
        "createdAt": datetime.datetime.now(datetime.UTC).isoformat(),
        "source": "v5.1.91-normalized-export",
        "counts": counts,
        "segments": segments
    }

    (out / "manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2),
        encoding="utf-8"
    )

    print(f"Created {out}")
    print(json.dumps(counts, ensure_ascii=False, indent=2))

if __name__ == "__main__":
    main()

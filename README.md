# team LieferantenCheck – Mobile Core 0.5

## Ziel dieses Stands
Die App ist jetzt für große reale Datenpakete vorbereitet. Unternehmensdaten werden nicht mehr als eine einzige riesige JSON gedacht, sondern als segmentiertes Paket.

## Segmentiertes Datenpaket
Ordnerstruktur:

```text
LieferantenCheck_Data_2026-09-17/
├── manifest.json
├── suppliers.jsonl
├── locations.jsonl
├── articles.jsonl
├── stock.jsonl
├── sales.jsonl
└── aggregates.jsonl
```

Jedes Segment hat im Manifest:
- Typ
- Dateiname
- Format
- erwartete Zeilenzahl
- SHA-256

## Import-Sicherheit
1. Manifest prüfen
2. alle Pflichtsegmente prüfen
3. jeden Datei-Hash prüfen
4. JSONL validieren
5. erst danach lokale Datenbank ersetzen
6. bei Fehler bleibt der bisherige Datenstand aktiv

## v5.1.91 Converter
`tools/convert_v5191.py`

Der Converter erwartet zunächst einen normalisierten Export aus v5.1.91 und erzeugt daraus den segmentierten Datenordner.

## Architektur
GitHub/Cloudflare enthalten ausschließlich App-Code. Reale Unternehmensdaten und Arbeitsstände bleiben lokal bzw. werden über Dateien/OneDrive importiert.

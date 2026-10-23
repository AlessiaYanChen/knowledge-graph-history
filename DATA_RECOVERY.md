# Reading data and rich text

The API uses SQLite at `<ASP.NET content root>/App_Data/exploration.db`. With the normal project launch this is `backend/HistoryExplorer.Api/App_Data/exploration.db`. `PathStore` and `ReadingStore` share this database; saved exploration paths are in `saved_paths`. `Data/exploration.json` is a read-only catalog, not the user's reading data. The browser keeps the current selection in the URL; it does not maintain a second data store.

Run the API under a Windows account that can write both `exploration.db` and its `App_Data` directory (SQLite creates journal files there). On this machine, starting the API under the restricted `codexsandboxoffline` account made reads work but caused every save to fail with `SQLite Error 8: attempt to write a readonly database`; the Vite proxy then showed HTTP 502. The working local API process runs as `IDIR\AYANCHEN`.

## Backup made before migration

`backend/HistoryExplorer.Api/App_Data/backups/exploration-pre-richtext-20261019T181848Z.db`

This is a consistent SQLite online backup, including all tables. It passed `PRAGMA integrity_check`, `PRAGMA foreign_key_check`, and a full table-by-table comparison with the source before migration. Its SHA-256 is `45cb8d3d442e652340662221a2e975d30b6e84b4db84579bd62883e5236d4e8e`. `App_Data` is ignored by Git; keep an additional copy outside the machine for disaster recovery.

## Restore

Stop all running API processes first. Keep a copy of the current database if it has received new edits since this backup. Then, from the repository root in PowerShell:

```powershell
$dataDir = 'backend/HistoryExplorer.Api/App_Data'
Copy-Item -LiteralPath "$dataDir/backups/exploration-pre-richtext-20261019T181848Z.db" -Destination "$dataDir/exploration.db" -Force
```

Starting the updated API will safely add the rich-text columns again. Restoring this earlier backup also rolls back any reading edits made after it was created.

## Storage contract

`books.description`, `chapters.summary`, `reading_excerpts.text`, and `reading_notes.text` remain plain-text columns. Each table adds nullable `rich_content` (restricted Tiptap/ProseMirror JSON) and `format_version` (`1`). Old rows have both new columns `NULL`; their text is shown literally and converted into editor paragraphs only when editing. New edits save the JSON and a matching plain-text projection in one SQL statement. There is no HTML or Markdown interpretation of old text. Rendering uses React elements from a fixed list of node and mark types; the API validates the JSON tree and its plain-text projection before saving. The format supports paragraphs, hard breaks, bold, italic, ordered and unordered lists, and blockquotes. Titles, names, authors, and labels remain plain inputs.

The startup migration checks for each column before adding it, so restarting the API does not change existing rows or insert duplicate sample data. Initial sample rows are skipped when any reading record or saved path already exists. There is currently no search or export endpoint; the plain-text columns remain available for those features.

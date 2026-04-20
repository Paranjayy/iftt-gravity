# 🪐 Gravity Archive vs. 🟠 Raycast Clipboard

A roadmap and comparison for the ultimate power-user archiver.

## ⚖️ Comparison Matrix

| Feature | 🟠 Raycast Clipboard | 🪐 Gravity Archive |
| :--- | :--- | :--- |
| **Storage Limit** | Configurable (256 - 5,000) | **Infinite** (SQLite-backed) |
| **Character Limit** | Truncates after ~10-20kb | **No Limit** (Save 10MB of SQL/JSON) |
| **Data Ownership** | Encrypted (Locked to Mac) | **Open Format** (SQLite / JSON Export) |
| **Portability** | Hard to move between Macs | **Portable** (via `export` / `import`) |
| **Searching** | Global search (Fast) | **Fuzzy + Full Text Search** |
| **Logic** | Proprietary / Closed | **Open Source** (Add your own rules) |
| **Metadata** | App Name | **Type Detection** (URL/Email/Code) |
| **Formatting** | Good basic support | **Markdown Enhanced** (Detail View) |

---

## 🛑 The "Raycast Problem" (Why we built this)
1.  **Encryption Lock-in**: Raycast stores your history in `raycast-enc.sqlite`. It is encrypted via Keychain, making it impossible to script or backup to a cloud "Prompt Vault" easily.
2.  **The Purge**: If you copy a massive 5MB file of logs, Raycast often chokes or ignores it. Gravity eats it.
3.  **Search Blindness**: Raycast search is great, but you can't build custom SQL queries or filters (like "show me only URLs copied from VS Code").

---

## 🔮 Future God-Mode Ideas
- [ ] **Context Awareness**: Use AppleScript to capture the **Source App Window Title** during copy.
    - *UX*: "Search for that thing I copied while I was in the Terminal."
- [ ] **AI-Powered Semantic Search**:
    - *Idea*: Add a "Meaning" search. "Find the code snippet about database connections" even if the word "connection" isn't in it.
- [ ] **Auto-Actionable Snippets**:
    - Detect a **Color Hex** -> Show a color picker in Raycast.
    - Detect a **Unix Timestamp** -> Show the human-readable date instantly.
    - Detect a **JSON String** -> Auto-format it in the Detail view.
- [ ] **Ghost Mode (Privacy)**:
    - Automatically detect `sk-...` (OpenAI keys) or `xoxp-...` (Slack tokens) and move them to a "Sensitive" encrypted table or auto-delete after 10 mins.
- [ ] **Collections**:
    - A keyboard shortcut to "Start Collection". All copies for the next 5 mins get grouped into a "Project Research" folder.

## ❓ Questions for the Master
1.  **Media Archiving**: Do you want to archive **Images** too? (Currently we skip images to keep the DB fast, but we can store them in a `~/Pictures/GravityArchive` folder).
2.  **Syncing**: Should the archive sync between your different Macs automatically via Git or Cloudflare?
3.  **Transparency**: Should I add a "History Hub" Dashboard to the Web UI (3000)?

# Developer Folder Cleanup Analysis

**Scanned:** `~/Developer/` (2026-08-28)
**Total size:** ~25GB+

---

## Safely Removable (empty/near-empty)

| Folder | Size | Items | Recommendation |
|--------|------|-------|----------------|
| `Karya/` | 0 | 0 | Delete — empty |
| `gemini/` | 0 | 0 | Delete — empty |
| `lakebed/` | 0 | 0 | Delete — empty |
| `paranjayy/` | 0 | 0 | Delete — empty |
| `project/` | 0 | 0 | Delete — empty |
| `ytbers catalogue/` | 0 | 0 | Delete — empty (use `ytbers-catalogue/` instead) |
| `devspace/` | 0 | 1 | Delete — empty git repo |
| `copilot-worktrees/` | 0 | 1 | Delete — empty git repo |
| `private-stash/` | 0 | 1 | Delete — empty git repo |
| `new folder/` | 1 | 1 | Delete — junk folder |

**Potential savings:** ~0 bytes (already empty)

---

## Rename Candidates (clarity)

| Current | Suggested | Why |
|---------|-----------|-----|
| `New Folder With Items/` | `design-palace/` or delete | Contains design project files |
| `New Folder With Items 2/` | `design-projects/` or delete | Contains 4 design subfolders |
| `new/` | `misc-projects/` or delete | Contains `neodisk` and `project-storage-os` |
| `imp/` (3.1GB!) | Review contents | Only 2 items: a JSON dump and dotfiles |

---

## Dev Junk (run Dev Purge command)

| Type | Count | Recommendation |
|------|-------|----------------|
| `node_modules/` | 19 folders | Run `Dev Purge` to trash |
| `.next/` | 7 folders | Run `Dev Purge` to trash |
| `dist/` | 10 folders | Run `Dev Purge` to trash |

**Potential savings:** 2-5GB (varies)

---

## Large Folders (review manually)

| Folder | Size | Notes |
|--------|------|-------|
| `Learning OSS/` | 3.4GB | Educational content — keep? |
| `imp/` | 3.1GB | Only 2 items — review |
| `telegram chats/` | 1.3GB | Chat exports — keep? |
| `chanhdai.com2/` | 1.3GB | Website project |
| `Chat-History-Backup/` | 1.3GB | Chat backups |
| `Takeout/` | 891MB | Google Takeout — extract & delete? |
| `clipboard-archive/` | 865MB | Clipboard data |
| `reddit/` | 782MB | Reddit data |
| `yuvi/` | 729MB | Only 1 file — review |

---

## Duplicate/Related Folders

| Folders | Action |
|---------|--------|
| `Image-Search/` + `Image-search2/` | Merge or delete older |
| `project manger/` + `project manager/` | Delete duplicate |
| `New Folder With Items/` + `New Folder With Items 2/` | Rename or delete |
| `new/` + `new folder/` | Merge or delete |
| `ytbers catalogue/` + `ytbers-catalogue/` | Delete empty one |

---

## Action Plan

1. **Immediate:** Delete empty folders (~10 folders, 0 bytes)
2. **Run Dev Purge:** Clean node_modules/.next/dist (~2-5GB)
3. **Review `imp/`:** 3.1GB with only 2 items
4. **Review `yuvi/`:** 729MB with only 1 file
5. **Merge duplicates:** Image-Search, project managers, new folders
6. **Extract & delete `Takeout/`:** 891MB Google Takeout archive

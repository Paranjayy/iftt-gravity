import {
  List,
  ActionPanel,
  Action,
  Icon,
  Color,
  showToast,
  Toast,
  Form,
  useNavigation,
  LocalStorage,
  Clipboard,
  Detail,
} from "@raycast/api";
import { useState, useEffect } from "react";
import fetch from "node-fetch";

/**
 * Prompt Library — store, search, and quickly use reusable AI prompts.
 *
 * Storage: LocalStorage (key "homepulse-prompts") — array of:
 *   { id, title, body, tags, model, useCount, lastUsedAt, createdAt, isFavorite }
 *
 * Variable substitution (applied at copy time):
 *   {{date}}   → 2026-07-11
 *   {{time}}   → 18:34
 *   {{dt}}     → 2026-07-11 18:34
 *   {{clip}}   → current clipboard contents
 *   {{file}}   → currently-focused filename in Finder (best-effort)
 *
 * Seeded on first run with 8 starter prompts aimed at power users
 * (commit messages, code review, etc.) — feel free to delete them.
 */

interface Prompt {
  id: string;
  title: string;
  body: string;
  tags: string[];
  model: string;
  useCount: number;
  lastUsedAt: string;
  createdAt: string;
  isFavorite: boolean;
}

const STORAGE_KEY = "homepulse-prompts";

function nowIso(): string {
  return new Date().toISOString();
}
function newId(): string {
  return `p-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Apply {{date}}, {{time}}, {{dt}}, {{clip}}, {{file}} substitutions.
 * Best-effort: missing values become empty string.
 */
async function substitute(body: string): Promise<string> {
  const now = new Date();
  const date = now.toISOString().split("T")[0];
  const time = now.toTimeString().slice(0, 5);
  const dt = `${date} ${time}`;

  // Clipboard: only fetch if needed (perf)
  let clip = "";
  if (body.includes("{{clip}}")) {
    try {
      const text = await Clipboard.readText();
      clip = text || "";
    } catch {
      clip = "";
    }
  }

  // File: leave as placeholder for now (no easy API for focused Finder item)
  return body
    .replace(/\{\{date\}\}/g, date)
    .replace(/\{\{time\}\}/g, time)
    .replace(/\{\{dt\}\}/g, dt)
    .replace(/\{\{clip\}\}/g, clip)
    .replace(/\{\{file\}\}/g, "");
}

const SEED_PROMPTS: Omit<
  Prompt,
  "id" | "useCount" | "lastUsedAt" | "createdAt" | "isFavorite"
>[] = [
  {
    title: "Commit Message (Conventional)",
    tags: ["git", "dev"],
    model: "claude",
    body: `Write a conventional commit message for the following diff. Use the format:

<type>(<scope>): <subject>

<body>

Rules:
- subject ≤ 72 chars, imperative mood, no trailing period
- type: feat | fix | chore | docs | refactor | test | perf | build | ci
- body: explain WHY, not WHAT (the diff shows what)
- if the change is non-trivial, add a bullet list of side effects

Diff:
{{clip}}`,
  },
  {
    title: "Code Review (Harsh but Constructive)",
    tags: ["dev", "review"],
    model: "claude",
    body: `Review the following code. For each issue:
1. Name the file + line if visible
2. Explain the problem in one sentence
3. Suggest the fix in one line
4. Severity: 🔴 blocker | 🟠 important | 🟡 nit

Focus areas: correctness, edge cases, error handling, naming, complexity, security, performance. Be specific. No filler. If it's good, say so explicitly.

Code:
{{clip}}`,
  },
  {
    title: "Bug Triage",
    tags: ["dev", "debug"],
    model: "claude",
    body: `Help me triage this bug report.

Extract:
- One-line summary
- Affected component(s)
- Repro steps (numbered)
- Expected vs actual
- Severity guess: S0 (down) | S1 (broken feature) | S2 (degraded) | S3 (cosmetic)
- Likely root cause category: state, async, config, env, race, data, third-party
- Suggested next action (reproduce, bisect, add log, etc.)

Report:
{{clip}}`,
  },
  {
    title: "Explain Like I'm 5",
    tags: ["learn", "explain"],
    model: "claude",
    body: `Explain the following concept as if I'm 5 years old. Then re-explain it at three escalating levels of expertise (junior, mid, senior). Use analogies. No jargon without defining it first.

Concept:
{{clip}}`,
  },
  {
    title: "Standup Summary",
    tags: ["work", "writing"],
    model: "claude",
    body: `Turn my raw notes into a 3-bullet standup:
- Yesterday: [what I finished, with proof links if any]
- Today: [what I plan to do, in priority order]
- Blockers: [what's in the way, with whom to ping]

Notes:
{{clip}}`,
  },
  {
    title: "Refactor Recipe",
    tags: ["dev", "refactor"],
    model: "claude",
    body: `I have this code that I suspect needs refactoring. Before suggesting changes:
1. Read it carefully
2. Identify the actual smell (not a generic "this is messy")
3. Propose the smallest refactor that addresses it
4. List 2-3 alternative approaches with tradeoffs
5. Recommend one and explain why

Code:
{{clip}}`,
  },
  {
    title: "PR Description",
    tags: ["git", "dev"],
    model: "claude",
    body: `Write a PR description with:
- One-line summary
- Why this change (link to issue/ticket if I mention one)
- What changed (3-5 bullets, user-facing language)
- How to test (numbered steps)
- Screenshots/recordings: [I haven't attached any]
- Risk + rollback plan
- Anything I should know as a reviewer

Context:
{{clip}}`,
  },
  {
    title: "Decision Doc (ADR)",
    tags: ["writing", "decisions"],
    model: "claude",
    body: `Write a short Architecture Decision Record (ADR) for the following decision. Use:

# ADR-NNN: <Title>
Status: proposed
Date: {{date}}

## Context
[what forces drove this decision]

## Decision
[what we chose to do]

## Consequences
[what becomes easier, what becomes harder, what's now locked in]

## Alternatives considered
- [option A]: rejected because…
- [option B]: rejected because…

Decision:
{{clip}}`,
  },
];

async function loadPrompts(): Promise<Prompt[]> {
  const stored = await LocalStorage.getItem<string>(STORAGE_KEY);
  if (stored) {
    try {
      const parsed = JSON.parse(stored) as Prompt[];
      if (Array.isArray(parsed)) return parsed;
    } catch {
      // fall through to seed
    }
  }
  // First run: seed
  const seeded: Prompt[] = SEED_PROMPTS.map((p) => ({
    ...p,
    id: newId(),
    useCount: 0,
    lastUsedAt: "",
    createdAt: nowIso(),
    isFavorite: false,
  }));
  await LocalStorage.setItem(STORAGE_KEY, JSON.stringify(seeded));
  return seeded;
}

async function savePrompts(prompts: Prompt[]): Promise<void> {
  await LocalStorage.setItem(STORAGE_KEY, JSON.stringify(prompts));
}

export default function Command() {
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    loadPrompts().then((p) => {
      setPrompts(p);
      setIsLoading(false);
    });
  }, []);

  async function persist(next: Prompt[]) {
    setPrompts(next);
    await savePrompts(next);
  }

  async function usePrompt(p: Prompt) {
    const expanded = await substitute(p.body);
    await Clipboard.copy(expanded);
    const next = prompts.map((x) =>
      x.id === p.id
        ? { ...x, useCount: x.useCount + 1, lastUsedAt: nowIso() }
        : x,
    );
    await persist(next);
    showToast({
      title: "Copied to clipboard",
      message: p.title,
      style: Toast.Style.Success,
    });
  }

  async function toggleFavorite(p: Prompt) {
    const next = prompts.map((x) =>
      x.id === p.id ? { ...x, isFavorite: !x.isFavorite } : x,
    );
    await persist(next);
  }

  async function deletePrompt(p: Prompt) {
    const next = prompts.filter((x) => x.id !== p.id);
    await persist(next);
    showToast({ title: `Deleted: ${p.title}`, style: Toast.Style.Success });
  }

  // Search filter
  const q = search.trim().toLowerCase();
  const matches = q
    ? prompts.filter(
        (p) =>
          p.title.toLowerCase().includes(q) ||
          p.body.toLowerCase().includes(q) ||
          p.tags.some((t) => t.toLowerCase().includes(q)),
      )
    : prompts;

  // Top 5 most-used (stable, doesn't change with search)
  const top5 = [...prompts]
    .sort((a, b) => b.useCount - a.useCount)
    .slice(0, 5)
    .filter((p) => p.useCount > 0);

  // Recently used
  const recent = [...prompts]
    .filter((p) => p.lastUsedAt)
    .sort((a, b) => b.lastUsedAt.localeCompare(a.lastUsedAt))
    .slice(0, 5);

  // Favorites
  const favorites = matches.filter((p) => p.isFavorite);
  const rest = matches.filter((p) => !p.isFavorite);

  return (
    <List
      isLoading={isLoading}
      onSearchTextChange={setSearch}
      searchBarPlaceholder="Search prompts by title, tag, or content..."
      throttle
    >
      {top5.length > 0 && (
        <List.Section title="🔥 Top 5 (most used)">
          {top5.map((p) => (
            <PromptItem
              key={p.id}
              prompt={p}
              onUse={usePrompt}
              onFavorite={toggleFavorite}
              onDelete={deletePrompt}
            />
          ))}
        </List.Section>
      )}
      {recent.length > 0 && (
        <List.Section title="🕒 Recently used">
          {recent.map((p) => (
            <PromptItem
              key={p.id}
              prompt={p}
              onUse={usePrompt}
              onFavorite={toggleFavorite}
              onDelete={deletePrompt}
            />
          ))}
        </List.Section>
      )}
      {favorites.length > 0 && (
        <List.Section title="⭐ Favorites">
          {favorites.map((p) => (
            <PromptItem
              key={p.id}
              prompt={p}
              onUse={usePrompt}
              onFavorite={toggleFavorite}
              onDelete={deletePrompt}
            />
          ))}
        </List.Section>
      )}
      <List.Section
        title={q ? `Results (${rest.length})` : `All Prompts (${rest.length})`}
      >
        {rest.length === 0 && !q ? (
          <List.Item
            title="No prompts yet"
            subtitle="Press ⌘N to create one"
            icon={Icon.Plus}
          />
        ) : null}
        {rest.map((p) => (
          <PromptItem
            key={p.id}
            prompt={p}
            onUse={usePrompt}
            onFavorite={toggleFavorite}
            onDelete={deletePrompt}
          />
        ))}
      </List.Section>
    </List>
  );
}

function PromptItem({
  prompt,
  onUse,
  onFavorite,
  onDelete,
}: {
  prompt: Prompt;
  onUse: (p: Prompt) => void | Promise<void>;
  onFavorite: (p: Prompt) => void | Promise<void>;
  onDelete: (p: Prompt) => void | Promise<void>;
}) {
  const subtitle = prompt.tags.length ? prompt.tags.join(" · ") : "untagged";
  return (
    <List.Item
      title={prompt.title}
      subtitle={subtitle}
      icon={
        prompt.isFavorite
          ? { source: Icon.Star, tintColor: Color.Yellow }
          : { source: Icon.Text, tintColor: Color.Blue }
      }
      accessories={[
        { text: prompt.model || "—", tag: { color: Color.Magenta } },
        ...(prompt.useCount > 0 ? [{ text: `used ${prompt.useCount}×` }] : []),
        ...(prompt.lastUsedAt
          ? [{ text: new Date(prompt.lastUsedAt).toLocaleDateString() }]
          : []),
      ]}
      actions={
        <ActionPanel>
          <Action
            title="Use (Copy + Count)"
            icon={Icon.CopyClipboard}
            shortcut={{ modifiers: [], key: "return" }}
            onAction={() => onUse(prompt)}
          />
          <Action.CopyToClipboard
            title="Copy Raw (no substitution)"
            content={prompt.body}
            shortcut={{ modifiers: ["cmd"], key: "c" }}
          />
          <Action.Push
            title="View Full Prompt"
            icon={Icon.Eye}
            target={<PromptDetail prompt={prompt} />}
          />
          <Action.Push
            title="Edit Prompt"
            icon={Icon.Pencil}
            shortcut={{ modifiers: ["cmd"], key: "e" }}
            target={<EditPromptForm prompt={prompt} />}
          />
          <Action
            title={prompt.isFavorite ? "Unfavorite" : "Favorite"}
            icon={Icon.Star}
            shortcut={{ modifiers: ["cmd"], key: "f" }}
            onAction={() => onFavorite(prompt)}
          />
          <Action
            title="Delete Prompt"
            icon={Icon.Trash}
            style={Action.Style.Destructive}
            shortcut={{ modifiers: ["cmd"], key: "delete" }}
            onAction={() => onDelete(prompt)}
          />
          <Action.Push
            title="New Prompt"
            icon={Icon.Plus}
            shortcut={{ modifiers: ["cmd"], key: "n" }}
            target={<NewPromptForm />}
          />
        </ActionPanel>
      }
    />
  );
}

function PromptDetail({ prompt }: { prompt: Prompt }) {
  const meta = `*Tags*: ${prompt.tags.join(", ") || "—"}  \n*Model*: ${prompt.model || "—"}  \n*Uses*: ${prompt.useCount}  \n*Last used*: ${prompt.lastUsedAt || "never"}  \n*Created*: ${new Date(prompt.createdAt).toLocaleString()}`;
  return (
    <Detail
      markdown={`# ${prompt.title}\n\n${meta}\n\n---\n\n${prompt.body}\n\n---\n\n### Variables\n- \`{{date}}\` → 2026-07-11\n- \`{{time}}\` → 18:34\n- \`{{dt}}\` → 2026-07-11 18:34\n- \`{{clip}}\` → current clipboard\n- \`{{file}}\` → focused filename (placeholder for now)`}
      actions={
        <ActionPanel>
          <Action.CopyToClipboard title="Copy Raw" content={prompt.body} />
        </ActionPanel>
      }
    />
  );
}

function NewPromptForm() {
  const { pop } = useNavigation();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [tags, setTags] = useState("");
  const [model, setModel] = useState("claude");

  async function handleSubmit() {
    if (!title.trim() || !body.trim()) {
      showToast({
        title: "Title and body are required",
        style: Toast.Style.Failure,
      });
      return;
    }
    const list = await loadPrompts();
    const next: Prompt[] = [
      ...list,
      {
        id: newId(),
        title: title.trim(),
        body: body.trim(),
        tags: tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
        model: model.trim() || "—",
        useCount: 0,
        lastUsedAt: "",
        createdAt: nowIso(),
        isFavorite: false,
      },
    ];
    await savePrompts(next);
    showToast({ title: "Prompt saved", style: Toast.Style.Success });
    pop();
  }

  return (
    <Form
      actions={
        <ActionPanel>
          <Action.SubmitForm
            title="Save Prompt"
            icon={Icon.Check}
            onSubmit={handleSubmit}
          />
        </ActionPanel>
      }
    >
      <Form.Description text="New prompt. Use {{date}}, {{time}}, {{clip}}, {{file}} for variable substitution at copy time." />
      <Form.TextField
        id="title"
        title="Title"
        placeholder="e.g. Commit Message"
        value={title}
        onChange={setTitle}
        autoFocus
      />
      <Form.TextArea
        id="body"
        title="Body"
        placeholder="The prompt. Use {{clip}} to embed current clipboard."
        value={body}
        onChange={setBody}
        enableMarkdown
      />
      <Form.TextField
        id="tags"
        title="Tags (comma separated)"
        placeholder="dev, git, review"
        value={tags}
        onChange={setTags}
      />
      <Form.Dropdown
        id="model"
        title="Suggested model"
        value={model}
        onChange={setModel}
      >
        <Form.Dropdown.Item value="claude" title="Claude" />
        <Form.Dropdown.Item value="gpt" title="GPT" />
        <Form.Dropdown.Item value="gemini" title="Gemini" />
        <Form.Dropdown.Item value="llama" title="Llama" />
        <Form.Dropdown.Item value="—" title="Any" />
      </Form.Dropdown>
    </Form>
  );
}

function EditPromptForm({ prompt }: { prompt: Prompt }) {
  const { pop } = useNavigation();
  const [title, setTitle] = useState(prompt.title);
  const [body, setBody] = useState(prompt.body);
  const [tags, setTags] = useState(prompt.tags.join(", "));
  const [model, setModel] = useState(prompt.model || "claude");

  async function handleSubmit() {
    if (!title.trim() || !body.trim()) {
      showToast({
        title: "Title and body are required",
        style: Toast.Style.Failure,
      });
      return;
    }
    const list = await loadPrompts();
    const next = list.map((p) =>
      p.id === prompt.id
        ? {
            ...p,
            title: title.trim(),
            body: body.trim(),
            tags: tags
              .split(",")
              .map((t) => t.trim())
              .filter(Boolean),
            model: model.trim() || "—",
          }
        : p,
    );
    await savePrompts(next);
    showToast({ title: "Prompt updated", style: Toast.Style.Success });
    pop();
  }

  return (
    <Form
      actions={
        <ActionPanel>
          <Action.SubmitForm
            title="Save Changes"
            icon={Icon.Check}
            onSubmit={handleSubmit}
          />
        </ActionPanel>
      }
    >
      <Form.TextField
        id="title"
        title="Title"
        value={title}
        onChange={setTitle}
      />
      <Form.TextArea
        id="body"
        title="Body"
        value={body}
        onChange={setBody}
        enableMarkdown
      />
      <Form.TextField id="tags" title="Tags" value={tags} onChange={setTags} />
      <Form.Dropdown
        id="model"
        title="Suggested model"
        value={model}
        onChange={setModel}
      >
        <Form.Dropdown.Item value="claude" title="Claude" />
        <Form.Dropdown.Item value="gpt" title="GPT" />
        <Form.Dropdown.Item value="gemini" title="Gemini" />
        <Form.Dropdown.Item value="llama" title="Llama" />
        <Form.Dropdown.Item value="—" title="Any" />
      </Form.Dropdown>
    </Form>
  );
}

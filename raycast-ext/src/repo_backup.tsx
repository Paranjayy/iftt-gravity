import { ActionPanel, Action, Icon, Detail, confirmAlert, showToast, Toast, useNavigation, List, Color } from "@raycast/api";
import { useState, useEffect } from "react";
import { inspectReposDeep, backupRepoToGithub, repoBackupMarkdown, RepoDeep, resolveScope } from "./fileops";
import { ScopePicker } from "./scope-picker";
import { useSelection, selAccessory } from "./selector";
import { LiveProgress } from "./live-progress";

function repoSummary(r: RepoDeep): { accessories: any[]; tint: any } {
  const unpushed = r.branches.filter((b) => b.ahead > 0 || b.behind > 0).length;
  const accessories: any[] = [];
  if (r.dirty) accessories.push({ text: "● uncommitted", color: Color.Red });
  if (unpushed > 0) accessories.push({ text: `${unpushed} unpushed`, color: Color.Orange });
  if (!r.hasRemote) accessories.push({ text: "no remote", color: Color.Yellow });
  else if (!r.remoteIsGitHub) accessories.push({ text: "non-GitHub", color: Color.Yellow });
  else accessories.push({ text: "GitHub ✓", color: Color.Green });
  return { accessories, tint: r.dirty ? Color.Red : r.hasRemote && !r.remoteIsGitHub ? Color.Yellow : Color.SecondaryText };
}

function BackupView({ root }: { root: string }) {
  const [repos, setRepos] = useState<RepoDeep[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const { selected, toggle, count } = useSelection();
  const { push } = useNavigation();

  useEffect(() => {
    setLoaded(false);
    inspectReposDeep(root, 7).then((r) => {
      setRepos(r);
      setLoaded(true);
    });
  }, [root]);

  const targets = () => (count > 0 ? repos.filter((r) => selected.has(r.path)) : repos);

  async function apply() {
    const list = targets();
    if (list.length === 0) return;
    const needCreate = list.filter((r) => !r.remoteIsGitHub);
    let toBackup = list;
    if (needCreate.length > 0) {
      const ok = await confirmAlert({
        title: `Push ${list.length} repo(s) to GitHub?`,
        message: `${needCreate.length} have no GitHub remote.\nCreate PRIVATE GitHub repos (avoids leaks)?\nCancel = only back up those already on GitHub.`,
        primaryAction: { title: "Create Private & Push" },
        dismissAction: { title: "Only GitHub ones" },
      });
      if (!ok) toBackup = list.filter((r) => r.remoteIsGitHub);
    }
    if (toBackup.length === 0) {
      showToast({ title: "Nothing to back up", style: Toast.Style.Failure });
      return;
    }
    setBusy(true);
    try {
      push(
        <LiveProgress
          title="Backing up to GitHub"
          icon="☁️"
          task={async (onP) => {
            const results = [];
            for (let i = 0; i < toBackup.length; i++) {
              results.push(await backupRepoToGithub(toBackup[i], { createPrivate: true, onProgress: onP, index: i, total: toBackup.length }));
            }
            showToast({ title: `Backed up ${results.filter((x) => x.status !== "failed").length}/${results.length}`, style: Toast.Style.Success });
            return repoBackupMarkdown(results);
          }}
        />
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <List isLoading={!loaded || busy} searchBarPlaceholder="Filter repos…">
      <List.Item
        title={count > 0 ? `▶ Backup ${count} selected` : `▶ Backup all ${repos.length}`}
        icon={Icon.Cloud}
        actions={<ActionPanel><Action title="Backup to GitHub" icon={Icon.Cloud} onAction={apply} /></ActionPanel>}
      />
      {repos.map((r) => {
        const s = repoSummary(r);
        return (
          <List.Item
            key={r.path}
            title={r.name}
            subtitle={r.path.replace(root, ".") || r.path}
            icon={Icon.Folder}
            tintColor={s.tint}
            accessories={[...s.accessories, selAccessory(selected.has(r.path))]}
            actions={
              <ActionPanel>
                <Action title={selected.has(r.path) ? "Deselect" : "Select"} icon={Icon.Checkmark} onAction={() => toggle(r.path)} />
                <Action
                  title="Backup this repo"
                  icon={Icon.Cloud}
                  onAction={async () => {
                    const res = await backupRepoToGithub(r, { createPrivate: true });
                    push(<Detail markdown={repoBackupMarkdown([res])} />);
                  }}
                />
              </ActionPanel>
            }
          />
        );
      })}
    </List>
  );
}

export default function Command() {
  const { push } = useNavigation();
  return <ScopePicker title="Backup" icon={Icon.Cloud} onPick={(scope, root) => push(<BackupView root={resolveScope(scope)} />)} />;
}

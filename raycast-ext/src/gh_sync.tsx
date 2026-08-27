import { ActionPanel, Action, Icon, Detail, confirmAlert, showToast, Toast, useNavigation, List } from "@raycast/api";
import { resolveScope, syncToGithub, ghMarkdown } from "./fileops";
import { ScopePicker } from "./scope-picker";

function GhView({ root }: { root: string }) {
  const [busy, setBusy] = useState(false);
  const { push } = useNavigation();

  async function run() {
    if (
      !(await confirmAlert({
        title: "Sync repos to GitHub?",
        message: `${root}\nRepos without a remote get a private GitHub repo created via gh; all branches + tags are pushed.`,
        primaryAction: { title: "Sync" },
      }))
    )
      return;
    setBusy(true);
    try {
      const results = await syncToGithub(root);
      const ok = results.filter((r) => r.status !== "failed").length;
      showToast({ title: `Synced ${ok}/${results.length}`, style: Toast.Style.Success });
      push(<Detail markdown={ghMarkdown(results)} />);
    } catch (e) {
      showToast({ title: "Failed", style: Toast.Style.Failure, message: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <List isLoading={busy}>
      <List.Item
        title="Sync Repos to GitHub"
        subtitle={root}
        icon={Icon.Cloud}
        actions={<ActionPanel><Action title="Sync" icon={Icon.Cloud} onAction={run} /></ActionPanel>}
      />
    </List>
  );
}

export default function Command() {
  const { push } = useNavigation();
  return <ScopePicker title="GitHub Sync" icon={Icon.Cloud} onPick={(scope, root) => push(<GhView root={resolveScope(scope)} />)} />;
}

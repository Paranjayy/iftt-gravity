import { List, ActionPanel, Action, Icon } from "@raycast/api";
import { SCOPES } from "./fileops";

export function ScopePicker({
  title,
  icon,
  onPick,
}: {
  title: string;
  icon: any;
  onPick: (scope: string, root: string) => void;
}) {
  const folders = Object.keys(SCOPES);
  return (
    <List searchBarPlaceholder="Pick a scope…">
      {folders.map((f) => (
        <List.Item
          key={f}
          title={f[0].toUpperCase() + f.slice(1)}
          subtitle={SCOPES[f]}
          icon={icon}
          actions={
            <ActionPanel>
              <Action title={`${title} Here`} onAction={() => onPick(f, SCOPES[f])} />
            </ActionPanel>
          }
        />
      ))}
    </List>
  );
}

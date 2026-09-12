import { List, ActionPanel, Action, Icon } from "@raycast/api";
import { DirBrowser } from "./dir-browser";
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
  return (
    <DirBrowser
      title={title}
      actionTitle={`${title} Here`}
      onPick={(dirPath) => {
        const scopeName = Object.entries(SCOPES).find(([, v]) => v === dirPath)?.[0];
        onPick(scopeName || dirPath, dirPath);
      }}
    />
  );
}

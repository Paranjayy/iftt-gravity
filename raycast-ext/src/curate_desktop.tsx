import { ActionPanel, Action, Icon, confirmAlert, showToast, Toast, useNavigation, List } from "@raycast/api";
import { useState } from "react";
import {
  SCOPES,
  CalendarGrain,
  organizeDesktop,
  organizeMarkdown,
  undoDesktopOrganize,
} from "./fileops";
import { LiveProgress } from "./live-progress";

const GRAINS: { value: CalendarGrain; title: string; hint: string }[] = [
  { value: "ymd", title: "Year / Month / Day", hint: "2026/09/12" },
  { value: "month", title: "Year / Month", hint: "2026/09" },
  { value: "week", title: "ISO Week", hint: "2026-W37" },
  { value: "day", title: "Day", hint: "2026-09-12" },
];

export default function Command() {
  const [grain, setGrain] = useState<CalendarGrain>("ymd");
  const { push } = useNavigation();
  const root = SCOPES.desktop;
  const selected = GRAINS.find((g) => g.value === grain)!;

  async function run() {
    if (
      !(await confirmAlert({
        title: `Curate Desktop by ${selected.title}?`,
        message: `Loose Desktop files only. Screenshots → Organised Screenshots/${selected.hint}/… Other files → Organised Folders by type. Capture date comes from the filename when possible.`,
        primaryAction: { title: "Curate" },
      }))
    )
      return;

    push(
      <LiveProgress
        title={`Curating by ${selected.title}`}
        icon="🗂️"
        task={async (onP) => {
          const r = await organizeDesktop(root, { grain, onProgress: onP });
          showToast({
            title: `Moved ${r.moved.length}`,
            style: r.failed.length ? Toast.Style.Failure : Toast.Style.Success,
            message: r.failed.length ? `${r.failed.length} failed` : undefined,
          });
          return organizeMarkdown(grain, r);
        }}
      />,
    );
  }

  async function undo() {
    const data = await undoDesktopOrganize();
    if (data.count > 0) {
      showToast({ title: `Restored ${data.count} files`, style: Toast.Style.Success });
    } else {
      showToast({ title: "Nothing to undo", style: Toast.Style.Failure });
    }
  }

  return (
    <List
      searchBarAccessory={
        <List.Dropdown tooltip="Calendar grain" value={grain} onChange={(v) => setGrain(v as CalendarGrain)} storeValue>
          {GRAINS.map((g) => (
            <List.Dropdown.Item key={g.value} title={`${g.title}  (${g.hint})`} value={g.value} />
          ))}
        </List.Dropdown>
      }
    >
      <List.Item
        title={`Curate Desktop → ${selected.hint}`}
        subtitle="Screenshots by capture date · other files by type"
        icon={Icon.Calendar}
        actions={
          <ActionPanel>
            <Action title="Curate Now" icon={Icon.Checkmark} onAction={run} />
            <Action title="Undo Last Curate" icon={Icon.RotateAntiClockwise} onAction={undo} />
          </ActionPanel>
        }
      />
    </List>
  );
}

import { ActionPanel, Action, Icon, confirmAlert, showToast, Toast, useNavigation, List } from "@raycast/api";
import { useState } from "react";
import type { CalendarGrain } from "./desktop-organize";

const GRAINS: { value: CalendarGrain; title: string; hint: string }[] = [
  { value: "ymd", title: "Year / Month / Day", hint: "2026/09/12" },
  { value: "month", title: "Year / Month", hint: "2026/09" },
  { value: "week", title: "ISO Week", hint: "2026-W37" },
  { value: "day", title: "Day", hint: "2026-09-12" },
];

export default function Command() {
  const [grain, setGrain] = useState<CalendarGrain>("ymd");
  const { push } = useNavigation();
  const selected = GRAINS.find((g) => g.value === grain)!;

  async function run() {
    if (
      !(await confirmAlert({
        title: `Curate Desktop by ${selected.title}?`,
        message: `Screenshots only → Organised Screenshots/${selected.hint}/. Other files stay. Warning MD if strays.`,
        primaryAction: { title: "Curate" },
      }))
    )
      return;

    const [{ guardDesktop, organizeMarkdown, DESKTOP, DOWNLOADS }, { LiveProgress }] = await Promise.all([
      import("./desktop-organize"),
      import("./live-progress"),
    ]);

    push(
      <LiveProgress
        title={`Curating by ${selected.title}`}
        icon="🗂️"
        task={async (onP) => {
          const r = await guardDesktop(DESKTOP, {
            downloadsDir: DOWNLOADS,
            grain,
            force: true,
            onProgress: onP,
          });
          const moved = r.swept?.moved.length ?? 0;
          const failed = r.swept?.failed.length ?? 0;
          showToast({
            title: `Moved ${moved} screenshots`,
            style: failed ? Toast.Style.Failure : Toast.Style.Success,
            message: r.strays.length ? `${r.strays.length} strays left (warning MD)` : undefined,
          });
          return organizeMarkdown(grain, r.swept ?? { moved: [], failed: [] });
        }}
      />,
    );
  }

  async function undo() {
    const { undoDesktopOrganize } = await import("./desktop-organize");
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
        subtitle="Screenshots only · first paint is empty of Desktop I/O"
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

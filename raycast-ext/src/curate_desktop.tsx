import { ActionPanel, Action, Icon, confirmAlert, showToast, Toast, useNavigation, List } from "@raycast/api";
import { useState } from "react";
import type { CalendarGrain } from "./desktop-organize";

const GRAINS: { value: CalendarGrain; title: string; hint: string }[] = [
  { value: "ymsepwd", title: "Year / Month-Sep / Week / Day", hint: "2026/09-Sep/W37/12" },
  { value: "ymwd", title: "Year / Month / Week / Day", hint: "2026/09/W37/12" },
  { value: "ymw", title: "Year / Month / Week", hint: "2026/09/W37" },
  { value: "ymd", title: "Year / Month / Day", hint: "2026/09/12" },
  { value: "named", title: "Named weekday", hint: "2026/09-September/Saturday/12" },
  { value: "verbose", title: "Verbose lowercase", hint: "2026/09-september/saturday/12" },
  { value: "week", title: "ISO Week (Clean & Group)", hint: "2026-W37" },
  { value: "month", title: "Year / Month", hint: "2026/09" },
  { value: "day", title: "Flat day", hint: "2026-09-12" },
];

export default function Command() {
  const [grain, setGrain] = useState<CalendarGrain>("ymsepwd");
  const { push } = useNavigation();
  const selected = GRAINS.find((g) => g.value === grain)!;

  async function sweepDesktop() {
    if (
      !(await confirmAlert({
        title: `Sweep Desktop → ${selected.title}?`,
        message: `Loose screenshots → Organised Screenshots/${selected.hint}/. Creates that folder if needed. Other Desktop files stay.`,
        primaryAction: { title: "Sweep" },
      }))
    )
      return;

    const [{ guardDesktop, organizeMarkdown, DESKTOP, DOWNLOADS }, { LiveProgress }] = await Promise.all([
      import("./desktop-organize"),
      import("./live-progress"),
    ]);

    push(
      <LiveProgress
        title={`Sweeping → ${selected.hint}`}
        icon="🗂️"
        task={async (onP) => {
          const r = await guardDesktop(DESKTOP, {
            downloadsDir: DOWNLOADS,
            grain,
            force: true,
            onProgress: onP,
          });
          showToast({
            title: `Moved ${r.swept?.moved.length ?? 0} from Desktop`,
            style: Toast.Style.Success,
            message: r.strays.length ? `${r.strays.length} strays left (warning MD)` : undefined,
          });
          return organizeMarkdown(grain, r.swept ?? { moved: [], failed: [] });
        }}
      />,
    );
  }

  async function reshapeLibrary() {
    if (
      !(await confirmAlert({
        title: `Reshape library → ${selected.title}?`,
        message: `Re-folders files already in Organised Screenshots into ${selected.hint}. No undo of Desktop. Empty old buckets are removed.`,
        primaryAction: { title: "Reshape" },
      }))
    )
      return;

    const [{ reshapeOrganisedScreenshots, organizeMarkdown, DESKTOP }, { LiveProgress }] = await Promise.all([
      import("./desktop-organize"),
      import("./live-progress"),
    ]);
    const library = `${DESKTOP}/Organised Screenshots`;

    push(
      <LiveProgress
        title={`Reshaping → ${selected.hint}`}
        icon="📁"
        task={async (onP) => {
          const r = await reshapeOrganisedScreenshots(library, grain, { onProgress: onP });
          showToast({ title: `Reshaped ${r.moved.length} files`, style: Toast.Style.Success });
          return organizeMarkdown(grain, r);
        }}
      />,
    );
  }

  return (
    <List
      searchBarAccessory={
        <List.Dropdown tooltip="Folder layout" value={grain} onChange={(v) => setGrain(v as CalendarGrain)} storeValue>
          {GRAINS.map((g) => (
            <List.Dropdown.Item key={g.value} title={`${g.title}  (${g.hint})`} value={g.value} />
          ))}
        </List.Dropdown>
      }
    >
      <List.Item
        title={`Sweep Desktop → ${selected.hint}`}
        subtitle="Loose screenshots only · creates Organised Screenshots"
        icon={Icon.Desktop}
        actions={
          <ActionPanel>
            <Action title="Sweep Desktop" icon={Icon.Checkmark} onAction={sweepDesktop} />
            <Action title="Reshape Library" icon={Icon.Folder} onAction={reshapeLibrary} />
          </ActionPanel>
        }
      />
      <List.Item
        title={`Reshape library → ${selected.hint}`}
        subtitle="Already-organised shots, in place — no Desktop undo"
        icon={Icon.Switch}
        actions={
          <ActionPanel>
            <Action title="Reshape Library" icon={Icon.Folder} onAction={reshapeLibrary} />
            <Action title="Sweep Desktop" icon={Icon.Desktop} onAction={sweepDesktop} />
          </ActionPanel>
        }
      />
    </List>
  );
}

import { ActionPanel, Action, Icon, Detail, confirmAlert, showToast, Toast, useNavigation, List } from "@raycast/api";
import { useState } from "react";
import { setScreenshotFormat, setScreenshotNoShadow, convertPngToJpg, convertMarkdown, SCOPES } from "./fileops";
import { LiveProgress } from "./live-progress";

export default function Command() {
  const [busy, setBusy] = useState(false);
  const [keep, setKeep] = useState("delete");
  const { push } = useNavigation();
  const desktop = SCOPES.desktop;
  const keepOriginals = keep === "keep";

  async function toJpg() {
    if (
      !(await confirmAlert({
        title: "Convert Desktop PNGs → JPG?",
        message: `${desktop}\n${keepOriginals ? "Originals KEPT (both PNG + JPG)." : "Originals deleted only on success; errors keep their PNG."}`,
        primaryAction: { title: "Convert" },
      }))
    )
      return;
    setBusy(true);
    try {
      push(
        <LiveProgress
          title="Converting Desktop PNGs → JPG"
          icon="📸"
          task={async (onP) => {
            const r = await convertPngToJpg(desktop, { recursive: true, quality: 80, keepOriginals, onProgress: onP });
            showToast({ title: `Converted ${r.converted.length}`, style: Toast.Style.Success });
            return convertMarkdown(r, keepOriginals);
          }}
        />
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <List
      isLoading={busy}
      searchBarAccessory={
        <List.Dropdown tooltip="Original PNGs" value={keep} onChange={setKeep} storeValue>
          <List.Dropdown.Item title="Delete originals" value="delete" />
          <List.Dropdown.Item title="Keep originals (both)" value="keep" />
        </List.Dropdown>
      }
    >
      <List.Item
        title="Switch macOS screenshots to JPG"
        subtitle="System-wide — smaller future captures"
        icon={Icon.Image}
        actions={
          <ActionPanel>
            <Action
              title="Set JPG + Apply"
              icon={Icon.Wand}
              onAction={async () => {
                await setScreenshotFormat("jpg");
                showToast({ title: "Screenshots now save as JPG", style: Toast.Style.Success });
              }}
            />
          </ActionPanel>
        }
      />
      <List.Item
        title="Disable window drop shadows"
        subtitle="Smaller window captures (no blur halo)"
        icon={Icon.Frame}
        actions={
          <ActionPanel>
            <Action
              title="Disable Shadows"
              icon={Icon.Frame}
              onAction={async () => {
                await setScreenshotNoShadow(true);
                showToast({ title: "Window shadows disabled", style: Toast.Style.Success });
              }}
            />
          </ActionPanel>
        }
      />
      <List.Item
        title="Shrink existing Desktop PNGs"
        subtitle={`Convert to JPG (${keepOriginals ? "keep originals" : "delete originals"})`}
        icon={Icon.Wand}
        actions={<ActionPanel><Action title="Convert Desktop" icon={Icon.Wand} onAction={toJpg} /></ActionPanel>}
      />
    </List>
  );
}

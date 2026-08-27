import { ActionPanel, Action, Icon, Detail, confirmAlert, showToast, Toast, useNavigation, List, getPreferenceValues } from "@raycast/api";
import { useState, useEffect } from "react";
import { listPngs, convertPngToJpg, convertMarkdown, estimatePngJpg, formatSize, FileInfo, resolveScope } from "./fileops";
import { ScopePicker } from "./scope-picker";
import { useSelection, selAccessory } from "./selector";
import { LiveProgress } from "./live-progress";

const prefs = getPreferenceValues<{ pngToJpgQuality: string; pngToJpgKeepOriginals: boolean }>();

function ConvertView({ root }: { root: string }) {
  const [pngs, setPngs] = useState<FileInfo[]>([]);
  const [est, setEst] = useState<Record<string, number | null>>({});
  const [estimating, setEstimating] = useState(false);
  const [estProgress, setEstProgress] = useState({ done: 0, total: 0 });
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [quality, setQuality] = useState(prefs.pngToJpgQuality || "80");
  const [keep, setKeep] = useState(prefs.pngToJpgKeepOriginals ? "keep" : "delete");
  const { selected, toggle, count } = useSelection();
  const { push } = useNavigation();

  useEffect(() => {
    let active = true;
    setLoaded(false);
    listPngs(root, true).then(async (r) => {
      if (!active) return;
      setPngs(r);
      setLoaded(true);
      setEstimating(true);
      const q = parseInt(quality, 10);

      // For large sets, sample ~10 files and extrapolate
      const SAMPLE_SIZE = 10;
      const files = r.map((p) => p.path);
      const sampleIndices =
        files.length <= SAMPLE_SIZE
          ? files.map((_, i) => i)
          : Array.from({ length: SAMPLE_SIZE }, (_, i) => Math.floor((i / SAMPLE_SIZE) * files.length));

      const sampled: Record<string, number | null> = {};
      for (const idx of sampleIndices) {
        if (!active) return;
        sampled[files[idx]] = await estimatePngJpg(files[idx], q);
        setEstProgress({ done: sampleIndices.indexOf(idx) + 1, total: sampleIndices.length });
      }

      // Extrapolate: compute avg ratio from samples, apply to all
      const sampledRatios = sampleIndices
        .map((i) => {
          const est = sampled[files[i]];
          return est != null ? est / r[i].size : null;
        })
        .filter((r): r is number => r != null);
      const avgRatio = sampledRatios.length > 0 ? sampledRatios.reduce((a, b) => a + b, 0) / sampledRatios.length : 0.25;

      const allEst: Record<string, number | null> = {};
      for (const p of r) {
        if (sampled[p.path] !== undefined) {
          allEst[p.path] = sampled[p.path];
        } else {
          allEst[p.path] = Math.round(p.size * avgRatio);
        }
      }
      if (active) {
        setEst(allEst);
        setEstimating(false);
      }
    });
    return () => {
      active = false;
    };
  }, [root, quality]);

  const keepOriginals = keep === "keep";
  const targets = () => (count > 0 ? pngs.filter((p) => selected.has(p.path)) : pngs);

  const estSaved = () =>
    Math.max(
      0,
      targets().reduce((sum, p) => sum + (p.size - (est[p.path] ?? p.size)), 0)
    );

  const totalPngBytes = () => targets().reduce((sum, p) => sum + p.size, 0);

  async function apply() {
    const list = targets();
    if (list.length === 0) return;
    if (
      !(await confirmAlert({
        title: `Convert ${list.length.toLocaleString()} PNG${list.length > 1 ? "s" : ""}?`,
        message: [
          `📁 ${root}`,
          ``,
          `Current PNG size: **${formatSize(totalPngBytes())}**`,
          `Estimated JPG size: **~${formatSize(totalPngBytes() - estSaved())}**`,
          `Estimated savings: **~${formatSize(estSaved())}** (~${Math.round((estSaved() / Math.max(1, totalPngBytes())) * 100)}%)`,
          ``,
          keepOriginals ? "✅ Originals KEPT (you get both PNG + JPG)." : "🗑 Originals TRASHED (recoverable from ~/.Trash) on success; errors keep their PNG.",
          ``,
          `⚡ ETA: ~${Math.round(list.length * 0.15)}s (estimate)`,
        ].join("\n"),
        primaryAction: { title: "Convert" },
      }))
    )
      return;
    setBusy(true);
    push(
      <LiveProgress
        title="Converting PNG → JPG"
        icon="🖼️"
        task={async (onP) => {
          const r = await convertPngToJpg(root, {
            files: list.map((p) => p.path),
            quality: parseInt(quality, 10),
            keepOriginals,
            onProgress: onP,
          });
          setBusy(false);
          return convertMarkdown(r, keepOriginals);
        }}
      />
    );
  }

  return (
    <List
      isLoading={!loaded || estimating || busy}
      searchBarAccessory={
        <List.Dropdown tooltip="JPG Quality" value={quality} onChange={setQuality} storeValue>
          <List.Dropdown.Item title="High (90)" value="90" />
          <List.Dropdown.Item title="Balanced (80)" value="80" />
          <List.Dropdown.Item title="Small (60)" value="60" />
          <List.Dropdown.Item title="Tiny (40)" value="40" />
        </List.Dropdown>
      }
    >
      {estimating && (
        <List.Section title={`Estimating savings… ${estProgress.done}/${estProgress.total} sampled`}>
          <List.Item title="Sampling PNGs to estimate JPG size" icon={Icon.Clock} />
        </List.Section>
      )}
      <List.Item
        title={count > 0 ? `▶ Convert ${count} selected` : `▶ Convert all ${pngs.length.toLocaleString()}`}
        subtitle={
          estimating
            ? "estimating savings…"
            : `save ~${formatSize(estSaved())} (~${Math.round((estSaved() / Math.max(1, totalPngBytes())) * 100)}%)`
        }
        icon={Icon.Wand}
        accessories={[{ text: keepOriginals ? "keep PNGs" : "delete PNGs" }]}
        actions={
          <ActionPanel>
            <Action title="Convert" icon={Icon.Wand} onAction={apply} />
            <Action
              title={keepOriginals ? "Switch to Delete Originals" : "Switch to Keep Originals"}
              icon={Icon.Checkmark}
              onAction={() => setKeep(keepOriginals ? "delete" : "keep")}
            />
          </ActionPanel>
        }
      />
      {pngs.map((p) => {
        const estJpg = est[p.path];
        const saving = estJpg != null ? p.size - estJpg : 0;
        return (
          <List.Item
            key={p.path}
            title={p.name}
            subtitle={p.path.replace(root, ".")}
            icon={Icon.Image}
            accessories={[
              { text: `${formatSize(p.size)} → ~${estJpg != null ? formatSize(estJpg) : "…"}` },
              { text: saving > 0 ? `−${formatSize(saving)}` : "" },
              selAccessory(selected.has(p.path)),
            ]}
            actions={
              <ActionPanel>
                <Action title={selected.has(p.path) ? "Deselect" : "Select"} icon={Icon.Checkmark} onAction={() => toggle(p.path)} />
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
  return <ScopePicker title="Convert" icon={Icon.Image} onPick={(scope, root) => push(<ConvertView root={resolveScope(scope)} />)} />;
}

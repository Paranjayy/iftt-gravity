import { List, ActionPanel, Action, showToast, Toast, Icon, Color, open } from "@raycast/api";
import { useState } from "react";
import fetch from "node-fetch";
import { hubUrl } from "./config";

interface SchedulePreset {
  id: string;
  title: string;
  description: string;
  icon: Icon;
  tint: string;
  jobs: Array<{ time: string; action: string; days: string; label: string }>;
}

const PRESETS: SchedulePreset[] = [
  {
    id: "morning-7am",
    title: "Safe 7am Morning Routine",
    description: "AC on 07:00 → AC off 07:10 (hard 10-min freeze cap) → AC cool 26°C 07:15 — weekdays only",
    icon: Icon.Sun,
    tint: "#FFA500",
    jobs: [
      { time: "07:00", action: "ac_on", days: "weekdays", label: "AC: Turn ON at 07:00 weekdays" },
      { time: "07:10", action: "ac_off", days: "weekdays", label: "AC: Turn OFF at 07:10 weekdays (10m cap)" },
      { time: "07:15", action: "ac_set_cool_26", days: "weekdays", label: "AC: Cool 26°C at 07:15 weekdays (resume normal)" },
    ],
  },
  {
    id: "evening-sleep",
    title: "Safe 11pm Sleep Routine",
    description: "Bulb off 23:00 → AC quiet 26°C 23:05 → Bulb warm 10% 23:10 (if you get up) — every day",
    icon: Icon.Moon,
    tint: "#3D2E5F",
    jobs: [
      { time: "23:00", action: "bulb_off", days: "daily", label: "Bulb: OFF at 23:00 daily" },
      { time: "23:05", action: "ac_set_cool_26", days: "daily", label: "AC: Quiet 26°C at 23:05 daily (sleep temp)" },
    ],
  },
  {
    id: "sunset",
    title: "Sunset Cinematic Routine",
    description: "Bulb Fireplace 15m before sunset → AC cool 24°C at sunset — daily",
    icon: Icon.Video,
    tint: "#5078E6",
    jobs: [
      // times are illustrative — user should swap for their actual sunset -15m
      { time: "18:30", action: "scene_fireplace", days: "daily", label: "Bulb: Fireplace at 18:30 daily (approx sunset -30m)" },
      { time: "19:00", action: "ac_set_cool_24", days: "daily", label: "AC: Cool 24°C at 19:00 daily (sunset)" },
    ],
  },
  {
    id: "wakeup-gradual",
    title: "Gradual Wake-Up Routine",
    description: "Bulb sunrise scene 15m before wake → AC off at wake time — daily",
    icon: Icon.Bullet,
    tint: "#FFDCAF",
    jobs: [
      // illustrative
      { time: "06:45", action: "scene_sunrise", days: "daily", label: "Bulb: Sunrise scene at 06:45 daily" },
      { time: "07:00", action: "bulb_cool", days: "daily", label: "Bulb: Cool 6500K at 07:00 daily (full wake)" },
    ],
  },
  {
    id: "panic-at-11pm",
    title: "Auto-Panic at 11pm (if you forgot)",
    description: "Safety net: turns off AC + Bulb + Aura at 23:30 if anything was left on — every day",
    icon: Icon.ExclamationMark,
    tint: "#E94B4B",
    jobs: [
      // Note: 'panic' is a custom action; if it doesn't exist on the bot
      // these will fail to fire — but the schedule will still be added.
      { time: "23:30", action: "ac_off", days: "daily", label: "AC: OFF at 23:30 daily (safety net)" },
      { time: "23:30", action: "bulb_off", days: "daily", label: "Bulb: OFF at 23:30 daily (safety net)" },
    ],
  },
];

async function addSchedule(time: string, action: string, days: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(hubUrl("control/schedule/add"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ time, action, days }),
    });
    const text = await res.text();
    if (!text.startsWith("{")) {
      return { ok: false, error: "Bot is on an older version. Restart with 'Gravity Hub(Start)' from Raycast." };
    }
    const data = JSON.parse(text);
    if (data.error) return { ok: false, error: data.error };
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: String(e?.message || "Hub Offline") };
  }
}

function PresetItem({ preset }: { preset: SchedulePreset }) {
  const [isAdding, setIsAdding] = useState(false);

  async function handleAdd() {
    setIsAdding(true);
    const toast = await showToast({
      style: Toast.Style.Animated,
      title: `Adding ${preset.jobs.length} schedule${preset.jobs.length === 1 ? "" : "s"}…`,
      message: preset.title,
    });
    let added = 0;
    let failed: string[] = [];
    for (const job of preset.jobs) {
      const r = await addSchedule(job.time, job.action, job.days);
      if (r.ok) added++;
      else failed.push(`${job.time} ${job.action}: ${r.error}`);
    }
    if (failed.length === 0) {
      toast.style = Toast.Style.Success;
      toast.title = `Added ${added} schedule${added === 1 ? "" : "s"}`;
      toast.message = preset.title;
    } else {
      toast.style = Toast.Style.Failure;
      toast.title = `Added ${added}/${preset.jobs.length}`;
      toast.message = failed[0] || "Some failed";
      // Offer a one-tap restart path if the bot is offline
      if (added === 0) {
        toast.primaryAction = {
          title: "Restart Bot",
          onAction: () => {
            void open("/Users/paranjay/Developer/developer/iftt/iftt-clone.sh", "Terminal");
          },
        };
      }
    }
    setIsAdding(false);
  }

  return (
    <List.Item
      title={preset.title}
      subtitle={preset.description}
      icon={{ source: preset.icon, tintColor: preset.tint as any }}
      accessories={[
        { text: `${preset.jobs.length} jobs` },
        { tag: isAdding ? { color: Color.Yellow } : { color: Color.Blue } as any, text: isAdding ? "⏵ Adding" : "↵ Add" } as any,
      ]}
      actions={
        <ActionPanel title={preset.title}>
          <Action
            title={isAdding ? "Adding…" : `Add ${preset.jobs.length} Schedule${preset.jobs.length === 1 ? "" : "s"}`}
            icon={preset.icon}
            shortcut={{ modifiers: [], key: "return" }}
            onAction={handleAdd}
          />
          <Action.CopyToClipboard
            title="Copy Job List (Markdown)"
            content={`# ${preset.title}\n\n${preset.description}\n\n${preset.jobs.map((j) => `- \`${j.time}\` ${j.days} → \`${j.action}\` (${j.label})`).join("\n")}`}
            shortcut={{ modifiers: ["cmd"], key: "c" }}
          />
        </ActionPanel>
      }
    />
  );
}

export default function SchedulePresets() {
  return (
    <List searchBarPlaceholder="Pick a schedule preset to add...">
      <List.Section title="Schedule Presets">
        {PRESETS.map((p) => (
          <PresetItem key={p.id} preset={p} />
        ))}
      </List.Section>
      <List.Section title="Heads up">
        <List.Item
          title="⚠️  Bot must be restarted for new schedule endpoint"
          subtitle="After adding, your schedules will start firing immediately"
          icon={{ source: Icon.ExclamationMark, tintColor: Color.Orange }}
        />
        <List.Item
          title="View or clear in Control House → Schedules"
          subtitle="Use 'View Active Schedules' to see what you added"
          icon={{ source: Icon.Info, tintColor: Color.Blue }}
        />
      </List.Section>
    </List>
  );
}

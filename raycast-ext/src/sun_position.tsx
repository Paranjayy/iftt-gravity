import { Detail, ActionPanel, Action, Icon, Color, Clipboard } from "@raycast/api";
import { useState, useEffect } from "react";
import fetch from "node-fetch";
import { hubUrl } from "./config";

interface SunInfo {
  sunrise: string;  // HH:MM (24h) in local time
  sunset: string;   // HH:MM (24h) in local time
  now: string;      // HH:MM
  isDay: boolean;
  minutesToSunrise: number;
  minutesToSunset: number;
}

function parseHHMM(s: string): { h: number; m: number } | null {
  if (!s || !/^\d{1,2}:\d{2}/.test(s)) return null;
  const [h, m] = s.split(":").map((n) => parseInt(n, 10));
  return { h, m };
}

function timeToMinutes(t: { h: number; m: number }): number {
  return t.h * 60 + t.m;
}

function diffMinutes(a: { h: number; m: number }, b: { h: number; m: number }): number {
  return timeToMinutes(b) - timeToMinutes(a);
}

function formatDuration(min: number): string {
  if (min < 0) min += 24 * 60;
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function computeSun(sunrise: string, sunset: string): SunInfo {
  const now = new Date();
  const nowHHMM = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  const nowT = { h: now.getHours(), m: now.getMinutes() };
  const sr = parseHHMM(sunrise);
  const ss = parseHHMM(sunset);
  const isDay = sr && ss ? (timeToMinutes(nowT) >= timeToMinutes(sr) && timeToMinutes(nowT) < timeToMinutes(ss)) : false;
  const minutesToSunrise = sr ? diffMinutes(nowT, sr) : -1;
  const minutesToSunset = ss ? diffMinutes(nowT, ss) : -1;
  return { sunrise, sunset, now: nowHHMM, isDay, minutesToSunrise, minutesToSunset };
}

export default function Command() {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  async function refresh() {
    setIsLoading(true);
    try {
      const ac = new AbortController();
      const t = setTimeout(() => ac.abort(), 4000);
      const res = await fetch(hubUrl("status"), { signal: ac.signal });
      clearTimeout(t);
      const json = await res.json();
      setData(json);
      setError(null);
    } catch (e) {
      setError("Hub Offline");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 30000);
    return () => clearInterval(t);
  }, []);

  const sunrise = data?.weather?.sunrise;
  const sunset = data?.weather?.sunset;
  const sun = sunrise && sunset ? computeSun(sunrise, sunset) : null;
  const phaseEmoji = sun?.isDay ? "☀️" : "🌙";
  const phaseLabel = sun?.isDay ? "Daytime" : "Nighttime";
  const nextEvent = sun && sun.minutesToSunrise > 0 && sun.minutesToSunrise < sun.minutesToSunset
    ? { name: "sunrise", mins: sun.minutesToSunrise, emoji: "🌅" }
    : sun ? { name: "sunset", mins: sun.minutesToSunset, emoji: "🌇" } : null;

  const markdown = error
    ? `# ❌ ${error}\n\nIs the Gravity Hub running?`
    : sun
    ? `# ${phaseEmoji} ${phaseLabel}

## ☀️ Today's Sun
- **Sunrise**: ${sun.sunrise} (${sun.minutesToSunrise > 0 ? `in ${formatDuration(sun.minutesToSunrise)}` : sun.minutesToSunrise === 0 ? "now" : "passed"})
- **Sunset**:  ${sun.sunset} (${sun.minutesToSunset > 0 ? `in ${formatDuration(sun.minutesToSunset)}` : sun.minutesToSunset === 0 ? "now" : "passed"})

## ⏱ Current
- **Time**:    ${sun.now} local
- **Phase**:   ${phaseEmoji} ${phaseLabel}
${nextEvent ? `- **Next**:    ${nextEvent.emoji} ${nextEvent.name} in ${formatDuration(nextEvent.mins)}` : ""}

---

## 💡 Suggestions
- Schedule *Sunset* scenes 5m **before** \`${sun.sunset}\` (cinematic warm-up)
- Schedule *Sunrise* scenes 5m **before** \`${sun.sunrise}\` (gradual wake)
- Best cool periods: 14:00–17:00 (heat-peak avoidance)
- Best focus periods: 09:00–11:00, 15:00–17:00 (cortisol peaks)

_Refresh: ⌘R · Auto-refresh every 30s_`
    : `# ☀️ Sun Position\n\nWaiting for sun data from the hub…`;

  const copy = sun
    ? `☀️ Sun: rise ${sun.sunrise} · set ${sun.sunset} · now ${sun.now} (${phaseLabel})`
    : "Hub Offline";

  return (
    <Detail
      isLoading={isLoading}
      markdown={markdown}
      actions={
        <ActionPanel title="Sun Position">
          <Action icon={Icon.Repeat} title="Force Refresh" shortcut={{ modifiers: ["cmd"], key: "r" }} onAction={refresh} />
          <Action.CopyToClipboard title="Copy Sun Summary" content={copy} shortcut={{ modifiers: ["cmd"], key: "c" }} />
          {sun ? (
            <>
              <Action.CopyToClipboard
                title="Copy as Schedule Time (sunrise -5m)"
                content={sun.sunrise}
                shortcut={{ modifiers: ["cmd", "shift"], key: "c" }}
              />
              <Action.CopyToClipboard
                title="Copy as Schedule Time (sunset -5m)"
                content={sun.sunset}
                shortcut={{ modifiers: ["cmd", "alt"], key: "c" }}
              />
            </>
          ) : null}
        </ActionPanel>
      }
    />
  );
}

import { List, Icon, Color } from "@raycast/api";
import { useState, useEffect } from "react";
import fetch from "node-fetch";

export default function Command() {
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchCortex() {
      try {
        const response = await fetch("http://localhost:3030/status");
        const json = await response.json();
        setData(json);
      } catch (e) {
        console.error(e);
      } finally {
        setIsLoading(false);
      }
    }
    fetchCortex();
  }, []);

  return (
    <List isLoading={isLoading} searchBarPlaceholder="Filter active background tasks...">
      <List.Section title="🛡️ Active Safety Protocols">
        <List.Item
          title="Auto-Saver Protection"
          subtitle="2.5h Absence Shutdown"
          icon={{ source: Icon.ShieldCheck, color: Color.Green }}
          accessories={[{ text: data?.online ? "Waiting" : "Active" }]}
        />
        <List.Item
          title="Sentry Idle Detection"
          subtitle="30m Workstation Monitor"
          icon={{ source: Icon.Eye, color: Color.Orange }}
        />
      </List.Section>

      <List.Section title="🧠 Context Awareness">
        <List.Item
          title="Media Aura"
          subtitle="Spotify-Light Sync"
          icon={{ source: Icon.Music, color: data?.mediaAura ? Color.Purple : Color.SecondaryText }}
          accessories={[{ text: data?.mediaAura ? "Engaged" : "Paused" }]}
        />
        <List.Item
          title="Battery Guardian"
          subtitle="Redline Power Protection"
          icon={{ source: Icon.LevelMeter, color: data?.battery?.isPlugged ? Color.Green : Color.Yellow }}
          accessories={[{ text: data?.battery?.level ? `${data.battery.level}%` : "100%" }]}
        />
      </List.Section>
    </List>
  );
}

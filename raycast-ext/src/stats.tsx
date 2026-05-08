import { Detail, Icon, Color } from "@raycast/api";
import { useState, useEffect } from "react";
import fetch from "node-fetch";

export default function Command() {
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
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
    fetchStats();
  }, []);

  const markdown = data ? `
# 🌌 Gravity Hub Dashboard

### ❄️ Climate
- **AC Status**: ${data.stats.ac?.status?.toUpperCase() || 'OFF'}
- **Current Load**: ${data.stats.acMinutes || 0} mins
- **Billing Units**: ${data.units || 0} kWh

### 💡 Illumination
- **Lights**: ${data.stats.light?.status?.toUpperCase() || 'OFF'}
- **Session Duration**: ${data.stats.lightMinutes || 0} mins

### ⚙️ System Health
- **Uptime**: ${Math.floor(data.uptime / 3600)}h ${Math.floor((data.uptime % 3600) / 60)}m
- **Spotify**: ${data.spotify || 'Idle'}
- **Network**: ${data.jitter ? (data.jitter > 150 ? '⚠️ Jittery' : '✅ Stable') : 'Unknown'}
` : "# ❌ Hub Offline";

  return (
    <Detail
      isLoading={isLoading}
      markdown={markdown}
      metadata={
        data && (
          <Detail.Metadata>
            <Detail.Metadata.Label title="Platform" icon={Icon.Computer} text={data.platform} />
            <Detail.Metadata.Label title="Network Jitter" icon={Icon.Globe} text={`${data.jitter?.toFixed(0) || 0}ms`} />
            <Detail.Metadata.TagList title="Power Status">
              <Detail.Metadata.TagList.Item 
                 text={data.battery?.isPlugged ? "Multi-Source" : "Battery"} 
                 color={data.battery?.isPlugged ? Color.Green : Color.Yellow} 
              />
            </Detail.Metadata.TagList>
          </Detail.Metadata>
        )
      }
    />
  );
}

import { List, ActionPanel, Action, Icon, showToast, Toast, Clipboard, Detail, useNavigation, LocalStorage } from "@raycast/api";
import { useState, useEffect } from "react";
import fetch from "node-fetch";

interface Conversion {
  id: string;
  original: string;
  markdown: string;
  timestamp: string;
}

export default function Command() {
  const [conversions, setConversions] = useState<Conversion[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  async function loadHistory() {
    const stored = await LocalStorage.getItem<string>("conversion-history");
    if (stored) {
      setConversions(JSON.parse(stored));
    }
    setIsLoading(false);
  }

  async function saveHistory(newHistory: Conversion[]) {
    await LocalStorage.setItem("conversion-history", JSON.stringify(newHistory));
  }

  async function handleConvertClipboard() {
    const text = await Clipboard.readText();
    if (!text) {
      showToast({ title: "Clipboard Empty", style: Toast.Style.Failure });
      return;
    }

    showToast({ title: "Fetching Intelligence...", style: Toast.Style.Animated });
    try {
      const response = await fetch(`http://localhost:3031/archive/convert/md?url=${encodeURIComponent(text)}`);
      const markdown = await response.text();
      
      const newConversion: Conversion = {
        id: Date.now().toString(),
        original: text,
        markdown,
        timestamp: new Date().toISOString()
      };
      
      const updatedHistory = [newConversion, ...conversions].slice(0, 50);
      setConversions(updatedHistory);
      await saveHistory(updatedHistory);
      
      await Clipboard.copy(markdown);
      showToast({ title: "Converted & Copied", style: Toast.Style.Success });
    } catch (e) {
      showToast({ title: "Conversion Failed", style: Toast.Style.Failure });
    }
  }

  async function clearHistory() {
    setConversions([]);
    await LocalStorage.removeItem("conversion-history");
    showToast({ title: "History Cleared" });
  }

  useEffect(() => {
    loadHistory();
  }, []);

  return (
    <List isLoading={isLoading} searchBarPlaceholder="Search conversion history...">
      <List.Item
        title="Convert Clipboard Content"
        subtitle="Extract all links and generate Bulleted List"
        icon={Icon.Link}
        actions={
          <ActionPanel>
            <Action title="Convert & Copy" onAction={handleConvertClipboard} icon={Icon.Checkmark} />
            <Action title="Clear History" onAction={clearHistory} icon={Icon.Trash} style={Action.Style.Destructive} />
          </ActionPanel>
        }
      />
      
      <List.Section title="Intelligence History">
        {conversions.map(c => (
          <List.Item
            key={c.id}
            title={c.markdown.split('\n')[0].substring(0, 100)}
            subtitle={new Date(c.timestamp).toLocaleTimeString()}
            actions={
              <ActionPanel>
                <Action.CopyToClipboard title="Copy Markdown" content={c.markdown} />
                <Action.Push title="Preview Result" target={<Detail markdown={c.markdown} />} />
                <Action title="Delete Entry" onAction={async () => {
                  const updated = conversions.filter(item => item.id !== c.id);
                  setConversions(updated);
                  await saveHistory(updated);
                }} icon={Icon.Trash} style={Action.Style.Destructive} />
              </ActionPanel>
            }
          />
        ))}
      </List.Section>
    </List>
  );
}

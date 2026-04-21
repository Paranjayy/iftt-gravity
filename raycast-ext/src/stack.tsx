import { List, ActionPanel, Action, Icon, Color, showToast, Toast } from "@raycast/api";
import { useState, useEffect } from "react";
import fetch from "node-fetch";

interface StackItem {
  id: string;
  text: string;
  timestamp: string;
  label?: string;
  meta?: {
    type: string;
  };
}

export default function Command() {
  const [items, setItems] = useState<StackItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  async function fetchStack() {
    setIsLoading(true);
    try {
      const response = await fetch("http://localhost:3030/archive/stack/list");
      const data: any = await response.json();
      setItems(data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    fetchStack();
  }, []);

  async function clearStack() {
    await fetch("http://localhost:3030/archive/stack/clear");
    fetchStack();
    showToast({ title: "Stack Cleared", style: Toast.Style.Success });
  }

  return (
    <List isLoading={isLoading} searchBarPlaceholder="Manage your paste sequence...">
      {items.length === 0 ? (
        <List.EmptyView title="Stack is Empty" description="Add clips using 'Add to Paste Stack' (Cmd+S) in the Archive." icon={Icon.Layers} />
      ) : (
        <List.Section title="Paste Sequence (Iron Stack)">
          {items.map((item, index) => (
            <List.Item
              key={`${item.id}-${index}`}
              icon={{ source: Icon.Layers, color: Color.Blue }}
              title={item.label || item.text.trim().split('\n')[0].substring(0, 50)}
              subtitle={`#${index + 1}`}
              actions={
                <ActionPanel>
                  <Action.CopyToClipboard title="Paste and Pop" content={item.text} />
                  <Action 
                    title="Clear Full Stack" 
                    icon={Icon.Trash} 
                    style={Action.Style.Destructive}
                    onAction={clearStack} 
                    shortcut={{ modifiers: ["cmd", "shift"], key: "x" }}
                  />
                </ActionPanel>
              }
            />
          ))}
        </List.Section>
      )}
    </List>
  );
}

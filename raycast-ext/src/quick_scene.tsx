import { List, ActionPanel, Action, showToast, Toast, Icon, Color } from "@raycast/api";
import { useState } from "react";
import fetch from "node-fetch";
import { hubUrl } from "./config";

interface Scene {
  name: string;
  key: string;
  description: string;
  icon: Icon;
  category: "home" | "focus" | "mood" | "entertainment" | "ambient";
}

const SCENES: Scene[] = [
  { name: "TV",        key: "tv",       description: "Dim bias light + AC cool 24°C",                icon: Icon.Video,       category: "entertainment" },
  { name: "Focus",     key: "focus",    description: "Crisp daylight white for work",                  icon: Icon.Eye,         category: "focus" },
  { name: "Cozy",      key: "cozy",     description: "Soft warm white, perfect for reading",           icon: Icon.Book,        category: "mood" },
  { name: "Romance",   key: "romance",  description: "Dim warm red, intimate lighting",               icon: Icon.Heart,       category: "mood" },
  { name: "Party",     key: "party",    description: "Energetic RGB cycle",                           icon: Icon.Star,        category: "entertainment" },
  { name: "Fireplace", key: "fireplace",description: "Flickering orange, fireside vibe",              icon: Icon.LightBulb,   category: "ambient" },
  { name: "Ocean",     key: "ocean",    description: "Calm blue waves, sleep-friendly",               icon: Icon.BarChart,    category: "ambient" },
  { name: "Pastel",    key: "pastel",   description: "Multi-color soft, gentle playful",              icon: Icon.Circle,      category: "mood" },
  { name: "Bedtime",   key: "bedtime",  description: "Fading to dark, melatonin-friendly",            icon: Icon.Moon,        category: "ambient" },
  { name: "Sunrise",   key: "sunrise",  description: "Gradual warm-up, wake-up alarm",                icon: Icon.Sun,         category: "home" },
  { name: "Relax",     key: "relax",    description: "Dimmed warm, evening wind-down",                icon: Icon.Circle,      category: "ambient" },
  { name: "Warm White",key: "warm",     description: "Cozy incandescent, classic reading light",      icon: Icon.Sun,         category: "home" },
  { name: "Cool White",key: "cool",     description: "Crisp daylight white, task lighting",           icon: Icon.Snowflake,   category: "focus" },
];

export default function Command() {
  const [filter, setFilter] = useState<string>("all");
  const [isExecuting, setIsExecuting] = useState<string | null>(null);

  async function fireScene(scene: Scene) {
    setIsExecuting(scene.key);
    const toast = await showToast({
      style: Toast.Style.Animated,
      title: `Activating: ${scene.name}`,
    });
    try {
      const res = await fetch(hubUrl(`scene/${scene.key}`));
      if (!res.ok) throw new Error("Failed");
      toast.style = Toast.Style.Success;
      toast.title = `Scene Active: ${scene.name}`;
      toast.message = scene.description;
    } catch (e) {
      toast.style = Toast.Style.Failure;
      toast.title = "Activation Failed";
      toast.message = "Hub Offline — is gravity-hub running?";
    } finally {
      setIsExecuting(null);
    }
  }

  const filtered = filter === "all" ? SCENES : SCENES.filter((s) => s.category === filter);

  return (
    <List
      searchBarPlaceholder="Find a scene to activate instantly..."
      searchBarAccessory={
        <List.Dropdown tooltip="Category Filter" onChange={setFilter} storeValue>
          <List.Dropdown.Item title="All Scenes" value="all" icon={Icon.List} />
          <List.Dropdown.Item title="Home" value="home" icon={Icon.House} />
          <List.Dropdown.Item title="Focus" value="focus" icon={Icon.Eye} />
          <List.Dropdown.Item title="Mood" value="mood" icon={Icon.Heart} />
          <List.Dropdown.Item title="Entertainment" value="entertainment" icon={Icon.Video} />
          <List.Dropdown.Item title="Ambient" value="ambient" icon={Icon.Moon} />
        </List.Dropdown>
      }
    >
      {(["home", "focus", "mood", "entertainment", "ambient"] as const).map((cat) => {
        const inCat = SCENES.filter((s) => s.category === cat);
        if (inCat.length === 0 || (filter !== "all" && filter !== cat)) return null;
        return (
          <List.Section
            key={cat}
            title={cat.charAt(0).toUpperCase() + cat.slice(1)}
            subtitle={`${inCat.length} scene${inCat.length === 1 ? "" : "s"}`}
          >
            {inCat.map((scene) => (
              <List.Item
                key={scene.key}
                title={scene.name}
                subtitle={scene.description}
                icon={{ source: scene.icon, tintColor: isExecuting === scene.key ? Color.Yellow : Color.Blue }}
                accessories={isExecuting === scene.key ? [{ text: "⏵ Firing" }] : [{ tag: { color: Color.Blue } as any, text: "↵ Fire" } as any]}
                actions={
                  <ActionPanel title={scene.name}>
                    <Action
                      title={`Fire ${scene.name}`}
                      icon={scene.icon}
                      shortcut={{ modifiers: [], key: "return" }}
                      onAction={() => fireScene(scene)}
                    />
                    <Action.CopyToClipboard
                      title="Copy Scene Command"
                      content={`/scene ${scene.key}`}
                      shortcut={{ modifiers: ["cmd"], key: "c" }}
                    />
                  </ActionPanel>
                }
              />
            ))}
          </List.Section>
        );
      })}
    </List>
  );
}

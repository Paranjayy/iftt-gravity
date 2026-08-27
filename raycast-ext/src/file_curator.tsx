import { List, ActionPanel, Action, Icon, useNavigation } from "@raycast/api";
import PngToJpg from "./png_to_jpg";
import Flatten from "./flatten";
import DevPurge from "./dev_purge";
import Dedup from "./dedup";
import RepoBackup from "./repo_backup";
import ScreenshotFix from "./screenshot_fix";
import DesktopWeek from "./desktop_week";

const TOOLS: { title: string; subtitle: string; icon: any; C: () => JSX.Element }[] = [
  { title: "PNG → JPG", subtitle: "Shrink screenshots & images, keep folder structure", icon: Icon.Image, C: PngToJpg },
  { title: "Flatten / Categorize", subtitle: "Reorganize files by ext, type, date, or week", icon: Icon.Folder, C: Flatten },
  { title: "Dev Purge", subtitle: "Trash-safe cleanup of node_modules, dist, .next…", icon: Icon.Trash, C: DevPurge },
  { title: "Dedupe Files", subtitle: "Find duplicates, trash redundant copies", icon: Icon.Copy, C: Dedup },
  { title: "Repo Backup", subtitle: "Back up every local git repo to GitHub", icon: Icon.Cloud, C: RepoBackup },
  { title: "Desktop Week Sort", subtitle: "Sort Desktop files into YYYY-Www folders", icon: Icon.Calendar, C: DesktopWeek },
  { title: "Screenshot Fixer", subtitle: "JPG captures, no shadows, shrink PNGs", icon: Icon.Wand, C: ScreenshotFix },
];

export default function Command() {
  const { push } = useNavigation();
  return (
    <List>
      <List.Section title="File Tools">
        {TOOLS.map((t) => (
          <List.Item
            key={t.title}
            title={t.title}
            subtitle={t.subtitle}
            icon={t.icon}
            actions={
              <ActionPanel>
                <Action title="Open" icon={Icon.ArrowRight} onAction={() => push(<t.C />)} />
              </ActionPanel>
            }
          />
        ))}
      </List.Section>
    </List>
  );
}

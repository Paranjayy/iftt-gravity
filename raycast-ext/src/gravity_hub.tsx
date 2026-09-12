import { List, ActionPanel, Action, Icon, useNavigation } from "@raycast/api";

// File Tools
import PngToJpg from "./png_to_jpg";
import Flatten from "./flatten";
import DevPurge from "./dev_purge";
import Dedup from "./dedup";
import RepoBackup from "./repo_backup";
import ScreenshotFix from "./screenshot_fix";
import DesktopWeek from "./desktop_week";
import CurateDesktop from "./curate_desktop";
import ClipboardBackup from "./clipboard_backup";
import OrganizeRepos from "./organize_repos";

// Smart Home
import SmartThings from "./smartthings";
import Control from "./control";
import HubPulse from "./hub_pulse";
import MoodPresets from "./mood_presets";
import QuickScene from "./quick_scene";
import SchedulePresets from "./schedule_presets";
import SunPosition from "./sun_position";
import Stats from "./stats";
import Logs from "./logs";
import RecentActivity from "./recent_activity";

// Utility
import Archive from "./archive";
import ClipboardVault from "./clipboard_vault";
import Prompts from "./prompts";
import ConvertLink from "./convert_link";
import SocialStats from "./social_stats";
import Notes from "./notes";
import QuickStats from "./quick_stats";

interface Cmd {
  title: string;
  subtitle: string;
  icon: any;
  section: string;
  keywords: string[];
  C: () => JSX.Element;
}

const COMMANDS: Cmd[] = [
  // File Tools
  { title: "PNG → JPG", subtitle: "Shrink screenshots & images, keep folder structure", icon: Icon.Image, section: "File Tools", keywords: ["png", "jpg", "image", "convert", "shrink"], C: PngToJpg },
  { title: "Flatten / Categorize", subtitle: "Reorganize files into folders by ext, type, date, day, or week", icon: Icon.Folder, section: "File Tools", keywords: ["flatten", "categorize", "sort", "organize", "folder", "ext", "date", "week"], C: Flatten },
  { title: "Dev Purge", subtitle: "Trash-safe cleanup of node_modules, dist, .next, build…", icon: Icon.Trash, section: "File Tools", keywords: ["dev", "purge", "cleanup", "node_modules", "dist", "cache"], C: DevPurge },
  { title: "Dedupe Files", subtitle: "Find duplicate files and trash redundant copies", icon: Icon.Copy, section: "File Tools", keywords: ["dedupe", "duplicate", "copy", "clone"], C: Dedup },
  { title: "Repo Backup", subtitle: "Back up every local git repo to GitHub", icon: Icon.Cloud, section: "File Tools", keywords: ["repo", "backup", "git", "github"], C: RepoBackup },
  { title: "Desktop Week Sort", subtitle: "Sort Desktop files into YYYY-Www week folders", icon: Icon.Calendar, section: "File Tools", keywords: ["desktop", "week", "sort", "organize"], C: DesktopWeek },
  { title: "Curate Desktop", subtitle: "Group screenshots by year/month/week/day without the hub", icon: Icon.Tray, section: "File Tools", keywords: ["desktop", "curate", "screenshot", "year", "month", "week", "day"], C: CurateDesktop },
  { title: "Screenshot Fixer", subtitle: "JPG captures, no shadows, shrink existing PNGs", icon: Icon.Wand, section: "File Tools", keywords: ["screenshot", "fix", "shadow", "jpg", "png"], C: ScreenshotFix },
  { title: "Clipboard Export", subtitle: "Export entire clipboard history — text-only, metadata, Markdown or JSON", icon: Icon.SaveDocument, section: "File Tools", keywords: ["clipboard", "backup", "export", "history"], C: ClipboardBackup },
  { title: "Organize Repos", subtitle: "Scan ~/Developer, categorize by GitHub/activity status", icon: Icon.List, section: "File Tools", keywords: ["organize", "repos", "developer", "github"], C: OrganizeRepos },

  // Smart Home
  { title: "SmartThings", subtitle: "Browse devices, scenes, and location modes", icon: Icon.House, section: "Smart Home", keywords: ["smartthings", "devices", "scenes"], C: SmartThings },
  { title: "Control House", subtitle: "Manage AC, Lights, and Scenes", icon: Icon.Switch, section: "Smart Home", keywords: ["control", "ac", "lights", "scenes", "house"], C: Control },
  { title: "Hub Pulse", subtitle: "All-in-one dashboard: AC, Bulb, SmartThings, Solis, Energy", icon: Icon.Heartbeat, section: "Smart Home", keywords: ["hub", "pulse", "dashboard", "energy"], C: HubPulse },
  { title: "Mood Presets", subtitle: "One-tap multi-step scene combos (Movie, Focus, Dinner, Bedtime…)", icon: Icon.Star, section: "Smart Home", keywords: ["mood", "preset", "movie", "focus", "dinner", "bedtime"], C: MoodPresets },
  { title: "Quick Scene", subtitle: "Activate any Gravity scene with one search", icon: Icon.Bolt, section: "Smart Home", keywords: ["quick", "scene", "activate"], C: QuickScene },
  { title: "Schedule Presets", subtitle: "One-tap add common routines (7am safety, 11pm sleep, sunset…)", icon: Icon.Clock, section: "Smart Home", keywords: ["schedule", "preset", "routine", "timer"], C: SchedulePresets },
  { title: "Sun Position", subtitle: "Sunrise/sunset countdown, current phase, schedule suggestions", icon: Icon.Sun, section: "Smart Home", keywords: ["sun", "sunrise", "sunset", "position"], C: SunPosition },
  { title: "Hub Dashboard", subtitle: "Real-time energy and system health", icon: Icon.BarChart, section: "Smart Home", keywords: ["hub", "dashboard", "energy", "health", "stats"], C: Stats },
  { title: "View Logs", subtitle: "See the latest house activity", icon: Icon.Text, section: "Smart Home", keywords: ["logs", "activity", "house"], C: Logs },
  { title: "Recent Hub Activity", subtitle: "Tail the last 20 entries from house_log.md", icon: Icon.History, section: "Smart Home", keywords: ["recent", "activity", "log", "tail"], C: RecentActivity },

  // Utility
  { title: "Clipboard Vault (Transcript)", subtitle: "Search locally curated Raycast clipboard transcripts and URLs", icon: Icon.Archive, section: "Utility", keywords: ["clipboard", "vault", "search", "transcript", "url"], C: ClipboardVault },
  { title: "Clipboard Archive", subtitle: "Infinite history of your copies and cuts", icon: Icon.Clock, section: "Utility", keywords: ["clipboard", "archive", "history", "copy", "cut"], C: Archive },
  { title: "Prompt Library", subtitle: "Store, search, and use reusable AI prompts", icon: Icon.Wand, section: "Utility", keywords: ["prompt", "library", "ai", "template"], C: Prompts },
  { title: "URL → Markdown", subtitle: "Convert URLs to markdown links with smart title extraction", icon: Icon.Link, section: "Utility", keywords: ["url", "markdown", "convert", "link"], C: ConvertLink },
  { title: "Social Stats", subtitle: "Fetch rich metadata for any URL — YouTube, GitHub, Reddit…", icon: Icon.Globe, section: "Utility", keywords: ["social", "stats", "youtube", "github", "reddit"], C: SocialStats },
  { title: "Gravity Notes", subtitle: "Mission Control for Notes and Universal File Probe", icon: Icon.Document, section: "Utility", keywords: ["notes", "gravity", "file", "probe"], C: Notes },
  { title: "Quick Stats", subtitle: "Disk usage breakdown with folder sizes and cleanup shortcuts", icon: Icon.BarChart, section: "Utility", keywords: ["stats", "disk", "usage", "space", "storage"], C: QuickStats },
];

const SECTION_ORDER = ["File Tools", "Smart Home", "Utility"];
const SECTION_ICONS: Record<string, any> = {
  "File Tools": Icon.Folder,
  "Smart Home": Icon.House,
  "Utility": Icon.Gear,
};

export default function GravityHub() {
  const { push } = useNavigation();
  const pinned = COMMANDS.filter((c) => ["PNG → JPG", "Flatten / Categorize", "Dev Purge", "Dedupe Files"].includes(c.title));

  return (
    <List searchBarPlaceholder="Search all HomePulse commands (Consolidated)…" throttle>
      <List.Section title="Quick Actions">
        {pinned.map((cmd) => (
          <List.Item
            key={cmd.title}
            title={cmd.title}
            subtitle={cmd.subtitle}
            icon={cmd.icon}
            keywords={[...cmd.keywords, "pinned", "quick"]}
            actions={
              <ActionPanel>
                <Action title="Open" icon={Icon.ArrowRight} onAction={() => push(<cmd.C />)} />
              </ActionPanel>
            }
          />
        ))}
      </List.Section>
      {SECTION_ORDER.map((section) => {
        const cmds = COMMANDS.filter((c) => c.section === section);
        if (cmds.length === 0) return null;
        return (
          <List.Section key={section} title={section}>
            {cmds.map((cmd) => (
              <List.Item
                key={cmd.title}
                title={cmd.title}
                subtitle={cmd.subtitle}
                icon={cmd.icon}
                keywords={cmd.keywords}
                actions={
                  <ActionPanel>
                    <Action title="Open" icon={Icon.ArrowRight} onAction={() => push(<cmd.C />)} />
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

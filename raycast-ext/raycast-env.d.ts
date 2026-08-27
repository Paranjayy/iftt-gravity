/// <reference types="@raycast/api">

/* 🚧 🚧 🚧
 * This file is auto-generated from the extension's manifest.
 * Do not modify manually. Instead, update the `package.json` file.
 * 🚧 🚧 🚧 */

/* eslint-disable @typescript-eslint/ban-types */

type ExtensionPreferences = {
  /** SmartThings PAT - Personal access token for SmartThings linking */
  "smartThingsPat"?: string,
  /** SmartThings Location ID - Optional location ID UUID for SmartThings */
  "smartThingsLocationId"?: string
}

/** Preferences accessible in all the extension's commands */
declare type Preferences = ExtensionPreferences

declare namespace Preferences {
  /** Preferences accessible in the `smartthings` command */
  export type Smartthings = ExtensionPreferences & {}
  /** Preferences accessible in the `control` command */
  export type Control = ExtensionPreferences & {}
  /** Preferences accessible in the `logs` command */
  export type Logs = ExtensionPreferences & {}
  /** Preferences accessible in the `archive` command */
  export type Archive = ExtensionPreferences & {}
  /** Preferences accessible in the `stats` command */
  export type Stats = ExtensionPreferences & {}
  /** Preferences accessible in the `notes` command */
  export type Notes = ExtensionPreferences & {}
  /** Preferences accessible in the `aura_toggle` command */
  export type AuraToggle = ExtensionPreferences & {}
  /** Preferences accessible in the `quick_scene` command */
  export type QuickScene = ExtensionPreferences & {}
  /** Preferences accessible in the `hub_pulse` command */
  export type HubPulse = ExtensionPreferences & {}
  /** Preferences accessible in the `mood_presets` command */
  export type MoodPresets = ExtensionPreferences & {}
  /** Preferences accessible in the `recent_activity` command */
  export type RecentActivity = ExtensionPreferences & {}
  /** Preferences accessible in the `hub_diagnostic` command */
  export type HubDiagnostic = ExtensionPreferences & {}
  /** Preferences accessible in the `sun_position` command */
  export type SunPosition = ExtensionPreferences & {}
  /** Preferences accessible in the `schedule_presets` command */
  export type SchedulePresets = ExtensionPreferences & {}
  /** Preferences accessible in the `prompts` command */
  export type Prompts = ExtensionPreferences & {}
  /** Preferences accessible in the `convert_link` command */
  export type ConvertLink = ExtensionPreferences & {}
  /** Preferences accessible in the `social_stats` command */
  export type SocialStats = ExtensionPreferences & {}
  /** Preferences accessible in the `clipboard_vault` command */
  export type ClipboardVault = ExtensionPreferences & {}
  /** Preferences accessible in the `png_to_jpg` command */
  export type PngToJpg = ExtensionPreferences & {}
  /** Preferences accessible in the `flatten` command */
  export type Flatten = ExtensionPreferences & {}
  /** Preferences accessible in the `dev_purge` command */
  export type DevPurge = ExtensionPreferences & {}
  /** Preferences accessible in the `dedup` command */
  export type Dedup = ExtensionPreferences & {}
  /** Preferences accessible in the `repo_backup` command */
  export type RepoBackup = ExtensionPreferences & {}
  /** Preferences accessible in the `desktop_week` command */
  export type DesktopWeek = ExtensionPreferences & {}
  /** Preferences accessible in the `screenshot_fix` command */
  export type ScreenshotFix = ExtensionPreferences & {}
  /** Preferences accessible in the `file_curator` command */
  export type FileCurator = ExtensionPreferences & {}
  /** Preferences accessible in the `clipboard_backup` command */
  export type ClipboardBackup = ExtensionPreferences & {}
}

declare namespace Arguments {
  /** Arguments passed to the `smartthings` command */
  export type Smartthings = {}
  /** Arguments passed to the `control` command */
  export type Control = {}
  /** Arguments passed to the `logs` command */
  export type Logs = {}
  /** Arguments passed to the `archive` command */
  export type Archive = {}
  /** Arguments passed to the `stats` command */
  export type Stats = {}
  /** Arguments passed to the `notes` command */
  export type Notes = {}
  /** Arguments passed to the `aura_toggle` command */
  export type AuraToggle = {}
  /** Arguments passed to the `quick_scene` command */
  export type QuickScene = {}
  /** Arguments passed to the `hub_pulse` command */
  export type HubPulse = {}
  /** Arguments passed to the `mood_presets` command */
  export type MoodPresets = {}
  /** Arguments passed to the `recent_activity` command */
  export type RecentActivity = {}
  /** Arguments passed to the `hub_diagnostic` command */
  export type HubDiagnostic = {}
  /** Arguments passed to the `sun_position` command */
  export type SunPosition = {}
  /** Arguments passed to the `schedule_presets` command */
  export type SchedulePresets = {}
  /** Arguments passed to the `prompts` command */
  export type Prompts = {}
  /** Arguments passed to the `convert_link` command */
  export type ConvertLink = {}
  /** Arguments passed to the `social_stats` command */
  export type SocialStats = {}
  /** Arguments passed to the `clipboard_vault` command */
  export type ClipboardVault = {}
  /** Arguments passed to the `png_to_jpg` command */
  export type PngToJpg = {}
  /** Arguments passed to the `flatten` command */
  export type Flatten = {}
  /** Arguments passed to the `dev_purge` command */
  export type DevPurge = {}
  /** Arguments passed to the `dedup` command */
  export type Dedup = {}
  /** Arguments passed to the `repo_backup` command */
  export type RepoBackup = {}
  /** Arguments passed to the `desktop_week` command */
  export type DesktopWeek = {}
  /** Arguments passed to the `screenshot_fix` command */
  export type ScreenshotFix = {}
  /** Arguments passed to the `file_curator` command */
  export type FileCurator = {}
  /** Arguments passed to the `clipboard_backup` command */
  export type ClipboardBackup = {}
}


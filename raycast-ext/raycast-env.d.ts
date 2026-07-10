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
}


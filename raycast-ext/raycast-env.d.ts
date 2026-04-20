/// <reference types="@raycast/api">

/* 🚧 🚧 🚧
 * This file is auto-generated from the extension's manifest.
 * Do not modify manually. Instead, update the `package.json` file.
 * 🚧 🚧 🚧 */

/* eslint-disable @typescript-eslint/ban-types */

type ExtensionPreferences = {}

/** Preferences accessible in all the extension's commands */
declare type Preferences = ExtensionPreferences

declare namespace Preferences {
  /** Preferences accessible in the `control` command */
  export type Control = ExtensionPreferences & {}
  /** Preferences accessible in the `logs` command */
  export type Logs = ExtensionPreferences & {}
  /** Preferences accessible in the `archive` command */
  export type Archive = ExtensionPreferences & {}
}

declare namespace Arguments {
  /** Arguments passed to the `control` command */
  export type Control = {}
  /** Arguments passed to the `logs` command */
  export type Logs = {}
  /** Arguments passed to the `archive` command */
  export type Archive = {}
}


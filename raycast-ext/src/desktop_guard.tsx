import { showToast, Toast, showHUD } from "@raycast/api";
import { SCOPES, guardDesktop, DESKTOP_SCREENSHOT_BREAK } from "./fileops";

export default async function Command() {
  const r = await guardDesktop(SCOPES.desktop, {
    downloadsDir: SCOPES.downloads,
    grain: "week",
    force: false,
  });
  const moved = r.swept?.moved.length ?? 0;
  if (r.overBreak) {
    await showHUD(`Over ${DESKTOP_SCREENSHOT_BREAK} shots — swept ${moved}`);
  } else if (r.strays.length > 0) {
    await showHUD(`${r.strays.length} non-screenshot files left — warning MD written`);
  } else {
    await showToast({
      title: `Desktop quiet (${r.screenshots} screenshots, under break)`,
      style: Toast.Style.Success,
    });
  }
}

import { ActionPanel, Action, Icon, showToast, Toast, LocalStorage } from "@raycast/api";

export async function addToPasteStack(text: string, title?: string) {
  try {
    const raw = (await LocalStorage.getItem<string>("homepulse-paste-stack")) || "[]";
    const queue: Array<{ id: string; text: string; title: string }> = JSON.parse(raw);
    queue.push({
      id: String(Date.now()),
      text,
      title: title || text.slice(0, 40).replace(/\s+/g, " "),
    });
    await LocalStorage.setItem("homepulse-paste-stack", JSON.stringify(queue));
    await showToast({
      style: Toast.Style.Success,
      title: `Added to Paste Stack (${queue.length} items queued)`,
    });
  } catch (e) {
    await showToast({ style: Toast.Style.Failure, title: "Failed to queue item" });
  }
}

export async function popNextPasteStack() {
  try {
    const raw = (await LocalStorage.getItem<string>("homepulse-paste-stack")) || "[]";
    const queue: Array<{ id: string; text: string; title: string }> = JSON.parse(raw);
    if (!queue.length) {
      await showToast({ style: Toast.Style.Failure, title: "Paste Stack is empty" });
      return null;
    }
    const item = queue.shift()!;
    await LocalStorage.setItem("homepulse-paste-stack", JSON.stringify(queue));
    return { item, remaining: queue.length };
  } catch (e) {
    return null;
  }
}

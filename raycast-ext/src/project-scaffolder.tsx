import { Form, ActionPanel, Action, Icon, showToast, Toast, useNavigation } from "@raycast/api";
import fetch from "node-fetch";
import path from "path";

export default function Command() {
  const { pop } = useNavigation();

  async function handleSubmit(values: { name: string; path: string; template: string }) {
    const toast = await showToast({ title: "Scaffolding Project...", style: Toast.Style.Animated });
    try {
      const res = await fetch("http://localhost:3031/archive/project/scaffold", {
        method: "POST",
        body: JSON.stringify(values),
        headers: { "Content-Type": "application/json" }
      });
      if (res.ok) {
        toast.style = Toast.Style.Success;
        toast.title = "Environment Hardened";
        pop();
      } else {
        toast.style = Toast.Style.Failure;
        toast.title = "Scaffolding Failed";
      }
    } catch (e) {
      toast.style = Toast.Style.Failure;
      toast.title = "Hub Offline";
    }
  }

  return (
    <Form
      actions={
        <ActionPanel>
          <Action.SubmitForm title="Scaffold Project" icon={Icon.Hammer} onSubmit={handleSubmit} />
        </ActionPanel>
      }
    >
      <Form.TextField id="name" title="Project Name" placeholder="e.g. Gravity-Forge" autoFocus />
      <Form.TextField id="path" title="Root Directory" defaultValue={`${process.env.HOME}/Developer`} />
      <Form.Dropdown id="template" title="Vibe / Template">
        <List.Dropdown.Item title="Minimalist (README + Git)" value="minimal" icon={Icon.Leaf} />
        <List.Dropdown.Item title="TypeScript (Bun + Vite)" value="ts-vite" icon={Icon.Code} />
        <List.Dropdown.Item title="Python (Venv + Script)" value="python" icon={Icon.Terminal} />
        <List.Dropdown.Item title="Sovereign Vault (Markdown Structure)" value="vault" icon={Icon.Lock} />
      </Form.Dropdown>
    </Form>
  );
}

import { List } from "@raycast/api";

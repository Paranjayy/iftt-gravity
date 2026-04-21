import { Form, ActionPanel, Action, Icon, showToast, Toast, useNavigation } from "@raycast/api";
import fetch from "node-fetch";

export default function Command() {
  const { pop } = useNavigation();

  async function handleSubmit(values: { text: string }) {
    if (!values.text.trim()) return;
    
    try {
      // Archive it as a 'Jot' with auto-labeling triggering on the backend
      await fetch("http://localhost:3031/archive/jot", {
        method: "POST",
        body: JSON.stringify({ text: values.text }),
        headers: { "Content-Type": "application/json" }
      });
      
      showToast({ title: "Jot Saved to Vault", style: Toast.Style.Success });
      pop();
    } catch (e) {
      showToast({ title: "Hub Offline", style: Toast.Style.Failure });
    }
  }

  return (
    <Form
      actions={
        <ActionPanel>
          <Action.SubmitForm title="Seal in Vault" onSubmit={handleSubmit} icon={Icon.Check} />
          <Action.OpenInBrowser title="Open Local Archive" url="raycast://extensions/paranjay/gravity-hub/archive" />
        </ActionPanel>
      }
    >
      <Form.TextArea 
        id="text" 
        title="Distraction-Free Jot" 
        placeholder="Type your thoughts, code, or ideas... (Cmd+Enter to Save)" 
        enableMarkdown 
        autoFocus
      />
    </Form>
  );
}

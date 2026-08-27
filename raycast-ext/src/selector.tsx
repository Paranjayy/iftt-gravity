import { useState, useCallback } from "react";

export function useSelection() {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const toggle = useCallback((key: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);
  const selectAll = useCallback((keys: string[]) => setSelected(new Set(keys)), []);
  const clear = useCallback(() => setSelected(new Set()), []);
  return { selected, toggle, selectAll, clear, count: selected.size };
}

export function selAccessory(isSelected: boolean) {
  return isSelected ? { text: "✓", color: "green" as const } : { text: "" };
}

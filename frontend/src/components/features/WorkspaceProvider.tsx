"use client";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { initialData } from "@/lib/mock-data/workspace";
import { WorkspaceData } from "@/lib/types";
import { CheckCircle2, X } from "lucide-react";
type Collection = Exclude<keyof WorkspaceData, "land" | "profile">;
type RecordFor<K extends Collection> = WorkspaceData[K][number];
interface WorkspaceContext {
  data: WorkspaceData;
  save: <K extends Collection>(collection: K, record: RecordFor<K>) => void;
  remove: (collection: Collection, id: string) => void;
  update: (values: Partial<WorkspaceData>) => void;
  notify: (message: string) => void;
}
const Context = createContext<WorkspaceContext | null>(null);
let snapshot: WorkspaceData = initialData;
let hydrated = false;
const listeners = new Set<() => void>();
function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
function getSnapshot() {
  if (!hydrated && typeof window !== "undefined") {
    hydrated = true;
    try {
      const stored = sessionStorage.getItem("cedar-workspace-v1");
      if (stored) snapshot = { ...initialData, ...JSON.parse(stored) };
    } catch {}
  }
  return snapshot;
}
function getServerSnapshot() {
  return initialData;
}
export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const data = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const [toast, setToast] = useState("");
  const update = (values: Partial<WorkspaceData>) => {
    snapshot = { ...getSnapshot(), ...values };
    try {
      sessionStorage.setItem("cedar-workspace-v1", JSON.stringify(snapshot));
    } catch {}
    listeners.forEach((listener) => listener());
  };
  const save = <K extends Collection>(collection: K, record: RecordFor<K>) => {
    const records = data[collection] as RecordFor<K>[];
    update({
      [collection]: records.some((r) => r.id === record.id)
        ? records.map((r) => (r.id === record.id ? record : r))
        : [record, ...records],
    });
  };
  const remove = (collection: Collection, id: string) =>
    update({ [collection]: data[collection].filter((r) => r.id !== id) });
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 5000);
    return () => clearTimeout(timer);
  }, [toast]);
  return (
    <Context.Provider value={{ data, save, remove, update, notify: setToast }}>
      {children}
      {toast && (
        <div className="toast" role="status">
          <CheckCircle2 size={21} />
          <div>
            <strong>Successfully updated</strong>
            <p>{toast}</p>
          </div>
          <button
            className="icon-button"
            aria-label="Dismiss notification"
            onClick={() => setToast("")}
          >
            <X size={18} />
          </button>
        </div>
      )}
    </Context.Provider>
  );
}
export function useWorkspace() {
  const ctx = useContext(Context);
  if (!ctx) throw new Error("Workspace provider is required");
  return ctx;
}

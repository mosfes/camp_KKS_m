"use client";

import type { Dispatch, SetStateAction } from "react";

import { useCallback, useEffect, useRef, useState } from "react";

export type DocumentSaveStatus = "saved" | "pending" | "saving" | "error";

type EditableDocument = { status?: string };

export function useDocumentAutoSave<T extends EditableDocument>({
  document,
  endpoint,
  initiallyDirty = false,
  setDocument,
}: {
  document: T | null;
  endpoint: string;
  initiallyDirty?: boolean;
  setDocument: Dispatch<SetStateAction<T | null>>;
}) {
  const [saveStatus, setSaveStatus] = useState<DocumentSaveStatus>("saved");
  const documentRef = useRef(document);
  const savedSnapshotRef = useRef<string | null>(null);
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve());
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  documentRef.current = document;

  const saveNow = useCallback(
    async (nextStatus: "DRAFT" | "FINALIZED" = "DRAFT", force = true) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = null;

      // Reserve a turn before waiting, so even simultaneous callers stay ordered.
      const previousSave = saveQueueRef.current;
      let release!: () => void;

      saveQueueRef.current = new Promise<void>((resolve) => {
        release = resolve;
      });
      await previousSave;

      try {
        const current = documentRef.current;

        if (
          !current ||
          (nextStatus === "DRAFT" && current.status === "FINALIZED")
        ) {
          return false;
        }

        const snapshot = JSON.stringify(current);

        if (
          nextStatus === "DRAFT" &&
          !force &&
          snapshot === savedSnapshotRef.current
        ) {
          setSaveStatus("saved");

          return true;
        }

        setSaveStatus("saving");
        const response = await fetch(endpoint, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...current, status: nextStatus }),
        });
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "บันทึกเอกสารไม่สำเร็จ");
        }
        const savedDocument = (data.document ?? data) as T;

        if (nextStatus === "FINALIZED") {
          if (JSON.stringify(documentRef.current) !== snapshot) {
            // New edits arrived during confirmation. Keep them in the form;
            // the pending draft save will reopen the server document.
            savedSnapshotRef.current = snapshot;
            setSaveStatus("pending");

            return false;
          }

          savedSnapshotRef.current = JSON.stringify(savedDocument);
          setDocument(savedDocument);
          setSaveStatus("saved");
        } else {
          // Keep the live form: the user may have typed more while saving.
          savedSnapshotRef.current = snapshot;
          setSaveStatus(
            JSON.stringify(documentRef.current) === snapshot
              ? "saved"
              : "pending",
          );
        }

        return true;
      } catch (error) {
        setSaveStatus("error");
        throw error;
      } finally {
        release();
      }
    },
    [endpoint, setDocument],
  );

  useEffect(() => {
    if (!document) return;
    const snapshot = JSON.stringify(document);

    if (savedSnapshotRef.current === null && !initiallyDirty) {
      savedSnapshotRef.current = snapshot;
      setSaveStatus("saved");

      return;
    }
    if (document.status === "FINALIZED") return;
    if (snapshot === savedSnapshotRef.current) {
      setSaveStatus("saved");

      return;
    }

    setSaveStatus("pending");
    timerRef.current = setTimeout(() => {
      void saveNow("DRAFT", false).catch(() => {
        // The header shows the error and offers a retry.
      });
    }, 800);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = null;
    };
  }, [document, initiallyDirty, saveNow]);

  useEffect(() => {
    const flush = () => {
      if (
        documentRef.current?.status !== "FINALIZED" &&
        documentRef.current &&
        JSON.stringify(documentRef.current) !== savedSnapshotRef.current
      ) {
        void saveNow("DRAFT", false).catch(() => {});
      }
    };
    const onVisibilityChange = () => {
      if (window.document.visibilityState === "hidden") flush();
    };

    window.document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("pagehide", flush);

    return () => {
      window.document.removeEventListener(
        "visibilitychange",
        onVisibilityChange,
      );
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, [saveNow]);

  return { saveStatus, saveNow };
}

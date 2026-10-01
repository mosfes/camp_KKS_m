"use client";

import React, {
  createContext,
  useContext,
  useState,
  ReactNode,
  useCallback,
  useRef,
} from "react";

import StatusModal, { ModalType } from "./StatusModal";

interface StatusModalContextType {
  showSuccess: (title: string, message: string) => void;
  showError: (title: string, message: string) => void;
  showWarning: (title: string, message: string) => void;
  showInfo: (title: string, message: string) => void;
  showConfirm: (
    title: string,
    message: string,
    onConfirm: () => void | Promise<void>,
    confirmText?: string,
  ) => void;
  setIsLoading: (loading: boolean) => void;
  close: () => void;
}

const StatusModalContext = createContext<StatusModalContextType | undefined>(
  undefined,
);

export function useStatusModal() {
  const context = useContext(StatusModalContext);

  if (!context) {
    throw new Error("useStatusModal must be used within a StatusModalProvider");
  }

  return context;
}

export function StatusModalProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [config, setConfig] = useState<{
    type: ModalType;
    title: string;
    message: string;
    onConfirm?: () => void | Promise<void>;
    confirmText?: string;
    isLoading?: boolean;
  }>({
    type: "info",
    title: "",
    message: "",
    isLoading: false,
  });

  const [isLoading, setIsLoading] = useState(false);
  const confirmInFlightRef = useRef(false);

  const openModal = useCallback(
    (
      type: ModalType,
      title: string,
      message: string,
      onConfirm?: () => void | Promise<void>,
      confirmText?: string,
    ) => {
      setConfig({ type, title, message, onConfirm, confirmText });
      confirmInFlightRef.current = false;
      setIsLoading(false);
      setIsOpen(true);
    },
    [],
  );

  const showSuccess = useCallback(
    (title: string, message: string) => openModal("success", title, message),
    [openModal],
  );
  const showError = useCallback(
    (title: string, message: string) => openModal("error", title, message),
    [openModal],
  );
  const showWarning = useCallback(
    (title: string, message: string) => openModal("warning", title, message),
    [openModal],
  );
  const showInfo = useCallback(
    (title: string, message: string) => openModal("info", title, message),
    [openModal],
  );

  // For specialized confirmation dialogs (using warning style usually, or info)
  const showConfirm = useCallback(
    (
      title: string,
      message: string,
      onConfirm: () => void | Promise<void>,
      confirmText?: string,
    ) => {
      openModal("warning", title, message, onConfirm, confirmText);
    },
    [openModal],
  );

  const close = useCallback(() => {
    setIsOpen(false);
  }, []);

  const handleConfirm = useCallback(async () => {
    const action = config.onConfirm;

    if (!action || confirmInFlightRef.current) return;

    confirmInFlightRef.current = true;
    setIsLoading(true);
    try {
      await action();
    } finally {
      confirmInFlightRef.current = false;
      setIsLoading(false);
    }
  }, [config.onConfirm]);

  return (
    <StatusModalContext.Provider
      value={{
        showSuccess,
        showError,
        showWarning,
        showInfo,
        showConfirm,
        setIsLoading,
        close,
      }}
    >
      {children}
      <StatusModal
        confirmText={config.confirmText}
        isLoading={isLoading}
        isOpen={isOpen}
        message={config.message}
        title={config.title}
        type={config.type}
        onClose={close}
        onConfirm={config.onConfirm ? handleConfirm : undefined}
      />
    </StatusModalContext.Provider>
  );
}

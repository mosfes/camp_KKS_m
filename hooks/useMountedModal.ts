import { useEffect, useState } from "react";

/** Keep a lazy modal mounted after its first open so its exit animation can run. */
export function useMountedModal(isOpen: boolean) {
  const [hasOpened, setHasOpened] = useState(false);

  useEffect(() => {
    if (isOpen) setHasOpened(true);
  }, [isOpen]);

  return isOpen || hasOpened;
}

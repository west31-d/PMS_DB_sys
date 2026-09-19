import { useEffect, useRef, type RefObject } from "react";

/** Keep the modal mounted until its exit animation has finished. */
export function usePopupClose(
  dialog: RefObject<HTMLDialogElement | null>,
  onClosed: () => void,
) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const callback = useRef(onClosed);
  callback.current = onClosed;
  useEffect(() => () => {
    if (timer.current !== null) clearTimeout(timer.current);
  }, []);

  return () => {
    if (timer.current !== null) return;
    const element = dialog.current;
    if (!element?.open || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      callback.current();
      return;
    }
    element.classList.add("is-closing");
    element.inert = true;
    timer.current = setTimeout(() => {
      timer.current = null;
      element.close();
      element.classList.remove("is-closing");
      element.inert = false;
      callback.current();
    }, 200);
  };
}

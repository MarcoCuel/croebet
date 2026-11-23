"use client";

import { useEffect } from "react";

export function useNotificationTitle(count: number) {
  useEffect(() => {
    const baseTitle = () => document.title.replace(/^\(\d+\) /, "");
    const update = () => {
      const title = `${count > 0 ? `(${count}) ` : ""}${baseTitle()}`;
      if (document.title !== title) document.title = title;
    };
    // Next can replace metadata after navigation, including streamed titles.
    const observer = new MutationObserver(update);
    observer.observe(document.head, { childList: true, subtree: true, characterData: true });
    update();
    return () => {
      observer.disconnect();
      document.title = baseTitle();
    };
  }, [count]);
}

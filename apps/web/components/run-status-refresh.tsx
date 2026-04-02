"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

type RunStatusRefreshProps = {
  active: boolean;
};

export function RunStatusRefresh({ active }: RunStatusRefreshProps) {
  const router = useRouter();

  useEffect(() => {
    if (!active) {
      return;
    }

    const intervalId = window.setInterval(() => {
      router.refresh();
    }, 3000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [active, router]);

  return null;
}

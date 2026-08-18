"use client";

import { useEffect, useState } from "react";
import { motion, useAnimation } from "framer-motion";
import { usePathname } from "next/navigation";

export function LoadingBar() {
  const controls = useAnimation();
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;
    setVisible(true);
    controls.start({
      scaleX: 1,
      transition: { duration: 0.8, ease: "easeInOut" },
    }).then(() => {
      timeout = setTimeout(() => {
        controls.start({
          scaleX: 0,
          originX: 1,
          transition: { duration: 0.3, ease: "easeOut" },
        }).then(() => setVisible(false));
      }, 200);
    });

    return () => clearTimeout(timeout);
  }, [pathname, controls]);

  if (!visible) return null;

  return (
    <div className="fixed inset-x-0 top-0 z-[9999] h-[2px]">
      <motion.div
        className="h-full bg-primary"
        initial={{ scaleX: 0, originX: 0 }}
        animate={controls}
      />
    </div>
  );
}

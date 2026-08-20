"use client";

export function haptic(pattern: "light" | "medium" | "heavy" | "success" | "error" = "light") {
  if (typeof window === "undefined") return;

  if ("vibrate" in navigator) {
    switch (pattern) {
      case "light":
        navigator.vibrate(10);
        break;
      case "medium":
        navigator.vibrate(20);
        break;
      case "heavy":
        navigator.vibrate(40);
        break;
      case "success":
        navigator.vibrate([10, 50, 10]);
        break;
      case "error":
        navigator.vibrate([30, 50, 30, 50, 30]);
        break;
    }
  }
}

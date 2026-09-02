import { useEffect, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

/**
 * Listens to new notifications in realtime and shows a native browser
 * notification (Windows/macOS/Linux desktop notification center) when:
 * - The browser tab is in background OR the user is on desktop
 * - Permission has been granted
 *
 * On mobile PWA, native push (via Service Worker) handles this — this hook
 * only fires the in-app system notification while the app is open.
 */
export function useDesktopNotifications() {
  const { user } = useAuth();
  const lastShownIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!user) return;
    if (typeof window === "undefined" || !("Notification" in window)) return;

    // Auto-request permission once if default (silent — won't bother on every load)
    if (Notification.permission === "default") {
      // Defer until user interacts to avoid abrupt prompt
      const askOnInteraction = () => {
        if (Notification.permission === "default") {
          Notification.requestPermission().catch(() => {});
        }
        window.removeEventListener("click", askOnInteraction);
      };
      window.addEventListener("click", askOnInteraction, { once: true });
    }

    const channel = supabase
      .channel(`desktop-notifications-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const notif = payload.new as {
            id: string;
            title: string;
            message: string;
            type: string | null;
          };

          if (lastShownIds.current.has(notif.id)) return;
          lastShownIds.current.add(notif.id);

          if (Notification.permission !== "granted") return;

          try {
            const n = new Notification(notif.title, {
              body: notif.message,
              icon: "/icon-192.png",
              badge: "/icon-192.png",
              tag: notif.id,
              silent: false,
            });

            n.onclick = () => {
              window.focus();
              n.close();
            };
          } catch (err) {
            console.warn("Could not show desktop notification:", err);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);
}

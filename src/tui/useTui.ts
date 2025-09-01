import { useInput } from "ink";
import { useMemo, useReducer, useRef } from "react";
import { getFailoverServices } from "../logic/failover";
import { getServiceStatus } from "../logic/status";
import type { Router, Service } from "../types/traefik";
import { getRouterItemHeight } from "../utils/layout";
import { initialState, tuiReducer } from "./reducer";

export const useTui = (
  routers: Router[],
  services: Service[],
  availableHeight: number,
  options?: { ignorePatterns?: string[]; refresh?: () => void },
) => {
  const [state, dispatch] = useReducer(tuiReducer, initialState);
  const ignore = (options?.ignorePatterns || []).map((s) => s.toLowerCase());

  const filteredRouters = routers.filter((router) => {
    const name = router.name.toLowerCase();
    if (ignore.length > 0) {
      const shouldIgnore = ignore.some((p) => {
        if (!p) return false;
        if (p === "*") return true;
        const startsStar = p.startsWith("*");
        const endsStar = p.endsWith("*");
        if (startsStar && endsStar && p.length > 2) {
          const inner = p.slice(1, -1);
          return name.includes(inner);
        }
        if (startsStar) {
          const inner = p.slice(1);
          return inner.length > 0 && name.endsWith(inner);
        }
        if (endsStar) {
          const inner = p.slice(0, -1);
          return inner.length > 0 && name.startsWith(inner);
        }
        return name.includes(p);
      });
      if (shouldIgnore) return false;
    }
    return name.includes(state.searchQuery.toLowerCase());
  });

  // Determine router status for sorting: DOWN if has services but none UP; UP if any UP; else UNKNOWN
  const routerStatus = useMemo(() => {
    const statusMap = new Map<string, "UP" | "DOWN" | "UNKNOWN">();
    for (const r of filteredRouters) {
      // match services as in RouterItem
      const escaped = r.service.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const pattern = new RegExp(`^${escaped}(@\\w+)?$`);
      const matched = services.filter((s) => pattern.test(s.name));
      let alive = 0;
      for (const s of matched) {
        if (s.type === "failover" && s.failover) {
          const { primary, fallback } = getFailoverServices(s.name, services);
          const ps = primary
            ? getServiceStatus(primary, services, new Set())
            : "UNKNOWN";
          const fs = fallback
            ? getServiceStatus(fallback, services, new Set())
            : "UNKNOWN";
          if (ps === "UP" || fs === "UP") alive += 1;
        } else {
          const st = getServiceStatus(s, services, new Set());
          if (st === "UP") alive += 1;
        }
      }
      const status: "UP" | "DOWN" | "UNKNOWN" =
        matched.length === 0 ? "UNKNOWN" : alive > 0 ? "UP" : "DOWN";
      statusMap.set(r.name, status);
    }
    return statusMap;
  }, [filteredRouters, services]);

  const sortedRouters = useMemo(() => {
    const arr = filteredRouters.slice();
    if (state.sortMode === "name") {
      arr.sort((a, b) => a.name.localeCompare(b.name));
    } else {
      // status: DEAD first, then UNKNOWN, then UP; inside each by name
      const rank = (r: Router) => {
        const s = routerStatus.get(r.name) || "UNKNOWN";
        return s === "DOWN" ? 0 : s === "UNKNOWN" ? 1 : 2;
      };
      arr.sort((a, b) => {
        const ra = rank(a);
        const rb = rank(b);
        if (ra !== rb) return ra - rb;
        return a.name.localeCompare(b.name);
      });
    }
    return arr;
  }, [filteredRouters, state.sortMode, routerStatus]);

  // Precompute full item heights for filtered routers
  const heights = useMemo(
    () => sortedRouters.map((r) => getRouterItemHeight(r, services)),
    [sortedRouters, services],
  );

  const footerHeight = 1;

  // Simple key buffer to detect "gg"
  const lastKeyRef = useRef<{ key: string; ts: number } | null>(null);

  useInput((input, key) => {
    // Handle Ctrl+C and quit in any mode
    if (input === "q" || (key.ctrl && input === "c")) {
      process.exit(0);
    }

    if (state.mode === "normal") {
      if (input === "/") {
        dispatch({ type: "SET_MODE", payload: "search" });
        return;
      }

      if (input === "r" || input === "R") {
        options?.refresh?.();
        return;
      }

      // Sorting controls
      if (input === "s") {
        dispatch({ type: "TOGGLE_SORT_MODE" });
        return;
      }
      if (input === "n" || input === "N") {
        dispatch({ type: "SET_SORT_MODE", payload: "name" });
        return;
      }
      if (input === "d" || input === "D") {
        dispatch({ type: "SET_SORT_MODE", payload: "status" });
        return;
      }

      if (key.upArrow || input === "k") {
        dispatch({
          type: "MOVE_UP",
          payload: {
            filteredRoutersLength: filteredRouters.length,
            heights,
            availableHeight,
            footerHeight,
          },
        });
      }

      if (key.downArrow || input === "j") {
        dispatch({
          type: "MOVE_DOWN",
          payload: {
            filteredRoutersLength: filteredRouters.length,
            heights,
            availableHeight,
            footerHeight,
          },
        });
      }

      // PageDown: try key.pageDown, Ctrl+f, or space
      if (
        (key as any).pageDown ||
        (key.ctrl && input === "f") ||
        input === " "
      ) {
        dispatch({
          type: "PAGE_DOWN",
          payload: { heights, availableHeight, footerHeight },
        });
      }

      // PageUp: try key.pageUp or Ctrl+b
      if ((key as any).pageUp || (key.ctrl && input === "b")) {
        dispatch({
          type: "PAGE_UP",
          payload: { heights, availableHeight, footerHeight },
        });
      }

      // Home/End
      if ((key as any).home) {
        dispatch({ type: "GO_TOP" });
      }
      if ((key as any).end) {
        dispatch({
          type: "GO_BOTTOM",
          payload: { heights, availableHeight, footerHeight },
        });
      }

      // Vim-style gg (go top) and G (go bottom)
      if (input === "g") {
        const now = Date.now();
        if (
          lastKeyRef.current &&
          lastKeyRef.current.key === "g" &&
          now - lastKeyRef.current.ts < 600
        ) {
          dispatch({ type: "GO_TOP" });
          lastKeyRef.current = null;
        } else {
          lastKeyRef.current = { key: "g", ts: now };
        }
      } else if (input === "G") {
        dispatch({
          type: "GO_BOTTOM",
          payload: { heights, availableHeight, footerHeight },
        });
      } else if (input !== "g") {
        // Reset buffer if other keys pressed
        lastKeyRef.current = null;
      }

      if (key.escape) {
        dispatch({ type: "SET_SEARCH_QUERY", payload: "" });
      }
    }

    if (state.mode === "search") {
      if (key.escape) {
        dispatch({ type: "SET_MODE", payload: "normal" });
        dispatch({ type: "SET_SEARCH_QUERY", payload: "" });
      }

      if (key.return) {
        dispatch({ type: "SET_MODE", payload: "normal" });
      }
    }
  });

  return { state, dispatch, filteredRouters: sortedRouters };
};

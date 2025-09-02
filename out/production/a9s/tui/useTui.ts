import { useInput } from "ink";
import { useReducer } from "react";
import type { Router } from "../types/traefik";
import { initialState, tuiReducer } from "./reducer";

export const useTui = (routers: Router[], visibleCount: number = 10) => {
  const [state, dispatch] = useReducer(tuiReducer, initialState);

  const filteredRouters = routers.filter((router) =>
    router.name.toLowerCase().includes(state.searchQuery.toLowerCase()),
  );

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

      if (key.upArrow || input === "k") {
        dispatch({
          type: "MOVE_UP",
          payload: { filteredRoutersLength: filteredRouters.length },
        });
      }

      if (key.downArrow || input === "j") {
        dispatch({
          type: "MOVE_DOWN",
          payload: {
            filteredRoutersLength: filteredRouters.length,
            visibleCount: Math.max(1, visibleCount), // Ensure at least 1
          },
        });
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

  return { state, dispatch, filteredRouters };
};

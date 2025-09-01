import { Box, Text, useStdout } from "ink";
import TextInput from "ink-text-input";
import type React from "react";
import { useEffect, useState } from "react";
import { useTraefikData } from "../hooks/useTraefikData";
import { useTui } from "../tui/useTui";
import { getRouterItemHeight } from "../utils/layout";
import RouterItem from "./RouterItem";

interface RoutersListProps {
  apiUrl: string;
  useTraefikDataHook?: typeof useTraefikData;
  ignorePatterns?: string[];
}

const RoutersList: React.FC<RoutersListProps> = ({
  apiUrl,
  useTraefikDataHook = useTraefikData,
  ignorePatterns = [],
}) => {
  const { stdout } = useStdout();
  const rows = (stdout as any)?.rows ?? process.stdout.rows ?? 24;
  const cols = (stdout as any)?.columns ?? process.stdout.columns ?? 80;
  const isTTY =
    (stdout as any)?.isTTY ??
    (typeof process !== "undefined" && (process.stdout as any)?.isTTY) ??
    false;
  const nonInteractive = !isTTY;
  const terminalWidth = cols;

  // State and data fetching
  const {
    routers: allRouters,
    services: allServices,
    loading,
    error,
    lastUpdated,
    refresh,
  } = useTraefikDataHook(apiUrl) as any;

  // Calculate available screen space
  const headerHeight = 1; // Search bar
  const footerHeight = 1; // Navigation footer (only shown if scrolling needed)
  // In non-interactive mode (e.g., redirecting to a file), render all content without pagination
  const availableHeight = nonInteractive
    ? Number.MAX_SAFE_INTEGER
    : rows - headerHeight - 1;

  // Calculate how many items can fit on screen for initial estimate
  // Get TUI state and filtered routers (must be called at top level)
  const [flash, setFlash] = useState<string | null>(null);
  useEffect(() => {
    if (lastUpdated) {
      setFlash("Updated");
      const id = setTimeout(() => setFlash(null), 1000);
      return () => clearTimeout(id);
    }
  }, [lastUpdated]);

  const { state, dispatch, filteredRouters } = useTui(
    allRouters,
    allServices,
    availableHeight,
    { ignorePatterns, refresh },
  );

  if (loading) {
    return <Text>Loading...</Text>;
  }

  if (error) {
    return <Text>Error: {error.message}</Text>;
  }

  // Helper to build a window of visible routers starting at a given index
  type WindowItem = {
    router: (typeof filteredRouters)[number];
    maxLines?: number;
    cutFrom?: "top" | "bottom";
  };
  const buildWindow = (startIndex: number) => {
    const windowRouters: WindowItem[] = [];
    let windowUsedLines = 0;

    for (let i = startIndex; i < filteredRouters.length; i++) {
      const router = filteredRouters[i];
      const itemHeight = getRouterItemHeight(router, allServices);

      // Reserve space for footer only if there will be more items above or below
      const needsFooter =
        filteredRouters.length > 1 &&
        (startIndex > 0 || i < filteredRouters.length - 1);
      const maxUsableHeight = needsFooter
        ? availableHeight - footerHeight
        : availableHeight;

      // Account for spacing between router items (RouterItem adds marginBottom=1 except last visible)
      const interItemSpacing = windowRouters.length > 0 ? 1 : 0;

      const wouldUse = windowUsedLines + interItemSpacing + itemHeight;
      if (wouldUse > maxUsableHeight) {
        // Try partial render if there is remaining space after spacing
        const remaining = maxUsableHeight - windowUsedLines - interItemSpacing;
        if (remaining > 0) {
          // Apply spacing
          windowUsedLines += interItemSpacing;
          windowRouters.push({
            router,
            maxLines: remaining,
            cutFrom: "bottom",
          });
          windowUsedLines = maxUsableHeight; // fully used
        }
        break;
      }

      // Apply spacing for all but the first item in the window
      windowUsedLines += interItemSpacing;

      windowRouters.push({ router });
      windowUsedLines += itemHeight;
    }

    // Ensure at least one item is visible (even if it overflows on very small screens)
    if (
      windowRouters.length === 0 &&
      filteredRouters.length > 0 &&
      startIndex < filteredRouters.length
    ) {
      const forcedRouter = filteredRouters[startIndex];
      const needsFooter =
        filteredRouters.length > 1 &&
        (startIndex > 0 || startIndex < filteredRouters.length - 1);
      const maxUsableHeight = needsFooter
        ? availableHeight - footerHeight
        : availableHeight;
      const forcedHeight = getRouterItemHeight(forcedRouter, allServices);
      const lines = Math.min(maxUsableHeight, forcedHeight);
      windowRouters.push({
        router: forcedRouter,
        maxLines: lines,
        cutFrom: "bottom",
      });
      windowUsedLines = lines;
    }

    return { windowRouters, windowUsedLines };
  };

  // First, build from the current topIndex
  let startIndex = Math.min(
    state.topIndex,
    Math.max(0, filteredRouters.length - 1),
  );
  let { windowRouters: visibleRouters } = buildWindow(startIndex);

  // If the selected router is not within the window, shift the start index incrementally
  const includesSelected = (start: number, items: { router: any }[]) => {
    const count = items.length;
    return (
      state.selectedRouter >= start && state.selectedRouter < start + count
    );
  };

  if (
    filteredRouters.length > 0 &&
    !includesSelected(startIndex, visibleRouters)
  ) {
    // Move window one item at a time toward the selected index
    const direction = state.selectedRouter > startIndex ? 1 : -1;
    let probe = startIndex;

    while (true) {
      const next = Math.min(
        Math.max(0, probe + direction),
        Math.max(0, filteredRouters.length - 1),
      );
      if (next === probe) break;
      probe = next;
      const built = buildWindow(probe);
      visibleRouters = built.windowRouters;
      if (includesSelected(probe, visibleRouters)) {
        startIndex = probe;
        break;
      }
      // Safety cap to avoid infinite loops
      if (
        (direction > 0 && probe >= state.selectedRouter) ||
        (direction < 0 && probe <= state.selectedRouter)
      ) {
        startIndex = probe;
        break;
      }
    }
  }

  // Ensure selected router is fully visible (avoid partial clipping)
  if (
    filteredRouters.length > 0 &&
    includesSelected(startIndex, visibleRouters)
  ) {
    const selectedIdxInWindow = state.selectedRouter - startIndex;
    const selectedItem = visibleRouters[selectedIdxInWindow];
    const fullHeight = getRouterItemHeight(
      filteredRouters[state.selectedRouter],
      allServices,
    );

    const isPartiallyClipped =
      selectedItem?.maxLines !== undefined &&
      selectedItem.maxLines < fullHeight;

    if (isPartiallyClipped) {
      // Try to advance the window until the selected item fits fully or we run out of room
      let probe = startIndex;
      while (probe < state.selectedRouter) {
        const next = Math.min(
          Math.max(0, probe + 1),
          Math.max(0, filteredRouters.length - 1),
        );
        if (next === probe) break;
        const built = buildWindow(next);
        const nowInWindow = includesSelected(next, built.windowRouters);
        if (!nowInWindow) {
          // If advancing skips past selection (unlikely), stop
          break;
        }
        const candidateSelected =
          built.windowRouters[state.selectedRouter - next];
        const candidateClipped =
          candidateSelected?.maxLines !== undefined &&
          candidateSelected.maxLines < fullHeight;
        if (!candidateClipped) {
          startIndex = next;
          visibleRouters = built.windowRouters;
          break;
        }
        probe = next;
        // If we reach the selection as the first visible item and still clipped, we can't improve further.
        if (probe === state.selectedRouter) {
          startIndex = probe;
          visibleRouters = built.windowRouters;
          break;
        }
      }
    }
  }

  const shouldShowFooter =
    !nonInteractive && filteredRouters.length > visibleRouters.length;
  return (
    <Box flexDirection="column">
      {/* Always visible header */}
      <Box backgroundColor="gray" paddingX={1}>
        {state.mode === "search" ? (
          <>
            <Text>Filter: </Text>
            <TextInput
              value={state.searchQuery}
              onChange={(query) =>
                dispatch({ type: "SET_SEARCH_QUERY", payload: query })
              }
            />
          </>
        ) : (
          <Text>🔍 Press / to search ({filteredRouters.length} routers)</Text>
        )}
      </Box>

      {/* Content area fills remaining space */}
      <Box flexDirection="column" flexGrow={1}>
        {visibleRouters.map((item, index) => {
          const absoluteIndex = startIndex + index;
          const isLast = index === visibleRouters.length - 1;
          return (
            <RouterItem
              key={item.router.name}
              router={item.router}
              services={allServices}
              isSelected={absoluteIndex === state.selectedRouter}
              terminalWidth={terminalWidth}
              isLast={isLast}
              maxLines={item.maxLines}
              cutFrom={item.cutFrom}
            />
          );
        })}
      </Box>
      {/*Footer with navigation info */}
      {shouldShowFooter && (
        <Box justifyContent="space-between" backgroundColor="gray" paddingX={1}>
          <Text>
            {startIndex > 0 && "▲"} {startIndex + 1}-
            {startIndex + visibleRouters.length} of {filteredRouters.length}{" "}
            {startIndex + visibleRouters.length < filteredRouters.length && "▼"}
          </Text>
          <Text dimColor>{flash ?? ""}</Text>
          <Text>
            {`sort: ${state.sortMode === "status" ? "dead" : "name"} • s: sort • r: refresh`}
          </Text>
        </Box>
      )}
    </Box>
  );
};

export default RoutersList;

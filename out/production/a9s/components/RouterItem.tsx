import { Box, Text } from "ink";
import React from "react";
import type { Router, Service } from "../types/traefik";
import ServiceItem from "./ServiceItem";
import { getRouterItemHeight, getServiceItemHeight } from "../utils/layout";

interface RouterItemProps {
  router: Router;
  services: Service[];
  isSelected: boolean;
  terminalWidth: number;
  isLast?: boolean; // NEW
  maxLines?: number;
  cutFrom?: "top" | "bottom";
}

const RouterItem: React.FC<RouterItemProps> = React.memo(
  ({ router, services, isSelected, terminalWidth, isLast, maxLines, cutFrom = "bottom" }) => {
    const routerServices = services.filter((s) => {
      const escapedService = router.service.replace(
        /[.*+?^${}()|[\]\\]/g,
        "\\$&",
      );
      const servicePattern = new RegExp(`^${escapedService}(@\\w+)?$`);
      return servicePattern.test(s.name);
    });

    // If no partial rendering requested, render full item as before
    if (maxLines === undefined) {
      return (
        <Box
          flexDirection="column"
          width={terminalWidth}
          marginBottom={isLast ? 0 : 1}
        >
          <Text backgroundColor={isSelected ? "blue" : undefined} wrap="truncate-end">
            <Text color="cyan">⬢</Text>{" "}
            <Text color="white" bold>
              {router.name.trim()}
            </Text>
          </Text>

          <Text color="gray" wrap="truncate-end">
            {"  "}
            <Text color="yellow">→</Text> {router.rule.trim()}
          </Text>

          {routerServices.map((service, index) => (
            <ServiceItem
              key={service.name}
              service={service}
              services={services}
              terminalWidth={terminalWidth}
              isLast={index === routerServices.length - 1}
            />
          ))}
        </Box>
      );
    }

    // Partial rendering path
    let remaining = Math.max(0, maxLines);

    // Helper to decide whether to render or skip based on top slicing
    const renderTop = cutFrom === "top";

    // For top slicing, we need to skip the first (total - maxLines) lines
    let skip = 0;
    if (renderTop) {
      skip = Math.max(0, getRouterItemHeight(router, services) - remaining);
    }

    const lines: React.ReactNode[] = [];

    const pushLine = (node: React.ReactNode) => {
      if (skip > 0) {
        skip -= 1;
      } else if (remaining > 0) {
        lines.push(node);
        remaining -= 1;
      }
    };

    // Header line
    pushLine(
      <Text backgroundColor={isSelected ? "blue" : undefined} wrap="truncate-end" key="router-header">
        <Text color="cyan">⬢</Text>{" "}
        <Text color="white" bold>
          {router.name.trim()}
        </Text>
      </Text>
    );

    // Rule line
    pushLine(
      <Text color="gray" wrap="truncate-end" key="router-rule">
        {"  "}
        <Text color="yellow">→</Text> {router.rule.trim()}
      </Text>
    );

    // Services lines
    if (remaining > 0 || skip > 0) {
      for (let i = 0; i < routerServices.length && (remaining > 0 || skip > 0); i++) {
        const service = routerServices[i];
        const isServiceLast = i === routerServices.length - 1;
        const svcHeight = getServiceItemHeight(service, services);

        if (skip >= svcHeight) {
          skip -= svcHeight;
          continue;
        }

        // Calculate how many lines we can render for this service
        const svcAvailable = renderTop ? (svcHeight - skip) : remaining;
        const svcMaxLines = Math.min(renderTop ? svcAvailable : remaining, svcHeight);
        const svcCutFrom = renderTop && skip > 0 ? "top" : "bottom";

        lines.push(
          <ServiceItem
            key={service.name}
            service={service}
            services={services}
            terminalWidth={terminalWidth}
            isLast={isServiceLast}
            maxLines={svcMaxLines}
            cutFrom={svcCutFrom as any}
          />
        );

        if (renderTop) {
          // In top-cut mode, we consumed (svcHeight - remaining after slicing) from skip + remaining
          const consumed = svcMaxLines;
          // After rendering, reset skip because we handled slicing within this item
          skip = 0;
          remaining -= consumed;
        } else {
          remaining -= svcMaxLines;
        }
      }
    }

    return (
      <Box flexDirection="column" width={terminalWidth} marginBottom={isLast ? 0 : 1}>
        {lines.map((node, idx) => (
          <React.Fragment key={idx}>{node}</React.Fragment>
        ))}
      </Box>
    );
  },
);

export default RouterItem;

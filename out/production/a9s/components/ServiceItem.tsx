import { Box, Text } from "ink";
import React from "react";
import { getFailoverServices } from "../logic/failover";
import { getServiceStatus } from "../logic/status";
import type { Service } from "../types/traefik";

interface ServiceItemProps {
  service: Service;
  services: Service[];
  terminalWidth: number;
  isLast?: boolean;
  maxLines?: number;
  cutFrom?: "top" | "bottom";
}

const ServiceItem: React.FC<ServiceItemProps> = React.memo(
  ({ service, services, terminalWidth, isLast = false, maxLines, cutFrom = "bottom" }) => {
    const status = getServiceStatus(service, services, new Set());
    const connector = isLast ? "└──" : "├──";

    // Helper function to get status indicator
    const getStatusIndicator = (serviceStatus: string) => {
      switch (serviceStatus) {
        case "UP":
          return <Text color="green">●</Text>;
        case "DOWN":
          return <Text color="red">●</Text>;
        default:
          return <Text color="gray">●</Text>;
      }
    };

    if (service.type === "failover") {
          // Build lines for a failover service
          const { primary, fallback } = getFailoverServices(service.name, services);
          const primaryStatus = primary
            ? getServiceStatus(primary, services, new Set())
            : "UNKNOWN";
          const fallbackStatus = fallback
            ? getServiceStatus(fallback, services, new Set())
            : "UNKNOWN";

          const isUsingPrimary = primaryStatus === "UP";

          const lines: React.ReactNode[] = [];
          // Header line
          lines.push(
            <Text wrap="truncate-end" key="fo-header">
              {"  "}
              {connector}{" "}
              <Text color="blue" bold>
                {service.name}
              </Text>{" "}
              <Text color="gray">(failover)</Text>
            </Text>,
          );
          if (primary) {
            lines.push(
              <Text wrap="truncate-end" key="fo-primary">
                {"  "}
                {"  "}├──{" "}
                <Text color={isUsingPrimary ? "green" : "gray"} bold={isUsingPrimary}>
                  {isUsingPrimary ? "P " : ""}
                  {primary.name.trim()}
                </Text>{" "}
                {getStatusIndicator(primaryStatus)}
                {isUsingPrimary && <Text color="green"> ← ACTIVE</Text>}
              </Text>,
            );
          }
          if (fallback) {
            lines.push(
              <Text wrap="truncate-end" key="fo-fallback">
                {"  "}
                {"  "}└──{" "}
                <Text color={!isUsingPrimary ? "yellow" : "gray"} bold={!isUsingPrimary}>
                  {!isUsingPrimary ? "P " : ""}
                  {fallback.name.trim()}
                </Text>{" "}
                {getStatusIndicator(fallbackStatus)}
                {!isUsingPrimary && <Text color="yellow"> ← FALLBACK ACTIVE</Text>}
              </Text>,
            );
          }

          // Apply partial slicing if requested
          const renderLines = (maxLines && maxLines >= 0) ? (() => {
            if (maxLines === undefined) return lines;
            if (maxLines === 0) return [] as React.ReactNode[];
            if (cutFrom === "top") return lines.slice(Math.max(0, lines.length - maxLines));
            return lines.slice(0, Math.min(lines.length, maxLines));
          })() : lines;

          return (
            <Box flexDirection="column" width={terminalWidth}>
              {renderLines.map((node, idx) => (
                <React.Fragment key={idx}>{node}</React.Fragment>
              ))}
            </Box>
          );
        }

    // Regular service
    const serverUrls =
      service.loadBalancer?.servers.map((s) => s.url.trim()).join(", ") ||
      "No servers";

    if (maxLines !== undefined && maxLines <= 0) {
      return null;
    }
    return (
      <Text wrap="truncate-end">
        {"  "}
        {connector}{" "}
        <Text color="white" bold>
          {service.name.trim()}
        </Text>{" "}
        {getStatusIndicator(status)} <Text color="gray">{serverUrls}</Text>
      </Text>
    );
  },
);

export default ServiceItem;

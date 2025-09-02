import type { Service } from "../types/traefik";
import { getFailoverServices } from "./failover";

export type ServiceStatus = "UP" | "DOWN" | "UNKNOWN";

export const getServiceStatus = (
  service: Service,
  allServices: Service[],
  visitedServices: Set<string> = new Set(),
): ServiceStatus => {
  if (visitedServices.has(service.name)) {
    // Circular dependency detected, break recursion
    return "UNKNOWN";
  }

  visitedServices.add(service.name);

  if (service.type === "failover") {
    const { primary, fallback } = getFailoverServices(
      service.name,
      allServices,
    );

    let primaryStatus: ServiceStatus = "UNKNOWN";
    if (primary) {
      primaryStatus = getServiceStatus(primary, allServices, visitedServices);
    }

    if (primaryStatus === "UP") {
      visitedServices.delete(service.name);
      return "UP";
    }

    let fallbackStatus: ServiceStatus = "UNKNOWN";
    if (fallback) {
      fallbackStatus = getServiceStatus(fallback, allServices, visitedServices);
    }

    if (fallbackStatus === "UP") {
      visitedServices.delete(service.name);
      return "UP";
    }

    if (primaryStatus === "DOWN" || fallbackStatus === "DOWN") {
      visitedServices.delete(service.name);
      return "DOWN";
    }

    visitedServices.delete(service.name);
    return "UNKNOWN";
  }

  if (service.serverStatus) {
    const statuses = Object.values(service.serverStatus);
    if (statuses.includes("UP")) {
      visitedServices.delete(service.name);
      return "UP";
    }
    if (statuses.length > 0) {
      visitedServices.delete(service.name);
      return "DOWN";
    }
  }

  // If no serverStatus, check the service's enabled/disabled status
  if (service.status === "enabled") {
    visitedServices.delete(service.name);
    return "UP";
  }
  if (service.status === "disabled") {
    visitedServices.delete(service.name);
    return "DOWN";
  }

  visitedServices.delete(service.name);
  return "UNKNOWN";
};

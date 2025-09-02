import { getFailoverServices } from "../logic/failover";
import type { Router, Service } from "../types/traefik";

// Clear caches since logic has changed
const serviceHeightCache = new Map<string, number>();
const routerHeightCache = new Map<string, number>();

export const getServiceItemHeight = (
  service: Service,
  allServices: Service[],
  _visitedServices: Set<string> = new Set(),
): number => {
  const cachedHeight = serviceHeightCache.get(service.name);
  if (cachedHeight !== undefined) {
    return cachedHeight;
  }

  if (service.type === "failover") {
    let height = 1; // For the failover service itself
    const { primary, fallback } = getFailoverServices(
      service.name,
      allServices,
    );
    if (primary) {
      // We need to get the status of the primary service to determine if it contributes to height
      // This is a bit tricky as getServiceStatus itself uses getServiceItemHeight
      // To avoid circular dependency in height calculation, we'll just assume 1 line if primary exists
      height += 1;
    }
    if (fallback) {
      height += 1; // For fallback
    }
    serviceHeightCache.set(service.name, height);
    return height;
  }
  serviceHeightCache.set(service.name, 1);
  return 1; // Non-failover service is 1 line
};

export const getRouterItemHeight = (
  router: Router,
  allServices: Service[],
): number => {
  const cachedHeight = routerHeightCache.get(router.name);
  if (cachedHeight !== undefined) {
    return cachedHeight;
  }

  let height = 2; // Router name + rule = 2 lines (spacing handled by RouterItem marginBottom for non-last items)

  // Use the same matching logic as RouterItem
  const routerServices = allServices.filter((s) => {
    const escapedService = router.service.replace(
      /[.*+?^${}()|[\]\\]/g,
      "\\$&",
    );
    const servicePattern = new RegExp(`^${escapedService}(@\\w+)?$`);
    return servicePattern.test(s.name);
  });

  routerServices.forEach((service) => {
    height += getServiceItemHeight(service, allServices, new Set()); // Pass a new Set for each service
  });

  routerHeightCache.set(router.name, height);
  return height;
};


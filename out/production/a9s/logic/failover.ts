import type { Service } from "../types/traefik";

export interface FailoverServices {
  primary: Service | undefined;
  fallback: Service | undefined;
}

export const getFailoverServices = (
  serviceName: string,
  services: Service[],
): FailoverServices => {
  const failoverService = services.find(
    (service) => service.name === serviceName,
  );
  if (
    !failoverService ||
    failoverService.type !== "failover" ||
    !failoverService.failover
  ) {
    return { primary: undefined, fallback: undefined };
  }

  // Helper function to match service names with provider suffixes
  const findServiceByName = (targetName: string | undefined) => {
    if (!targetName) return undefined;

    return services.find((s) => {
      const escapedTarget = targetName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const servicePattern = new RegExp(`^${escapedTarget}(@\\w+)?$`);
      return servicePattern.test(s.name);
    });
  };

  const primaryService = findServiceByName(failoverService.failover?.service);
  const fallbackService = findServiceByName(failoverService.failover?.fallback);

  return {
    primary: primaryService,
    fallback: fallbackService,
  };
};

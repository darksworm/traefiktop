import type { Router, Service } from "../types/traefik";

export interface MappedRouter {
  router: Router;
  services: Service[];
}

export const mapRoutersToServices = (
  routers: Router[],
  services: Service[],
): MappedRouter[] => {
  return routers.map((router) => ({
    router,
    services: services.filter((service) =>
      service.usedBy.includes(router.name),
    ),
  }));
};

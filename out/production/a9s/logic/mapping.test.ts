import type { Router, Service } from "../types/traefik";
import { mapRoutersToServices } from "./mapping";

describe("mapRoutersToServices", () => {
  it("should map routers to services correctly", () => {
    const routers: Router[] = [
      {
        name: "router1",
        service: "service1",
        rule: "Host(`example.com`)",
        entryPoints: [],
        status: "enabled",
        provider: "file",
        middlewares: [],
        priority: 1,
        using: [],
      },
    ];
    const services: Service[] = [
      {
        name: "service1",
        usedBy: ["router1"],
        status: "enabled",
        provider: "file",
        type: "loadbalancer",
      },
    ];

    const result = mapRoutersToServices(routers, services);

    expect(result).toEqual([
      {
        router: routers[0],
        services: [services[0]],
      },
    ]);
  });
});

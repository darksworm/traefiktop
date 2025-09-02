import type { Service } from "../types/traefik";
import { getFailoverServices } from "./failover";

describe("getFailoverServices", () => {
  it("should return the primary and fallback services for a failover service", () => {
    const services: Service[] = [
      {
        name: "failover-service@file",
        status: "enabled",
        provider: "file",
        type: "failover",
        failover: {
          service: "primary-service@file",
          fallback: "fallback-service@file",
        },
      },
      {
        name: "primary-service@file",
        usedBy: ["failover-service@file"],
        status: "enabled",
        provider: "file",
        type: "loadbalancer",
      },
      {
        name: "fallback-service@file",
        usedBy: ["failover-service@file"],
        status: "enabled",
        provider: "file",
        type: "loadbalancer",
      },
    ];

    const result = getFailoverServices("failover-service@file", services);

    expect(result).toEqual({
      primary: services[1],
      fallback: services[2],
    });
  });
});

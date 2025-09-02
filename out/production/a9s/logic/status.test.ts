import type { Service } from "../types/traefik";
import { getServiceStatus } from "./status";

describe("getServiceStatus", () => {
  it("should return UP if serverStatus is UP", () => {
    const service: Service = {
      name: "service1",
      usedBy: ["router1"],
      status: "enabled",
      provider: "file",
      type: "loadbalancer",
      serverStatus: { "http://nginx-auth": "UP" },
    };
    expect(getServiceStatus(service, [])).toBe("UP");
  });

  it("should return DOWN if serverStatus is DOWN", () => {
    const service: Service = {
      name: "service1",
      usedBy: ["router1"],
      status: "enabled",
      provider: "file",
      type: "loadbalancer",
      serverStatus: { "http://nginx-auth": "DOWN" },
    };
    expect(getServiceStatus(service, [])).toBe("DOWN");
  });

  it("should return UNKNOWN if serverStatus is not defined", () => {
    const service: Service = {
      name: "service1",
      usedBy: ["router1"],
      status: "enabled",
      provider: "file",
      type: "loadbalancer",
    };
    expect(getServiceStatus(service, [])).toBe("UP");
  });
});

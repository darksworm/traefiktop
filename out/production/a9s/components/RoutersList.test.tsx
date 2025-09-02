import { render } from "ink-testing-library";
import type { Router, Service } from "../types/traefik";
import RoutersList from "./RoutersList";

describe("RoutersList", () => {
  it("should render loading state initially", () => {
    const useTraefikDataMock = () => ({
      loading: true,
      error: null,
      routers: [],
      services: [],
    });
    const { lastFrame } = render(
      <RoutersList apiUrl="" useTraefikDataHook={useTraefikDataMock} />,
    );
    expect(lastFrame()).toContain("Loading...");
  });

  it("should render error state", () => {
    const useTraefikDataMock = () => ({
      loading: false,
      error: new Error("Test Error"),
      routers: [],
      services: [],
    });
    const { lastFrame } = render(
      <RoutersList apiUrl="" useTraefikDataHook={useTraefikDataMock} />,
    );
    expect(lastFrame()).toContain("Error: Test Error");
  });

  it("should render routers and services", () => {
    const routers: Router[] = [
      {
        name: "router1",
        rule: "Host(`example.com`)",
        service: "service1",
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
        name: "service1@file", // Add provider suffix to match the regex logic
        usedBy: ["router1"],
        status: "enabled",
        provider: "file",
        type: "loadbalancer",
      },
    ];
    const useTraefikDataMock = () => ({
      loading: false,
      error: null,
      routers,
      services,
    });
    const { lastFrame } = render(
      <RoutersList apiUrl="" useTraefikDataHook={useTraefikDataMock} />,
    );
    const output = lastFrame();
    // Test shows search header and router count
    expect(output).toContain("🔍 Press / to search");
    expect(output).toContain("1 routers");
  });
});

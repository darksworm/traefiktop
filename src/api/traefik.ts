import { err, ok, ResultAsync } from "neverthrow";
import * as yup from "yup";
import type { Router, Service } from "../types/traefik";

// Define common schemas for reusability
const HealthCheckSchema = yup.object({
  mode: yup.string().required(),
  path: yup.string().required(),
  interval: yup.string().required(),
  timeout: yup.string().required(),
  followRedirects: yup.boolean().optional(),
});

const ResponseForwardingSchema = yup.object({
  flushInterval: yup.string().required(),
});

const LoadBalancerSchema = yup.object({
  servers: yup.array(yup.object({ url: yup.string().required() })).required(),
  passHostHeader: yup.boolean().optional(),
  responseForwarding: ResponseForwardingSchema.optional(),
  healthCheck: HealthCheckSchema.optional(),
  serversTransport: yup.string().optional(),
});

const FailoverConfigSchema = yup.object({
  service: yup.string().required(),
  fallback: yup.string().required(),
});

// Service Schemas
export const ServiceItemSchema = yup.object({
  status: yup.string().required(),
  name: yup.string().required(),
  provider: yup.string().required(),
  usedBy: yup.array(yup.string()).optional(),
  type: yup.string().optional(), // Make type optional for generic services
  loadBalancer: LoadBalancerSchema.optional(),
  failover: FailoverConfigSchema.optional(),
  serverStatus: yup
    .object()
    .test("is-record", "serverStatus must be a record of strings", (value) => {
      if (value === undefined) return true;
      return (
        typeof value === "object" &&
        value !== null &&
        Object.values(value).every((v) => typeof v === "string")
      );
    })
    .optional(),
});

export const ServiceSchema = yup.array(ServiceItemSchema).required();

// Router Schema
export const RouterSchema = yup
  .array(
    yup.object({
      entryPoints: yup.array(yup.string().required()).required(),
      middlewares: yup.array(yup.string().required()).optional(),
      service: yup.string().required(),
      rule: yup.string().required(),
      priority: yup.number().required(),
      tls: yup.object({ options: yup.string().required() }).optional(),
      status: yup.string().required(),
      using: yup.array(yup.string().required()).required(),
      name: yup.string().required(),
      provider: yup.string().required(),
      ruleSyntax: yup.string().optional(),
    }),
  )
  .required();

const fetchTraefikData = <_T>(
  url: string,
  basicAuth?: string,
): ResultAsync<any[], Error> => {
  // Optionally disable TLS verification only when explicitly requested.
  // Enable by setting TRAEFIKTOP_INSECURE=1 (or run with --insecure flag).
  if (process.env.TRAEFIKTOP_INSECURE === "1") {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
  }

  return ResultAsync.fromPromise(
    (async () => {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), 5000); // 5 second timeout

      try {
        const headers = basicAuth
          ? {
              Authorization: `Basic ${Buffer.from(basicAuth).toString("base64")}`,
            }
          : undefined;
        const res = await fetch(url, { signal: controller.signal, headers });
        clearTimeout(id);
        if (!res.ok) {
          throw new Error(`Failed to fetch from ${url}: ${res.statusText}`);
        }
        return res.json();
      } catch (error) {
        clearTimeout(id);
        throw error;
      }
    })(),
    (e) => new Error(`Failed to fetch data: ${(e as Error).message}`),
  );
};

export const getRouters = (
  apiUrl: string,
  basicAuth?: string,
): ResultAsync<Router[], Error> =>
  fetchTraefikData(`${apiUrl}/api/http/routers`, basicAuth).andThen((data) => {
    try {
      const parsedRouters = RouterSchema.validateSync(data, {
        strict: true,
        abortEarly: false,
      });
      return ok(parsedRouters as Router[]);
    } catch (error) {
      console.error("Router parsing error:", error);
      return err(
        new Error(
          `Failed to parse router data: ${(error as yup.ValidationError).message}`,
        ),
      );
    }
  });

export const getServices = (
  apiUrl: string,
  basicAuth?: string,
): ResultAsync<Service[], Error> =>
  fetchTraefikData(`${apiUrl}/api/http/services`, basicAuth).andThen((data) => {
    try {
      const parsedServices = ServiceSchema.validateSync(data, {
        strict: true,
        abortEarly: false,
      });
      return ok(parsedServices as Service[]);
    } catch (error) {
      console.error("Service parsing error:", error);
      return err(
        new Error(
          `Failed to parse service data: ${(error as yup.ValidationError).message}`,
        ),
      );
    }
  });

export const getService = (
  apiUrl: string,
  serviceName: string,
  basicAuth?: string,
): ResultAsync<Service, Error> =>
  fetchTraefikData(
    `${apiUrl}/api/http/services/${encodeURIComponent(serviceName)}`,
    basicAuth,
  ).andThen((data) => {
    try {
      const parsedService = ServiceItemSchema.validateSync(data, {
        strict: true,
        abortEarly: false,
      });
      return ok(parsedService as Service);
    } catch (error) {
      console.error(`Single service (${serviceName}) parsing error:`, error);
      return err(
        new Error(
          `Failed to parse single service data for ${serviceName}: ${(error as yup.ValidationError).message}`,
        ),
      );
    }
  });

import { useEffect, useState } from "react";

import { getRouters, getServices } from "../api/traefik";
import type { Router, Service } from "../types/traefik";

export const useTraefikData = (apiUrl: string, basicAuth?: string) => {
  const [routers, setRouters] = useState<Router[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: refreshTick intentionally triggers refetch
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      const [routersResult, servicesResult] = await Promise.all([
        getRouters(apiUrl, basicAuth),
        getServices(apiUrl, basicAuth),
      ]);

      if (routersResult.isErr()) {
        console.error("Error fetching routers:", routersResult.error);
        setError(routersResult.error);
        setLoading(false);
        return;
      }

      if (servicesResult.isErr()) {
        console.error("Error fetching services:", servicesResult.error);
        setError(servicesResult.error);
        setLoading(false);
        return;
      }

      setRouters(routersResult.value);
      setServices(servicesResult.value);
      setLoading(false);
      setLastUpdated(Date.now());
    };

    fetchData();

    // Disabled auto-refresh for now to prevent excessive API calls
    // const intervalId = setInterval(fetchData, 5000); // Refresh every 5 seconds
    // return () => clearInterval(intervalId); // Cleanup on unmount
  }, [apiUrl, basicAuth, refreshTick]);
  const refresh = () => setRefreshTick((n) => n + 1);

  // Auto-refresh every 10s
  // biome-ignore lint/correctness/useExhaustiveDependencies: interval should reset only on apiUrl changes
  useEffect(() => {
    const id = setInterval(() => {
      setRefreshTick((n) => n + 1);
    }, 10_000);
    return () => clearInterval(id);
  }, [apiUrl, basicAuth]);

  return { routers, services, loading, error, refresh, lastUpdated };
};

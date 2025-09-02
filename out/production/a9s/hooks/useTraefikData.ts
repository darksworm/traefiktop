import { useEffect, useState } from "react";

import { getRouters, getServices } from "../api/traefik";
import type { Router, Service } from "../types/traefik";

export const useTraefikData = (apiUrl: string) => {
  const [routers, setRouters] = useState<Router[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const [routersResult, servicesResult] = await Promise.all([
        getRouters(apiUrl),
        getServices(apiUrl),
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
    };

    fetchData();

    // Disabled auto-refresh for now to prevent excessive API calls
    // const intervalId = setInterval(fetchData, 5000); // Refresh every 5 seconds
    // return () => clearInterval(intervalId); // Cleanup on unmount
  }, [apiUrl]);

  return { routers, services, loading, error };
};

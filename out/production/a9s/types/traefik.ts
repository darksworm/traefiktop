export interface Router {
  entryPoints: string[];
  middlewares: string[];
  service: string;
  rule: string;
  priority: number;
  tls?: {
    options: string;
  };
  status: string;
  using: string[];
  name: string;
  provider: string;
}

export interface Service {
  loadBalancer?: {
    servers: { url: string }[];
    healthCheck?: {
      mode: string;
      path: string;
      interval: string;
      timeout: string;
    };
  };
  failover?: {
    service: string;
    fallback: string;
  };
  status: string;
  serverStatus?: { [key: string]: string };
  usedBy?: string[];
  name: string;
  provider: string;
  type?: string;
}

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Router {
    #[serde(rename = "entryPoints")]
    pub entry_points: Vec<String>,
    pub middlewares: Option<Vec<String>>,
    pub service: String,
    pub rule: String,
    pub priority: i64, // Changed to i64 for very large priorities
    pub tls: Option<TlsConfig>,
    pub status: String,
    pub using: Vec<String>,
    pub name: String,
    pub provider: String,
    #[serde(rename = "ruleSyntax")]
    pub rule_syntax: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TlsConfig {
    pub options: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Service {
    #[serde(rename = "loadBalancer")]
    pub load_balancer: Option<LoadBalancer>,
    pub failover: Option<FailoverConfig>,
    pub status: String,
    #[serde(rename = "serverStatus")]
    pub server_status: Option<HashMap<String, String>>,
    #[serde(rename = "usedBy")]
    pub used_by: Option<Vec<String>>,
    pub name: String,
    pub provider: String,
    #[serde(rename = "type")]
    pub service_type: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LoadBalancer {
    pub servers: Vec<Server>,
    #[serde(rename = "healthCheck")]
    pub health_check: Option<HealthCheck>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Server {
    pub url: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HealthCheck {
    pub mode: String,
    pub path: String,
    pub interval: String,
    pub timeout: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FailoverConfig {
    pub service: String,
    pub fallback: String,
}

#[derive(Debug, Clone)]
pub struct TraefikData {
    pub routers: Vec<Router>,
    pub services: Vec<Service>,
}
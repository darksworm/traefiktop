use crate::types::{Router, Service, TraefikData};
use anyhow::{Context, Result};
use reqwest::Client;
use std::time::Duration;

pub struct TraefikClient {
    client: Client,
    base_url: String,
}

impl TraefikClient {
    pub fn new(base_url: String, insecure: bool) -> Result<Self> {
        let mut builder = Client::builder()
            .timeout(Duration::from_secs(5))
            .user_agent("traefiktop-rs/0.1.0");

        if insecure {
            builder = builder.danger_accept_invalid_certs(true);
        }

        let client = builder.build().context("Failed to build HTTP client")?;

        Ok(Self { client, base_url })
    }

    pub async fn get_routers(&self) -> Result<Vec<Router>> {
        let url = format!("{}/api/http/routers", self.base_url);
        let response = self
            .client
            .get(&url)
            .send()
            .await
            .context("Failed to send request to Traefik API")?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            return Err(anyhow::anyhow!(
                "Failed to fetch routers: HTTP {} - {}",
                status, body
            ));
        }

        let text = response.text().await.context("Failed to get response text")?;
        let routers: Vec<Router> = serde_json::from_str(&text)
            .context("Failed to parse routers JSON")?;

        Ok(routers)
    }

    pub async fn get_services(&self) -> Result<Vec<Service>> {
        let url = format!("{}/api/http/services", self.base_url);
        let response = self
            .client
            .get(&url)
            .send()
            .await
            .context("Failed to send request to Traefik API")?;

        if !response.status().is_success() {
            return Err(anyhow::anyhow!(
                "Failed to fetch services: HTTP {}",
                response.status()
            ));
        }

        let services: Vec<Service> = response
            .json()
            .await
            .context("Failed to parse services JSON")?;

        Ok(services)
    }

    pub async fn get_service(&self, service_name: &str) -> Result<Service> {
        let url = format!(
            "{}/api/http/services/{}",
            self.base_url,
            urlencoding::encode(service_name)
        );
        let response = self
            .client
            .get(&url)
            .send()
            .await
            .context("Failed to send request to Traefik API")?;

        if !response.status().is_success() {
            return Err(anyhow::anyhow!(
                "Failed to fetch service {}: HTTP {}",
                service_name,
                response.status()
            ));
        }

        let service: Service = response
            .json()
            .await
            .context("Failed to parse service JSON")?;

        Ok(service)
    }

    pub async fn fetch_all_data(&self) -> Result<TraefikData> {
        let (routers_result, services_result) = tokio::join!(self.get_routers(), self.get_services());

        let routers = routers_result.context("Failed to fetch routers")?;
        let services = services_result.context("Failed to fetch services")?;

        Ok(TraefikData { routers, services })
    }
}
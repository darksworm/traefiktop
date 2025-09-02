use crate::types::{Service, Router};
use std::collections::HashSet;

#[derive(Debug, Clone, PartialEq)]
pub enum ServiceStatus {
    Up,
    Down,
    Unknown,
}

#[derive(Debug, Clone)]
pub struct FailoverServices<'a> {
    pub primary: Option<&'a Service>,
    pub fallback: Option<&'a Service>,
}

/// Find service by name, supporting provider suffixes (e.g. service@provider)
pub fn find_service_by_name<'a>(target_name: &str, services: &'a [Service]) -> Option<&'a Service> {
    // First try exact match
    if let Some(service) = services.iter().find(|s| s.name == target_name) {
        return Some(service);
    }
    
    // Then try with provider suffix pattern
    services.iter().find(|s| {
        // Check if service name matches pattern: target_name(@provider)?
        if s.name.starts_with(target_name) {
            let remaining = &s.name[target_name.len()..];
            remaining.is_empty() || remaining.starts_with('@')
        } else {
            false
        }
    })
}

/// Get failover services for a given failover service
pub fn get_failover_services<'a>(
    service_name: &str,
    services: &'a [Service],
) -> FailoverServices<'a> {
    let failover_service = services.iter().find(|s| s.name == service_name);
    
    if let Some(service) = failover_service {
        if let Some(ref failover_config) = service.failover {
            let primary = find_service_by_name(&failover_config.service, services);
            let fallback = find_service_by_name(&failover_config.fallback, services);
            
            return FailoverServices { primary, fallback };
        }
    }
    
    FailoverServices {
        primary: None,
        fallback: None,
    }
}

/// Get the status of a service, handling failover recursively
pub fn get_service_status(
    service: &Service,
    all_services: &[Service],
    visited_services: &mut HashSet<String>,
) -> ServiceStatus {
    if visited_services.contains(&service.name) {
        // Circular dependency detected, break recursion
        return ServiceStatus::Unknown;
    }
    
    visited_services.insert(service.name.clone());
    
    let result = if service.service_type.as_deref() == Some("failover") || service.failover.is_some() {
        // Handle failover service
        let FailoverServices { primary, fallback } = get_failover_services(&service.name, all_services);
        
        let primary_status = if let Some(primary) = primary {
            get_service_status(primary, all_services, visited_services)
        } else {
            ServiceStatus::Unknown
        };
        
        if primary_status == ServiceStatus::Up {
            ServiceStatus::Up
        } else {
            let fallback_status = if let Some(fallback) = fallback {
                get_service_status(fallback, all_services, visited_services)
            } else {
                ServiceStatus::Unknown
            };
            
            if fallback_status == ServiceStatus::Up {
                ServiceStatus::Up
            } else if primary_status == ServiceStatus::Down || fallback_status == ServiceStatus::Down {
                ServiceStatus::Down
            } else {
                ServiceStatus::Unknown
            }
        }
    } else {
        // Handle regular service
        if let Some(ref server_status) = service.server_status {
            let statuses: Vec<&String> = server_status.values().collect();
            if statuses.iter().any(|status| *status == "UP") {
                ServiceStatus::Up
            } else if !statuses.is_empty() {
                ServiceStatus::Down
            } else {
                ServiceStatus::Unknown
            }
        } else {
            // If no serverStatus, check the service's enabled/disabled status
            match service.status.as_str() {
                "enabled" => ServiceStatus::Up,
                "disabled" => ServiceStatus::Down,
                _ => ServiceStatus::Unknown,
            }
        }
    };
    
    visited_services.remove(&service.name);
    result
}

/// Get all services that match a router's service name (with provider suffix support)
pub fn get_router_services<'a>(router: &Router, services: &'a [Service]) -> Vec<&'a Service> {
    services.iter().filter(|s| {
        // Check if service name matches pattern: router.service(@provider)?
        if s.name.starts_with(&router.service) {
            let remaining = &s.name[router.service.len()..];
            remaining.is_empty() || remaining.starts_with('@')
        } else {
            false
        }
    }).collect()
}

/// Determine router-level status and active service
pub fn get_router_status_info<'a>(router: &Router, services: &'a [Service]) -> (ServiceStatus, Option<&'a Service>, usize) {
    let router_services = get_router_services(router, services);
    let mut alive_count = 0;
    let mut active_service: Option<&Service> = None;
    
    for svc in &router_services {
        if svc.service_type.as_deref() == Some("failover") || svc.failover.is_some() {
            let FailoverServices { primary, fallback } = get_failover_services(&svc.name, services);
            
            let primary_status = if let Some(primary) = primary {
                get_service_status(primary, services, &mut HashSet::new())
            } else {
                ServiceStatus::Unknown
            };
            
            let fallback_status = if let Some(fallback) = fallback {
                get_service_status(fallback, services, &mut HashSet::new())
            } else {
                ServiceStatus::Unknown
            };
            
            if primary_status == ServiceStatus::Up {
                alive_count += 1;
                if active_service.is_none() {
                    active_service = primary;
                }
            } else if fallback_status == ServiceStatus::Up {
                alive_count += 1;
                if active_service.is_none() {
                    active_service = fallback;
                }
            }
        } else {
            let status = get_service_status(svc, services, &mut HashSet::new());
            if status == ServiceStatus::Up {
                alive_count += 1;
                if active_service.is_none() {
                    active_service = Some(svc);
                }
            }
        }
    }
    
    let router_status = if alive_count > 0 {
        ServiceStatus::Up
    } else if router_services.is_empty() {
        ServiceStatus::Unknown
    } else {
        ServiceStatus::Down
    };
    
    (router_status, active_service, alive_count)
}
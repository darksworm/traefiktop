use crate::api::TraefikClient;
use crate::service_status::{get_router_status_info, get_failover_services, get_service_status, ServiceStatus};
use crate::types::{Router, Service, TraefikData};
use std::collections::HashSet;
use anyhow::Result;
use ratatui::{
    layout::{Constraint, Direction, Layout, Rect},
    style::{Color, Modifier, Style},
    text::{Line, Span},
    widgets::{Block, Borders, List, ListItem, ListState, Paragraph},
    Frame,
};
use std::time::{Duration, Instant};

#[derive(Debug, Clone, PartialEq)]
pub enum AppState {
    Normal,
    Search,
    Loading,
    Error(String),
}

#[derive(Debug, Clone, PartialEq)]
pub enum SortMode {
    Dead,  // Dead services first
    Name,  // Alphabetical by name
}

pub struct App {
    pub state: AppState,
    pub should_quit: bool,
    pub traefik_data: Option<TraefikData>,
    pub filtered_routers: Vec<Router>,
    pub list_state: ListState,
    pub search_query: String,
    pub last_update: Option<Instant>,
    pub client: TraefikClient,
    pub refresh_interval: Duration,
    pub sort_mode: SortMode,
    pub scroll_offset: usize,
    pub selected_router_index: usize,
    pub pending_g_key: bool,
    pub ignore_patterns: Vec<String>,
}

impl App {
    pub fn new(api_url: String, insecure: bool, ignore_patterns: Vec<String>) -> Result<Self> {
        let client = TraefikClient::new(api_url, insecure)?;
        let mut list_state = ListState::default();
        list_state.select(Some(0));

        Ok(Self {
            state: AppState::Loading,
            should_quit: false,
            traefik_data: None,
            filtered_routers: Vec::new(),
            list_state,
            search_query: String::new(),
            last_update: None,
            client,
            refresh_interval: Duration::from_secs(30),
            sort_mode: SortMode::Dead, // Default to dead services first
            scroll_offset: 0,
            selected_router_index: 0,
            pending_g_key: false,
            ignore_patterns,
        })
    }

    pub async fn refresh_data(&mut self) -> Result<()> {
        self.state = AppState::Loading;
        match self.client.fetch_all_data().await {
            Ok(data) => {
                self.traefik_data = Some(data);
                self.update_filtered_routers();
                self.last_update = Some(Instant::now());
                self.state = if self.search_query.is_empty() {
                    AppState::Normal
                } else {
                    AppState::Search
                };
            }
            Err(e) => {
                self.state = AppState::Error(format!("Failed to fetch data: {}", e));
            }
        }
        Ok(())
    }

    pub fn update_filtered_routers(&mut self) {
        self.update_filtered_routers_with_reset(false);
    }

    fn matches_ignore_pattern(&self, router_name: &str) -> bool {
        let name_lower = router_name.to_lowercase();
        
        for pattern in &self.ignore_patterns {
            let pattern_lower = pattern.to_lowercase();
            
            let matches = if pattern_lower.starts_with('*') && pattern_lower.ends_with('*') {
                // Contains pattern: *foo*
                let middle = &pattern_lower[1..pattern_lower.len()-1];
                name_lower.contains(middle)
            } else if pattern_lower.starts_with('*') {
                // Ends with pattern: *foo
                let suffix = &pattern_lower[1..];
                name_lower.ends_with(suffix)
            } else if pattern_lower.ends_with('*') {
                // Starts with pattern: foo*
                let prefix = &pattern_lower[..pattern_lower.len()-1];
                name_lower.starts_with(prefix)
            } else {
                // For patterns without wildcards, treat as "contains" to match TypeScript behavior
                name_lower.contains(&pattern_lower)
            };
            
            if matches {
                return true;
            }
        }
        
        false
    }

    pub fn update_filtered_routers_with_reset(&mut self, reset_position: bool) {
        if let Some(ref data) = self.traefik_data {
            // First filter by ignore patterns
            let mut filtered: Vec<Router> = data
                .routers
                .iter()
                .filter(|router| !self.matches_ignore_pattern(&router.name))
                .cloned()
                .collect();

            // Then filter by search query
            if !self.search_query.is_empty() {
                filtered = filtered
                    .into_iter()
                    .filter(|router| {
                        router.name.to_lowercase().contains(&self.search_query.to_lowercase())
                            || router.rule.to_lowercase().contains(&self.search_query.to_lowercase())
                            || router.service.to_lowercase().contains(&self.search_query.to_lowercase())
                    })
                    .collect();
            }

            // Then sort based on sort mode
            match self.sort_mode {
                SortMode::Dead => {
                    // Sort by router status (dead first), then by name
                    filtered.sort_by(|a, b| {
                        let a_status = get_router_status_info(a, &data.services).0;
                        let b_status = get_router_status_info(b, &data.services).0;
                        
                        // Dead services first (Down < Up < Unknown)
                        let status_order = |status: &ServiceStatus| match status {
                            ServiceStatus::Down => 0,
                            ServiceStatus::Up => 1,
                            ServiceStatus::Unknown => 2,
                        };
                        
                        status_order(&a_status).cmp(&status_order(&b_status))
                            .then_with(|| a.name.cmp(&b.name))
                    });
                }
                SortMode::Name => {
                    // Sort alphabetically by name
                    filtered.sort_by(|a, b| a.name.cmp(&b.name));
                }
            }

            self.filtered_routers = filtered;

            // Only reset position when explicitly requested (search/sort changes)
            if reset_position {
                self.scroll_offset = 0;
                self.selected_router_index = 0;
            } else {
                // Ensure selection is still valid after refresh
                if self.selected_router_index >= self.filtered_routers.len() && !self.filtered_routers.is_empty() {
                    self.selected_router_index = self.filtered_routers.len() - 1;
                }
            }

            // Update list state for compatibility
            if !self.filtered_routers.is_empty() {
                self.list_state.select(Some(self.selected_router_index));
            } else {
                self.list_state.select(None);
                self.selected_router_index = 0;
                self.scroll_offset = 0;
            }
        }
    }

    pub fn next_router(&mut self) {
        if self.filtered_routers.is_empty() {
            return;
        }
        
        if self.selected_router_index < self.filtered_routers.len() - 1 {
            self.selected_router_index += 1;
        }
    }

    pub fn previous_router(&mut self) {
        if self.filtered_routers.is_empty() {
            return;
        }
        
        if self.selected_router_index > 0 {
            self.selected_router_index -= 1;
        }
    }

    pub fn go_to_first_router(&mut self) {
        if !self.filtered_routers.is_empty() {
            self.selected_router_index = 0;
        }
    }

    pub fn go_to_last_router(&mut self) {
        if !self.filtered_routers.is_empty() {
            self.selected_router_index = self.filtered_routers.len() - 1;
        }
    }

    pub fn page_down(&mut self, page_size: usize) {
        if self.filtered_routers.is_empty() {
            return;
        }
        
        let new_index = (self.selected_router_index + page_size).min(self.filtered_routers.len() - 1);
        self.selected_router_index = new_index;
    }

    pub fn page_up(&mut self, page_size: usize) {
        if self.filtered_routers.is_empty() {
            return;
        }
        
        let new_index = self.selected_router_index.saturating_sub(page_size);
        self.selected_router_index = new_index;
    }

    fn get_router_start_line(&self, router_index: usize) -> usize {
        let mut line_count = 0;
        let all_services = self.traefik_data.as_ref().map(|d| &d.services[..]).unwrap_or(&[]);
        
        for i in 0..router_index {
            if i >= self.filtered_routers.len() {
                break;
            }
            
            let router = &self.filtered_routers[i];
            
            // Router name line
            line_count += 1;
            // Rule line
            line_count += 1;
            
            // Service lines
            if let Some(main_service) = self.get_service_for_router(router) {
                if main_service.service_type.as_deref() == Some("failover") || main_service.failover.is_some() {
                    // Failover service line + primary + fallback lines
                    line_count += 3;
                } else {
                    // Regular service line
                    line_count += 1;
                    // Server lines (if this router is selected)
                    if i == self.selected_router_index {
                        if let Some(ref lb) = main_service.load_balancer {
                            line_count += lb.servers.len();
                        }
                    }
                }
            } else {
                // Service not found line
                line_count += 1;
            }
            
            // Empty line separator (except for last router)
            if i < self.filtered_routers.len() - 1 {
                line_count += 1;
            }
        }
        
        line_count
    }

    pub fn ensure_selected_visible(&mut self, viewport_height: usize) {
        if self.filtered_routers.is_empty() {
            return;
        }
        
        let router_start_line = self.get_router_start_line(self.selected_router_index);
        let total_lines = self.calculate_total_lines();
        
        // Calculate how many lines this router takes
        let router_lines = if self.selected_router_index < self.filtered_routers.len() - 1 {
            self.get_router_start_line(self.selected_router_index + 1) - router_start_line
        } else {
            total_lines - router_start_line
        };
        
        // Ensure the selected router is visible
        if router_start_line < self.scroll_offset {
            // Router is above the viewport, scroll up to show it
            self.scroll_offset = router_start_line;
        } else if router_start_line + router_lines > self.scroll_offset + viewport_height {
            // Router is below the viewport, scroll down to show it
            if router_lines <= viewport_height {
                self.scroll_offset = (router_start_line + router_lines).saturating_sub(viewport_height);
            } else {
                // Router is bigger than viewport, show the start
                self.scroll_offset = router_start_line;
            }
        }
        
        // Ensure scroll_offset doesn't exceed bounds
        if total_lines > viewport_height {
            let max_scroll = total_lines - viewport_height;
            if self.scroll_offset > max_scroll {
                self.scroll_offset = max_scroll;
            }
        } else {
            self.scroll_offset = 0;
        }
    }

    fn calculate_total_lines(&self) -> usize {
        let mut total_lines = 0;
        for (i, router) in self.filtered_routers.iter().enumerate() {
            // Router name line
            total_lines += 1;
            // Rule line
            total_lines += 1;
            
            // Service lines
            if let Some(ref data) = self.traefik_data {
                if let Some(main_service) = self.get_service_for_router(router) {
                    if main_service.service_type.as_deref() == Some("failover") || main_service.failover.is_some() {
                        // Failover service line
                        total_lines += 1;
                        // Primary and fallback lines
                        total_lines += 2;
                    } else {
                        // Regular service line
                        total_lines += 1;
                        // Server lines (if service is selected)
                        if i == self.selected_router_index {
                            if let Some(ref lb) = main_service.load_balancer {
                                total_lines += lb.servers.len();
                            }
                        }
                    }
                } else {
                    // Service not found line
                    total_lines += 1;
                }
            }
            
            // Empty line separator (except for last router)
            if i < self.filtered_routers.len() - 1 {
                total_lines += 1;
            }
        }
        total_lines
    }


    pub fn enter_search_mode(&mut self) {
        self.state = AppState::Search;
    }

    pub fn exit_search_mode(&mut self) {
        self.state = AppState::Normal;
        self.search_query.clear();
        self.update_filtered_routers_with_reset(true); // Reset position when clearing search
    }

    pub fn update_search_query(&mut self, query: String) {
        self.search_query = query;
        self.update_filtered_routers_with_reset(true); // Reset position on search change
    }

    pub fn quit(&mut self) {
        self.should_quit = true;
    }

    pub fn toggle_sort_mode(&mut self) {
        self.sort_mode = match self.sort_mode {
            SortMode::Dead => SortMode::Name,
            SortMode::Name => SortMode::Dead,
        };
        self.update_filtered_routers_with_reset(true); // Reset position on sort change
    }

    pub fn get_selected_router(&self) -> Option<&Router> {
        self.list_state
            .selected()
            .and_then(|i| self.filtered_routers.get(i))
    }

    pub fn get_service_for_router(&self, router: &Router) -> Option<&Service> {
        let services = &self.traefik_data.as_ref()?.services;
        crate::service_status::find_service_by_name(&router.service, services)
    }

    pub fn get_service_by_name(&self, service_name: &str) -> Option<&Service> {
        let services = &self.traefik_data.as_ref()?.services;
        crate::service_status::find_service_by_name(service_name, services)
    }

    pub fn render(&mut self, frame: &mut Frame) {
        let size = frame.area();

        // Create layout - always just main content + footer
        let chunks = Layout::default()
            .direction(Direction::Vertical)
            .constraints([
                Constraint::Min(0),    // Main content  
                Constraint::Length(1), // Footer/Status
            ])
            .split(size);

        self.render_main_content(frame, chunks[0]);
        self.render_footer(frame, chunks[1]);
    }

    fn render_header(&self, frame: &mut Frame, area: Rect) {
        let title = match &self.state {
            AppState::Search => {
                if self.search_query.is_empty() {
                    format!("🔍 Press / to search ({} routers)", self.filtered_routers.len())
                } else {
                    format!("Filter: {}", self.search_query)
                }
            },
            AppState::Loading => "⏳ Loading Traefik data...".to_string(),
            AppState::Error(_) => "❌ Error loading data".to_string(),
            AppState::Normal => {
                let total_routers = self.traefik_data.as_ref().map(|d| d.routers.len()).unwrap_or(0);
                format!("🔍 Press / to search ({} routers)", total_routers)
            },
        };

        let header = Paragraph::new(title)
            .style(Style::default().fg(Color::Gray));

        frame.render_widget(header, area);
    }

    fn render_main_content(&mut self, frame: &mut Frame, area: Rect) {
        match &self.state {
            AppState::Loading => {
                let loading = Paragraph::new("Loading Traefik data...")
                    .style(Style::default().fg(Color::Yellow));
                frame.render_widget(loading, area);
            }
            AppState::Error(error) => {
                let error_msg = Paragraph::new(format!("Error: {}", error))
                    .style(Style::default().fg(Color::Red));
                frame.render_widget(error_msg, area);
            }
            _ => {
                self.render_router_list(frame, area);
            }
        }
    }

    fn render_router_list(&mut self, frame: &mut Frame, area: Rect) {
        if self.filtered_routers.is_empty() {
            let empty_msg = if self.search_query.is_empty() {
                "No routers found"
            } else {
                "No routers match your search"
            };
            let paragraph = Paragraph::new(empty_msg)
                .style(Style::default().fg(Color::Gray));
            frame.render_widget(paragraph, area);
            return;
        }

        let viewport_height = area.height as usize;
        
        // Ensure selected router is visible and adjust scroll if needed
        self.ensure_selected_visible(viewport_height);
        
        // Generate all lines for all routers
        let mut all_lines = Vec::new();
        let all_services = self.traefik_data.as_ref().map(|d| &d.services[..]).unwrap_or(&[]);
        
        for (i, router) in self.filtered_routers.iter().enumerate() {
            let selected = i == self.selected_router_index;
            
            // Get router status and active service using the proper TypeScript logic
            let (router_status, _active_service, _alive_count) = get_router_status_info(router, all_services);
            let is_down = router_status == ServiceStatus::Down;
            
            // Router name with appropriate emoji and colors based on status
            let (icon, icon_color, name_style) = if is_down {
                ("💀", Color::White, if selected { Style::default().fg(Color::Black).bg(Color::Cyan).add_modifier(Modifier::BOLD) } else { Style::default().fg(Color::Red).add_modifier(Modifier::BOLD) })
            } else {
                ("⬢ ", Color::Cyan, if selected { Style::default().fg(Color::Black).bg(Color::Cyan).add_modifier(Modifier::BOLD) } else { Style::default().fg(Color::White).add_modifier(Modifier::BOLD) })
            };
            
            all_lines.push(Line::from(vec![
                Span::styled(icon, Style::default().fg(icon_color)),
                Span::styled(router.name.clone(), name_style),
            ]));

            // Rule with arrow
            all_lines.push(Line::from(vec![
                Span::raw("  "),
                Span::styled("→", Style::default().fg(Color::Yellow)),
                Span::raw(" "),
                Span::styled(router.rule.clone(), Style::default().fg(Color::DarkGray)),
            ]));

            // Find the main service that matches the router
            if let Some(main_service) = self.get_service_for_router(router) {
                // Check if this is a failover service
                if main_service.service_type.as_deref() == Some("failover") || main_service.failover.is_some() {
                    // Show failover service
                    all_lines.push(Line::from(vec![
                        Span::raw("  └── "),
                        Span::styled(
                            format!("{} (failover)", main_service.name),
                            Style::default().fg(Color::Magenta),
                        ),
                    ]));

                    // Show failover target services
                    let failover_services = get_failover_services(&main_service.name, all_services);
                    
                    if let Some(primary) = failover_services.primary {
                        let primary_status = get_service_status(primary, all_services, &mut HashSet::new());
                        let (status_icon, status_color, service_color, line_color) = match primary_status {
                            ServiceStatus::Up => ("✓", Color::Green, Color::White, Color::White),
                            ServiceStatus::Down => ("✗", Color::Red, Color::DarkGray, Color::DarkGray),
                            ServiceStatus::Unknown => ("?", Color::Yellow, Color::DarkGray, Color::DarkGray),
                        };
                        
                        all_lines.push(Line::from(vec![
                            Span::styled("      ├── ", Style::default().fg(line_color)),
                            Span::styled(status_icon, Style::default().fg(status_color)),
                            Span::raw(" "),
                            Span::styled(primary.name.clone(), Style::default().fg(service_color)),
                        ]));
                    }
                    
                    if let Some(fallback) = failover_services.fallback {
                        let fallback_status = get_service_status(fallback, all_services, &mut HashSet::new());
                        let (status_icon, status_color, service_color, line_color) = match fallback_status {
                            ServiceStatus::Up => ("✓", Color::Green, Color::White, Color::White),
                            ServiceStatus::Down => ("✗", Color::Red, Color::DarkGray, Color::DarkGray),
                            ServiceStatus::Unknown => ("?", Color::Yellow, Color::DarkGray, Color::DarkGray),
                        };
                        
                        all_lines.push(Line::from(vec![
                            Span::styled("      └── ", Style::default().fg(line_color)),
                            Span::styled(status_icon, Style::default().fg(status_color)),
                            Span::raw(" "),
                            Span::styled(fallback.name.clone(), Style::default().fg(service_color)),
                        ]));
                    }
                } else {
                    // Regular service
                    all_lines.push(Line::from(vec![
                        Span::raw("  └── "),
                        Span::styled(main_service.name.clone(), Style::default().fg(Color::Magenta)),
                    ]));

                    // Show load balancer servers when selected
                    if selected {
                        if let Some(ref lb) = main_service.load_balancer {
                            for (idx, server) in lb.servers.iter().enumerate() {
                                let is_last = idx == lb.servers.len() - 1;
                                let tree_char = if is_last { "└──" } else { "├──" };
                                
                                // Check server status from serverStatus if available
                                let server_status = main_service.server_status
                                    .as_ref()
                                    .and_then(|status_map| status_map.get(&server.url))
                                    .map(|s| s.as_str())
                                    .unwrap_or("unknown");
                                
                                let (status_icon, status_color, server_color, line_color) = if server_status == "UP" {
                                    ("✓", Color::Green, Color::White, Color::White)
                                } else {
                                    ("✗", Color::Red, Color::DarkGray, Color::DarkGray)
                                };
                                
                                all_lines.push(Line::from(vec![
                                    Span::styled(format!("      {} ", tree_char), Style::default().fg(line_color)),
                                    Span::styled(status_icon, Style::default().fg(status_color)),
                                    Span::raw(" "),
                                    Span::styled(server.url.clone(), Style::default().fg(server_color)),
                                ]));
                            }
                        }
                    }
                }
            } else {
                // Service not found
                all_lines.push(Line::from(vec![
                    Span::raw("  └── "),
                    Span::styled(
                        format!("{} (not found)", router.service),
                        Style::default().fg(Color::Red),
                    ),
                ]));
            }

            // Add empty line after each router except the last one
            if i < self.filtered_routers.len() - 1 {
                all_lines.push(Line::from(""));
            }
        }

        // Apply scrolling - show only the lines that fit in the viewport
        let visible_lines: Vec<Line> = all_lines
            .into_iter()
            .skip(self.scroll_offset)
            .take(viewport_height)
            .collect();

        // Fill remaining space with empty lines if needed
        let mut display_lines = visible_lines;
        while display_lines.len() < viewport_height {
            display_lines.push(Line::from(""));
        }

        let paragraph = Paragraph::new(display_lines);
        frame.render_widget(paragraph, area);
    }

    fn render_footer(&self, frame: &mut Frame, area: Rect) {
        let footer = match &self.state {
            AppState::Search => {
                let search_content = if self.search_query.is_empty() {
                    "Search: (type to filter routers) | ESC: exit | Enter: accept".to_string()
                } else {
                    format!("Search: {} | ESC: exit | Enter: accept", self.search_query)
                };
                Paragraph::new(search_content)
                    .style(Style::default().fg(Color::Yellow))
            }
            _ => {
                let sort_mode_str = match self.sort_mode {
                    SortMode::Dead => "dead",
                    SortMode::Name => "name",
                };

                let mut footer_spans = vec![
                    Span::raw("q: quit | r: refresh | /: search | s: sort | sort: "),
                    Span::styled(sort_mode_str, Style::default().fg(Color::Cyan)),
                ];

                if let Some(last_update) = self.last_update {
                    let elapsed = last_update.elapsed();
                    footer_spans.push(Span::raw(format!(
                        " | {}s ago",
                        elapsed.as_secs()
                    )));
                }

                Paragraph::new(Line::from(footer_spans))
                    .style(Style::default().fg(Color::Gray))
            }
        };

        frame.render_widget(footer, area);
    }
}
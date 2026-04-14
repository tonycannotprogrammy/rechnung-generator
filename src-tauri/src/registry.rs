use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use crate::config;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Receipt {
    pub file_name: String,
    pub path: String,
    pub date: String,
    pub vendor: String,
    pub category: String,
    pub amount: f64,
    pub status: String,
    #[serde(default)]
    pub row_data: serde_json::Value,
    #[serde(default)]
    pub invoice_num: u32,
}

/// Returns the active profile's storage directory.
/// Path: {storage_path}/{active_profile}/
pub fn get_storage_dir() -> PathBuf {
    let cfg = config::load_local_config();
    let base = PathBuf::from(&cfg.storage_path);
    let dir = base.join(&cfg.active_profile);
    if !dir.exists() {
        let _ = fs::create_dir_all(&dir);
    }
    dir
}

/// Returns the root storage path (the shared folder).
pub fn get_root_storage_dir() -> PathBuf {
    let cfg = config::load_local_config();
    PathBuf::from(&cfg.storage_path)
}

pub fn get_registry_path() -> PathBuf {
    let dir = get_storage_dir();
    dir.join("registry.json")
}

pub fn load_registry() -> Vec<Receipt> {
    let path = get_registry_path();
    if path.exists() {
        if let Ok(content) = fs::read_to_string(&path) {
            if let Ok(registry) = serde_json::from_str(&content) {
                return registry;
            }
        }
    }
    Vec::new()
}

pub fn save_registry(registry: &Vec<Receipt>) -> Result<(), String> {
    let path = get_registry_path();
    let content = serde_json::to_string_pretty(registry).map_err(|e| e.to_string())?;
    fs::write(path, content).map_err(|e| e.to_string())
}

/// Migrate data from the old ~/Documents/Receipts location to the new profile-based location.
/// Called once on startup.
pub fn migrate_if_needed() {
    let old_dir = dirs::document_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("Receipts");

    let new_dir = get_storage_dir();

    // Only migrate if old location exists AND new profile dir doesn't have settings yet
    let old_settings = old_dir.join("settings.json");
    let new_settings = new_dir.join("settings.json");

    if old_settings.exists() && !new_settings.exists() {
        let _ = fs::create_dir_all(&new_dir);

        // Copy settings.json
        if let Ok(content) = fs::read_to_string(&old_settings) {
            let _ = fs::write(&new_settings, content);
        }

        // Copy registry.json
        let old_registry = old_dir.join("registry.json");
        let new_registry = new_dir.join("registry.json");
        if old_registry.exists() && !new_registry.exists() {
            if let Ok(content) = fs::read_to_string(&old_registry) {
                let _ = fs::write(&new_registry, content);
            }
        }
    }
}

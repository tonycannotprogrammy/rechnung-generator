use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

/// Machine-local configuration — NOT shared across network/iCloud.
/// Stores where the shared data lives and which profile is active.
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct LocalConfig {
    pub storage_path: String,
    pub active_profile: String,
}

impl Default for LocalConfig {
    fn default() -> Self {
        let docs = dirs::document_dir().unwrap_or_else(|| PathBuf::from("."));
        LocalConfig {
            storage_path: docs.join("RechnungGenerator").to_string_lossy().to_string(),
            active_profile: "Standard".to_string(),
        }
    }
}

/// Returns the path to the local (machine-only) config file.
/// macOS: ~/Library/Application Support/RechnungGenerator/local_config.json
/// Windows: %APPDATA%/RechnungGenerator/local_config.json
pub fn get_local_config_path() -> PathBuf {
    let config_dir = dirs::config_dir().unwrap_or_else(|| {
        dirs::home_dir()
            .unwrap_or_else(|| PathBuf::from("."))
            .join(".config")
    });
    let dir = config_dir.join("RechnungGenerator");
    if !dir.exists() {
        let _ = fs::create_dir_all(&dir);
    }
    dir.join("local_config.json")
}

pub fn load_local_config() -> LocalConfig {
    let path = get_local_config_path();
    if path.exists() {
        if let Ok(content) = fs::read_to_string(&path) {
            if let Ok(config) = serde_json::from_str(&content) {
                return config;
            }
        }
    }
    let config = LocalConfig::default();
    let _ = save_local_config(&config);
    config
}

pub fn save_local_config(config: &LocalConfig) -> Result<(), String> {
    let path = get_local_config_path();
    let content = serde_json::to_string_pretty(config).map_err(|e| e.to_string())?;
    fs::write(path, content).map_err(|e| e.to_string())
}

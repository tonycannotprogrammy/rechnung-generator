use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Receipt {
    pub file_name: String,
    pub path: String,
    pub date: String,
    pub vendor: String,
    pub category: String,
    pub amount: f64,
    pub status: String,
}

pub fn get_storage_dir() -> PathBuf {
    let docs = dirs::document_dir().unwrap_or_else(|| PathBuf::from("."));
    docs.join("Receipts")
}

pub fn get_registry_path() -> PathBuf {
    let dir = get_storage_dir();
    if !dir.exists() {
        let _ = fs::create_dir_all(&dir);
    }
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

use tauri::command;
use std::fs;
use std::path::PathBuf;
use tauri_plugin_shell::ShellExt;
use tauri_plugin_dialog::DialogExt;
use serde_json::Value;
use crate::config::{self, LocalConfig};
use crate::registry::{self, Receipt};

// ═══════════════════════════════════════════════════════
//  REGISTRY COMMANDS
// ═══════════════════════════════════════════════════════

#[command]
pub fn get_registry() -> Vec<Receipt> {
    registry::load_registry()
}

#[command]
pub fn add_receipt(metadata: Receipt, _pdf_bytes: Vec<u8>) -> Result<Receipt, String> {
    let mut reg = registry::load_registry();
    let root = registry::get_storage_dir();

    let parts: Vec<&str> = metadata.date.split('-').collect();
    let year = if !parts.is_empty() { parts[0] } else { "Unknown" };
    let month = if parts.len() > 1 { parts[1] } else { "XX" };

    let target_dir = root.join(year).join(month);
    fs::create_dir_all(&target_dir).map_err(|e| e.to_string())?;

    let path = target_dir.join(&metadata.file_name);
    // We don't store PDFs — they are generated on-the-fly from row_data

    let mut updated_metadata = metadata.clone();
    updated_metadata.path = path.to_string_lossy().to_string();

    reg.push(updated_metadata.clone());
    registry::save_registry(&reg)?;
    Ok(updated_metadata)
}

#[command]
pub fn save_temp_pdf(file_name: String, pdf_bytes: Vec<u8>) -> Result<String, String> {
    let temp_dir = std::env::temp_dir();
    let path = temp_dir.join(file_name);
    fs::write(&path, pdf_bytes).map_err(|e| e.to_string())?;
    Ok(path.to_string_lossy().to_string())
}

#[command]
pub fn update_receipt_status(file_name: String, status: String) -> Result<(), String> {
    let mut reg = registry::load_registry();
    if let Some(r) = reg.iter_mut().find(|r| r.file_name == file_name) {
        r.status = status;
        registry::save_registry(&reg)
    } else {
        Err("Receipt not found".into())
    }
}

#[command]
pub fn delete_receipt(file_name: String) -> Result<(), String> {
    let mut reg = registry::load_registry();
    if let Some(pos) = reg.iter().position(|r| r.file_name == file_name) {
        let r = reg.remove(pos);
        let path = PathBuf::from(&r.path);
        if path.exists() {
            let _ = fs::remove_file(path);
        }
        registry::save_registry(&reg)
    } else {
        Err("Receipt not found".into())
    }
}

// ═══════════════════════════════════════════════════════
//  EMAIL & PRINT COMMANDS
// ═══════════════════════════════════════════════════════

#[command]
pub fn open_email(app: tauri::AppHandle, to: String, subject: String, body: String, _attachment_path: Option<String>) -> Result<(), String> {
    let mailto = format!("mailto:{}?subject={}&body={}",
        urlencoding::encode(&to),
        urlencoding::encode(&subject),
        urlencoding::encode(&body)
    );
    app.shell().open(&mailto, None).map_err(|e| e.to_string())
}

#[command]
pub async fn print_file(app: tauri::AppHandle, path: String) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    let res = app.shell().command("lp").args(&[&path]).output().await;

    #[cfg(target_os = "windows")]
    let res = app.shell().command("powershell").args(&["-Command", &format!("Start-Process -FilePath \"{}\" -Verb Print", path)]).output().await;

    #[cfg(target_os = "linux")]
    let res = app.shell().command("lp").args(&[&path]).output().await;

    match res {
        Ok(_) => Ok(()),
        Err(e) => Err(e.to_string()),
    }
}

// ═══════════════════════════════════════════════════════
//  SETTINGS COMMANDS
// ═══════════════════════════════════════════════════════

#[command]
pub fn get_settings() -> Result<Value, String> {
    let settings_path = registry::get_storage_dir().join("settings.json");
    if settings_path.exists() {
        let content = fs::read_to_string(&settings_path).map_err(|e| e.to_string())?;
        serde_json::from_str(&content).map_err(|e| e.to_string())
    } else {
        Ok(serde_json::json!({}))
    }
}

#[command]
pub fn save_settings(settings: Value) -> Result<(), String> {
    let dir = registry::get_storage_dir();
    if !dir.exists() {
        fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    }
    let settings_path = dir.join("settings.json");
    let content = serde_json::to_string_pretty(&settings).map_err(|e| e.to_string())?;
    fs::write(settings_path, content).map_err(|e| e.to_string())
}

#[command]
pub fn get_storage_path() -> String {
    let cfg = config::load_local_config();
    cfg.storage_path
}

#[command]
pub async fn pick_folder(app: tauri::AppHandle) -> Result<Option<String>, String> {
    if let Some(folder) = app.dialog().file().blocking_pick_folder() {
        Ok(Some(folder.to_string()))
    } else {
        Ok(None)
    }
}

// ═══════════════════════════════════════════════════════
//  PROFILE & STORAGE COMMANDS
// ═══════════════════════════════════════════════════════

#[command]
pub fn get_local_config() -> LocalConfig {
    config::load_local_config()
}

#[command]
pub fn set_storage_path(path: String) -> Result<(), String> {
    let mut cfg = config::load_local_config();
    let new_base = PathBuf::from(&path);
    if !new_base.exists() {
        fs::create_dir_all(&new_base).map_err(|e| e.to_string())?;
    }
    // Ensure active profile dir exists in new location
    let profile_dir = new_base.join(&cfg.active_profile);
    if !profile_dir.exists() {
        fs::create_dir_all(&profile_dir).map_err(|e| e.to_string())?;
    }
    cfg.storage_path = path;
    config::save_local_config(&cfg)
}

#[command]
pub fn get_profiles() -> Vec<String> {
    let cfg = config::load_local_config();
    let base = PathBuf::from(&cfg.storage_path);
    if !base.exists() {
        return vec![cfg.active_profile];
    }
    let mut profiles = Vec::new();
    if let Ok(entries) = fs::read_dir(&base) {
        for entry in entries.flatten() {
            if entry.file_type().map(|t| t.is_dir()).unwrap_or(false) {
                if let Some(name) = entry.file_name().to_str() {
                    // Only include directories that look like profiles (not year folders like "2024")
                    if !name.starts_with('.') && name.parse::<u32>().is_err() {
                        profiles.push(name.to_string());
                    }
                }
            }
        }
    }
    if profiles.is_empty() {
        profiles.push(cfg.active_profile);
    }
    profiles.sort();
    profiles
}

#[command]
pub fn get_active_profile() -> String {
    config::load_local_config().active_profile
}

#[command]
pub fn switch_profile(profile_name: String) -> Result<(), String> {
    let mut cfg = config::load_local_config();
    let profile_dir = PathBuf::from(&cfg.storage_path).join(&profile_name);
    if !profile_dir.exists() {
        return Err(format!("Profile '{}' does not exist", profile_name));
    }
    cfg.active_profile = profile_name;
    config::save_local_config(&cfg)
}

#[command]
pub fn create_profile(profile_name: String) -> Result<(), String> {
    let cfg = config::load_local_config();
    let profile_dir = PathBuf::from(&cfg.storage_path).join(&profile_name);
    if profile_dir.exists() {
        return Err(format!("Profile '{}' already exists", profile_name));
    }
    fs::create_dir_all(&profile_dir).map_err(|e| e.to_string())?;
    // Create empty settings and registry
    let empty_settings = serde_json::json!({});
    let content = serde_json::to_string_pretty(&empty_settings).map_err(|e| e.to_string())?;
    fs::write(profile_dir.join("settings.json"), content).map_err(|e| e.to_string())?;
    let empty_reg: Vec<Receipt> = Vec::new();
    let reg_content = serde_json::to_string_pretty(&empty_reg).map_err(|e| e.to_string())?;
    fs::write(profile_dir.join("registry.json"), reg_content).map_err(|e| e.to_string())?;
    Ok(())
}

#[command]
pub fn delete_profile(profile_name: String) -> Result<(), String> {
    let cfg = config::load_local_config();
    if cfg.active_profile == profile_name {
        return Err("Cannot delete the currently active profile".into());
    }
    let profile_dir = PathBuf::from(&cfg.storage_path).join(&profile_name);
    if profile_dir.exists() {
        fs::remove_dir_all(&profile_dir).map_err(|e| e.to_string())?;
    }
    Ok(())
}

// ═══════════════════════════════════════════════════════
//  MIGRATION (called once on startup)
// ═══════════════════════════════════════════════════════

#[command]
pub fn run_migration() {
    registry::migrate_if_needed();
}

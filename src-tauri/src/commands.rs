use tauri::command;
use std::fs;
use std::path::PathBuf;
use tauri_plugin_shell::ShellExt;
use tauri_plugin_dialog::DialogExt;
use serde_json::Value;
use crate::registry::{self, Receipt};

#[command]
pub fn get_registry() -> Vec<Receipt> {
    registry::load_registry()
}

#[command]
pub fn add_receipt(metadata: Receipt, pdf_bytes: Vec<u8>) -> Result<Receipt, String> {
    let mut reg = registry::load_registry();
    let root = registry::get_storage_dir();
    
    let parts: Vec<&str> = metadata.date.split('-').collect();
    let year = if !parts.is_empty() { parts[0] } else { "Unknown" };
    let month = if parts.len() > 1 { parts[1] } else { "XX" };
    
    let target_dir = root.join(year).join(month);
    fs::create_dir_all(&target_dir).map_err(|e| e.to_string())?;
    
    let path = target_dir.join(&metadata.file_name);
    fs::write(&path, pdf_bytes).map_err(|e| e.to_string())?;
    
    let mut updated_metadata = metadata.clone();
    updated_metadata.path = path.to_string_lossy().to_string();
    
    reg.push(updated_metadata.clone());
    registry::save_registry(&reg)?;
    Ok(updated_metadata)
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

#[command]
pub fn open_email(app: tauri::AppHandle, to: String, subject: String, body: String, attachment_path: Option<String>) -> Result<(), String> {
    let mailto = if let Some(_path) = attachment_path {
        format!("mailto:{}?subject={}&body={}", 
            urlencoding::encode(&to), 
            urlencoding::encode(&subject), 
            urlencoding::encode(&body)
        )
    } else {
        format!("mailto:{}?subject={}&body={}", 
            urlencoding::encode(&to), 
            urlencoding::encode(&subject), 
            urlencoding::encode(&body)
        )
    };
    
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
    registry::get_storage_dir().to_string_lossy().to_string()
}

#[command]
pub async fn pick_folder(app: tauri::AppHandle) -> Result<Option<String>, String> {
    if let Some(folder) = app.dialog().file().blocking_pick_folder() {
        Ok(Some(folder.to_string()))
    } else {
        Ok(None)
    }
}

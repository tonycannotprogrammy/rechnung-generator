pub mod commands;
pub mod registry;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            commands::get_registry,
            commands::add_receipt,
            commands::update_receipt_status,
            commands::delete_receipt,
            commands::open_email,
            commands::print_file,
            commands::get_settings,
            commands::save_settings,
            commands::get_storage_path,
            commands::pick_folder
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

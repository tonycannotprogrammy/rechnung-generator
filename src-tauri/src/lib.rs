pub mod commands;
pub mod config;
pub mod registry;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            // Registry
            commands::get_registry,
            commands::add_receipt,
            commands::save_temp_pdf,
            commands::update_receipt_status,
            commands::delete_receipt,
            // Email & Print
            commands::open_pdf,
            commands::open_email,
            commands::print_file,
            // Settings
            commands::get_settings,
            commands::save_settings,
            commands::get_storage_path,
            commands::pick_folder,
            // Profiles & Storage
            commands::get_local_config,
            commands::set_storage_path,
            commands::get_profiles,
            commands::get_active_profile,
            commands::switch_profile,
            commands::create_profile,
            commands::rename_profile,
            commands::delete_profile,
            commands::run_migration
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

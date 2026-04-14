cask "rechnung-generator" do
  version "2.1.0"
  sha256 "cd4b1816e4d8a4fac54d50a10f9932b26c37a2704e29569c13b662b25385f2ad"

  url "https://github.com/tonycannotprogrammy/rechnung-generator/releases/download/v#{version}/Rechnung.Generator_#{version}_aarch64.dmg"
  name "Rechnung Generator"
  desc "Professional invoice generator with SEPA QR codes and profiles"
  homepage "https://github.com/tonycannotprogrammy/rechnung-generator"

  app "Rechnung Generator.app"

  zap trash: [
    "~/Library/Application Support/RechnungGenerator",
    "~/Library/Caches/com.rechnunggenerator.desktop",
    "~/Library/Preferences/com.rechnunggenerator.desktop.plist",
    "~/Library/Saved Application State/com.rechnunggenerator.desktop.savedState",
    "~/Library/WebKit/com.rechnunggenerator.desktop",
  ]
end

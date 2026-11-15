# Astronaut Health Monitor: desktop app

NASA Space Apps Challenge 2026 · Create Health Monitoring Software for Astronauts on Space Missions · Spark Team

This branch is the download page of the desktop app. The app is the same web app as the [live demo](https://spark-health-monitor.onrender.com/), packaged with Electron, and works without an internet connection. Source code: [`main` branch](https://github.com/Spark-teams422/spark-health-monitor/tree/main) (the wrapper is in [`desktop/`](https://github.com/Spark-teams422/spark-health-monitor/tree/main/desktop)).

## Download (version 1.0.0)

| System | File | Size |
| --- | --- | --- |
| macOS 12 or later, Apple silicon (M1 or later) | [Astronaut-Health-Monitor-1.0.0-mac-arm64.dmg](https://github.com/Spark-teams422/spark-health-monitor/releases/download/desktop-v1.0.0/Astronaut-Health-Monitor-1.0.0-mac-arm64.dmg) | 115 MB |
| macOS 12 or later, Intel | [Astronaut-Health-Monitor-1.0.0-mac-x64.dmg](https://github.com/Spark-teams422/spark-health-monitor/releases/download/desktop-v1.0.0/Astronaut-Health-Monitor-1.0.0-mac-x64.dmg) | 122 MB |
| Windows 10 or 11 (x64) | [Astronaut-Health-Monitor-1.0.0-win-x64.exe](https://github.com/Spark-teams422/spark-health-monitor/releases/download/desktop-v1.0.0/Astronaut-Health-Monitor-1.0.0-win-x64.exe) | 117 MB |
| Linux (x64) | [Astronaut-Health-Monitor-1.0.0-linux-x86_64.AppImage](https://github.com/Spark-teams422/spark-health-monitor/releases/download/desktop-v1.0.0/Astronaut-Health-Monitor-1.0.0-linux-x86_64.AppImage) | 121 MB |

Not sure which Mac you have? Apple menu → **About This Mac**: "Chip: Apple M…" means Apple silicon, "Processor: Intel" means Intel.

All files: [release desktop-v1.0.0](https://github.com/Spark-teams422/spark-health-monitor/releases/tag/desktop-v1.0.0).

## Install

The app is a hackathon prototype: the macOS app is signed ad hoc but not notarized by Apple (that needs a paid Apple Developer account), and the Windows installer is not code-signed. Each system therefore asks once before the first start.

**macOS**

1. Open the `.dmg` and drag **Astronaut Health Monitor** to **Applications**.
2. Open the app. macOS says it cannot verify the developer: click **Done** (not Move to Trash).
3. Open **System Settings → Privacy & Security**, scroll down to "Astronaut Health Monitor was blocked", click **Open Anyway** and confirm with your password.

The app then opens normally every time. Terminal alternative for step 2–3:

```bash
xattr -dr com.apple.quarantine "/Applications/Astronaut Health Monitor.app"
```

**Windows**

Run the `.exe`. If SmartScreen shows "Windows protected your PC", choose **More info**, then **Run anyway**, and follow the installer.

**Linux**

```bash
chmod +x Astronaut-Health-Monitor-1.0.0-linux-x86_64.AppImage && ./Astronaut-Health-Monitor-1.0.0-linux-x86_64.AppImage
```

Some distributions need FUSE 2 for AppImages (Ubuntu 22.04 or later: `sudo apt install libfuse2`).

Best on a screen of 1366 × 768 or larger.

## Notes

- All values are simulated sample data. This is a decision-support prototype, not a medical device.
- The installers are built from the `main` branch by GitHub Actions ([workflow](https://github.com/Spark-teams422/spark-health-monitor/blob/main/.github/workflows/desktop.yml)).
- License: Apache 2.0 (see [LICENSE](LICENSE)); third-party licenses: [NOTICE](https://github.com/Spark-teams422/spark-health-monitor/blob/main/NOTICE).

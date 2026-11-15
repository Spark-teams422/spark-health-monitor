# Astronaut Health Monitor: desktop app

NASA Space Apps Challenge 2026 · Create Health Monitoring Software for Astronauts on Space Missions · Spark Team

This branch is the download page of the desktop app. The app is the same web app as the [live demo](https://spark-health-monitor.onrender.com/), packaged with Electron, and works without an internet connection. Source code: [`main` branch](https://github.com/Spark-teams422/spark-health-monitor/tree/main) (the wrapper is in [`desktop/`](https://github.com/Spark-teams422/spark-health-monitor/tree/main/desktop)).

## Download (version 1.0.0)

| System | File | Size |
| --- | --- | --- |
| macOS, Apple silicon (M1 or later) | [Astronaut-Health-Monitor-1.0.0-mac-arm64.dmg](https://github.com/Spark-teams422/spark-health-monitor/releases/download/desktop-v1.0.0/Astronaut-Health-Monitor-1.0.0-mac-arm64.dmg) | 116 MB |
| macOS, Intel | [Astronaut-Health-Monitor-1.0.0-mac-x64.dmg](https://github.com/Spark-teams422/spark-health-monitor/releases/download/desktop-v1.0.0/Astronaut-Health-Monitor-1.0.0-mac-x64.dmg) | 120 MB |
| Windows 10 or 11 (x64) | [Astronaut-Health-Monitor-1.0.0-win-x64.exe](https://github.com/Spark-teams422/spark-health-monitor/releases/download/desktop-v1.0.0/Astronaut-Health-Monitor-1.0.0-win-x64.exe) | 117 MB |

All files: [release desktop-v1.0.0](https://github.com/Spark-teams422/spark-health-monitor/releases/tag/desktop-v1.0.0).

## Install

The packages are not code-signed, so the system asks once before the first start.

- **macOS:** open the `.dmg`, drag the app to Applications, then right-click the app and choose **Open**.
- **Windows:** run the `.exe`; if SmartScreen appears, choose **More info**, then **Run anyway**.

Best on a screen of 1366 × 768 or larger.

## Notes

- All values are simulated sample data. This is a decision-support prototype, not a medical device.
- The installers are built from the `main` branch by GitHub Actions ([workflow](https://github.com/Spark-teams422/spark-health-monitor/blob/main/.github/workflows/desktop.yml)).
- License: Apache 2.0 (see [LICENSE](LICENSE)); third-party licenses: [NOTICE](https://github.com/Spark-teams422/spark-health-monitor/blob/main/NOTICE).

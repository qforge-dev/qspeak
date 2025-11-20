# qSpeak Flatpak Configuration

This directory contains the configuration files needed to create a Flatpak package for qSpeak and submit it to Flathub.

## Files

- `org.qforge.qspeak.yml` - The main Flatpak manifest file
- `org.qforge.qspeak.metainfo.xml` - Application metadata for Flathub
- `flatpak-README.md` - This file

## Prerequisites

Before building the Flatpak, you need to install the required tools and runtime:

### Install flatpak and flatpak-builder

**On Arch Linux/Manjaro:**

```bash
sudo pacman -S --needed flatpak flatpak-builder
```

**On Ubuntu/Debian:**

```bash
sudo apt install flatpak flatpak-builder
```

**On Fedora:**

```bash
sudo dnf install flatpak flatpak-builder
```

### Install the Flatpak Runtime

```bash
flatpak install flathub org.gnome.Platform//46 org.gnome.Sdk//46
```

## Building the Flatpak Locally

1. Clone or download these configuration files
2. Make sure both `org.qforge.qspeak.yml` and `org.qforge.qspeak.metainfo.xml` are in the same directory
3. Build the Flatpak:

```bash
flatpak-builder --repo=local-repo build-dir org.qforge.qspeak.yml --force-clean
```

4. Install the locally built Flatpak:

```bash
flatpak --user remote-add --no-gpg-verify local-repo local-repo
flatpak --user install local-repo org.qforge.qspeak
```

5. Run the application:

```bash
flatpak run org.qforge.qspeak
```

## Testing

After installation, test that:

- The application launches correctly
- All UI elements work as expected
- File permissions are appropriate
- The application can access necessary system resources

## Submitting to Flathub

To submit qSpeak to Flathub:

1. Fork the [Flathub repository](https://github.com/flathub/flathub) on GitHub
2. Clone your fork:
   ```bash
   git clone --branch=new-pr git@github.com:your_username/flathub.git
   cd flathub
   ```
3. Create a new branch:
   ```bash
   git checkout -b qspeak
   ```
4. Copy the manifest files to the repository:
   ```bash
   cp org.qforge.qspeak.yml org.qforge.qspeak.metainfo.xml /path/to/flathub/
   ```
5. Commit and push your changes:
   ```bash
   git add org.qforge.qspeak.yml org.qforge.qspeak.metainfo.xml
   git commit -m "Add qSpeak application"
   git push origin qspeak
   ```
6. Open a pull request against the `new-pr` branch on the Flathub repository

## Notes

- The manifest uses the GNOME 46 runtime which includes all standard dependencies
- Network access is enabled for potential online features
- Home directory access is granted for saving recordings
- The application ID `org.qforge.qspeak` follows the reverse domain naming convention
- Make sure to update the version in the metainfo.xml file when releasing new versions

## Troubleshooting

If you encounter issues:

1. Check the build logs for any missing dependencies
2. Verify that all file paths in the manifest match the actual deb package structure
3. Test the application in the Flatpak runtime to ensure all features work
4. Consult the [Flatpak documentation](https://docs.flatpak.org/) for advanced configuration options

For Flathub-specific issues, refer to the [Flathub documentation](https://github.com/flathub/flathub/wiki).

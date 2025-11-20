# GitHub Actions Scripts

## extract-changelog.js

This script extracts changelog information from `changelog.json` for the current release version and formats it for GitHub releases.

### How it works:

1. Reads the current git tag from the `GITHUB_REF_NAME` environment variable
2. Extracts the version number (removes 'v' prefix if present)
3. Searches for the matching version in `changelog.json`
4. Formats the changes into a GitHub release notes format
5. Outputs the formatted notes to `release-notes.md`

### Usage:

The script is automatically run by the GitHub Actions workflow during the release process. It expects:

- `GITHUB_REF_NAME` environment variable to be set (automatically available in GitHub Actions)
- `changelog.json` file to exist in the project root
- The changelog JSON structure with `version`, `changes`, and `date` fields

### Error Handling:

- If `changelog.json` doesn't exist, creates a basic release note
- If no version entry is found, creates a note indicating this
- If any other error occurs, includes the error message in the release notes

import fs from "fs";
import path from "path";

function extractChangelog() {
  try {
    // Get the tag from environment variable (should be something like "v0.1.58")
    const tag = process.env.GITHUB_REF_NAME;
    if (!tag) {
      throw new Error("GITHUB_REF_NAME environment variable not found");
    }

    // Extract version from tag (remove 'v' prefix if present)
    const version = tag.startsWith("v") ? tag.slice(1) : tag;
    console.log(`Looking for changelog entry for version: ${version}`);

    // Read changelog.json
    const changelogPath = path.join(process.cwd(), "changelog.json");

    if (!fs.existsSync(changelogPath)) {
      console.log("changelog.json file not found");
      return `## Release ${tag}\n\nNo changelog file found.`;
    }

    const changelogData = JSON.parse(fs.readFileSync(changelogPath, "utf8"));

    // Find the entry for this version
    const versionEntry = changelogData.find((entry) => entry.version === version);

    if (!versionEntry) {
      console.log(`No changelog entry found for version ${version}`);
      return `## Release ${tag}\n\nNo changelog entry found for this version. Please check the changelog.json file.`;
    }

    // Format the changelog entry
    let releaseNotes = `## What's Changed in ${tag}\n\n`;

    if (versionEntry.changes && versionEntry.changes.length > 0) {
      versionEntry.changes.forEach((change) => {
        releaseNotes += `- ${change}\n`;
      });
    } else {
      releaseNotes += `- No changes listed for this version\n`;
    }

    if (versionEntry.date) {
      const date = new Date(versionEntry.date);
      releaseNotes += `\n**Release Date:** ${date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })}\n`;
    }

    console.log("Generated release notes:");
    console.log(releaseNotes);

    return releaseNotes;
  } catch (error) {
    console.error("Error extracting changelog:", error.message);
    const tag = process.env.GITHUB_REF_NAME || "Unknown";
    return `## Release ${tag}\n\nError extracting changelog: ${error.message}`;
  }
}

// Export the release notes to a file for GitHub Actions
const releaseNotes = extractChangelog();
fs.writeFileSync("release-notes.md", releaseNotes);
console.log("Release notes written to release-notes.md");

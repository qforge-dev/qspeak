import { execSync } from "child_process";
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";
import OpenAI from "openai";
import { z } from "zod";
import { zodResponseFormat } from "openai/helpers/zod";

type VersionType = "major" | "minor" | "patch";

interface ChangelogEntry {
  version: string;
  title: string;
  changes: string[];
  date: string;
}

interface VersionState {
  packageJson: string;
  tauriConf: string;
  // cargoToml: string;
  // cargoLock: string;
  changelog: string;
  currentVersion: string;
}

const SummarySchema = z.object({
  title: z.string(),
  changes: z.array(z.string()),
});

function checkUncommittedChanges(): void {
  try {
    const status = execSync("git status --porcelain").toString();
    if (status.trim()) {
      console.error("Error: You have uncommitted changes in your working directory.");
      console.error("Please commit or stash them before releasing.");
      console.error("\nUncommitted changes:");
      console.error(status);
      process.exit(1);
    }
  } catch (error) {
    console.error("Error checking git status:", error);
    process.exit(1);
  }
}

function pullWithRebase(): void {
  try {
    console.log("Pulling latest changes with rebase...");
    execSync("git pull --rebase origin main");
  } catch (error) {
    console.error("Error pulling changes:", error);
    process.exit(1);
  }
}

function saveVersionState(): VersionState {
  return {
    packageJson: readFileSync("package.json", "utf-8"),
    tauriConf: readFileSync("src-tauri/tauri.conf.json", "utf-8"),
    // cargoToml: readFileSync("src-tauri/Cargo.toml", "utf-8"),
    // cargoLock: readFileSync("src-tauri/Cargo.lock", "utf-8"),
    changelog: readFileSync("changelog.json", "utf-8"),
    currentVersion: JSON.parse(readFileSync("package.json", "utf-8")).version,
  };
}

function restoreVersionState(state: VersionState): void {
  try {
    writeFileSync("package.json", state.packageJson);
    writeFileSync("src-tauri/tauri.conf.json", state.tauriConf);
    // writeFileSync("src-tauri/Cargo.toml", state.cargoToml);
    // writeFileSync("src-tauri/Cargo.lock", state.cargoLock);
    writeFileSync("changelog.json", state.changelog);

    // Reset any git changes
    execSync("git reset --hard HEAD");
    execSync(`git tag -d v${state.currentVersion} || true`);
  } catch (error) {
    console.error("Error restoring version state:", error);
    process.exit(1);
  }
}

function getAllTags(): string[] {
  try {
    const tags = execSync('git tag -l "v*" --sort=-v:refname').toString().trim().split("\n");
    return tags.map((tag) => tag.substring(1)); // Remove 'v' prefix
  } catch (error) {
    console.error("Error getting git tags:", error);
    return [];
  }
}

function findLastVersionOfType(currentVersion: string, type: VersionType): string | null {
  const [currentMajor, currentMinor, currentPatch] = currentVersion.split(".").map(Number);
  const tags = getAllTags();

  // Filter tags that are less than current version
  const previousVersions = tags.filter((tag) => {
    const [major, minor, patch] = tag.split(".").map(Number);
    if (type === "major") {
      return major < currentMajor;
    } else if (type === "minor") {
      return major === currentMajor && minor < currentMinor;
    } else {
      return major === currentMajor && minor === currentMinor && patch < currentPatch;
    }
  });

  if (previousVersions.length === 0) {
    return null;
  }

  // Sort versions in descending order and get the first one
  return previousVersions.sort((a, b) => {
    const [aMajor, aMinor, aPatch] = a.split(".").map(Number);
    const [bMajor, bMinor, bPatch] = b.split(".").map(Number);

    if (aMajor !== bMajor) return bMajor - aMajor;
    if (aMinor !== bMinor) return bMinor - aMinor;
    return bPatch - aPatch;
  })[0];
}

async function getChangesSinceVersion(version: string | null): Promise<string> {
  try {
    if (!version) {
      // If no previous version, get all commits
      return execSync('git log --pretty=format:"%h %s"').toString();
    }
    return execSync(`git log v${version}..HEAD --pretty=format:"%h %s"`).toString();
  } catch (error) {
    console.error("Error getting git changes:", error);
    process.exit(1);
  }
}

async function summarizeChanges(changes: string): Promise<{ title: string; changes: string[] }> {
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  try {
    const response = await openai.beta.chat.completions.parse({
      model: "gpt-4.1",
      messages: [
        {
          role: "system",
          content: `
You are a helpful assistant that creates release summaries for software releases. You need to generate:
1. A concise, engaging title for the release that captures the main theme or most important changes
2. A list of meaningful user-facing changes and improvements

For the title:
- Keep it under 60 characters
- Make it descriptive and engaging
- Focus on the main theme (e.g., "Major Performance Improvements", "New Chat Features", "Bug Fixes and Stability")
- Don't include version numbers in the title

For the changes:
- Focus only on bug fixes and new features; do not include chores, small tweaks, or irrelevant quotes
- Exclude any commits that are solely about version bumps, style changes, or other non-user-facing updates
- Add appropriate emojis to each item to enhance readability and engagement
- Format each change as a separate item in a list

Example format:
Title: "Enhanced User Experience and Performance"
Changes:
- 🐛 Fixed a bug where the login button was unresponsive
- 🚀 Added a new user onboarding tutorial feature
- 🔧 Improved performance of the search functionality
- 🎨 Added a new theme to the app

Do not include items such as:
- Minor formatting changes
- Update documentation
- Chores and refactoring without visible changes
- Quotes or unrelated text from commit messages
`,
        },
        {
          role: "user",
          content: `Please create a release title and summarize these git commits into a list of meaningful changes:\n\n${changes}`,
        },
      ],
      response_format: zodResponseFormat(SummarySchema, "summary"),
    });

    const summary = response.choices[0]?.message?.parsed;
    return {
      title: summary?.title || "Release Update",
      changes: summary?.changes || [],
    };
  } catch (error) {
    console.error("Error getting OpenAI summary:", error);
    process.exit(1);
  }
}

function updateChangelog(version: string, title: string, changes: string[]) {
  const changelogPath = join(process.cwd(), "changelog.json");
  const changelog: ChangelogEntry[] = JSON.parse(readFileSync(changelogPath, "utf-8"));

  changelog.unshift({
    version,
    title,
    changes,
    date: new Date().toISOString(),
  });

  writeFileSync(changelogPath, JSON.stringify(changelog, null, 2) + "\n");
}

function bumpVersion(version: string, type: VersionType): string {
  const [major, minor, patch] = version.split(".").map(Number);

  switch (type) {
    case "major":
      return `${major + 1}.0.0`;
    case "minor":
      return `${major}.${minor + 1}.0`;
    case "patch":
      return `${major}.${minor}.${patch + 1}`;
    default:
      throw new Error(`Invalid version type: ${type}`);
  }
}

function updateFileVersion(filePath: string, newVersion: string, versionField: string) {
  const content = readFileSync(filePath, "utf-8");
  const data = JSON.parse(content);
  data[versionField] = newVersion;
  writeFileSync(filePath, JSON.stringify(data, null, 2) + "\n");
}

function updateSentryRelease(newVersion: string) {
  const libRsPath = join(process.cwd(), "src-tauri", "src", "lib.rs");
  const content = readFileSync(libRsPath, "utf-8");
  const updatedContent = content.replace(
    /release: Some\(Cow::Borrowed\("(\d+\.\d+\.\d+)"\)\)/,
    `release: Some(Cow::Borrowed("${newVersion}"))`,
  );
  writeFileSync(libRsPath, updatedContent);
}

function updateCargoVersion(newVersion: string) {
  const cargoPath = join(process.cwd(), "src-tauri", "Cargo.toml");
  const cargoLockPath = join(process.cwd(), "src-tauri", "Cargo.lock");

  // Update Cargo.toml
  const content = readFileSync(cargoPath, "utf-8");
  const updatedContent = content.replace(/version = "(\d+\.\d+\.\d+)"/, `version = "${newVersion}"`);
  writeFileSync(cargoPath, updatedContent);

  // Update Cargo.lock
  const lockContent = readFileSync(cargoLockPath, "utf-8");
  const updatedLockContent = lockContent.replace(
    /name = "qspeak"\nversion = "(\d+\.\d+\.\d+)"/,
    `name = "qspeak"\nversion = "${newVersion}"`,
  );
  writeFileSync(cargoLockPath, updatedLockContent);
}

function createGitTag(version: string, title: string) {
  execSync(`git add .`);
  execSync(`git commit -m "chore: bump version to ${version}"`);
  execSync(`git tag -a v${version} -m "Release v${version}: ${title}"`);
}

function pushChanges() {
  try {
    console.log("Pushing changes to remote...");
    execSync("git push");
    console.log("Pushing tags to remote...");
    execSync("git push --tags");
    console.log("Successfully pushed all changes and tags!");
  } catch (error) {
    throw new Error("Failed to push changes to remote");
  }
}

function moveTag(tagName: string) {
  try {
    // Check if tag exists
    execSync(`git rev-parse --verify refs/tags/${tagName}`, { stdio: "ignore" });

    console.log(`Moving tag ${tagName} to current commit...`);

    // Delete the tag locally
    execSync(`git tag -d ${tagName}`);

    // Create the tag at current commit
    execSync(`git tag ${tagName}`);

    // Force push the updated tag
    console.log("Pushing updated tag to remote...");
    execSync(`git push origin :refs/tags/${tagName}`); // Delete remote tag
    execSync(`git push origin ${tagName}`); // Push new tag

    console.log(`Successfully moved tag ${tagName} to current commit!`);
  } catch (error) {
    if (error instanceof Error && error.message.includes("refs/tags/")) {
      console.error(`Error: Tag ${tagName} does not exist.`);
      console.error("Available tags:");
      try {
        const tags = execSync('git tag -l "v*" --sort=-v:refname').toString().trim();
        console.error(tags);
      } catch (e) {
        console.error("Could not list tags");
      }
    } else {
      console.error("Error moving tag:", error);
    }
    process.exit(1);
  }
}

async function main() {
  const command = process.argv[2];

  // Handle move-tag command
  if (command === "move-tag") {
    const tagName = process.argv[3];

    if (!tagName) {
      console.error("Usage: npm run release move-tag <tag-name>");
      console.error("  tag-name: the tag to move to current commit (e.g., v1.2.3)");
      process.exit(1);
    }

    // Check for uncommitted changes first
    checkUncommittedChanges();

    moveTag(tagName);
    return;
  }

  // Handle version bump commands
  const versionType = command as VersionType;
  const sinceVersion = process.argv[3]; // Optional: specify version to create notes from

  if (!versionType || !["major", "minor", "patch"].includes(versionType)) {
    console.error("Usage:");
    console.error("  npm run release <major|minor|patch> [since-version]");
    console.error("  npm run release move-tag <tag-name>");
    console.error("");
    console.error("Version bump:");
    console.error("  version-type: major, minor, or patch");
    console.error("  since-version: optional - specify version to create notes from (e.g., 1.2.3)");
    console.error("");
    console.error("Move tag:");
    console.error("  tag-name: the tag to move to current commit (e.g., v1.2.3)");
    process.exit(1);
  }

  if (!process.env.OPENAI_API_KEY) {
    console.error("Error: OPENAI_API_KEY environment variable is not set");
    process.exit(1);
  }

  // Check for uncommitted changes first
  checkUncommittedChanges();

  // Pull latest changes with rebase
  pullWithRebase();

  // Save current state for potential rollback
  const initialState = saveVersionState();

  try {
    // Read current version from package.json
    const packageJson = JSON.parse(readFileSync("package.json", "utf-8"));
    const currentVersion = packageJson.version;
    const newVersion = bumpVersion(currentVersion, versionType);

    console.log(`Bumping version from ${currentVersion} to ${newVersion}`);

    // Get changes since specified version or last version of the same type
    let lastVersion: string | null;
    if (sinceVersion) {
      // Validate that the specified version exists as a tag
      const allTags = getAllTags();
      if (!allTags.includes(sinceVersion)) {
        console.error(`Error: Version ${sinceVersion} not found in git tags.`);
        console.error(`Available versions: ${allTags.slice(0, 10).join(", ")}${allTags.length > 10 ? "..." : ""}`);
        process.exit(1);
      }
      lastVersion = sinceVersion;
      console.log(`Getting changes since manually specified version ${lastVersion}...`);
    } else {
      lastVersion = findLastVersionOfType(newVersion, versionType);
      console.log(`Getting changes since version ${lastVersion || "beginning"}...`);
    }

    const changes = await getChangesSinceVersion(lastVersion);

    // Summarize changes using OpenAI
    console.log("Summarizing changes...");
    const summarizedChanges = await summarizeChanges(changes);

    // Update changelog
    console.log("Updating changelog...");
    updateChangelog(newVersion, summarizedChanges.title, summarizedChanges.changes);

    // Update versions in all files
    updateFileVersion("package.json", newVersion, "version");
    updateFileVersion("src-tauri/tauri.conf.json", newVersion, "version");
    updateSentryRelease(newVersion);
    // updateCargoVersion(newVersion);

    // Create git tag and push changes
    createGitTag(newVersion, summarizedChanges.title);
    pushChanges();

    console.log(`Successfully released version ${newVersion}!`);
    console.log(`\nRelease title: ${summarizedChanges.title}`);
    console.log("\nChanges in this release:");
    summarizedChanges.changes.forEach((change) => console.log(`- ${change}`));
  } catch (error) {
    console.error("Error during release:", error);
    console.log("\nRolling back changes...");
    restoreVersionState(initialState);
    console.log("Successfully rolled back all changes.");
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("Error:", error);
  process.exit(1);
});

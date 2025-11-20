import { readFileSync, writeFileSync } from "fs";
import { join } from "path";
import OpenAI from "openai";
import { z } from "zod";
import { zodResponseFormat } from "openai/helpers/zod";

interface ChangelogEntry {
  version: string;
  title?: string;
  changes: string[];
  date: string;
}

const TitleSchema = z.object({
  title: z.string(),
});

async function generateTitle(changes: string[]): Promise<string> {
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
You are a helpful assistant that creates concise, engaging titles for software release notes.

Requirements for the title:
- Keep it under 60 characters
- Make it descriptive and engaging
- Focus on the main theme or most important changes
- Don't include version numbers in the title
- Use title case (capitalize important words)
- Focus on user-facing benefits when possible

Examples of good titles:
- "Enhanced User Experience and Performance"
- "New Chat Features and Bug Fixes"
- "Major Performance Improvements"
- "Dark Mode and UI Enhancements"
- "Critical Security Updates"
- "New Tools and Productivity Features"

If the changes list is empty or contains only minor updates, use a generic title like:
- "Minor Updates and Improvements"
- "Maintenance Release"
- "Bug Fixes and Stability"
`,
        },
        {
          role: "user",
          content: `Please create a concise title for this release based on these changes:\n\n${changes.join("\n")}`,
        },
      ],
      response_format: zodResponseFormat(TitleSchema, "title"),
    });

    const result = response.choices[0]?.message?.parsed;
    return result?.title || "Release Update";
  } catch (error) {
    console.error("Error generating title with OpenAI:", error);
    // Fallback to a simple title based on the number of changes
    if (changes.length === 0) {
      return "Maintenance Release";
    } else if (changes.length === 1) {
      return "Quick Fix";
    } else if (changes.length <= 3) {
      return "Bug Fixes and Improvements";
    } else {
      return "Feature Updates and Improvements";
    }
  }
}

async function updateChangelogTitles() {
  const changelogPath = join(process.cwd(), "changelog.json");

  try {
    const changelog: ChangelogEntry[] = JSON.parse(readFileSync(changelogPath, "utf-8"));

    console.log(`Found ${changelog.length} changelog entries`);

    let updatedCount = 0;

    for (let i = 0; i < changelog.length; i++) {
      const entry = changelog[i];

      if (!entry.title) {
        console.log(`\nGenerating title for version ${entry.version}...`);
        console.log(`Changes: ${entry.changes.length} items`);

        const title = await generateTitle(entry.changes);
        entry.title = title;
        updatedCount++;

        console.log(`✅ Added title: "${title}"`);

        // Add a small delay to avoid hitting rate limits
        if (i < changelog.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
      } else {
        console.log(`✓ Version ${entry.version} already has title: "${entry.title}"`);
      }
    }

    if (updatedCount > 0) {
      writeFileSync(changelogPath, JSON.stringify(changelog, null, 2) + "\n");
      console.log(`\n🎉 Successfully updated ${updatedCount} changelog entries with titles!`);
    } else {
      console.log("\n✨ All changelog entries already have titles!");
    }
  } catch (error) {
    console.error("Error updating changelog:", error);
    process.exit(1);
  }
}

async function main() {
  if (!process.env.OPENAI_API_KEY) {
    console.error("Error: OPENAI_API_KEY environment variable is not set");
    process.exit(1);
  }

  console.log("🔄 Updating changelog titles...");
  await updateChangelogTitles();
}

main().catch((error) => {
  console.error("Error:", error);
  process.exit(1);
});

# Task 1: Update Claude Code Theme Setting

## Context
The user invoked the `/update-config` skill to modify Claude Code configuration. Through clarification, the user requested to set the UI theme to `auto` (follow system appearance) in the user/global settings file.

## Approach
1. Read the existing user settings file located at `%USERPROFILE%\.claude\settings.json` (or `~/.claude/settings.json` on Unix-like systems).
2. If the file does not exist, create it with a JSON object containing the `theme` field set to `"auto"`.
3. If the file exists, merge the `theme` field with the value `"auto"` while preserving all other existing settings.
4. Write the updated JSON back to the same file.
5. Verify the change by reading the file and confirming the `theme` property is set to `"auto"`.

## Implementation Steps (to be executed after plan approval)
- Use the `Read` tool to load the current settings file (if it exists).
- Use the `Write` tool to save the updated settings.
- Optionally, use the `Read` tool again to confirm the update.

## Verification
After applying the change, the user's Claude Code UI should adapt to the system's light/dark mode setting. The settings file will contain `"theme": "auto"`.

## Notes
- This change applies globally to all Claude Code sessions for the user.
- If the user prefers a different scope (project or local), the plan can be adjusted accordingly.
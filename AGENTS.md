# AI Agent Development Guide for SillyTavern Extensions

This document provides guidance for AI coding agents (like Claude Code, Cursor, GitHub Copilot, etc.) working on SillyTavern extensions.

---

## Project Overview

**Project Type**: SillyTavern UI Extension
**Language**: JavaScript (Browser-based)
**Context**: Browser extension for SillyTavern chat interface
**Entry Point**: `index.js`
**Metadata**: `manifest.json`

---

## Architecture

### Extension Location
```
/scripts/extensions/third-party/st-text-messaging/
├── manifest.json          # Extension metadata and configuration
├── index.js              # Main entry point
├── style.css             # Optional styles
├── example.html          # UI components
└── docs/
    └── ST_EXTENSIONS.md  # Developer documentation
```

### Key Import Paths
```javascript
// From extensions.js (3 levels up)
import { extension_settings, getContext, loadExtensionSettings } from "../../../extensions.js";

// From main script (4 levels up)
import { saveSettingsDebounced } from "../../../../script.js";
```

### Global Context Access
```javascript
// Modern approach - preferred
const context = SillyTavern.getContext();

// Legacy approach - still works
import { getContext } from "../../../extensions.js";
const context = getContext();
```

---

## Critical Constraints

### DO NOT
- ❌ Use Node.js APIs (fs, path, etc.) - this runs in the browser
- ❌ Import npm packages directly - they won't resolve
- ❌ Use async/await with macros - only synchronous functions
- ❌ Assume file system access - use fetch/AJAX for external resources
- ❌ Create server-side code - extensions are client-side only
- ❌ Use absolute paths for imports - always relative from third-party folder

### DO
- ✅ Use browser APIs (fetch, localStorage, DOM manipulation)
- ✅ Use jQuery ($) - it's available globally
- ✅ Use relative imports based on `/scripts/extensions/third-party/`
- ✅ Store settings in `extension_settings[extensionName]`
- ✅ Call `saveSettingsDebounced()` after modifying settings
- ✅ Use `toastr` for notifications (available globally)

---

## Development Patterns

### 1. Extension Initialization
```javascript
const extensionName = "st-text-messaging";
const extensionFolderPath = `scripts/extensions/third-party/${extensionName}`;

jQuery(async () => {
    // Load HTML components
    const settingsHtml = await $.get(`${extensionFolderPath}/settings.html`);
    $("#extensions_settings").append(settingsHtml);

    // Register event listeners
    $("#my-button").on("click", onButtonClick);

    // Load settings
    await loadSettings();

    // Register slash commands, macros, etc.
    registerCommands();
});
```

### 2. Settings Management
```javascript
const defaultSettings = {
    enabled: true,
    apiKey: "",
    threshold: 0.7
};

async function loadSettings() {
    // Initialize if doesn't exist
    extension_settings[extensionName] = extension_settings[extensionName] || {};

    if (Object.keys(extension_settings[extensionName]).length === 0) {
        Object.assign(extension_settings[extensionName], defaultSettings);
    }

    // Update UI
    $("#enabled-checkbox").prop("checked", extension_settings[extensionName].enabled);
    $("#api-key-input").val(extension_settings[extensionName].apiKey);
}

function onSettingChange(event) {
    const value = $(event.target).val();
    extension_settings[extensionName].apiKey = value;
    saveSettingsDebounced(); // Always call this after changing settings
}
```

### 3. Event Handling
```javascript
const { eventSource, event_types } = SillyTavern.getContext();

// Listen for chat events
eventSource.on(event_types.MESSAGE_SENT, async (data) => {
    console.log("User sent:", data.message);
    await processMessage(data);
});

eventSource.on(event_types.MESSAGE_RECEIVED, (data) => {
    console.log("Character replied:", data.message);
});

eventSource.on(event_types.CHAT_CHANGED, () => {
    console.log("Chat switched - reload state if needed");
});
```

### 4. Slash Commands
```javascript
function registerCommands() {
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'send-sms',
        callback: async (namedArgs, unnamedArgs) => {
            const phoneNumber = namedArgs.to;
            const message = unnamedArgs.toString();

            try {
                await sendSMS(phoneNumber, message);
                return `Sent: ${message}`;
            } catch (error) {
                toastr.error(`Failed to send SMS: ${error.message}`);
                return '';
            }
        },
        namedArgumentList: [
            SlashCommandNamedArgument.fromProps({
                name: 'to',
                description: 'phone number to send to',
                typeList: ARGUMENT_TYPE.STRING,
                isRequired: true,
            }),
        ],
        unnamedArgumentList: [
            SlashCommandArgument.fromProps({
                description: 'message text',
                typeList: ARGUMENT_TYPE.STRING,
                isRequired: true,
            }),
        ],
        helpString: 'Send an SMS message. Usage: /send-sms to=+1234567890 Hello!',
    }));
}
```

### 5. API Calls (External Services)
```javascript
async function sendSMS(phoneNumber, message) {
    const apiKey = extension_settings[extensionName].apiKey;

    if (!apiKey) {
        throw new Error("API key not configured");
    }

    try {
        const response = await fetch('https://api.service.com/sms', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                to: phoneNumber,
                message: message
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'API request failed');
        }

        return await response.json();
    } catch (error) {
        console.error('SMS send error:', error);
        throw error;
    }
}
```

### 6. Character Data Storage
```javascript
async function saveCharacterPreference(key, value) {
    const { writeExtensionField, characterId } = SillyTavern.getContext();

    if (characterId === undefined) {
        console.warn("No character selected");
        return;
    }

    await writeExtensionField(characterId, extensionName, {
        [key]: value
    });
}

function readCharacterPreference(key) {
    const { characters, characterId } = SillyTavern.getContext();

    if (characterId === undefined) return null;

    const character = characters[characterId];
    const extensionData = character?.data?.extensions?.[extensionName];

    return extensionData?.[key];
}
```

---

## Common Tasks

### Adding a New Feature

1. **Update manifest.json** if needed (version bump, new dependencies)
2. **Create UI components** in HTML file
3. **Add settings** to defaultSettings object
4. **Register event listeners** in jQuery initialization
5. **Implement feature logic** with proper error handling
6. **Test** with SillyTavern running

### Adding External API Integration

1. **Add API configuration** to settings (URL, API key, etc.)
2. **Create API client functions** using fetch
3. **Handle errors gracefully** with try-catch
4. **Show user feedback** with toastr notifications
5. **Validate inputs** before making requests

### Adding a Slash Command

1. **Design command syntax** (name, arguments)
2. **Implement callback function** (async if needed)
3. **Register with SlashCommandParser** in initialization
4. **Add help text** with usage examples
5. **Handle errors** and return meaningful messages

### Debugging

1. **Browser Console**: Primary debugging tool
   ```javascript
   console.log('[st-text-messaging]', 'Debug info:', data);
   ```

2. **Check Extension Loading**: Look for errors in console on ST startup

3. **Settings Persistence**: Verify in browser DevTools > Application > Local Storage

4. **Event Firing**: Add listeners with logging to verify events work

5. **Network Requests**: Use DevTools > Network tab to inspect API calls

---

## Testing Checklist

- [ ] Extension loads without errors
- [ ] Settings save and persist across reloads
- [ ] UI elements appear in correct location
- [ ] Slash commands execute successfully
- [ ] Event listeners trigger appropriately
- [ ] External API calls work (if applicable)
- [ ] Error handling displays user-friendly messages
- [ ] No console errors during normal operation
- [ ] Settings UI updates match internal state
- [ ] Works with different characters/chats

---

## Common Pitfalls

### 1. Incorrect Import Paths
❌ **Wrong:**
```javascript
import { getContext } from "@/extensions.js";
import { getContext } from "extensions.js";
```

✅ **Correct:**
```javascript
import { getContext } from "../../../extensions.js";
```

### 2. Forgetting saveSettingsDebounced()
❌ **Wrong:**
```javascript
function onSettingChange(event) {
    extension_settings[extensionName].value = event.target.value;
    // Settings won't persist!
}
```

✅ **Correct:**
```javascript
function onSettingChange(event) {
    extension_settings[extensionName].value = event.target.value;
    saveSettingsDebounced(); // Required for persistence
}
```

### 3. Async Macros
❌ **Wrong:**
```javascript
registerMacro('fetch-data', async () => {
    const data = await fetch('/api/data');
    return data.json(); // Won't work - macros must be sync
});
```

✅ **Correct:**
```javascript
// Pre-fetch data and store in variable
let cachedData = 'loading...';

(async () => {
    const response = await fetch('/api/data');
    cachedData = await response.text();
})();

registerMacro('fetch-data', () => {
    return cachedData; // Synchronous return
});
```

### 4. Missing Error Handling
❌ **Wrong:**
```javascript
async function callAPI() {
    const response = await fetch('/api/endpoint');
    const data = await response.json();
    return data;
}
```

✅ **Correct:**
```javascript
async function callAPI() {
    try {
        const response = await fetch('/api/endpoint');
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('[st-text-messaging] API error:', error);
        toastr.error(`API call failed: ${error.message}`);
        return null;
    }
}
```

### 5. Not Checking characterId
❌ **Wrong:**
```javascript
const { characterId, writeExtensionField } = SillyTavern.getContext();
await writeExtensionField(characterId, 'key', 'value');
// Will fail if no character selected or in group chat
```

✅ **Correct:**
```javascript
const { characterId, writeExtensionField } = SillyTavern.getContext();

if (characterId === undefined) {
    console.warn('No character selected');
    toastr.warning('Please select a character first');
    return;
}

await writeExtensionField(characterId, 'key', 'value');
```

---

## manifest.json Reference

### Required Fields
```json
{
    "display_name": "Text Messaging Extension",
    "js": "index.js",
    "author": "Your Name",
    "version": "1.0.0"
}
```

### Recommended Fields
```json
{
    "display_name": "Text Messaging Extension",
    "loading_order": 9,
    "js": "index.js",
    "css": "style.css",
    "author": "Your Name",
    "version": "1.0.0",
    "homePage": "https://github.com/yourname/st-text-messaging",
    "auto_update": true,
    "minimum_client_version": "1.12.0"
}
```

### With Dependencies
```json
{
    "display_name": "Text Messaging Extension",
    "loading_order": 9,
    "requires": [],
    "optional": [],
    "dependencies": ["vectors"],
    "js": "index.js",
    "css": "style.css",
    "author": "Your Name",
    "version": "1.0.0",
    "homePage": "https://github.com/yourname/st-text-messaging"
}
```

---

## Available Globals

### Always Available
- `jQuery` / `$` - jQuery library
- `toastr` - Notification library
- `SillyTavern` - Main application object
- `SlashCommandParser` - For registering slash commands
- `ARGUMENT_TYPE` - Enum for argument types

### Common Context Properties
```javascript
const context = SillyTavern.getContext();

// Character/Chat
context.characterId         // Current character index
context.characters          // Array of all characters
context.chat                // Current chat messages
context.chatId              // Current chat identifier
context.groupId             // Group chat ID (if in group)
context.name1               // User name
context.name2               // Character name

// Functions
context.registerMacro       // Register custom macros
context.unregisterMacro     // Unregister macros
context.writeExtensionField // Write to character card
context.generateRaw         // Generate text without context
context.generateQuietPrompt // Generate text in chat context
context.eventSource         // Event system
context.event_types         // Event type constants
context.saveSettingsDebounced // Save settings
```

---

## File Structure Best Practices

### Minimal Extension
```
st-text-messaging/
├── manifest.json
└── index.js
```

### Standard Extension
```
st-text-messaging/
├── manifest.json
├── index.js
├── style.css
└── settings.html
```

### Complex Extension
```
st-text-messaging/
├── manifest.json
├── index.js
├── style.css
├── settings.html
├── docs/
│   ├── ST_EXTENSIONS.md
│   └── AGENTS.md
├── i18n/
│   ├── en-us.json
│   └── de-de.json
└── lib/
    ├── api-client.js
    └── utils.js
```

---

## Agent Workflow

When implementing a feature:

1. **Understand the requirement** - What is the user asking for?
2. **Check existing code** - What's already implemented?
3. **Plan the changes** - What files need modification?
4. **Implement incrementally** - One feature at a time
5. **Test as you go** - Verify each piece works
6. **Handle errors** - Add try-catch and user feedback
7. **Update documentation** - Keep README/docs current

---

## Quick Reference Commands

### Get current chat messages
```javascript
const { chat } = SillyTavern.getContext();
console.log(chat); // Array of message objects
```

### Show notification
```javascript
toastr.success('Operation completed!');
toastr.info('Information message');
toastr.warning('Warning message');
toastr.error('Error occurred');
```

### Load HTML file
```javascript
const html = await $.get(`${extensionFolderPath}/my-component.html`);
$("#target-element").append(html);
```

### Make API call
```javascript
const response = await fetch('https://api.example.com/endpoint', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data: 'value' })
});
const result = await response.json();
```

### Get user input
```javascript
const userInput = await callPopup('Enter value:', 'input');
if (userInput) {
    console.log('User entered:', userInput);
}
```

---

## Resources

- **Full Documentation**: See `docs/ST_EXTENSIONS.md`
- **Official Examples**: `/public/scripts/extensions/` in ST repository
- **SillyTavern Repo**: https://github.com/SillyTavern/SillyTavern
- **jQuery Docs**: https://api.jquery.com/
- **Browser APIs**: https://developer.mozilla.org/en-US/docs/Web/API

---

## Support

When stuck:
1. Check browser console for errors
2. Review `docs/ST_EXTENSIONS.md` for detailed API info
3. Look at official extension examples
4. Ask in SillyTavern Discord community
5. Check GitHub issues in SillyTavern repository

# SillyTavern Extension Development Guide

## Overview

SillyTavern UI extensions are JavaScript-based plugins that run in the browser context and can:
- Modify the UI and DOM
- Hook into SillyTavern events and API
- Call internal APIs
- Interact with chat data
- Register custom slash commands
- Add custom macros
- Store data in character cards

**Prerequisites**: JavaScript knowledge is required.

---

## Project Structure

### Basic Extension Layout

```
your-extension/
├── manifest.json          # Required: Extension metadata
├── index.js              # Entry point script
├── style.css             # Optional: Custom styles
└── i18n/                 # Optional: Internationalization
    ├── en-us.json
    ├── de-de.json
    └── fr-fr.json
```

### Installation Locations

- **User-scoped extensions**: `data/<user-handle>/extensions/`
- **Third-party extensions** (downloadable): `/scripts/extensions/third-party/`
- **Development**: Place in `/scripts/extensions/third-party/` for easier testing

---

## manifest.json

Every extension requires a `manifest.json` file with metadata and configuration.

### Complete Example

```json
{
    "display_name": "My Extension Name",
    "loading_order": 1,
    "requires": [],
    "optional": [],
    "dependencies": [],
    "js": "index.js",
    "css": "style.css",
    "author": "Your Name",
    "version": "1.0.0",
    "homePage": "https://github.com/yourname/your-extension",
    "auto_update": true,
    "minimum_client_version": "1.0.0",
    "generate_interceptor": "myInterceptorFunction",
    "i18n": {
        "de-de": "i18n/de-de.json",
        "fr-fr": "i18n/fr-fr.json"
    }
}
```

### Manifest Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `display_name` | string | Yes | Human-readable extension name |
| `js` | string | Yes | Path to entry point JavaScript file |
| `author` | string | Yes | Extension author name |
| `version` | string | Yes | Semantic version (e.g., "1.0.0") |
| `loading_order` | number | No | Execution order (lower = earlier) |
| `css` | string | No | Path to stylesheet file |
| `homePage` | string | No | Extension homepage URL |
| `auto_update` | boolean | No | Enable automatic updates |
| `minimum_client_version` | string | No | Minimum SillyTavern version required |
| `requires` | array | No | Required extensions (folder names) |
| `optional` | array | No | Optional extensions |
| `dependencies` | array | No | Extension dependencies (folder names) |
| `generate_interceptor` | string | No | Global function name for prompt interception |
| `i18n` | object | No | Locale-to-file mappings |

### Dependencies

Extensions can depend on other extensions by their **folder name**:

```json
{
    "dependencies": ["vectors", "stable-diffusion"],
    "optional": ["speech-recognition"]
}
```

The extension won't load if dependencies are missing or disabled.

---

## Core API: getContext()

Access SillyTavern's API and state through `SillyTavern.getContext()`.

### Basic Usage

```javascript
const context = SillyTavern.getContext();

// Common properties
const {
    characterId,      // Current character index
    characters,       // Array of all characters
    chat,            // Current chat messages
    name1,           // User name
    name2,           // Character name
    registerMacro,   // Register custom macros
    unregisterMacro, // Unregister macros
    writeExtensionField, // Write to character card
    generateRaw,     // Generate text without context
    generateQuietPrompt // Generate text in chat context
} = context;
```

### TypeScript Support

Create a `global.d.ts` file for autocompletion:

```typescript
export {};

// For user-scoped extensions
import '../../../../public/global';
// OR for server-scoped extensions
import '../../../../global';

declare global {
    // Add additional global type declarations here
}
```

---

## Slash Commands

Register custom slash commands that users can invoke in chat.

### Modern Registration (Recommended)

```javascript
SlashCommandParser.addCommandObject(SlashCommand.fromProps({
    name: 'repeat',
    callback: (namedArgs, unnamedArgs) => {
        const times = namedArgs.times ?? 5;
        const text = unnamedArgs.toString();
        const separator = isTrueBoolean(namedArgs.space.toString()) ? ' ' : '';
        return Array(times).fill(text).join(separator);
    },
    aliases: ['rpt'],
    returns: 'the repeated text',
    namedArgumentList: [
        SlashCommandNamedArgument.fromProps({
            name: 'times',
            description: 'number of times to repeat the text',
            typeList: ARGUMENT_TYPE.NUMBER,
            defaultValue: '5',
        }),
        SlashCommandNamedArgument.fromProps({
            name: 'space',
            description: 'whether to separate with spaces',
            typeList: ARGUMENT_TYPE.BOOLEAN,
            defaultValue: 'off',
            enumList: ['on', 'off'],
        }),
    ],
    unnamedArgumentList: [
        SlashCommandArgument.fromProps({
            description: 'the text to repeat',
            typeList: ARGUMENT_TYPE.STRING,
            isRequired: true,
        }),
    ],
    helpString: `
        <div>
            Repeats the provided text a number of times.
        </div>
        <div>
            <strong>Examples:</strong>
            <ul>
                <li><pre><code>/repeat hello</code></pre> returns "hellohellohellohellohello"</li>
                <li><pre><code>/repeat times=3 space=on world</code></pre> returns "world world world"</li>
            </ul>
        </div>
    `,
}));
```

### Argument Types

```javascript
ARGUMENT_TYPE.STRING   // Text input
ARGUMENT_TYPE.NUMBER   // Numeric input
ARGUMENT_TYPE.BOOLEAN  // Boolean (on/off, true/false)
ARGUMENT_TYPE.LIST     // List of values
```

---

## Custom Macros

Macros can be used in character cards, prompts, and templates.

### String Macros

```javascript
const { registerMacro } = SillyTavern.getContext();

registerMacro('fizz', 'buzz');
// Usage: {{fizz}} → "buzz"
```

### Function Macros (Synchronous Only)

```javascript
registerMacro('tomorrow', () => {
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
    return tomorrow.toLocaleDateString();
});
// Usage: {{tomorrow}} → "12/16/2025"

registerMacro('random100', () => {
    return Math.floor(Math.random() * 100).toString();
});
// Usage: {{random100}} → "42"
```

### Unregistering Macros

```javascript
const { unregisterMacro } = SillyTavern.getContext();
unregisterMacro('fizz');
```

**Note**: Only synchronous functions are supported for macro values.

---

## Character Card Data Storage

Store extension-specific data directly in character cards (Character Cards V2 Specification).

### Writing Data

```javascript
const { writeExtensionField, characterId } = SillyTavern.getContext();

await writeExtensionField(characterId, 'my_extension_key', {
    someData: 'value',
    anotherData: 42,
    settings: {
        enabled: true,
        threshold: 0.7
    }
});
```

### Reading Data

```javascript
const { characters, characterId } = SillyTavern.getContext();
const character = characters[characterId];
const myData = character.data?.extensions?.my_extension_key;

if (myData) {
    console.log(myData.someData); // "value"
    console.log(myData.anotherData); // 42
}
```

### Important Notes

- `characterId` is an array index, not a stable identifier
- Data must be JSON-serializable
- In group chats, `characterId` may not be available
- Data is exported with the character card when shared

---

## Events System

### Listening to Events

```javascript
const { eventSource, event_types } = SillyTavern.getContext();

// Listen for chat messages
eventSource.on(event_types.MESSAGE_SENT, (data) => {
    console.log('User sent:', data.message);
});

eventSource.on(event_types.MESSAGE_RECEIVED, (data) => {
    console.log('Character replied:', data.message);
});

eventSource.on(event_types.CHAT_CHANGED, () => {
    console.log('Chat switched');
});
```

### Emitting Custom Events

```javascript
const { eventSource } = SillyTavern.getContext();

// Define custom event type
const MY_CUSTOM_EVENT = 'my_extension_event';

// Emit event
eventSource.emit(MY_CUSTOM_EVENT, {
    action: 'something_happened',
    data: { foo: 'bar' }
});

// Other extensions can listen
eventSource.on(MY_CUSTOM_EVENT, (data) => {
    console.log('Custom event received:', data);
});
```

---

## Text Generation

### In-Context Generation (Quiet Prompt)

Generates text within the current chat context:

```javascript
const { generateQuietPrompt } = SillyTavern.getContext();

async function translateText(text) {
    const prompt = `Translate to Spanish: ${text}`;
    const result = await generateQuietPrompt({
        quietPrompt: prompt
    });
    return result;
}
```

### Raw Generation (No Context)

Generates text without chat context:

```javascript
const { generateRaw } = SillyTavern.getContext();

async function summarize(text) {
    const result = await generateRaw({
        prompt: `Summarize this text: ${text}`,
        use_mancer: false,
        max_length: 200
    });
    return result;
}
```

### Structured Outputs (JSON Schema)

Force the model to output valid JSON matching a schema:

```javascript
const { generateRaw } = SillyTavern.getContext();

const jsonSchema = {
    name: 'StoryStateModel',
    description: 'A schema for story state',
    strict: true, // Enforce strict schema compliance
    value: {
        '$schema': 'http://json-schema.org/draft-04/schema#',
        'type': 'object',
        'properties': {
            'location': { 'type': 'string' },
            'plans': { 'type': 'string' },
            'memories': { 'type': 'string' }
        },
        'required': ['location', 'plans', 'memories']
    }
};

const prompt = 'Generate a story state. Output as JSON.';

const result = await generateRaw({
    prompt,
    jsonSchema
});

// Parse the result
const storyState = JSON.parse(result);
console.log(storyState.location);
```

**Notes**:
- Primarily for Chat Completion APIs
- Output is a stringified JSON object
- Failures return empty object `{}`
- Manual parsing and validation required

---

## Prompt Interceptors

Modify prompts before they're sent to the AI.

### Registration

In `manifest.json`:

```json
{
    "display_name": "My Interceptor Extension",
    "loading_order": 10,
    "generate_interceptor": "myCustomInterceptorFunction"
}
```

### Interceptor Function

```javascript
// Must be a global function
window.myCustomInterceptorFunction = function(prompts) {
    // prompts is an object containing various prompt parts
    // Modify and return the prompts object

    // Example: Add a prefix to the main prompt
    if (prompts.mainPrompt) {
        prompts.mainPrompt = `[Enhanced] ${prompts.mainPrompt}`;
    }

    // Example: Modify system prompt
    if (prompts.systemPrompt) {
        prompts.systemPrompt += '\nAlways be concise.';
    }

    return prompts;
};
```

**Note**: `loading_order` determines the execution sequence of multiple interceptors.

---

## Importing from Other Files

### Dynamic Import (Recommended)

```javascript
/**
 * Import a member from a module by URL, bypassing webpack.
 */
async function importFromUrl(url, what, defaultValue = null) {
    try {
        const module = await import(/* webpackIgnore: true */ url);
        if (!Object.hasOwn(module, what)) {
            throw new Error(`No ${what} in module`);
        }
        return module[what];
    } catch (error) {
        console.error(`Failed to import ${what} from ${url}:`, error);
        return defaultValue;
    }
}

// Usage
const generateRaw = await importFromUrl('/script.js', 'generateRaw');
```

### Direct Import (Less Stable)

```javascript
import { generateQuietPrompt } from "../../../../script.js";

async function handleMessage(data) {
    const text = data.message;
    const translated = await generateQuietPrompt({
        quietPrompt: text
    });
    return translated;
}
```

**Warning**: Direct imports may break if SillyTavern's internal structure changes.

---

## State Management

### Persistent Settings

Store extension settings that persist across sessions:

```javascript
const EXTENSION_NAME = 'my-extension';

// Save settings
function saveSettings() {
    const settings = {
        enabled: true,
        apiKey: 'abc123',
        threshold: 0.7
    };

    localStorage.setItem(
        `${EXTENSION_NAME}_settings`,
        JSON.stringify(settings)
    );
}

// Load settings
function loadSettings() {
    const saved = localStorage.getItem(`${EXTENSION_NAME}_settings`);
    if (saved) {
        return JSON.parse(saved);
    }
    return getDefaultSettings();
}

function getDefaultSettings() {
    return {
        enabled: false,
        apiKey: '',
        threshold: 0.5
    };
}
```

### Chat Metadata

Store data specific to the current chat:

```javascript
const { saveChatMetadata, getChatMetadata } = SillyTavern.getContext();

// Save metadata
await saveChatMetadata({
    my_extension_data: {
        messageCount: 42,
        lastAction: 'translate'
    }
});

// Read metadata
const metadata = getChatMetadata();
const myData = metadata.my_extension_data;
```

---

## Internationalization (i18n)

### Via Manifest

In `manifest.json`:

```json
{
    "i18n": {
        "en-us": "i18n/en-us.json",
        "de-de": "i18n/de-de.json",
        "fr-fr": "i18n/fr-fr.json"
    }
}
```

### Translation Files

`i18n/en-us.json`:
```json
{
    "greeting": "Hello",
    "farewell": "Goodbye",
    "settings": {
        "title": "Extension Settings",
        "enabled": "Enabled"
    }
}
```

`i18n/de-de.json`:
```json
{
    "greeting": "Hallo",
    "farewell": "Auf Wiedersehen",
    "settings": {
        "title": "Erweiterungseinstellungen",
        "enabled": "Aktiviert"
    }
}
```

### Direct API Call

```javascript
const { addLocaleData } = SillyTavern.getContext();

addLocaleData({
    'en-us': {
        'my_extension.greeting': 'Hello'
    },
    'de-de': {
        'my_extension.greeting': 'Hallo'
    }
});

// Use in code
const greeting = t('my_extension.greeting');
```

---

## Making Extras API Requests

Call SillyTavern Extras API endpoints from your extension:

```javascript
const { doExtrasFetch } = SillyTavern.getContext();

async function callCustomEndpoint() {
    try {
        const response = await doExtrasFetch('/api/custom-endpoint', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                data: 'some value'
            })
        });

        const result = await response.json();
        return result;
    } catch (error) {
        console.error('Extras API error:', error);
        return null;
    }
}
```

---

## Shared Libraries

Access common utility libraries included with SillyTavern:

```javascript
const libs = SillyTavern.getContext().libs;

// Examples of available libraries (check source for complete list)
const _ = libs.lodash;           // Lodash utilities
const $ = libs.jquery;           // jQuery
const Handlebars = libs.handlebars; // Template engine
```

---

## Bundling

For complex extensions with multiple files and dependencies:

1. Use a bundler like Webpack, Rollup, or esbuild
2. Bundle everything into a single `index.js` file
3. Include source maps for debugging
4. Ensure relative imports work from `/scripts/extensions/third-party/`

### Example Webpack Config

```javascript
module.exports = {
    entry: './src/index.js',
    output: {
        filename: 'index.js',
        path: __dirname
    },
    mode: 'production',
    devtool: 'source-map',
    module: {
        rules: [
            {
                test: /\.js$/,
                exclude: /node_modules/,
                use: 'babel-loader'
            }
        ]
    }
};
```

---

## Extension Submission Guidelines

To contribute to the official SillyTavern extension repository:

### Requirements

1. **Open Source**: Must have a libre license (e.g., AGPLv3)
2. **Compatibility**: Works with latest SillyTavern release
3. **Documentation**: Comprehensive README with:
   - Installation instructions
   - Usage examples
   - Feature list
   - Configuration options
4. **No Server Dependencies**: Extensions requiring server plugins won't be accepted
5. **Maintenance**: Be ready to update when core changes

### Best Practices

- Use semantic versioning
- Test thoroughly before submission
- Provide clear error messages
- Handle edge cases gracefully
- Minimize performance impact
- Document all configuration options

---

## Complete Example Extension

```javascript
// index.js
(function() {
    'use strict';

    const EXTENSION_NAME = 'example-extension';
    const DEBUG = true;

    // Settings
    let settings = {
        enabled: true,
        prefix: '[EXT]'
    };

    function log(...args) {
        if (DEBUG) {
            console.log(`[${EXTENSION_NAME}]`, ...args);
        }
    }

    function loadSettings() {
        const saved = localStorage.getItem(`${EXTENSION_NAME}_settings`);
        if (saved) {
            settings = { ...settings, ...JSON.parse(saved) };
        }
        log('Settings loaded:', settings);
    }

    function saveSettings() {
        localStorage.setItem(
            `${EXTENSION_NAME}_settings`,
            JSON.stringify(settings)
        );
        log('Settings saved');
    }

    function registerSlashCommands() {
        SlashCommandParser.addCommandObject(SlashCommand.fromProps({
            name: 'example',
            callback: (args, value) => {
                return `${settings.prefix} ${value}`;
            },
            helpString: 'Example command that adds a prefix to text',
            unnamedArgumentList: [
                SlashCommandArgument.fromProps({
                    description: 'text to prefix',
                    typeList: ARGUMENT_TYPE.STRING,
                    isRequired: true,
                }),
            ],
        }));
        log('Slash commands registered');
    }

    function registerMacros() {
        const { registerMacro } = SillyTavern.getContext();

        registerMacro('example_time', () => {
            return new Date().toLocaleTimeString();
        });

        log('Macros registered');
    }

    function setupEventListeners() {
        const { eventSource, event_types } = SillyTavern.getContext();

        eventSource.on(event_types.MESSAGE_SENT, (data) => {
            if (!settings.enabled) return;
            log('Message sent:', data.message);
        });

        log('Event listeners registered');
    }

    function createUI() {
        const settingsHtml = `
            <div class="example-extension-settings">
                <h3>Example Extension Settings</h3>
                <label>
                    <input type="checkbox" id="example-enabled" ${settings.enabled ? 'checked' : ''}>
                    Enabled
                </label>
                <label>
                    Prefix:
                    <input type="text" id="example-prefix" value="${settings.prefix}">
                </label>
                <button id="example-save">Save</button>
            </div>
        `;

        // Add to settings panel (implementation depends on ST structure)
        // This is a simplified example
        $('#extensions_settings').append(settingsHtml);

        $('#example-save').on('click', () => {
            settings.enabled = $('#example-enabled').prop('checked');
            settings.prefix = $('#example-prefix').val();
            saveSettings();
        });

        log('UI created');
    }

    // Initialize extension
    async function init() {
        log('Initializing...');

        loadSettings();
        registerSlashCommands();
        registerMacros();
        setupEventListeners();
        createUI();

        log('Initialization complete');
    }

    // Run initialization
    init();
})();
```

---

## Debugging Tips

1. **Console Logging**: Use `console.log()` extensively during development
2. **Browser DevTools**: Use the browser's developer tools to inspect state
3. **Error Handling**: Wrap async operations in try-catch blocks
4. **Source Maps**: Enable source maps when bundling for easier debugging
5. **Extension Reload**: Refresh the page to reload extension changes

---

## Resources

- **SillyTavern Repository**: https://github.com/SillyTavern/SillyTavern
- **Extension Examples**: Check `/public/scripts/extensions/` for official examples
- **Community Discord**: Ask for help in the SillyTavern Discord server
- **MDN JavaScript Course**: https://developer.mozilla.org/en-US/docs/Learn/JavaScript

---

## Alternative: STscript

If you don't want to write JavaScript, consider using **STscript** - a simpler scripting language built into SillyTavern for basic automation tasks.

# Nore's Interface Enhancements

A small quality of life module for Foundry VTT v13. It adds sidebar startup behavior, a pause banner position control, a clean collapsible hotbar button, and a compact toolbar in Module Management for checking and unchecking modules and for importing or exporting the active set.

## Requirements

* Foundry VTT v13
* Tested with dnd5e

## Install

### One click install
Paste this manifest URL in Foundry's Install Module screen.

```
https://raw.githubusercontent.com/noreaga/nores-interface-enhancements/main/module.json
```

### Manual
Download the release zip and install from file.

```
https://github.com/noreaga/nores-interface-enhancements/releases/download/v2.9.7/nore-interface-enhancements-v2.9.7.zip
```

## Features

### Sidebar at startup
* Option to expand the sidebar on world load
* Choose a default active tab or use Last open tab

Tabs include Chat, Combat, Scenes, Actors, Items, Journal, Tables, Cards, Macros, Playlists, Compendium packs, Settings

### Pause banner position
* Dropdown with Default, Top, Bottom
* Default uses the system position
* Top anchors near the top center
* Bottom anchors lower on the screen

### Collapsible hotbar
* A native looking icon appears in the hotbar's left control cluster
* Clicking hides or shows the entire hotbar while leaving the toggle visible
* Respects Start hotbars collapsed on world load
* Works with dnd5e and does not disturb page arrows or lock and clear controls

### Module Management toolbar
* Title on the left and five compact icon buttons on the right
* Check all marks every module checkbox
* Uncheck all clears everything except this module
* Copy active list places active modules in the clipboard as a text list
* Export active as JSON writes an active-modules.json file
* Import JSON and check reads an active-modules.json file and checks matching ids
* These actions do not force dependency prompts. Press Save Modules to apply

## Settings

* Default sidebar tab  
  Default is Last open tab  
  Choices include Chat, Combat, Scenes, Actors, Items, Journal, Tables, Cards, Macros, Playlists, Compendium packs, Settings

* Expand sidebar on load  
  Opens the sidebar when the world is ready

* Enable collapsible hotbars  
  Shows the toggle in the left control cluster

* Start hotbars collapsed  
  Begins with the hotbar hidden

* Pause banner position  
  Default, Top, Bottom

## Compatibility

* Designed for v13
* Uses only public client APIs and DOM hooks
* No network calls and no data collection

## Manifest fields

Your module.json should include these keys.

```json
{
  "id": "nores-interface-enhancements",
  "title": "Nore's Interface Enhancements",
  "description": "UI tweaks for Foundry VTT v13: sidebar auto expand with selectable default tab or last tab, pause banner position, collapsible hotbars, and a Module Management toolbar.",
  "type": "module",
  "version": "2.9.7",
  "compatibility": {
    "minimum": "13",
    "verified": "13"
  },
  "authors": [
    { "name": "Nore", "url": "https://github.com/noreaga" }
  ],
  "esmodules": [
    "scripts/nores-interface-enhancements.mjs"
  ],
  "styles": [
    "styles/nores-interface-enhancements.css"
  ],
  "url": "https://github.com/noreaga/nores-interface-enhancements",
  "manifest": "https://raw.githubusercontent.com/noreaga/nores-interface-enhancements/main/module.json",
  "download": "https://github.com/noreaga/nores-interface-enhancements/releases/download/v2.9.7/nores-interface-enhancements-v2.9.7.zip",
  "readme": "https://raw.githubusercontent.com/noreaga/nores-interface-enhancements/main/README.md",
  "license": "https://raw.githubusercontent.com/noreaga/nores-interface-enhancements/main/LICENSE.md",
  "changelog": "https://raw.githubusercontent.com/noreaga/nores-interface-enhancements/main/CHANGELOG.md",
  "socket": false
}
```

## License

MIT © 2025 Nore  
See LICENSE.md

## Credits

Created by Nore

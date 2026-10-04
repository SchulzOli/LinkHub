---
title: Getting started
description: Install LinkHub as your new tab page or run it locally, and build your first board.
order: 1
section: Guide
---

# Getting started

LinkHub turns a blank tab into an infinite canvas. You place link cards,
groups, pictures, live charts and news feeds on it and arrange them the way
you think about them. Everything is stored in your browser.

![The LinkHub canvas with five groups of link cards](assets/screenshots/01-canvas-overview.png)

## Install the extension

LinkHub replaces the new tab page in Chrome, Edge and Firefox.

| Browser | Store                                                                                                      |
| ------- | ---------------------------------------------------------------------------------------------------------- |
| Chrome  | [Chrome Web Store](https://chromewebstore.google.com/detail/linkhub/dpbgplhiaobnegcbfedihimnoamlpgmd)      |
| Edge    | [Edge Add-ons](https://microsoftedge.microsoft.com/addons/detail/linkhub/gkcpbfphinbaoplepknkinjfkdhljghp) |
| Firefox | [Firefox Add-ons](https://addons.mozilla.org/en-US/firefox/addon/link-hub/)                                |

After the install, open a new tab. The extension asks for no permissions and
loads no remote code.

## Run it from source

You need Node.js 22 or later.

```bash
git clone https://github.com/SchulzOli/LinkHub.git
cd LinkHub
npm install
npm run dev
```

Open <http://localhost:5173>. To load your own build as an extension, see
[Browser extension](extension.html).

## Your first board

1. Paste a URL anywhere on the canvas, or select **Add link** in the taskbar.
   LinkHub creates a card with the site's icon.
2. Select **Add group** and drag cards into the group body. Groups can hold
   other groups.
3. Switch between **edit mode** and **view mode** with the pencil/eye button.
   In view mode a click opens the link; in edit mode you move, resize and
   style nodes.
4. Open the menu (☰) to pick a theme, set defaults for new nodes, or manage
   workspaces.

## Taskbar

| Button             | What it does                                        |
| ------------------ | --------------------------------------------------- |
| Add link           | Quick add: URL and title for a new card             |
| Add group          | A new group at the center of the view               |
| Upload image       | Places an image file as a picture node              |
| Open image gallery | All images stored by LinkHub                        |
| Add chart          | A chart node, see [Charts](charts.html)             |
| Add news feed      | A news feed node, see [News feeds](news-feeds.html) |
| Edit / view mode   | Toggles between arranging and using the board       |
| Menu (☰)          | Options, Themes, Templates, Statistics, Data        |
| ?                  | Keyboard shortcuts and the privacy summary          |

---
title: Privacy and data
description: What LinkHub stores, where, and which network requests it makes.
order: 6
section: Guide
---

# Privacy and data

LinkHub is local-first. There is no account, no LinkHub server, no analytics
and no advertising.

## Stored in your browser

IndexedDB holds the workspaces, images, templates and themes; localStorage
keeps a small snapshot of the active workspace. Statistics are computed from
data that stays on the device. Nothing is synced. To move a board, export a
`.linkhub.zip` bundle and import it elsewhere.

Details: [Storage](storage.html).

## Network requests

| When                             | Request                                                                                                                                                |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| You create a link card           | The site's `/favicon.ico`, then Google's favicon service as a fallback (can be turned off)                                                             |
| A chart node is on the board     | The feed server set on the chart (default: your own computer, `127.0.0.1:8787`)                                                                        |
| A news feed node is on the board | The feeds you added, through the proxy set on the node (default: `127.0.0.1:8788`) or directly; with **Images** on, article images from the news sites |
| You select **Check Links**       | One `HEAD` request per card URL                                                                                                                        |
| You open a link                  | The page itself, in a new tab                                                                                                                          |

None of these requests carry your board content, templates, themes, images or
statistics.

The full policy: [LinkHub privacy policy](privacy/).

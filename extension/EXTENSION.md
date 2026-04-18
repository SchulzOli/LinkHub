# LinkHub Browser Extension

Use LinkHub as your new tab page in Chrome, Edge, and Firefox.

## Local Development

### Build the extension

```bash
npm run build:extension
```

This builds the app with relative paths and packages everything into `dist-extension/`.

### Install locally

**Chrome / Edge:**

1. Open `chrome://extensions` or `edge://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked** and select `dist-extension/`
4. Open a new tab

**Firefox:**

1. Open `about:debugging#/runtime/this-firefox`
2. Click **Load Temporary Add-on**
3. Select `dist-extension/manifest.json`
4. Open a new tab

### Icons

`public/linkhub-mark.svg` is the source for:

- the web favicon
- the extension PNG icons in `extension/icons/`
- the app symbol used inside the UI

The extension PNGs are committed to the repository. If the mark changes, update the files in `extension/icons/` so they stay in sync with `public/linkhub-mark.svg`, then rebuild the extension:

```bash
npm run build:extension
```

### Updating after code changes

1. Run `npm run build:extension`
2. Chrome/Edge: reload the unpacked extension in the extensions page
3. Firefox: reload the temporary add-on in `about:debugging`

### Data migration

The extension has its own isolated storage. To move existing data from the web build into the extension, export a canvas bundle in the web build and import that bundle in the extension from the Data tab.

Current bundle imports can:

- replace the current canvas
- create a brand-new workspace from the imported bundle
- restore gallery images, saved templates, and saved custom themes that were bundled during export

---

## Firefox Release Workflow

### 1. Prepare the release

Before each AMO submission:

1. Ensure `extension/icons/` contains the final committed PNG set
2. Bump `"version"` in `extension/manifest.json`
3. Keep `browser_specific_settings.gecko.id` unchanged

Current Gecko ID:

```json
"browser_specific_settings": {
  "gecko": {
    "id": "linkhub@extension"
  }
}
```

Do **not** change that ID after the first public Firefox release, otherwise installed users will not receive updates.

### 2. Generate the Firefox build

```bash
npm run build:extension
```

Then create the AMO upload ZIP:

```powershell
Compress-Archive -Path dist-extension\* -DestinationPath linkhub-firefox.zip -Force
```

Important:

- The ZIP root must contain the files from `dist-extension/`
- Do **not** zip the `dist-extension` folder itself as a nested folder

### 3. Test locally in Firefox

1. Open `about:debugging#/runtime/this-firefox`
2. Click **Load Temporary Add-on**
3. Select `dist-extension/manifest.json`
4. Open a new tab and verify the extension behaves correctly

### 4. Submit to AMO

1. Create or sign in to an account at https://addons.mozilla.org/en-US/developers/
2. Choose **Submit a New Add-on**
3. For a public listing, choose **Listed**
4. Upload `linkhub-firefox.zip`
5. Fill out the store listing

Typical listing fields:

- Name
- Short description
- Long description
- Category
- Screenshots

### 5. Prepare for review

For smoother Firefox review, prepare the following:

- Screenshots, ideally `1280x800` or `640x400`
- A short reviewer note explaining that the add-on replaces the browser new-tab page
- A privacy statement explaining that data stays local in the browser

Suggested privacy wording:

> LinkHub stores user data locally in the browser on the current device. It does not send workspace data, templates, themes, or images to external servers.

### 6. Source archive for AMO reviewers

Because the extension is bundled with Vite, AMO reviewers may ask for source code or review goes faster if you provide it proactively.

Recommended approach:

```bash
git archive --format=zip -o linkhub-source.zip HEAD
```

That gives you a clean source archive from tracked files only, without `node_modules` and without `dist-extension`.

Include a short README for reviewers with at least:

```bash
npm install
npm run build:extension
```

### 7. What not to change

Do not change these during release packaging:

- `browser_specific_settings.gecko.id` in `extension/manifest.json`
- the ZIP structure, which must contain the built extension files at the archive root

---

## Chrome Web Store

### Chrome requirements at a glance

Chrome Web Store requires a Manifest V3 extension, a valid ZIP package, a clear single purpose, an accurate privacy disclosure, and a complete store listing.

For this project, the extension package itself is already in good shape:

- `manifest_version: 3` is already in place
- the required extension icons are present in `extension/icons/`
- the extension has a narrow purpose: replace the new tab page with LinkHub
- the manifest currently requests no extra high-risk permissions

What is still needed before a Chrome release:

- a Chrome Web Store developer account
- store listing copy: name, short description, detailed description, category
- store visuals prepared for the listing: screenshots and any required listing graphics
- privacy disclosure filled out in the Chrome dashboard
- a public privacy policy URL that matches the dashboard disclosure

For automated publishing in this repository, Chrome uses a Google service account linked to the Chrome Web Store publisher.

### Chrome release workflow

#### 1. Prepare the release

Before each Chrome Web Store submission:

1. Ensure `extension/icons/` contains the final committed PNG set
2. Bump `"version"` in `extension/manifest.json`
3. Confirm the extension still has a single clear purpose: LinkHub as the browser new tab page
4. Re-check that no unnecessary permissions were added to the manifest

Current manifest characteristics:

```json
{
  "manifest_version": 3,
  "description": "Your personal link canvas as a new tab page.",
  "chrome_url_overrides": {
    "newtab": "index.html"
  }
}
```

#### 2. Build the Chrome package

```bash
npm run build:extension
```

Then create the Chrome Web Store upload ZIP:

```powershell
Compress-Archive -Path dist-extension\* -DestinationPath linkhub-chrome.zip -Force
```

Important:

- The ZIP root must contain the files from `dist-extension/`
- Do **not** zip the `dist-extension` folder itself as a nested folder
- Chrome Web Store accepts ZIP uploads up to 2 GB

#### 3. Test locally in Chrome

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked** and select `dist-extension/`
4. Open a new tab and verify storage, import/export, images, themes, and menu flows

#### 4. Prepare the store listing

In the Chrome Developer Dashboard you will need to complete at least:

- Package
- Store Listing
- Privacy
- Distribution
- Test instructions, if reviewer guidance is useful

Prepare these materials before submission:

- extension name
- short description
- full description
- category
- screenshots that show the actual new-tab experience
- privacy policy URL

Recommended positioning for LinkHub:

- Category: `Functionality & UI` or `Workflow & Planning`
- Single purpose statement: replace the browser new tab page with a personal link canvas

#### 5. Privacy disclosure

Chrome requires the Privacy section in the dashboard to accurately describe user data handling.

For LinkHub, the intended disclosure should stay aligned with the actual behavior:

> LinkHub stores user data locally in the browser on the current device. It does not send workspace data, templates, themes, or images to external servers.

Chrome's policy requires a privacy policy when a product handles user data, and Chrome explicitly states that this still applies when the data is stored only locally.

For that reason, this repository keeps a hosted policy page at `public/privacy/index.html`. After deploying the site, use the hosted `/privacy/index.html` URL in the Chrome Web Store privacy policy field.

#### 6. One-time Google setup for service-account publishing

1. Create or sign in to an account at https://chrome.google.com/webstore/devconsole
2. Pay the one-time developer registration fee if the account is new
3. If the Chrome Web Store item does not exist yet, click **Add new item**, upload `linkhub-chrome.zip`, and save the draft
4. Complete **Store Listing**, **Privacy**, and **Distribution** for the item
5. In the Chrome Developer Dashboard, open **Account** and copy the **Publisher ID**
6. Open the Chrome Web Store item and copy the extension ID from the item page or store URL
7. Open Google Cloud Console and create or select a project
8. Enable the **Chrome Web Store API** in that project
9. Create a **Service Account** in the same project
10. Create a JSON key for the service account and download it securely
11. Go back to the Chrome Developer Dashboard, open **Account**, and add the service-account email address there

Important:

- Google currently allows only one linked service account per publisher
- the service account must be added in the Chrome dashboard before API calls will work
- listing metadata and privacy disclosures still stay in the dashboard

#### 7. Local Chrome deployment

Create a local env file from the example:

```bash
copy chrome.env.example chrome.env
```

Fill in:

- `EXT_ID`
- `PUBLISHER_ID`
- `SERVICE_ACCOUNT_KEY_FILE`

Then publish the current extension build to Chrome:

```bash
npm run deploy:chrome
```

This uses `extension/deploy.mjs`, builds `dist-extension.zip`, authenticates with the service account, uploads the ZIP to the Chrome Web Store API, and submits the item for publishing.

#### 8. GitHub Actions / CD setup for Chrome

The repository CD workflow supports Chrome publishing through the `deploy_chrome` flag.

Required GitHub repository secrets:

- `CHROME_EXT_ID`
- `CHROME_PUBLISHER_ID`
- `CHROME_SERVICE_ACCOUNT_JSON`

For `CHROME_SERVICE_ACCOUNT_JSON`, paste the full JSON key content of the Google service account.

Workflow behavior:

- `sync-version` updates `package.json`, `package-lock.json`, and `extension/manifest.json`
- `deploy-extension` builds the extension and calls `node extension/deploy.mjs --publish-only chrome`

#### 9. What still stays manual in the dashboard

- the first item creation if you have never uploaded the extension before
- store listing text, screenshots, and category management
- privacy disclosures and privacy-policy URL maintenance
- at least one manual publish after changing visibility settings, because Chrome keeps publishing tied to the current visibility configuration

#### 10. Review readiness checklist

Before submitting, verify:

- the extension behavior matches the store description exactly
- the privacy disclosure matches the real data handling exactly
- the listing clearly explains that this is a new-tab override
- the screenshots show the actual product, not mockups
- no extra permissions or remote-code patterns were introduced

#### 11. Current project status for Chrome

Already covered in this repository:

- Manifest V3 packaging
- committed extension icons
- Chrome-compatible new-tab override
- extension ZIP packaging flow via `dist-extension/`

Still to prepare outside the codebase:

- Chrome Web Store developer account setup
- public privacy policy URL
- final store listing copy and images
- optional reviewer/test notes in the dashboard

---

## Edge Add-ons

### Important limitation up front

The Microsoft Edge Add-ons Publish API updates an existing Edge product. It does not create the initial product entry and it does not manage listing metadata such as screenshots, long description, or categories.

That means:

- the first Edge listing must be created manually in Partner Center
- package updates after that can run through the API and CI/CD
- store metadata continues to be managed in Partner Center

### Edge requirements at a glance

For this repository, Edge uses the same extension package structure as Chrome:

- Manifest V3 new-tab override
- bundled ZIP built from `dist-extension/`
- same icons and client-side runtime bundle

What you still need outside the repo:

- a Microsoft Partner Center account with an Edge add-on already created
- Publish API access enabled in Partner Center
- a generated Client ID and API key
- the Product ID of the Edge add-on to update

### Enable the Edge Publish API

In Partner Center:

1. Sign in to the account that owns the Edge add-on
2. Open `Microsoft Edge > Publish API`
3. Enable the newer Publish API experience
4. Create API credentials
5. Copy the generated `Client ID` and `API key`
6. Open the Edge add-on overview and copy the `Product ID`

The Product ID is the GUID of the existing Edge extension product.

### Local Edge deployment

Create a local env file from the example:

```bash
copy edge.env.example edge.env
```

Fill in:

- `CLIENT_ID`
- `API_KEY`
- `PRODUCT_ID`

Then publish the current extension build to Edge:

```bash
npm run deploy:edge
```

This uses `extension/deploy.mjs`, builds `dist-extension.zip`, and sends the update through the Edge publishing API.

### GitHub Actions / CD setup for Edge

The repository CD workflow already supports Edge publishing through the `deploy_edge` flag.

Required GitHub repository secrets:

- `EDGE_CLIENT_ID`
- `EDGE_API_KEY`
- `EDGE_PRODUCT_ID`

Workflow behavior:

- `sync-version` updates `package.json`, `package-lock.json`, and `extension/manifest.json`
- `deploy-extension` builds the extension and calls `node extension/deploy.mjs --publish-only edge`

### Edge release notes

- the initial listing still needs to be created and configured manually in Partner Center
- API publishing updates the package for an existing draft submission and triggers store-side processing
- listing copy, screenshots, privacy information, and category selection stay in Partner Center
- public availability still depends on Microsoft Edge Add-ons processing and review state

# Asset library

Images live in Google Drive, not in this repo (decisions D-009, D-019).

- Folder: [Grow Good / Brand Assets](https://drive.google.com/drive/folders/18lo_PVFiQg35C69ko6-QD-IuZ4E3WCHC)
- Register: [Asset register](https://docs.google.com/spreadsheets/d/1KH1aZgWdh7mh1G72m4zsZ55CJTiZH_fFFny2-CxJt0w/edit)

## Folders

| Folder | Holds |
|---|---|
| 00 Inbox | Anything new. Not available to agents until it is sorted and registered. |
| Photography | Garden and event photos |
| Illustrations | Rendered garden illustrations |
| Spots and icons | Animated spot illustrations and icons |
| Logos | Grow Good wordmark files |
| Partners | Partner and sponsor logos |
| Art direction | References for D-035: English craft, hippie modernism, hand drawn. For people designing templates. Never placed in a design. |
| Retired | Assets no longer in use. Kept for the record. |

## Register columns

| Column | Notes |
|---|---|
| asset_id | A-0001, A-0002, … Never reused. |
| file_name, folder, drive_file_id | Where the file is. |
| type | photo, illustration, spot, icon, logo, partner-logo |
| style | For illustrations, spots and icons, the illustration style (D-038). For logos, the wordmark variant, such as ‘primary’, that the wordmark include asks for (D-037). Blank for photos. |
| subjects | Comma-separated plain words: ‘prairie, pollinators, front yard’. |
| season | spring, summer, fall, winter, any |
| orientation, width_px, height_px | For choosing the right image for a format. The sync measures each file and lists its real size. |
| alt_text | Written once, here. Agents reuse it. |
| credit, usage_rights | usage_rights: owned, licensed, permission, unknown |
| status | draft, approved, retired |
| approved_by, approved_on, notes | Leah Fagan or Brad Nagle. |

## How rows reach the theme

The sync (D-053) reads the register with a read-only Google service account, copies every row that is approved, has known usage rights, alt text and a Drive file into `assets/library/`, and lists them in `_data/assets.yml`. A row taken back to draft or retired leaves on the next sync. Files must be web-sized: at most 2400px on the longest edge and 2MB.

- The GitHub workflow **Assets** runs it on demand and on Monday mornings, and opens a pull request when anything changed. The pull request lists approved rows it had to leave out, and why.
- `npm run assets:check` checks the library against its list, in every Playbook build.
- Locally: `GOOGLE_SERVICE_ACCOUNT_KEY="$(cat key.json)" npm run assets:sync`.

### Setting up the service account (once)

1. In the Google Cloud console, create a project, or pick one, and enable the **Google Sheets API** and the **Google Drive API**.
2. Under **IAM & Admin → Service accounts**, create an account named `asset-sync`. It needs no roles.
3. On the account, **Keys → Add key → JSON**. A key file downloads.
4. In Drive, share **Grow Good / Brand Assets** with the account’s address (it ends in `iam.gserviceaccount.com`) as **Viewer**. The register is inside the folder, so it is shared too.
5. Save the key as the repo secret, then delete the downloaded file: `gh secret set GOOGLE_SERVICE_ACCOUNT_KEY --repo sbx-bnagle/growgood-brand < key.json`
6. In the repo’s **Settings → Actions → General**, turn on **Allow GitHub Actions to create and approve pull requests**, so the sync can open its pull request.

## Rules for agents

1. Use only images listed in `_data/assets.yml`, through the image include (IMG-001). Every one is approved with known rights.
2. Use the alt_text from the register. Do not write new alt text for a registered image.
3. If no approved image fits, the request goes to ‘brief a person’ (LADDER-003).
4. Never place anything from Art direction in a design. Those files are references, not assets.

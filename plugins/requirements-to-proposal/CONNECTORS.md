# Connectors

## How tool references work

Plugin files use `~~category` as a placeholder for whatever tool you connect in that category. The plugin is tool-agnostic — it describes the workflow in terms of categories rather than naming a specific product, so it works with whatever you already use.

## Connectors for this plugin

| Category | Placeholder | Options |
| --- | --- | --- |
| CRM | `~~CRM` | Twenty, HubSpot, Salesforce, Pipedrive, Attio, Zoho CRM |

## Optional, not required

Nothing else needs connecting. The plugin will use these if they happen to be available, and works without them:

| Purpose | Used for | Examples |
| --- | --- | --- |
| Transcription | Turning a recording into text | ElevenLabs, or a local speech-to-text model |
| Document or chat sources | Pulling requirements out of where they landed | Google Drive, Notion, Gmail, Slack |

If no transcription connector is reachable, the skill falls back to transcribing locally on a connected computer.

## What the CRM connector needs to do

At minimum: search accounts, create an account, create contacts, create deal or opportunity records, and attach notes. File upload is nice to have — many connectors don't offer it, and the skill handles that by linking the published document from a note instead.

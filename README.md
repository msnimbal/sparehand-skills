# SpareHand AI — Claude skills

Reusable skills for Claude (Cowork / Claude Code), maintained by SpareHand AI.

## Skills

| Skill | Purpose |
|---|---|
| [`sparehand-client-scope`](skills/sparehand-client-scope/SKILL.md) | Turn raw client requirements — notes, text, WhatsApp messages, audio recordings, documents — into a scope document, a PDF, and matching records in the SpareHand CRM. |

## Layout

```
skills/<skill-name>/SKILL.md
```

Each `SKILL.md` carries YAML frontmatter with `name` and `description`. The description decides when Claude reaches for the skill, so edit it deliberately.

## Conventions

**Method, not findings.** A skill holds how we work. Anything about a specific client, platform or vendor — an API limit, a price, a product quirk — belongs in that client's CRM notes, not here. Findings go stale; method doesn't.

**Edit the source, not the copy.** Claude keeps a synced, read-only cache of account skills. Changes made there don't persist. Update the file in this repo, then save the skill through Claude's own proposal flow so both stay in step.

## Contributing

One skill per directory. Keep steps ordered and imperative, and record the failure modes that actually happened — those are worth more to the next run than a description of the happy path.

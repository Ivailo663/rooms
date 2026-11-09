---
name: spec
description: Draft or change acceptance criteria in specs/ before any code is written. Use when the user describes a new feature, a behaviour change, or a bug whose expected behaviour isn't already a criterion, or when they type /spec.
---

# /spec: write the criteria first

The user describes behaviour in plain words. You turn it into acceptance
criteria and stop for their review. **Write no application code in this step.**

## Steps

1. **Read** `specs/README.md` (the format and tags), `specs/product.md` (scope),
   and the spec for the area. Use the index in the README. If the feature
   doesn't fit any domain, make a new file and add it to the index under a new
   prefix.
2. **Read the code the rule touches.** For every new or changed criterion,
   decide which case it is:
   - The code already does it. Write the criterion as is.
   - The code doesn't do it yet. The criterion is part of this feature, so no
     tag is needed.
   - The code does something different, and the user didn't ask for that to
     change. Flag it in your reply. Don't pick a side.
3. **Write the criteria.**
   - One observable behaviour per bullet: status codes, messages, what the user
     sees. Say *what* happens, not *how*.
   - Ids: take the next free number in that prefix. Never reuse a deleted id.
     Group related ids by tens (MEM-0x join, MEM-1x leave).
   - Tag **(mirrored)** when the client must predict the server's answer.
   - Edit an existing criterion in place when the rule changes. Don't add a
     second, contradicting one.
   - Anything you'd otherwise have to guess goes under `## Open questions` in
     that spec. Never guess it into a criterion.
4. **Show the user** the spec diff (a `git diff specs/` summary) plus the open
   questions, in a few lines. **Stop.** The user approves or edits the
   criteria. That review is what makes this spec-driven.
5. **After approval**, dispatch F/B with the criterion ids to build and test
   against, and Q with the same ids to verify.
6. **When the feature ships**, remove any "Status: in progress" line from the
   spec, run `npm run spec:check -- --verbose`, and report which of the new ids
   still have no test.

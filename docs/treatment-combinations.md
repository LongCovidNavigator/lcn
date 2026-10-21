# Combination therapies

The detail page renders combinations separately from alias stages, using a violet bracket. A combination is the parent; components remain below it on combination and single-treatment pages. The current entry is never a link. Each membership retains its existing `cp:<combination>:<component>` or unresolved-name `cn:` feedback key and explicit statement.

`component_of` links an entry to an existing combination. The contextual picker offers only combinations. `has_component` proposes another component on the combination page.

`new_combination` submits one pending `community_submissions` record containing a name and 2–20 distinct existing `component_ids`, including the current source. Nothing is added to the treatment table before authenticated review. The pending proposal is visible on every component page. Names and component sets are checked for duplicates; order does not affect the signature.

Approval runs in the review transaction and creates the treatment entry, primary-name alias and all component links atomically. The `combination_definition` alias records the complete reviewed set; `combination_component` aliases provide individual links. The graph uses the reviewed set instead of guessing additional components from the display name. Existing combinations retain their previous name-based fallback. Approval is idempotent and returns the new treatment ID.

Votes on the new-combination proposal remain attached to the proposal. They are not copied to every membership: approval of a new entry and confirmation of each individual relationship are different assertions.

Checks:

- `php tests/treatment_combinations.php` (creation/review/validation; transaction rolled back)
- `node tests/treatment_combinations.cjs` (both perspectives, navigation, new form, pending visibility, mobile; marked pending test record cleaned up)
- `php tests/treatment_relationship_assertions.php`
- `node tests/treatment_relationship_assertions.cjs` (relationship vote requests mocked)

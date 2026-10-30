# Explicit relationship types on therapy/alias couplings

`tbl_cpl_treatments_nd2aliases.relation_type` describes a single coupling:

| Value | Meaning |
| --- | --- |
| `reference` | The parent/reference therapy of this alias collection |
| `group_member` | The therapy belongs to this group (e.g. EMDR → Psychotherapie) |
| `application_form` | Application form of the reference therapy |
| `substance_variant` | Substance variant of the reference therapy |
| `detailed_method` | More specific execution of a procedure, not mere group membership |
| `NULL` | Relationship has not been specified |

Alias names, alias types, existing coupling rows and notes are retained. In particular,
an `umbrella_term` collection may contain different coupling types (Magnesium).
Trade/generic aliases and combination aliases keep their existing storage conventions.
No new therapy entries are required. Existing feedback keys remain unchanged.

Before running the updated PHP code against another database, run:

```powershell
& C:\xampp\php\php.exe migrations/20261028_alias_coupling_relations.php
```

The CLI-only migration is repeatable, adds the nullable column, fills an explicit list
of existing relationships, and verifies that all pre-existing search data is identical.
It does not infer forms from names. Unclear legacy links stay NULL and are displayed
as “Verbindungsart noch nicht spezifiziert”. The display no longer uses oral/infusion
keywords or shared name prefixes to decide between forms and substance variants.

Explicit reference couplings take precedence over name-based parent resolution.
For old collections without such a coupling, the existing unique-name resolution
remains as compatibility fallback. Entry roles (group, substance, procedure) are not
introduced as a separate taxonomy in this change.

Moderated group/form/variant/detail proposals write the coupling field under an
umbrella alias. They never retype the entire alias based on heuristics. Merge code
preserves coupling metadata and rejects contradictory typed alias couplings.

Validation: `tests/alias_coupling_relations.php`,
`tests/alias_coupling_search_compatibility.php`,
`tests/alias_coupling_diagrams.cjs`, plus relationship-stage/assertion/proposal tests.

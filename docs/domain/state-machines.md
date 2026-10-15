# Core state machines

## Task status categories

`NOT_STARTED` → `IN_PROGRESS` → `DONE`  
Also: `BLOCKED`, `CANCELLED`  
Workspace display states map to these categories. Completion is an authorized status transition on the same task row.

## Personal financial journal

`draft` → `posted` → (correction via new) `reversed`  
Posted journals are immutable; corrections create reversal journals.

## Timesheet

`draft` → `submitted` → `approved` | `rejected` → `locked`  
Locked timesheets do not accept line edits.

## Invoice

`draft` → `pending_approval` → `issued` → `partially_paid` → `paid`  
Also: `void`, `credited`  
Number reserved atomically at issue; issued snapshot immutable.

## Focus session

`running` ↔ `paused` → `finished` | `cancelled`

## Finance correlation link

`pending` → `draft_created` | `posted` | `skipped` | `failed`

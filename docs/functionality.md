**Overview**
The Group Lesson Planner is a single-page, in-browser tool for managing lesson groups, scheduling dates, calculating monthly totals, and generating payment messages. Data is stored locally in the browser and can be exported or imported via CSV for backup or transfer.

**Primary UI Areas**

- Top actions: `+ Add Group`, `Edit Template`, `Load CSV`, `Save CSV`, `Clear All Data`.
- Group list/cards showing the group name and total planned lessons.
- Group modal showing group info, monthly overrides, and schedule editing.
- Calendar editor with month navigation, weekday toggles, and a bulk price input.
- Review payment message modal for copy-ready text.

**Core Workflows**

- Add a group by opening the modal, entering name, price, currency, and saving.
- Edit group info by clicking the pencil icon, updating values, and saving.
- Edit schedule by selecting dates or weekday headers, then saving or canceling.
- Apply monthly overrides by changing per-lesson prices during schedule editing.
- Generate and copy payment messages from months with lessons.
- Export and import CSV snapshots for backup or transfer.
- Clear all data after confirmation.

**Behavior Notes**

- Empty state: when no groups exist, the list shows a prompt to add one.
- Confirmations and alerts: deleting a group and clearing all data require confirmation; exporting with no groups shows an alert; invalid CSV import shows an error alert.
- Disabled states: payment message copy is disabled for months with zero lessons; bulk price input is disabled when no dates are selected.
- Persistence: all data is stored in `localStorage` and a leave-page warning appears if groups exist.

import { GroupCard } from "./GroupCard";
import type { Group, Settings } from "./types";

/**
 * The grid of group cards, or the invitation to make the first one.
 *
 * The sort is a rendering step and never reaches storage: the stored array
 * stays in insertion order, which is why `data-group-index` carries the array
 * position rather than the position on screen. Several specs assert stored
 * order and screen order separately, and they differ on purpose.
 *
 * No list semantics here. `role="list"` would be the obvious addition and it is
 * deferred deliberately — see the batch page: it changes the frozen body
 * accessibility snapshot, and the grid is a set of headed regions rather than a
 * list of short items.
 */

const sortGroups = (groups: Group[]): { group: Group; index: number }[] =>
  groups
    .map((group, index) => ({ group, index }))
    .sort((a, b) =>
      a.group.name.localeCompare(b.group.name, undefined, {
        numeric: true,
        sensitivity: "base",
      }),
    );

type Props = {
  groups: Group[];
  settings: Settings;
  onOpen: (index: number) => void;
};

export const GroupList = ({ groups, settings, onOpen }: Props) => (
  <div id="groupList" className="group-list">
    {groups.length === 0 ? (
      <div className="empty-state">
        No groups yet. Click &apos;+ Add Group&apos; to get started!
      </div>
    ) : (
      sortGroups(groups).map(({ group, index }) => (
        <GroupCard
          // Keyed by position, not by name. A group's identity IS its array
          // position today, and keying by name would replace the whole card
          // whenever it is renamed — which loses focus mid-edit for anyone
          // using a keyboard. The card holds no state of its own, so reusing
          // the node across a rename is safe.
          key={index}
          group={group}
          index={index}
          settings={settings}
          onOpen={() => {
            onOpen(index);
          }}
        />
      ))
    )}
  </div>
);

# `components/athena/components/share-modal.tsx`

> The "Board Members" modal for an Athena/Flowboard board. It lists board members with infinite scroll and search, and lets non-member roles invite users, change member roles and remove members.

**Kind:** React component · **Lines:** 520

## Purpose
In the Athena board dashboard (`Dashbaord.tsx`), the share button opens this modal so the current user can manage who has access to the board. All data and mutations go through the zustand store `useMemberStore` (`store/athena/memberStore.ts`). That store talks to the external Flowboard members API on `uatapi.garage.app`, not to this repo's `/backend`. The modal itself is a hand-rolled fixed overlay. It uses the shared `AlertDialog` only for the delete confirmation.

## How it works
**Store wiring (L68-L80)**
It selects these values from `useMemberStore`:
- `members`, `availableUsers`, `isSearchingUsers`, `isLoading`, `isLoadingMore` and `pagination`
- the actions `searchUsers`, `fetchMembers`, `addMember`, `updateMember`, `deleteMember` and `loadMoreMembers`

**Loading members (L127-L160)**
- On mount, and whenever `boardId` changes, it calls `fetchMembers(boardId, 1, "")`. In the store this is `GET https://uatapi.garage.app/flowboard/v1/members?boardId=...&size=50&page=...` with the `auth-token` cookie.
- The member-search box is debounced by 500ms and refetches page 1 with the query.
- A callback ref on the last member row (`lastMemberElementRef`) uses an IntersectionObserver to call `loadMoreMembers(boardId, memberSearchQuery)`.
- On mount it also calls `searchUsers("")` to preload candidates for the invite box. The store fetches them from `https://uatapi.garage.app/api/users/taskroom?search=...`.

**Inviting (L162-L199, L263-L341)**
- The invite row is shown only when `role != "member"`, so admins and observers see it.
- Typing calls `searchUsers(query)` and opens a dropdown of `availableUsers`. A full-screen transparent overlay closes the dropdown on an outside click.
- Clicking a user calls `addMember(...)` with `{ boardId, orgId, role: inviteRole, memberUserId, email, name, image: "", boardSocketId, notificationSocketId, newBoardMember: true }`, plus a second "playload" object that holds a nested `userId` for the store's local insert. The store sends `POST .../flowboard/v1/members`.
- The role `<select>` offers Member and Observer. Admin appears only when the viewer is an admin and also the board creator (`userId === currentBoard.userId`).
- `boardSocketId` and `notificationSocketId` are hard-coded to `undefined`.

**Member list (L350-L495)**
- Each row shows an avatar (`member.user.avatar`, or the first letter of `member.userId.name`), the name with a "(you)" suffix for the current user, and "email • role".
- For non-member viewers, each row also has:
  - a role `<select>` that calls `updateMember(member._id, role)` (`PUT .../members/:id`); it is disabled for the board owner's row;
  - a trash button, hidden for the owner, that opens the delete confirmation.
- The heading badge shows `pagination.count`, or `members.length` if that is missing.
- Skeleton rows are shown during the initial load and during load-more.

**Deleting (L216-L235, L499-L515)**
- `confirmDelete` calls `deleteMember(member._id)` (`DELETE .../members/:id`) and then closes the `AlertDialog`.

**Copy link (L100-L126, L210-L214)**
- `handleCopy` (a textarea plus `execCommand("copy")`) and `handleCopyLink` (`navigator.clipboard`) both copy `https://flowboard-new-garage-app.vercel.app/flowboard/<boardId>`. Neither is wired to any button in the current JSX.

## Exports
- `ShareModal: React.FC<{ onClose, boardId, orgId, userId, role, currentBoard }>` - the modal. `role` is the viewer's board role. `currentBoard` is used to find the board owner (`currentBoard.userId`).

## Interfaces
- **External services (through `store/athena/memberStore.ts`):** `https://uatapi.garage.app/flowboard/v1/members` (list, add, update, delete) and `https://uatapi.garage.app/api/users/taskroom` (user search). These are not part of this repo.
- **Browser storage / cookies:** the store reads the `auth-token` cookie for these calls.

## Dependencies
- **Internal:** `store/athena/memberStore.ts` - member state and API actions; `components/ui/alert-dialog.tsx` - delete confirmation; `components/ui/skeleton.tsx` - loading rows; `components/ui/button.tsx` (imported, unused).
- **Packages:** `react`; `lucide-react` - icons.

## Used by
- `components/athena/components/Dashbaord.tsx`, which renders `<ShareModal>` when `isShareModalOpen` is true and `userData` is available. It passes `userData.organizationId`, `userData.id`, `memberData.role` and `currentBoard`.

## Notes
- **Permission check is inverted-looking:** management controls appear for every role except `"member"`, so observers see them too. The real enforcement must be on the server.
- The mapped list wraps each row in an unkeyed fragment (`<>...</>`). The `key={member.id}` sits on the inner `div`, which causes React key warnings.
- There are leftover `console.log` calls that print the members list (L88, L209).
- The share URL is hard-coded to a Vercel preview domain (`flowboard-new-garage-app.vercel.app`).
- Many imported icons (`Link`, `Copy`, `Sparkles`, `Globe`, `User`, `Shield`, `Check`, `Share2`) and the `ShareLinkProps` interface are unused.

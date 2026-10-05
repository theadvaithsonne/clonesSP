# `app/(dashboard)/auction/components/StartAuctionDialog.tsx`

> Three-step modal for creating a new global auction or editing an existing one: choose the product, set the terms, review and submit.

**Kind:** Next.js app-directory module (colocated) · **Lines:** 391

## Purpose
The Auction page uses this dialog both for "+ Start Auction" and for the Edit button on a card. It collects the product details, which come either from one of the user's Garage store products or from manual entry with uploaded images. It then collects the duration and minimum price, shows a summary, and finally calls the create or update auction endpoint. The saved auction goes back to the parent through `onSuccess`.

## How it works
### State
- `step`: 1, 2 or 3;
- `form`: a `FormState` object holding `productSource`, `productId`, `productName`, `productImages`, `productDescription`, `productVideoUrl`, `minPrice` (kept as a string), `currency` and `durationHours`;
- `garageProducts` and `loadingProducts`;
- `uploadingImages`, `submitting` and `error`;
- a hidden file input reached through `fileInputRef`.

`DEFAULT_FORM` starts with source `garage`, currency `USD` and a duration of 6 hours.

### Effects
- **Reset or prefill** (runs when `editAuction` or `open` changes). With an `editAuction`, the form is filled from it: `minPrice` becomes a string and `durationHours` is narrowed to 1, 6, 24 or 48. Without one, the form goes back to `DEFAULT_FORM`. Either way the dialog returns to step 1 and the error is cleared.
- **Load Garage products.** When the dialog is open, the source is `garage` and the product list is still empty, it calls `getAuctionMyProducts()` (`GET /backend/auctions/my-products`). If that fails, the list is set to empty. The backend returns up to 200 `active` `Product` documents across every organisation the user belongs to (from `user.organizations[]` plus the older single `user.organization` field), newest first, selecting only `_id name images organizationId`.

### Helpers
- `set(key, value)`: updates one field and clears the error.
- `handleGarageProductSelect(id)`: copies `productId`, `name` and `images` from the chosen product into the form.
- `handleImageUpload(files)`: uploads every selected file in parallel with `uploadFile()` (from `lib/coverfi/uploadFile.ts`, which sends `POST /backend/upload` with the bearer token) and appends the returned URLs to `productImages`. If any upload fails, it shows "Image upload failed. Please try again."

### Steps
1. **Product.** A radio group picks "From Garage" or "From Outside".
   - **Garage:** a `Select` of products, with a disabled "No active products" item when the list is empty, plus an image preview.
   - **Outside:** Title*, Description, an Images* upload button with thumbnails, and an optional Video URL.
   - `validateStep1` requires a `productId` for Garage, or a title and at least one image for Outside.
2. **Terms.** Duration buttons for 1, 6, 24 or 48 hours, a minimum price input, and a currency `Select` (USD or INR). `validateStep2` requires a number of 0 or more.
3. **Review.** A summary card (first image, name, description, duration, minimum bid). The submit button reads "Start Auction", or "Save Changes" in edit mode.

### Submit (`handleSubmit`)
- Builds a `CreateAuctionPayload`. `productId` is included only for the `garage` source, and empty optional strings are sent as `undefined`. The parent's `creatorName` and `creatorAvatar` are added.
- Calls `updateAuction(editAuction._id, payload)` (`PUT /backend/auctions/:id`) in edit mode, or `createAuction(payload)` (`POST /backend/auctions`) otherwise, then calls `onSuccess(result)` and `onClose()`.
- On failure, shows the error message inline.

The backend checks the same rules again:
- `productSource` must be `garage` or `outside`;
- the duration must be 1, 6, 24 or 48 hours;
- `minPrice` must be 0 or more;
- for the `garage` source, `productId` must be a valid ObjectId (required on create).

It also sets `endTime = startTime + durationHours`, and on edit recalculates it from the original start time. It fills in `creatorOrgName` from the caller's current org (falling back to "Unknown Org"), and broadcasts `auction:new` or `auction:update`. Only the creator can edit, and only while the auction is `ongoing`.

## Exports
- `default StartAuctionDialog(props)`: the props are:
  - `open`, `onClose()`;
  - `onSuccess(auction: IAuction)`;
  - `editAuction?: IAuction | null`: when set, the dialog is in edit mode;
  - `creatorName: string`;
  - `creatorAvatar?: string`.

## Interfaces
- **Backend endpoints called:**
  - `GET /backend/auctions/my-products`: the user's active store products;
  - `POST /backend/upload`: image uploads;
  - `POST /backend/auctions`: create;
  - `PUT /backend/auctions/:id`: edit.
- **Database (via backend):** `Auction` (model "Auction"): written. `Product`, `User` and `Organization`: read.

## Dependencies
- **Internal:**
  - `lib/auction-api.ts`: `createAuction`, `updateAuction`, `getAuctionMyProducts` and the types;
  - `lib/coverfi/uploadFile.ts`: the file upload helper;
  - `components/ui/dialog`, `button`, `input`, `label`, `textarea`, `select` and `radio-group`.
- **Packages:** `react` (`useState`, `useEffect`, `useRef`).

## Used by
- `app/(dashboard)/auction/page.tsx`

## Notes
- The Garage product list is fetched only while it is empty. A user with no products triggers a new fetch each time the dialog opens or the source changes back to `garage`.
- Uploaded images can only be added, never removed. Switching the source does not clear images or the title already in the form, so values from one source can carry over to the other.
- The backend allows a price of 0, and so does this form.

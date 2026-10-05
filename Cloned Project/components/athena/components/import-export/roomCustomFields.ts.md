# `components/athena/components/import-export/roomCustomFields.ts`

> Types and small helpers that let a Taskroom room's custom fields be offered as import targets, using `cf:<fieldId>` mapping keys and type-aware value parsing.

**Kind:** utility module (TypeScript, no JSX) · **Lines:** 89

## Purpose
A room in Athena / Taskroom can define custom fields, such as a number, a date or a dropdown. During a spreadsheet import, these fields appear in the mapping UI alongside the standard task fields. This module defines the shapes involved, the `cf:` prefix that keeps custom-field keys separate from standard ones in a `ColumnMapping`, and how raw cell text becomes a value Taskroom accepts.

## How it works
- **Mapping keys.** A custom field's key in the mapping is `CUSTOM_FIELD_KEY_PREFIX` (`"cf:"`) plus the field `_id`.
  - `customFieldMappingKey` builds the key;
  - `isCustomFieldMappingKey` detects one;
  - `customFieldIdFromMappingKey` strips the prefix.
- **Type normalisation.** `normalizeCustomFieldType` maps backend type names onto the `CustomFieldType` set:
  - `select` becomes `dropdown`, and `multiselect` becomes `labels`;
  - `textarea`, `number` and `date` keep their names;
  - anything else becomes `text`.
- **Value parsing.** `parseCustomFieldValue(type, raw)`:
  - returns `null` for an empty string;
  - for `number`, returns a finite number or `null`;
  - for every other type, returns the raw string. Dates and dropdown values are not converted.
- **UI and lookup helpers.**
  - `mapRoomCustomFieldsToMappable` turns room field definitions into `MappableField` entries (`isCustomField: true` plus the normalised `fieldType`) for the mapping step.
  - `customFieldTypeById` builds a `Map<fieldId, CustomFieldType>` that `applyColumnMapping` uses.

## Exports
- `CustomFieldType` - `"number" | "text" | "date" | "dropdown" | "textarea" | "labels"`.
- `RoomCustomFieldDef` - `{ _id, name, type, options? }`, as returned in the room's `customFields` array. Each option is a string or `{ label?, name?, value?, color? }`.
- `MappableField` - `{ key, label, required?, isCustomField?, fieldType? }`, one row of the mapping UI.
- `CUSTOM_FIELD_KEY_PREFIX` - `"cf:"`.
- `customFieldMappingKey(fieldId: string): string`
- `isCustomFieldMappingKey(key: string): boolean`
- `customFieldIdFromMappingKey(key: string): string`
- `normalizeCustomFieldType(type: string): CustomFieldType`
- `parseCustomFieldValue(type: CustomFieldType, raw: string): string | number | null`
- `mapRoomCustomFieldsToMappable(fields?: RoomCustomFieldDef[]): MappableField[]`
- `customFieldTypeById(fields?: RoomCustomFieldDef[]): Map<string, CustomFieldType>`

## Dependencies
- **Internal:** none.
- **Packages:** none.

## Used by
- `components/athena/components/import-export/ImportExportDashboard.tsx` - builds the mapping-field list and reads `cf:` keys.
- `components/athena/components/import-export/importExportApi.ts` - the `RoomCustomFieldDef` type for `fetchRoomCustomFields`.
- `components/athena/components/import-export/parseSpreadsheet.ts` - auto-mapping and value conversion.

## Notes
- Dropdown and label values are not checked against the field's `options`, so whatever text is in the cell is sent to Taskroom.

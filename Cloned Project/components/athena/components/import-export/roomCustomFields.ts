export type CustomFieldType =
  | "number"
  | "text"
  | "date"
  | "dropdown"
  | "textarea"
  | "labels";

export type RoomCustomFieldDef = {
  _id: string;
  name: string;
  type: string;
  options?: Array<string | { label?: string; name?: string; value?: string; color?: string }>;
};

export type MappableField = {
  key: string;
  label: string;
  required?: boolean;
  isCustomField?: boolean;
  fieldType?: CustomFieldType;
};

export const CUSTOM_FIELD_KEY_PREFIX = "cf:";

export function customFieldMappingKey(fieldId: string): string {
  return `${CUSTOM_FIELD_KEY_PREFIX}${fieldId}`;
}

export function isCustomFieldMappingKey(key: string): boolean {
  return key.startsWith(CUSTOM_FIELD_KEY_PREFIX);
}

export function customFieldIdFromMappingKey(key: string): string {
  return key.slice(CUSTOM_FIELD_KEY_PREFIX.length);
}

export function normalizeCustomFieldType(type: string): CustomFieldType {
  switch (type) {
    case "dropdown":
    case "select":
      return "dropdown";
    case "labels":
    case "multiselect":
      return "labels";
    case "textarea":
      return "textarea";
    case "number":
      return "number";
    case "date":
      return "date";
    default:
      return "text";
  }
}

export function parseCustomFieldValue(
  type: CustomFieldType,
  raw: string
): string | number | null {
  if (raw === "") return null;
  if (type === "number") {
    return Number.isFinite(Number(raw)) ? Number(raw) : null;
  }
  return raw;
}

export function mapRoomCustomFieldsToMappable(
  fields?: RoomCustomFieldDef[]
): MappableField[] {
  if (!fields?.length) return [];
  return fields.map((field) => ({
    key: customFieldMappingKey(field._id),
    label: field.name,
    isCustomField: true,
    fieldType: normalizeCustomFieldType(field.type),
  }));
}

export function customFieldTypeById(
  fields?: RoomCustomFieldDef[]
): Map<string, CustomFieldType> {
  const map = new Map<string, CustomFieldType>();
  (fields ?? []).forEach((field) => {
    map.set(field._id, normalizeCustomFieldType(field.type));
  });
  return map;
}

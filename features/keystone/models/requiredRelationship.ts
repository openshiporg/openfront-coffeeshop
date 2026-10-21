import { relationship } from "@keystone-6/core/fields";

/** Keeps Keystone's relationship API while making an owned to-one relation non-null in Prisma. */
type RelationshipAccess = Parameters<typeof relationship>[0]["access"];

export function requiredRelationship(ref: string, fieldName: string, targetModel: string, access?: RelationshipAccess) {
  const escapedField = fieldName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const escapedModel = targetModel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return relationship({
    ref,
    ...(access ? { access } : {}),
    db: {
      extendPrismaSchema(field) {
        return field
          .replace(new RegExp(`(\\b${escapedField}\\s+${escapedModel})\\?`), "$1")
          .replace(new RegExp(`(\\b${escapedField}Id\\s+String)\\?`), "$1");
      },
    },
  });
}

export function requiredStoreRelationship(ref: string, access?: RelationshipAccess) {
  return requiredRelationship(ref, "store", "StoreSetting", access);
}

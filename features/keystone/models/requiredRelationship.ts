import { relationship } from "@keystone-6/core/fields";

/** Keeps Keystone's relationship API while making an owned to-one relation non-null in Prisma. */
type RelationshipAccess = Parameters<typeof relationship>[0]["access"];

type RelationshipHooks = Parameters<typeof relationship>[0]["hooks"];

export function requiredRelationship(ref: string, fieldName: string, targetModel: string, access?: RelationshipAccess, hooks?: RelationshipHooks) {
  const escapedField = fieldName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const escapedModel = targetModel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return relationship({
    ref,
    ...(access ? { access } : {}),
    ...(hooks ? { hooks } : {}),
    db: {
      extendPrismaSchema(field) {
        return field
          .replace(new RegExp(`(\\b${escapedField}\\s+${escapedModel})\\?`), "$1")
          .replace(new RegExp(`(\\b${escapedField}Id\\s+String)\\?`), "$1");
      },
    },
  });
}

/** The single-store owner relation. A create that names no store is connected to the primary store,
 *  so staff without Store Settings access can still create records the store owns. */
export function requiredStoreRelationship(ref: string, access?: RelationshipAccess) {
  return requiredRelationship(ref, "store", "StoreSetting", access, {
    resolveInput: async ({ operation, resolvedData, fieldKey, context }) => {
      const value = resolvedData[fieldKey];
      if (operation !== "create" || (value !== undefined && value !== null)) return value;
      const store = await context.sudo().prisma.storeSetting.findUnique({ where: { singletonKey: "primary" }, select: { id: true } });
      if (!store) throw new Error("Primary store is required before creating store records");
      return { connect: { id: store.id } };
    },
  });
}

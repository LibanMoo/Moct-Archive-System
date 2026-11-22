import { defineContract, now } from "@prisma/orm-postgres/contract-builder";
import { enumType, member } from "@prisma/orm-postgres/contract-builder";

// Values must match what the frontend sends/displays.
const Direction = enumType(
  "Direction",
  { codecId: "pg/text@1" } as const,
  member("IN", "IN"),
  member("OUT", "OUT"),
  member("INT", "INT"), // internal: between ministry departments
);

const Status = enumType(
  "Status",
  { codecId: "pg/text@1" } as const,
  member("Pending", "Pending"),
  member("Processing", "Processing"),
  member("Completed", "Completed"),
);

export const contract = defineContract(
  {},
  ({ field, model, rel, gen, type }) => {
    const User = model("User", {
      fields: {
        id: field.column(type.Uuid()).id().onCreate(gen.uuid(7)),
        name: field.column(type.String()).optional(),
        email: field.column(type.String()).unique(),
        password: field.column(type.String()),
        role: field.column(type.String()),
        // FK -> Department.id
        department: field.column(type.Uuid()).optional(),
        active: field.column(type.Boolean()).default(true),
        createdAt: field
          .column(type.DateTime())
          .default(now())
          .onCreate(gen.now()),
        updatedAt: field.column(type.temporal.UpdatedAt()),
      },
    });

    const Department = model("Department", {
      fields: {
        id: field.column(type.Uuid()).id().onCreate(gen.uuid(7)),
        name: field.column(type.String()).unique(),
        createdAt: field
          .column(type.DateTime())
          .default(now())
          .onCreate(gen.now()),
        updatedAt: field.column(type.temporal.UpdatedAt()),
        CreatedBy: field.column(type.Uuid()).optional(),
        UpdatedBy: field.column(type.Uuid()).optional(),
      },
    });

    // Registered senders / recipients (organisations or people).
    // One table for both: the same body can send and receive documents.
    const Correspondent = model("Correspondent", {
      fields: {
        id: field.column(type.Uuid()).id().onCreate(gen.uuid(7)),
        name: field.column(type.String()).unique(),
        phone: field.column(type.String()).optional(),
        email: field.column(type.String()).optional(),
        address: field.column(type.String()).optional(),
        active: field.column(type.Boolean()).default(true),
        createdAt: field
          .column(type.DateTime())
          .default(now())
          .onCreate(gen.now()),
        updatedAt: field.column(type.temporal.UpdatedAt()),
        createdById: field.column(type.Uuid()).optional(),
      },
    });

    const Document = model("Document", {
      fields: {
        id: field.column(type.Uuid()).id().onCreate(gen.uuid(7)),
        referenceNumber: field.column(type.String()).unique(),
        direction: field.namedType(Direction),
        subject: field.column(type.String()),
        description: field.column(type.String()).optional(),
        // Name snapshots, kept for search/reports and if a correspondent is removed.
        sender: field.column(type.String()).optional(),
        recipient: field.column(type.String()).optional(),
        senderId: field.column(type.Uuid()).optional(),
        recipientId: field.column(type.Uuid()).optional(),
        // Name snapshot of departmentId (older records may only have this text).
        department: field.column(type.String()).optional(),
        departmentId: field.column(type.Uuid()).optional(),
        // Internal (INT) documents: sending and receiving department.
        fromDepartmentId: field.column(type.Uuid()).optional(),
        toDepartmentId: field.column(type.Uuid()).optional(),
        documentDate: field.column(type.DateTime()).default(now()),
        status: field.namedType(Status).default("Pending"),
        isArchived: field.column(type.Boolean()).default(false),
        archivedAt: field.column(type.DateTime()).optional(),
        originalFileName: field.column(type.String()).optional(),
        storedFileName: field.column(type.String()).optional(),
        mimeType: field.column(type.String()).optional(),
        fileSize: field.column(type.Int()).default(0),
        createdAt: field
          .column(type.DateTime())
          .default(now())
          .onCreate(gen.now()),
        updatedAt: field.column(type.temporal.UpdatedAt()),
        createdById: field.column(type.Uuid()).optional(),
        updatedById: field.column(type.Uuid()).optional(),
        archivedById: field.column(type.Uuid()).optional(),
      },
    });

    const AuditLog = model("AuditLog", {
      fields: {
        id: field.column(type.Uuid()).id().onCreate(gen.uuid(7)),
        action: field.column(type.String()),
        userId: field.column(type.Uuid()).optional(),
        documentId: field.column(type.Uuid()).optional(),
        details: field.column(type.String()).optional(),
        ipAddress: field.column(type.String()).optional(),
        timestamp: field
          .column(type.DateTime())
          .default(now())
          .onCreate(gen.now()),
      },
    });

    // Deleting a user/document must not fail because of history rows,
    // so references are cleared instead of blocking the delete.
    const setNull = { fk: { onDelete: "setNull" } } as const;

    return {
      models: {
        User: User.relations({
          departmentInfo: rel
            .belongsTo(Department, { from: "department", to: "id" })
            .sql(setNull),
        }),
        Department: Department.relations({
          users: rel.hasMany(User, { by: "department" }),
          documents: rel.hasMany(Document, { by: "departmentId" }),
          sentInternal: rel.hasMany(Document, { by: "fromDepartmentId" }),
          receivedInternal: rel.hasMany(Document, { by: "toDepartmentId" }),
        }),
        Document: Document.relations({
          createdBy: rel
            .belongsTo(User, { from: "createdById", to: "id" })
            .sql(setNull),
          updatedBy: rel
            .belongsTo(User, { from: "updatedById", to: "id" })
            .sql(setNull),
          archivedBy: rel
            .belongsTo(User, { from: "archivedById", to: "id" })
            .sql(setNull),
          senderCorrespondent: rel
            .belongsTo(Correspondent, { from: "senderId", to: "id" })
            .sql(setNull),
          recipientCorrespondent: rel
            .belongsTo(Correspondent, { from: "recipientId", to: "id" })
            .sql(setNull),
          departmentInfo: rel
            .belongsTo(Department, { from: "departmentId", to: "id" })
            .sql(setNull),
          fromDepartment: rel
            .belongsTo(Department, { from: "fromDepartmentId", to: "id" })
            .sql(setNull),
          toDepartment: rel
            .belongsTo(Department, { from: "toDepartmentId", to: "id" })
            .sql(setNull),
        }),
        Correspondent: Correspondent.relations({
          sentDocuments: rel.hasMany(Document, { by: "senderId" }),
          receivedDocuments: rel.hasMany(Document, { by: "recipientId" }),
          createdBy: rel
            .belongsTo(User, { from: "createdById", to: "id" })
            .sql(setNull),
        }),
        AuditLog: AuditLog.relations({
          user: rel
            .belongsTo(User, { from: "userId", to: "id" })
            .sql(setNull),
          document: rel
            .belongsTo(Document, { from: "documentId", to: "id" })
            .sql(setNull),
        }),
      },
      enums: {
        Direction,
        Status,
      },
    };
  },
);

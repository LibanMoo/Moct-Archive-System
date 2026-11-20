import { defineContract, now } from '@prisma/orm-postgres/contract-builder';

export const contract = defineContract({}, ({ field, model, rel, gen, type }) => {
  const User = model('User', {
    fields: {
      id: field.column(type.Uuid()).id().onCreate(gen.uuid(7)),
      name: field.column(type.String()).optional(),
      email: field.column(type.String()).unique(),
      password: field.column(type.String()),
      role: field.column(type.String()),
      department: field.column(type.String()),
      createdAt: field.column(type.DateTime()).default(now()).onCreate(gen.now()),
      updatedAt: field.column(type.temporal.UpdatedAt()),
    },
  });
  const Department = model('Department', {
    fields: {
      id: field.column(type.Uuid()).id().onCreate(gen.uuid(7)),
      name: field.column(type.String()).unique(),
      createdAt: field.column(type.DateTime()).default(now()).onCreate(gen.now()),
      updatedAt: field.column(type.temporal.UpdatedAt()),
      CreatedBy: field.column(type.Uuid()).optional(),
      UpdatedBy: field.column(type.Uuid()).optional(),
    }
  }
 
);

  return {
    models: {
      User: User.relations({
        department: rel.belongsTo(Department, { from: 'department', to: 'id' }),
      }),
      Department: Department.relations({
        users: rel.hasMany(User, { by: 'department' }),
      }),
    },
  };
});

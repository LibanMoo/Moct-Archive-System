#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/0a2f6a20f972de3ce5d984f91ad8cae6dfac7b64311ce8f88cf30f871d0adaf3/contract';
import startContract from '../../snapshots/0a2f6a20f972de3ce5d984f91ad8cae6dfac7b64311ce8f88cf30f871d0adaf3/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/5e916cb8ea5eb51d084a26f1267ff2d6769cc9161a1fa272fe52da84ed31f4aa/contract';
import endContract from '../../snapshots/5e916cb8ea5eb51d084a26f1267ff2d6769cc9161a1fa272fe52da84ed31f4aa/contract.json' with { type: 'json' };
import {
  Migration,
  MigrationCLI,
  checkExpression,
  col,
  fn,
  lit,
  primaryKey,
  sql,
} from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createTable({
        schema: 'public',
        table: 'AuditLog',
        columns: [
          col('action', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('ipAddress', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('timestamp', 'timestamptz(3)', {
            notNull: true,
            default: fn(sql`now()`),
            codecRef: { codecId: 'pg/timestamptz-date@1', typeParams: { precision: 3 } },
          }),
          col('userId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'Document',
        columns: [
          col('CreatedBy', 'uuid', { codecRef: { codecId: 'pg/uuid@1' } }),
          col('UpdatedBy', 'uuid', { codecRef: { codecId: 'pg/uuid@1' } }),
          col('createdAt', 'timestamptz(3)', {
            notNull: true,
            default: fn(sql`now()`),
            codecRef: { codecId: 'pg/timestamptz-date@1', typeParams: { precision: 3 } },
          }),
          col('description', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('direction', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('fileSize', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('isArchived', 'bool', {
            notNull: true,
            default: lit(false),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('mimeType', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('originalFileName', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('receipient', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('referenceNumber', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('sender', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('status', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('storedFileName', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('subject', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('updatedAt', 'timestamptz(3)', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-date@1', typeParams: { precision: 3 } },
          }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'Document_direction_check_0c542325',
            sql`"direction" IN ('INC', 'OUT', 'INT')`,
          ),
          checkExpression(
            'Document_status_check_19a2b525',
            sql`"status" IN ('pending', 'approved', 'rejected')`,
          ),
        ],
      }),
      this.addUnique({
        schema: 'public',
        table: 'Document',
        constraint: 'Document_referenceNumber_key',
        columns: ['referenceNumber'],
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);

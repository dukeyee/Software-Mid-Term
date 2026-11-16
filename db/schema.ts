import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  username: text('username').notNull().unique(),
  name: text('name').notNull(),
  role: text('role', { enum: ['author', 'editor'] }).notNull(),
  passwordHash: text('password_hash').notNull(),
  salt: text('salt').notNull(),
  iterations: integer('iterations').notNull(),
  createdAt: text('created_at').notNull(),
});
export const sessions = sqliteTable('sessions', {
  tokenHash: text('token_hash').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  expiresAt: integer('expires_at').notNull(),
}, table => [index('sessions_expiry_idx').on(table.expiresAt)]);
export const manuscripts = sqliteTable('manuscripts', {
  id: text('id').primaryKey(),
  authorId: text('author_id').notNull().references(() => users.id),
  category: text('category').notNull(),
  title: text('title').notNull(),
  content: text('content').notNull(),
  status: text('status', { enum: ['draft', 'review', 'approved'] }).notNull(),
  version: integer('version').notNull().default(1),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
}, table => [index('manuscripts_author_idx').on(table.authorId), index('manuscripts_status_idx').on(table.status)]);
export const reviews = sqliteTable('reviews', {
  id: text('id').primaryKey(),
  manuscriptId: text('manuscript_id').notNull().references(() => manuscripts.id, { onDelete: 'cascade' }),
  editorId: text('editor_id').notNull().references(() => users.id),
  action: text('action', { enum: ['return', 'approve'] }).notNull(),
  reason: text('reason'),
  manuscriptVersion: integer('manuscript_version').notNull(),
  createdAt: text('created_at').notNull(),
}, table => [index('reviews_manuscript_idx').on(table.manuscriptId)]);
export const loginAttempts = sqliteTable('login_attempts', {
  key: text('key').primaryKey(),
  attempts: integer('attempts').notNull(),
  windowStart: integer('window_start').notNull(),
});

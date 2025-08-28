import { sql } from 'drizzle-orm';
import {
  index,
  jsonb,
  pgTable,
  timestamp,
  varchar,
  decimal,
  integer,
  boolean,
  text,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User storage table
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique().notNull(),
  passwordHash: varchar("password_hash").notNull(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  failedLoginAttempts: integer("failed_login_attempts").default(0),
  lockedUntil: timestamp("locked_until"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Debt accounts table
export const debtAccounts = pgTable("debt_accounts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  plaidAccountId: varchar("plaid_account_id"),
  institutionName: varchar("institution_name").notNull(),
  accountNickname: varchar("account_nickname").notNull(),
  accountType: varchar("account_type").notNull(), // credit_card, auto_loan, student_loan, mortgage, personal_loan, heloc
  currentBalance: decimal("current_balance", { precision: 12, scale: 2 }).notNull(),
  interestRate: decimal("interest_rate", { precision: 5, scale: 2 }).notNull(),
  minimumPayment: decimal("minimum_payment", { precision: 10, scale: 2 }),
  dueDate: integer("due_date"), // Day of month (1-31)
  creditLimit: decimal("credit_limit", { precision: 12, scale: 2 }), // For credit cards
  isHidden: boolean("is_hidden").default(false),
  isManual: boolean("is_manual").default(false), // Manually added vs Plaid
  lastSynced: timestamp("last_synced"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Plaid connections table
export const plaidConnections = pgTable("plaid_connections", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  accessToken: text("access_token").notNull(), // This will be encrypted
  institutionId: varchar("institution_id").notNull(),
  institutionName: varchar("institution_name").notNull(),
  isActive: boolean("is_active").default(true),
  lastSynced: timestamp("last_synced"),
  createdAt: timestamp("created_at").defaultNow(),
});

export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;

export const insertDebtAccountSchema = createInsertSchema(debtAccounts).omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
});

export const updateDebtAccountSchema = insertDebtAccountSchema.partial();

export const insertPlaidConnectionSchema = createInsertSchema(plaidConnections).omit({
  id: true,
  userId: true,
  createdAt: true,
});

export type InsertDebtAccount = z.infer<typeof insertDebtAccountSchema>;
export type UpdateDebtAccount = z.infer<typeof updateDebtAccountSchema>;
export type DebtAccount = typeof debtAccounts.$inferSelect;
export type PlaidConnection = typeof plaidConnections.$inferSelect;
export type InsertPlaidConnection = z.infer<typeof insertPlaidConnectionSchema>;

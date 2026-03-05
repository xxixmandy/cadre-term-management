import { pgTable, serial, timestamp, varchar, text, integer, boolean, date, index } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"
import { createSchemaFactory } from "drizzle-zod"
import { z } from "zod"

export const healthCheck = pgTable("health_check", {
	id: serial().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
});

// 全局配置表
export const settings = pgTable(
  "settings",
  {
    id: serial().notNull().primaryKey(),
    key: varchar("key", { length: 100 }).notNull().unique(),
    value: text("value"),
    description: varchar("description", { length: 255 }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
  },
  (table) => [
    index("settings_key_idx").on(table.key),
  ]
);

// 干部任期管理表 - 放宽必填限制，只有姓名必填
export const cadres = pgTable(
  "cadres",
  {
    id: serial().notNull().primaryKey(),
    name: varchar("name", { length: 50 }).notNull(), // 唯一必填
    gender: varchar("gender", { length: 10 }),
    birthDate: date("birth_date"),
    department: varchar("department", { length: 100 }),
    position: varchar("position", { length: 100 }),
    termStartDate: date("term_start_date"),
    termDuration: integer("term_duration"), // 任期时长（月数）
    termEndDate: date("term_end_date"), // 任期结束日期（用于排序计算）
    termEndDateOriginal: text("term_end_date_original"), // 任期结束时间原始完整描述
    retirementDate: date("retirement_date"), // 退休日期
    status: varchar("status", { length: 20 }).default("在任").notNull(), // 在任/即将到期/已到期
    remarks: text("remarks"), // 备注
    isTemporary: boolean("is_temporary").default(false), // 是否为暂定时间
    createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
  },
  (table) => [
    // 索引：用于排序和搜索
    index("cadres_name_idx").on(table.name),
    index("cadres_department_idx").on(table.department),
    index("cadres_status_idx").on(table.status),
    index("cadres_term_end_date_idx").on(table.termEndDate),
  ]
);

// 使用 createSchemaFactory 配置 date coercion
const { createInsertSchema: createCoercedInsertSchema } = createSchemaFactory({
  coerce: { date: true },
});

// Zod schemas for validation - 只要求name必填
export const insertCadreSchema = createCoercedInsertSchema(cadres).pick({
  name: true,
  gender: true,
  birthDate: true,
  department: true,
  position: true,
  termStartDate: true,
  termDuration: true,
  termEndDate: true,
  termEndDateOriginal: true,
  remarks: true,
  isTemporary: true,
});

export const updateCadreSchema = createCoercedInsertSchema(cadres)
  .pick({
    name: true,
    gender: true,
    birthDate: true,
    department: true,
    position: true,
    termStartDate: true,
    termDuration: true,
    termEndDate: true,
    termEndDateOriginal: true,
    remarks: true,
    isTemporary: true,
  })
  .partial();

// Settings schemas
export const insertSettingSchema = createCoercedInsertSchema(settings).pick({
  key: true,
  value: true,
  description: true,
});

export const updateSettingSchema = createCoercedInsertSchema(settings)
  .pick({
    value: true,
    description: true,
  })
  .partial();

// TypeScript types
export type Cadre = typeof cadres.$inferSelect;
export type InsertCadre = z.infer<typeof insertCadreSchema>;
export type UpdateCadre = z.infer<typeof updateCadreSchema>;
export type Setting = typeof settings.$inferSelect;
export type InsertSetting = z.infer<typeof insertSettingSchema>;
export type UpdateSetting = z.infer<typeof updateSettingSchema>;

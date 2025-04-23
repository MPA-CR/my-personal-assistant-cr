import { pgTable, text, serial, integer, boolean, timestamp, json, real, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Users table (clients and assistants)
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  email: text("email").notNull().unique(),
  fullName: text("full_name").notNull(),
  phoneNumber: text("phone_number"),
  profileImage: text("profile_image"),
  role: text("role").notNull().default("client"), // 'client', 'assistant', 'admin'
  languages: text("languages").array(),
  bio: text("bio"),
  isVerified: boolean("is_verified").default(false),
  avgRating: real("avg_rating"),
  location: json("location"), // {lat, lng}
  createdAt: timestamp("created_at").defaultNow(),
  lastActive: timestamp("last_active"),
});

// Service categories table
export const serviceCategories = pgTable("service_categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  icon: text("icon").notNull(),
  description: text("description"),
});

// Services offered by assistants
export const services = pgTable("services", {
  id: serial("id").primaryKey(),
  assistantId: integer("assistant_id").notNull().references(() => users.id),
  categoryId: integer("category_id").notNull().references(() => serviceCategories.id),
  pricePerHour: real("price_per_hour").notNull(),
  description: text("description"),
});

// Bookings table
export const bookings = pgTable("bookings", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").notNull().references(() => users.id),
  assistantId: integer("assistant_id").notNull().references(() => users.id),
  serviceId: integer("service_id").notNull().references(() => services.id),
  startTime: timestamp("start_time").notNull(),
  endTime: timestamp("end_time").notNull(),
  location: json("location").notNull(), // {lat, lng, address}
  status: text("status").notNull().default("pending"), // 'pending', 'confirmed', 'completed', 'cancelled'
  totalAmount: real("total_amount").notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Reviews table
export const reviews = pgTable("reviews", {
  id: serial("id").primaryKey(),
  bookingId: integer("booking_id").notNull().references(() => bookings.id),
  clientId: integer("client_id").notNull().references(() => users.id),
  assistantId: integer("assistant_id").notNull().references(() => users.id),
  rating: integer("rating").notNull(),
  comment: text("comment"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Messages table
export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  senderId: integer("sender_id").notNull().references(() => users.id),
  receiverId: integer("receiver_id").notNull().references(() => users.id),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  isRead: boolean("is_read").default(false),
});

// Insert schemas
export const insertUserSchema = createInsertSchema(users)
  .omit({ id: true, avgRating: true, createdAt: true, lastActive: true });
export const insertServiceCategorySchema = createInsertSchema(serviceCategories).omit({ id: true });
export const insertServiceSchema = createInsertSchema(services).omit({ id: true });
export const insertBookingSchema = createInsertSchema(bookings).omit({ id: true, createdAt: true });
export const insertReviewSchema = createInsertSchema(reviews).omit({ id: true, createdAt: true });
export const insertMessageSchema = createInsertSchema(messages).omit({ id: true, createdAt: true });

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type ServiceCategory = typeof serviceCategories.$inferSelect;
export type InsertServiceCategory = z.infer<typeof insertServiceCategorySchema>;

export type Service = typeof services.$inferSelect;
export type InsertService = z.infer<typeof insertServiceSchema>;

export type Booking = typeof bookings.$inferSelect;
export type InsertBooking = z.infer<typeof insertBookingSchema>;

export type Review = typeof reviews.$inferSelect;
export type InsertReview = z.infer<typeof insertReviewSchema>;

export type Message = typeof messages.$inferSelect;
export type InsertMessage = z.infer<typeof insertMessageSchema>;

// Additional schemas for app logic
export const loginSchema = z.object({
  username: z.string().min(3),
  password: z.string().min(6),
});

export type LoginCredentials = z.infer<typeof loginSchema>;

// Location type
export type Location = {
  lat: number;
  lng: number;
  address?: string;
};

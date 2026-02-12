import { z } from "zod";

// Auth validations
export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .email({ message: "Invalid email address" })
    .max(255, { message: "Email must be less than 255 characters" }),
  password: z
    .string()
    .min(8, { message: "Password must be at least 8 characters" })
    .max(128, { message: "Password must be less than 128 characters" }),
});

export const signupSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, { message: "Name is required" })
    .max(100, { message: "Name must be less than 100 characters" }),
  email: z
    .string()
    .trim()
    .email({ message: "Invalid email address" })
    .max(255, { message: "Email must be less than 255 characters" }),
  password: z
    .string()
    .min(8, { message: "Password must be at least 8 characters" })
    .max(128, { message: "Password must be less than 128 characters" }),
});

// Profile validations
export const profileSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, { message: "Name is required" })
    .max(100, { message: "Name must be less than 100 characters" }),
  bio: z.string().max(1000, { message: "Bio must be less than 1000 characters" }).nullable(),
  linkedin_url: z
    .string()
    .url({ message: "Invalid LinkedIn URL" })
    .max(500, { message: "URL must be less than 500 characters" })
    .nullable()
    .or(z.literal("")),
  x_url: z
    .string()
    .url({ message: "Invalid X/Twitter URL" })
    .max(500, { message: "URL must be less than 500 characters" })
    .nullable()
    .or(z.literal("")),
  bluesky_url: z
    .string()
    .url({ message: "Invalid Bluesky URL" })
    .max(500, { message: "URL must be less than 500 characters" })
    .nullable()
    .or(z.literal("")),
});

export const emailChangeSchema = z.object({
  email: z
    .string()
    .trim()
    .email({ message: "Invalid email address" })
    .max(255, { message: "Email must be less than 255 characters" }),
});

export const passwordChangeSchema = z
  .object({
    newPassword: z
      .string()
      .min(8, { message: "Password must be at least 8 characters" })
      .max(128, { message: "Password must be less than 128 characters" }),
    confirmPassword: z
      .string()
      .min(8, { message: "Password must be at least 8 characters" })
      .max(128, { message: "Password must be less than 128 characters" }),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export const usernameSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3, { message: "Username must be at least 3 characters" })
    .max(30, { message: "Username must be less than 30 characters" })
    .regex(/^[a-zA-Z0-9_]+$/, {
      message: "Username can only contain letters, numbers, and underscores",
    }),
});

export const educationSchema = z.object({
  institution: z
    .string()
    .trim()
    .max(200, { message: "Institution name must be less than 200 characters" }),
  degree: z.string().trim().max(200, { message: "Degree must be less than 200 characters" }),
  year: z.string().trim().max(4, { message: "Year must be 4 digits" }),
});

export const certificationSchema = z.object({
  name: z
    .string()
    .trim()
    .max(200, { message: "Certification name must be less than 200 characters" }),
  url: z
    .string()
    .url({ message: "Invalid certification URL" })
    .max(500, { message: "URL must be less than 500 characters" }),
  platform: z
    .string()
    .trim()
    .max(100, { message: "Platform name must be less than 100 characters" }),
});

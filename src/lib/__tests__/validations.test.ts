import { describe, it, expect } from "vitest";
import {
  loginSchema,
  signupSchema,
  profileSchema,
  emailChangeSchema,
  passwordChangeSchema,
  usernameSchema,
  educationSchema,
  certificationSchema,
} from "../validations";

describe("loginSchema", () => {
  it("accepts valid login data", () => {
    const result = loginSchema.safeParse({ email: "user@example.com", password: "password123" });
    expect(result.success).toBe(true);
  });

  it("rejects invalid email", () => {
    const result = loginSchema.safeParse({ email: "not-an-email", password: "password123" });
    expect(result.success).toBe(false);
  });

  it("rejects empty email", () => {
    const result = loginSchema.safeParse({ email: "", password: "password123" });
    expect(result.success).toBe(false);
  });

  it("rejects password shorter than 8 characters", () => {
    const result = loginSchema.safeParse({ email: "user@example.com", password: "short" });
    expect(result.success).toBe(false);
  });

  it("rejects password longer than 128 characters", () => {
    const result = loginSchema.safeParse({ email: "user@example.com", password: "a".repeat(129) });
    expect(result.success).toBe(false);
  });

  it("trims email whitespace", () => {
    const result = loginSchema.safeParse({
      email: "  user@example.com  ",
      password: "password123",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe("user@example.com");
    }
  });

  it("rejects email longer than 255 characters", () => {
    const longEmail = "a".repeat(250) + "@b.com";
    const result = loginSchema.safeParse({ email: longEmail, password: "password123" });
    expect(result.success).toBe(false);
  });
});

describe("signupSchema", () => {
  it("accepts valid signup data", () => {
    const result = signupSchema.safeParse({
      name: "John Doe",
      email: "john@example.com",
      password: "password123",
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty name", () => {
    const result = signupSchema.safeParse({
      name: "",
      email: "john@example.com",
      password: "password123",
    });
    expect(result.success).toBe(false);
  });

  it("rejects name longer than 100 characters", () => {
    const result = signupSchema.safeParse({
      name: "a".repeat(101),
      email: "john@example.com",
      password: "password123",
    });
    expect(result.success).toBe(false);
  });

  it("trims name whitespace", () => {
    const result = signupSchema.safeParse({
      name: "  John Doe  ",
      email: "john@example.com",
      password: "password123",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe("John Doe");
    }
  });
});

describe("profileSchema", () => {
  it("accepts valid profile with all fields", () => {
    const result = profileSchema.safeParse({
      name: "Jane Smith",
      bio: "A short bio",
      linkedin_url: "https://linkedin.com/in/jane",
      x_url: "https://x.com/jane",
      bluesky_url: "https://bsky.app/jane",
    });
    expect(result.success).toBe(true);
  });

  it("accepts profile with null optional fields", () => {
    const result = profileSchema.safeParse({
      name: "Jane Smith",
      bio: null,
      linkedin_url: null,
      x_url: null,
      bluesky_url: null,
    });
    expect(result.success).toBe(true);
  });

  it("accepts profile with empty string URLs", () => {
    const result = profileSchema.safeParse({
      name: "Jane Smith",
      bio: null,
      linkedin_url: "",
      x_url: "",
      bluesky_url: "",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid URLs", () => {
    const result = profileSchema.safeParse({
      name: "Jane Smith",
      bio: null,
      linkedin_url: "not-a-url",
      x_url: null,
      bluesky_url: null,
    });
    expect(result.success).toBe(false);
  });

  it("rejects bio longer than 1000 characters", () => {
    const result = profileSchema.safeParse({
      name: "Jane Smith",
      bio: "a".repeat(1001),
      linkedin_url: null,
      x_url: null,
      bluesky_url: null,
    });
    expect(result.success).toBe(false);
  });
});

describe("emailChangeSchema", () => {
  it("accepts valid email", () => {
    const result = emailChangeSchema.safeParse({ email: "new@example.com" });
    expect(result.success).toBe(true);
  });

  it("rejects invalid email", () => {
    const result = emailChangeSchema.safeParse({ email: "not-an-email" });
    expect(result.success).toBe(false);
  });
});

describe("passwordChangeSchema", () => {
  it("accepts matching passwords", () => {
    const result = passwordChangeSchema.safeParse({
      newPassword: "newpass123",
      confirmPassword: "newpass123",
    });
    expect(result.success).toBe(true);
  });

  it("rejects mismatched passwords", () => {
    const result = passwordChangeSchema.safeParse({
      newPassword: "newpass123",
      confirmPassword: "different456",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const confirmError = result.error.issues.find((i) => i.path.includes("confirmPassword"));
      expect(confirmError?.message).toBe("Passwords do not match");
    }
  });

  it("rejects passwords shorter than 8 characters", () => {
    const result = passwordChangeSchema.safeParse({
      newPassword: "short",
      confirmPassword: "short",
    });
    expect(result.success).toBe(false);
  });
});

describe("usernameSchema", () => {
  it("accepts valid username", () => {
    const result = usernameSchema.safeParse({ username: "john_doe123" });
    expect(result.success).toBe(true);
  });

  it("rejects username with special characters", () => {
    const result = usernameSchema.safeParse({ username: "john@doe!" });
    expect(result.success).toBe(false);
  });

  it("rejects username shorter than 3 characters", () => {
    const result = usernameSchema.safeParse({ username: "ab" });
    expect(result.success).toBe(false);
  });

  it("rejects username longer than 30 characters", () => {
    const result = usernameSchema.safeParse({ username: "a".repeat(31) });
    expect(result.success).toBe(false);
  });

  it("accepts underscores", () => {
    const result = usernameSchema.safeParse({ username: "user_name_123" });
    expect(result.success).toBe(true);
  });

  it("rejects spaces", () => {
    const result = usernameSchema.safeParse({ username: "user name" });
    expect(result.success).toBe(false);
  });

  it("rejects hyphens", () => {
    const result = usernameSchema.safeParse({ username: "user-name" });
    expect(result.success).toBe(false);
  });
});

describe("educationSchema", () => {
  it("accepts valid education data", () => {
    const result = educationSchema.safeParse({
      institution: "MIT",
      degree: "Computer Science",
      year: "2020",
    });
    expect(result.success).toBe(true);
  });

  it("rejects year longer than 4 digits", () => {
    const result = educationSchema.safeParse({
      institution: "MIT",
      degree: "CS",
      year: "20200",
    });
    expect(result.success).toBe(false);
  });
});

describe("certificationSchema", () => {
  it("accepts valid certification data", () => {
    const result = certificationSchema.safeParse({
      name: "AWS Solutions Architect",
      url: "https://aws.amazon.com/cert/12345",
      platform: "AWS",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid certification URL", () => {
    const result = certificationSchema.safeParse({
      name: "AWS SA",
      url: "not-a-url",
      platform: "AWS",
    });
    expect(result.success).toBe(false);
  });
});

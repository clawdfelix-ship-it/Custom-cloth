import { hash } from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/db";

/**
 * Password helpers.
 *
 * We use bcrypt server-side. The reference implementation ships an unsalted
 * SHA-512 implementation in the browser (`js/sha512.js`) which hashes the
 * password client-side before POSTing it as the `p` field. We deliberately do
 * not replicate that: client-side unsalted hashing provides no protection
 * and prevents proper server-side password rotation.
 */

export const PASSWORD_MIN_LENGTH = 8;

export async function hashPassword(password: string): Promise<string> {
  return hash(password, 12);
}

export async function verifyPassword(
  password: string,
  passwordHash: string,
): Promise<boolean> {
  const { compare } = await import("bcryptjs");
  return compare(password, passwordHash);
}

export const registerSchema = z.object({
  username: z
    .string()
    .min(3, "Username must be at least 3 characters")
    .max(32)
    .regex(/^\w+$/, "Username must contain only letters, numbers and underscores"),
  email: z.string().email("Enter a valid email address"),
  password: z
    .string()
    .min(PASSWORD_MIN_LENGTH, `Password must be at least ${PASSWORD_MIN_LENGTH} characters`),
  confirmPassword: z.string(),
});

export type RegisterInput = z.infer<typeof registerSchema>;

export async function createUser(input: RegisterInput) {
  const existing = await prisma.user.findFirst({
    where: {
      OR: [{ username: input.username }, { email: input.email }],
    },
  });
  if (existing) {
    throw new Error(
      existing.username === input.username
        ? "That username is already taken."
        : "That email is already registered.",
    );
  }

  const passwordHash = await hashPassword(input.password);

  return prisma.user.create({
    data: {
      username: input.username,
      email: input.email,
      passwordHash,
    },
    select: { id: true, username: true, email: true },
  });
}

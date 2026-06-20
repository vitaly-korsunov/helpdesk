import "dotenv/config";
import { hashPassword } from "better-auth/crypto";
import { Role } from "../generated/prisma/enums";
import { prisma } from "../src/db";

async function main() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) {
    throw new Error("ADMIN_EMAIL and ADMIN_PASSWORD must be set in the environment");
  }

  const user = await prisma.user.upsert({
    where: { email },
    update: { role: Role.ADMIN },
    create: {
      id: crypto.randomUUID(),
      name: "Admin",
      email,
      emailVerified: true,
      role: Role.ADMIN,
    },
  });

  const hashedPassword = await hashPassword(password);
  const existingAccount = await prisma.account.findFirst({
    where: { userId: user.id, providerId: "credential" },
  });
  if (existingAccount) {
    await prisma.account.update({
      where: { id: existingAccount.id },
      data: { password: hashedPassword },
    });
  } else {
    await prisma.account.create({
      data: {
        id: crypto.randomUUID(),
        providerId: "credential",
        accountId: user.id,
        userId: user.id,
        password: hashedPassword,
      },
    });
  }

  console.log(`Seeded admin user: ${email}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

import "dotenv/config";
import { hashPassword } from "better-auth/crypto";
import { Role } from "../generated/prisma/enums";
import { prisma } from "../src/db";

async function upsertUser(name: string, email: string, password: string, role: Role) {
  const user = await prisma.user.upsert({
    where: { email },
    update: { role },
    create: {
      id: crypto.randomUUID(),
      name,
      email,
      emailVerified: true,
      role,
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

  console.log(`Seeded ${role} user: ${email}`);
}

async function main() {
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminEmail || !adminPassword) {
    throw new Error("ADMIN_EMAIL and ADMIN_PASSWORD must be set in the environment");
  }
  await upsertUser("Admin", adminEmail, adminPassword, Role.ADMIN);

  const agentEmail = process.env.AGENT_EMAIL;
  const agentPassword = process.env.AGENT_PASSWORD;
  if (!agentEmail || !agentPassword) {
    throw new Error("AGENT_EMAIL and AGENT_PASSWORD must be set in the environment");
  }
  await upsertUser("Agent", agentEmail, agentPassword, Role.AGENT);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

import { PrismaClient, Tier } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

function getCurrentMonthKey(date: Date): string {
  const year = date.getUTCFullYear();
  const month = `${date.getUTCMonth() + 1}`.padStart(2, "0");
  return `${year}-${month}`;
}

async function upsertUser(params: {
  email: string;
  firstName: string;
  lastName: string;
  tier: Tier;
  passwordHash: string;
}) {
  return prisma.user.upsert({
    where: { email: params.email },
    create: {
      email: params.email,
      firstName: params.firstName,
      lastName: params.lastName,
      tier: params.tier,
      passwordHash: params.passwordHash,
      isVerified: true,
    },
    update: {
      firstName: params.firstName,
      lastName: params.lastName,
      tier: params.tier,
      passwordHash: params.passwordHash,
      isVerified: true,
    },
  });
}

async function main() {
  const passwordHash = await bcrypt.hash("Test1234!", 12);

  const freeUser = await upsertUser({
    email: "free@test.com",
    firstName: "Free",
    lastName: "User",
    tier: Tier.FREE,
    passwordHash,
  });

  const proUser = await upsertUser({
    email: "pro@test.com",
    firstName: "Pro",
    lastName: "User",
    tier: Tier.PRO,
    passwordHash,
  });

  await upsertUser({
    email: "premium@test.com",
    firstName: "Premium",
    lastName: "User",
    tier: Tier.PREMIUM,
    passwordHash,
  });

  await upsertUser({
    email: "admin@test.com",
    firstName: "Admin",
    lastName: "User",
    tier: Tier.PREMIUM,
    passwordHash,
  });

  await prisma.usageRecord.upsert({
    where: {
      userId_month: {
        userId: proUser.id,
        month: getCurrentMonthKey(new Date()),
      },
    },
    create: {
      userId: proUser.id,
      month: getCurrentMonthKey(new Date()),
      aiQueryCount: 28,
    },
    update: {
      aiQueryCount: 28,
    },
  });

  void freeUser;
  console.log("✓ Seed complete. Test users created.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

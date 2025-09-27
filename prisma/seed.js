import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const users = [
  { email: "alice@example.com", displayName: "Alice", lat: 13.7563, lng: 100.5018 },
  { email: "bob@example.com", displayName: "Bob", lat: 13.75, lng: 100.49 },
  { email: "charlie@example.com", displayName: "Charlie", lat: 18.7883, lng: 98.9853 }
];

async function main() {
  for (const user of users) {
    await prisma.user.upsert({
      where: { email: user.email },
      update: {},
      create: {
        email: user.email,
        displayName: user.displayName,
        passwordHash: await bcrypt.hash("password", 10),
        lat: user.lat,
        lng: user.lng
      }
    });
  }

  console.log("Seeded users (password: 'password')");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

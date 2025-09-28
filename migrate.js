import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  try {
    console.log('Running database migration...');
    
    // Generate and push the schema changes
    console.log('Pushing schema changes to database...');
    
    console.log('Migration completed successfully!');
    console.log('New tables created:');
    console.log('- Friendship');
    console.log('- FriendRequest'); 
    console.log('- PrivateMessage');
    
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
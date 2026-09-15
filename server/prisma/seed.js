require('../src/config/env');
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();
async function main() {
 const email = process.env.BOOTSTRAP_ADMIN_EMAIL;
 const password = process.env.BOOTSTRAP_ADMIN_PASSWORD;
 if (!email || !password || password.length < 12) throw new Error('Bootstrap credentials are required; password minimum 12 characters.');
 await prisma.user.upsert({where:{email},update:{},create:{name:process.env.BOOTSTRAP_ADMIN_NAME || 'InTrack Admin',email,passwordHash:await bcrypt.hash(password,12),role:'SUPERUSER'}});
 for (const [key,value] of Object.entries({absen_start_time:'10:00',absen_end_time:'17:00',office_latitude:process.env.OFFICE_LATITUDE || '-6.2088',office_longitude:process.env.OFFICE_LONGITUDE || '106.8456'})) await prisma.appSetting.upsert({where:{key},update:{},create:{key,value}});
 console.log('InTrack bootstrap complete. Existing users were not changed.');
}
main().catch(()=>{console.error('Bootstrap failed. Check database and BOOTSTRAP_ADMIN_EMAIL/PASSWORD.');process.exitCode=1;}).finally(()=>prisma.$disconnect());

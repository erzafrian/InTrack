// Print presence/compatibility only, never credential values.
const fs=require('node:fs');
const path=require('node:path');
const dotenv=require('../server/node_modules/dotenv');
const root=path.resolve(__dirname,'..');
const readEnv=file=>fs.existsSync(file)?dotenv.parse(fs.readFileSync(file)):{};
const env={...readEnv(path.join(root,'.env')),...readEnv(path.join(root,'server/.env')),...process.env};
const keys=['DATABASE_URL','JWT_SECRET','PORT','CLIENT_URL','S3_ENDPOINT','S3_ACCESS_KEY_ID','S3_SECRET_ACCESS_KEY','S3_BUCKET_NAME','S3_PUBLIC_URL','GOOGLE_CLIENT_ID','GOOGLE_CLIENT_SECRET','GOOGLE_REDIRECT_URI','NOTION_CLIENT_ID','NOTION_CLIENT_SECRET','NOTION_REDIRECT_URI','AI_API_KEY','AI_BASE_URL','AI_MODEL','FACE_SERVICE_URL'];
const presence=Object.fromEntries(keys.map(k=>[k,Boolean(env[k])]));
const pathname=v=>{try{return new URL(v).pathname;}catch{return null;}};
const host=v=>{try{return new URL(v).hostname;}catch{return '';}};
const report={date:new Date().toISOString(),presence,
 storageProvider:host(env.S3_ENDPOINT).endsWith('.supabase.co')?'Supabase':host(env.S3_ENDPOINT).endsWith('.r2.cloudflarestorage.com')?'Cloudflare R2':'Other or unset',
 rootEnvExists:fs.existsSync(path.join(root,'.env')),serverEnvExists:fs.existsSync(path.join(root,'server/.env')),
 supabasePublicBucketMatches:pathname(env.S3_PUBLIC_URL)==='/storage/v1/object/public/'+env.S3_BUCKET_NAME,
 googleCallbackMatchesActiveRoute:pathname(env.GOOGLE_REDIRECT_URI||'http://localhost:3000/api/auth/google/callback')==='/api/google/callback',
 notionCallbackMatchesActiveRoute:pathname(env.NOTION_REDIRECT_URI||'http://localhost:3000/api/auth/notion/callback')==='/api/auth/notion/callback',
 devBackendPortMatchesProxy:(env.PORT||'3000')==='3001',
 databaseProvider:host(env.DATABASE_URL).endsWith('neon.tech')?'Neon':'Other or unset',
 usesLegacyAIRouter:host(env.AI_BASE_URL||'https://router.getcore.id/v1')==='router.getcore.id',
 faceHosting:host(env.FACE_SERVICE_URL).endsWith('.hf.space')?'Hugging Face Space':host(env.FACE_SERVICE_URL)==='127.0.0.1'||host(env.FACE_SERVICE_URL)==='localhost'?'Local':'Other or unset'};
fs.writeFileSync(path.join(__dirname,'config-audit-results.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify(report));

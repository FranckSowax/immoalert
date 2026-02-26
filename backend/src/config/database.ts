import { PrismaClient } from '@prisma/client';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Ensure pgbouncer=true is set for Supabase Transaction-mode pooler
const ensurePgBouncer = (url?: string): string | undefined => {
  if (!url) return url;
  const separator = url.includes('?') ? '&' : '?';
  if (!url.includes('pgbouncer=true')) {
    return `${url}${separator}pgbouncer=true`;
  }
  return url;
};

// Prisma client singleton
const prismaClientSingleton = () => {
  return new PrismaClient({
    log: process.env.NODE_ENV === 'development'
      ? ['query', 'error', 'warn']
      : ['error'],
    datasourceUrl: ensurePgBouncer(process.env.DATABASE_URL),
  });
};

declare global {
  var prisma: undefined | ReturnType<typeof prismaClientSingleton>;
}

export const prisma = globalThis.prisma ?? prismaClientSingleton();

if (process.env.NODE_ENV !== 'production') globalThis.prisma = prisma;

// Supabase client
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

export const connectDatabase = async (): Promise<void> => {
  try {
    await prisma.$connect();
    console.log('✅ Database connected successfully');
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    throw error;
  }
};

export const disconnectDatabase = async (): Promise<void> => {
  await prisma.$disconnect();
  console.log('✅ Database disconnected');
};

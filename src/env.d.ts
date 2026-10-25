declare namespace Cloudflare {
  interface Env {
    APP_ORIGIN: string
    ADMIN_ORIGIN?: string
    DATABASE_URL: string
    HYPERDRIVE?: Hyperdrive
    COVERS: R2Bucket
    PRIVATE: R2Bucket
    SUPABASE_URL: string
    SUPABASE_PUBLISHABLE_KEY: string
    LENCO_SANDBOX: string
    LENCO_PUBLIC_KEY: string
    LENCO_API_SECRET_KEY: string
    LENCO_WEBHOOK_HASH_KEY?: string
    LENCO_PAYOUT_ACCOUNT_ID?: string
    GOOGLE_BOOKS_API_KEY?: string
    ANTHROPIC_API_KEY?: string
    RESEND_API_KEY?: string
    EMAIL_FROM: string
  }
}

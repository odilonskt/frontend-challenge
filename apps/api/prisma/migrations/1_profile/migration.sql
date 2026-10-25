-- Collector profile (specs/014-user-profile, data-model.md). Hand-written like 0_init: the table shapes match
-- prisma/schema.prisma, and the CHECK constraints (which Prisma does not model) are added here so the database
-- enforces what the service validates. Lengths are in characters (code points), the same unit the service counts.

-- CreateTable
CREATE TABLE "profiles" (
    "owner_id" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "bio" TEXT NOT NULL DEFAULT '',
    "ens_name" TEXT NOT NULL DEFAULT '',
    "ens_tld" TEXT NOT NULL DEFAULT '.eth',
    "wallet_nickname" TEXT NOT NULL DEFAULT '',
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "profiles_owner_id_check" CHECK (owner_id <> ''),
    CONSTRAINT "profiles_display_name_check" CHECK (char_length(display_name) BETWEEN 3 AND 60),
    CONSTRAINT "profiles_bio_check" CHECK (char_length(bio) <= 280),
    CONSTRAINT "profiles_ens_name_check" CHECK (ens_name = '' OR ens_name ~ '^[a-z0-9][a-z0-9-]{2,39}$'),
    CONSTRAINT "profiles_ens_tld_check" CHECK (ens_tld IN ('.eth', '.xyz', '.art')),
    CONSTRAINT "profiles_wallet_nickname_check" CHECK (char_length(wallet_nickname) <= 40),
    CONSTRAINT "profiles_pkey" PRIMARY KEY ("owner_id")
);

-- CreateTable
CREATE TABLE "profile_avatars" (
    "owner_id" TEXT NOT NULL,
    "content_type" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "byte_size" INTEGER NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "profile_avatars_owner_id_check" CHECK (owner_id <> ''),
    CONSTRAINT "profile_avatars_content_type_check" CHECK (content_type IN ('image/png', 'image/jpeg', 'image/webp')),
    CONSTRAINT "profile_avatars_byte_size_check" CHECK (byte_size BETWEEN 1 AND 1048576),
    CONSTRAINT "profile_avatars_pkey" PRIMARY KEY ("owner_id")
);

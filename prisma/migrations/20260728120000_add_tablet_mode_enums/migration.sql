DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PaymentContextType') THEN
    ALTER TYPE "PaymentContextType" ADD VALUE IF NOT EXISTS 'TABLET';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PrintingSource') THEN
    ALTER TYPE "PrintingSource" ADD VALUE IF NOT EXISTS 'TABLET';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'DeviceType') THEN
    ALTER TYPE "DeviceType" ADD VALUE IF NOT EXISTS 'TABLET';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SettingsChannel') THEN
    ALTER TYPE "SettingsChannel" ADD VALUE IF NOT EXISTS 'TABLET';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'OrderSource') THEN
    ALTER TYPE "OrderSource" ADD VALUE IF NOT EXISTS 'TABLET';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'CustomerSource') THEN
    ALTER TYPE "CustomerSource" ADD VALUE IF NOT EXISTS 'TABLET';
  END IF;
END $$;

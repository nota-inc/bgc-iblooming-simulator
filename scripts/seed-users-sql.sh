#!/usr/bin/env bash
set -euo pipefail

CONTAINER_NAME="${BGC_DB_CONTAINER_NAME:-bgc-alpha-postgres}"
DB_NAME="${BGC_DB_NAME:-bgc_alpha_simulator}"
DB_USER="${BGC_DB_USER:-postgres}"
SEED_PASSWORD="${SEED_USER_PASSWORD:-ChangeMe123!}"

PASSWORD_HASH="$(
  node -e "const { scryptSync } = require('node:crypto'); const password = process.argv[1]; const salt = 'bgc-dev-seed'; const hash = scryptSync(password, salt, 64).toString('hex'); console.log(\`scrypt\$\${salt}\$\${hash}\`);" "$SEED_PASSWORD"
)"

docker exec -i "$CONTAINER_NAME" psql -U "$DB_USER" -d "$DB_NAME" <<SQL
INSERT INTO "Role" ("id", "key", "label", "createdAt") VALUES
  ('role_founder', 'founder', 'Founder', NOW()),
  ('role_analyst', 'analyst', 'Analyst', NOW()),
  ('role_product', 'product', 'Product', NOW()),
  ('role_engineering', 'engineering', 'Engineering', NOW()),
  ('role_admin', 'admin', 'Admin', NOW())
ON CONFLICT ("key") DO UPDATE SET "label" = EXCLUDED."label";

INSERT INTO "User" ("id", "name", "email", "passwordHash", "status", "createdAt", "updatedAt") VALUES
  ('user_founder', 'Founder User', 'founder@bgc.local', '${PASSWORD_HASH}', 'ACTIVE', NOW(), NOW()),
  ('user_analyst', 'Analyst User', 'analyst@bgc.local', '${PASSWORD_HASH}', 'ACTIVE', NOW(), NOW()),
  ('user_product', 'Product User', 'product@bgc.local', '${PASSWORD_HASH}', 'ACTIVE', NOW(), NOW()),
  ('user_engineering', 'Engineering User', 'engineering@bgc.local', '${PASSWORD_HASH}', 'ACTIVE', NOW(), NOW()),
  ('user_admin', 'Admin User', 'admin@bgc.local', '${PASSWORD_HASH}', 'ACTIVE', NOW(), NOW())
ON CONFLICT ("email") DO UPDATE SET
  "name" = EXCLUDED."name",
  "passwordHash" = EXCLUDED."passwordHash",
  "status" = EXCLUDED."status",
  "updatedAt" = NOW();

INSERT INTO "UserRole" ("id", "userId", "roleId", "createdAt")
SELECT 'userrole_founder_founder', 'user_founder', 'role_founder', NOW()
ON CONFLICT ("userId", "roleId") DO NOTHING;

INSERT INTO "UserRole" ("id", "userId", "roleId", "createdAt")
SELECT 'userrole_analyst_analyst', 'user_analyst', 'role_analyst', NOW()
ON CONFLICT ("userId", "roleId") DO NOTHING;

INSERT INTO "UserRole" ("id", "userId", "roleId", "createdAt")
SELECT 'userrole_product_product', 'user_product', 'role_product', NOW()
ON CONFLICT ("userId", "roleId") DO NOTHING;

INSERT INTO "UserRole" ("id", "userId", "roleId", "createdAt")
SELECT 'userrole_engineering_engineering', 'user_engineering', 'role_engineering', NOW()
ON CONFLICT ("userId", "roleId") DO NOTHING;

INSERT INTO "UserRole" ("id", "userId", "roleId", "createdAt")
SELECT 'userrole_admin_admin', 'user_admin', 'role_admin', NOW()
ON CONFLICT ("userId", "roleId") DO NOTHING;
SQL

echo "Seeded internal users and roles with password \"${SEED_PASSWORD}\"."

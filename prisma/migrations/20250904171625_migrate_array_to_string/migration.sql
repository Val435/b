-- 1. Crear nueva columna temporal
ALTER TABLE "User" ADD COLUMN "city_tmp" TEXT;

-- 2. Migrar datos (tomar el primer valor del array si existe)
UPDATE "User"
SET "city_tmp" = "city"[1];

-- 3. Eliminar la columna vieja
ALTER TABLE "User" DROP COLUMN "city";

-- 4. Renombrar la nueva columna
ALTER TABLE "User" RENAME COLUMN "city_tmp" TO "city";
-- Drop the old system_config table (unused)
-- The app uses system_configuration table from 004c_add_super_admin_tables.sql instead

-- First drop the trigger that references this table
DROP TRIGGER IF EXISTS update_system_config_updated_at ON system_config;

-- Then drop the table and its index
DROP INDEX IF EXISTS idx_config_key;
DROP TABLE IF EXISTS system_config;

/**
 * Sync DEV seed data to PROD
 *
 * Usage:
 *   PROD_DATABASE_URL="postgresql://..." node scripts/sync-prod-seed-data.js
 *
 * Or set PROD_DATABASE_URL in your environment
 */

const { Client } = require('pg');
require('dotenv').config({ path: './backend/.env' });

// PROD connection - MUST be provided
const PROD_URL = process.env.PROD_DATABASE_URL;

if (!PROD_URL) {
  console.error('❌ ERROR: PROD_DATABASE_URL environment variable is required');
  console.error('Usage: PROD_DATABASE_URL="postgresql://..." node scripts/sync-prod-seed-data.js');
  process.exit(1);
}

// All system_configuration data from DEV (as of 2026-01-10)
const systemConfig = [
  { key: 'admin_digest_day', value: 1, description: 'Day of week for admin digest (0=Sunday, 1=Monday, etc)', data_type: 'number', category: 'email', is_public: false },
  { key: 'admin_digest_enabled', value: true, description: 'Enable weekly admin digest email', data_type: 'boolean', category: 'email', is_public: false },
  { key: 'admin_digest_hour', value: 9, description: 'Hour to send admin digest (0-23)', data_type: 'number', category: 'email', is_public: false },
  { key: 'allow_family_edits_under_review', value: true, description: 'Allow families to edit applications in under_review status', data_type: 'boolean', category: 'workflow', is_public: false },
  { key: 'allow_new_applications', value: 'true', description: 'Control whether new applications can be created.', data_type: 'boolean', category: 'application', is_public: true },
  { key: 'allowed_file_types', value: [".pdf", ".docx", ".doc", ".jpg", ".jpeg", ".png"], description: 'Allowed file extensions', data_type: 'json', category: 'files', is_public: false },
  { key: 'application_season_end', value: '2025-06-30', description: 'Date when applications close', data_type: 'date', category: 'camp', is_public: false },
  { key: 'application_season_start', value: '2025-01-01', description: 'Date when applications open', data_type: 'date', category: 'camp', is_public: false },
  { key: 'approval_required_count', value: 3, description: 'Number of approvals needed to enable Accept button', data_type: 'number', category: 'workflow', is_public: false },
  { key: 'auto_submit_enabled', value: true, description: 'Automatically submit applications when 100% complete', data_type: 'boolean', category: 'workflow', is_public: false },
  { key: 'camp_end_date', value: '2025-07-22', description: 'Camp end date', data_type: 'date', category: 'camp', is_public: false },
  { key: 'camp_fee', value: '1195', description: 'Application fee charged upon acceptance (USD)', data_type: 'number', category: 'camp', is_public: false },
  { key: 'camp_start_date', value: '2025-07-15', description: 'Camp start date', data_type: 'date', category: 'camp', is_public: false },
  { key: 'camp_year', value: 2026, description: 'Current camp season year', data_type: 'number', category: 'camp', is_public: false },
  { key: 'contact_address_city', value: 'Tinley Park', description: 'Contact address city', data_type: 'string', category: 'contact', is_public: false },
  { key: 'contact_address_state', value: 'IL', description: 'Contact address state', data_type: 'string', category: 'contact', is_public: false },
  { key: 'contact_address_street', value: 'PO Box 663', description: 'Contact address street', data_type: 'string', category: 'contact', is_public: false },
  { key: 'contact_address_zip', value: '60477', description: 'Contact address zip', data_type: 'string', category: 'contact', is_public: false },
  { key: 'contact_email', value: 'info@fasdcamp.org', description: 'Public contact email', data_type: 'string', category: 'contact', is_public: false },
  { key: 'contact_phone', value: '(555) 123-4567', description: 'Public contact phone', data_type: 'string', category: 'contact', is_public: false },
  { key: 'email_enabled', value: true, description: 'Enable email notifications', data_type: 'boolean', category: 'email', is_public: false },
  { key: 'email_from_address', value: 'apps@fasdcamp.org', description: 'Email sender address', data_type: 'string', category: 'email', is_public: false },
  { key: 'email_from_name', value: 'CAMP - A FASD Community', description: 'Email sender name', data_type: 'string', category: 'email', is_public: false },
  { key: 'incomplete_reminder_day', value: 1, description: 'Day of week for incomplete reminders', data_type: 'number', category: 'email', is_public: false },
  { key: 'incomplete_reminder_enabled', value: true, description: 'Enable weekly incomplete application reminders', data_type: 'boolean', category: 'email', is_public: false },
  { key: 'invoice_due_days', value: '30', description: 'Number of days/weeks/months after invoice creation until due', data_type: 'number', category: 'billing', is_public: false },
  { key: 'invoice_due_unit', value: 'days', description: 'Unit for invoice due calculation: days, weeks, or months', data_type: 'string', category: 'billing', is_public: false },
  { key: 'invoice_final_due_date', value: '', description: 'Global absolute final due date for all invoices (YYYY-MM-DD)', data_type: 'string', category: 'billing', is_public: false },
  { key: 'invoice_final_due_date_enabled', value: 'false', description: 'Whether the global final due date is enabled', data_type: 'boolean', category: 'billing', is_public: false },
  { key: 'max_campers', value: 50, description: 'Maximum number of campers accepted per season', data_type: 'number', category: 'camp', is_public: false },
  { key: 'max_file_size_mb', value: 10, description: 'Maximum file size in megabytes', data_type: 'number', category: 'files', is_public: false },
  { key: 'organization_instagram', value: '@fasdcamp', description: 'Organization Instagram handle', data_type: 'string', category: 'contact', is_public: false },
  { key: 'organization_name', value: 'CAMP - A FASD Community', description: 'Full organization name', data_type: 'string', category: 'contact', is_public: false },
  { key: 'organization_website', value: 'fasdcamp.org', description: 'Organization website URL', data_type: 'string', category: 'contact', is_public: false },
  { key: 'payment_reminder_day', value: 1, description: 'Day of week for payment reminders', data_type: 'number', category: 'email', is_public: false },
  { key: 'payment_reminder_enabled', value: true, description: 'Enable weekly payment reminder emails', data_type: 'boolean', category: 'email', is_public: false },
  { key: 'production_url', value: 'app.fasdcamp.org', description: 'Production application URL', data_type: 'string', category: 'contact', is_public: false },
  {
    key: 'status_colors',
    value: {
      "camper_complete": { "bg": "#D1FAE5", "text": "#065F46", "label": "Complete" },
      "category_camper": { "bg": "#F3E8FF", "text": "#7C3AED", "label": "Camper" },
      "camper_incomplete": { "bg": "#CFFAFE", "text": "#0E7490", "label": "Incomplete" },
      "category_inactive": { "bg": "#F3F4F6", "text": "#4B5563", "label": "Inactive" },
      "inactive_deferred": { "bg": "#FEF3C7", "text": "#B45309", "label": "Deferred" },
      "inactive_inactive": { "bg": "#F3F4F6", "text": "#4B5563", "label": "Deactivated" },
      "applicant_complete": { "bg": "#E0E7FF", "text": "#3730A3", "label": "Complete" },
      "applicant_waitlist": { "bg": "#FFEDD5", "text": "#9A3412", "label": "Waitlist" },
      "category_applicant": { "bg": "#EFF6FF", "text": "#1D4ED8", "label": "Applicant" },
      "inactive_withdrawn": { "bg": "#FFEDD5", "text": "#C2410C", "label": "Withdrawn" },
      "applicant_incomplete": { "bg": "#DBEAFE", "text": "#1E40AF", "label": "Incomplete" },
      "applicant_not_started": { "bg": "#F3F4F6", "text": "#1F2937", "label": "Not Started" },
      "applicant_under_review": { "bg": "#FEF3C7", "text": "#92400E", "label": "Under Review" }
    },
    description: 'Customizable colors for application statuses and stages.',
    data_type: 'json',
    category: 'appearance',
    is_public: true
  }
];

// Teams from DEV
const teams = [
  { key: 'ops', name: 'Operations', description: 'Operational review and logistics', color: '#166534', order_index: 1, is_active: true },
  { key: 'med', name: 'Medical', description: 'Medical review and health assessment', color: '#DC2626', order_index: 2, is_active: true },
  { key: 'behavioral', name: 'Behavioral', description: 'Behavioral and psychological review', color: '#7C3AED', order_index: 3, is_active: true },
  { key: 'lit', name: 'LIT', description: 'Educational and literacy assessment', color: '#0369A1', order_index: 4, is_active: true }
];

async function syncToProd() {
  const client = new Client({
    connectionString: PROD_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('🔌 Connecting to PROD database...');
    await client.connect();
    console.log('✅ Connected to PROD\n');

    // 1. Sync system_configuration
    console.log('📋 Syncing system_configuration...');
    for (const config of systemConfig) {
      await client.query(`
        INSERT INTO system_configuration (key, value, description, data_type, category, is_public)
        VALUES ($1, $2::jsonb, $3, $4, $5, $6)
        ON CONFLICT (key) DO UPDATE SET
          value = EXCLUDED.value,
          description = EXCLUDED.description,
          data_type = EXCLUDED.data_type,
          category = EXCLUDED.category,
          is_public = EXCLUDED.is_public,
          updated_at = NOW()
      `, [config.key, JSON.stringify(config.value), config.description, config.data_type, config.category, config.is_public]);
    }
    console.log(`   ✅ ${systemConfig.length} config items synced\n`);

    // 2. Sync teams
    console.log('👥 Syncing teams...');
    for (const team of teams) {
      await client.query(`
        INSERT INTO teams (key, name, description, color, order_index, is_active)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (key) DO UPDATE SET
          name = EXCLUDED.name,
          description = EXCLUDED.description,
          color = EXCLUDED.color,
          order_index = EXCLUDED.order_index,
          is_active = EXCLUDED.is_active,
          updated_at = NOW()
      `, [team.key, team.name, team.description, team.color, team.order_index, team.is_active]);
    }
    console.log(`   ✅ ${teams.length} teams synced\n`);

    // 3. Sync email_templates from DEV
    console.log('📧 Syncing email_templates...');
    const devClient = new Client({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    });
    await devClient.connect();

    const templatesResult = await devClient.query(`
      SELECT key, name, subject, html_content, text_content, variables,
             trigger_event, is_active, markdown_content, use_markdown
      FROM email_templates
    `);

    for (const template of templatesResult.rows) {
      await client.query(`
        INSERT INTO email_templates (key, name, subject, html_content, text_content, variables, trigger_event, is_active, markdown_content, use_markdown)
        VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9, $10)
        ON CONFLICT (key) DO UPDATE SET
          name = EXCLUDED.name,
          subject = EXCLUDED.subject,
          html_content = EXCLUDED.html_content,
          text_content = EXCLUDED.text_content,
          variables = EXCLUDED.variables,
          trigger_event = EXCLUDED.trigger_event,
          is_active = EXCLUDED.is_active,
          markdown_content = EXCLUDED.markdown_content,
          use_markdown = EXCLUDED.use_markdown,
          updated_at = NOW()
      `, [
        template.key,
        template.name,
        template.subject,
        template.html_content,
        template.text_content,
        template.variables ? JSON.stringify(template.variables) : null,
        template.trigger_event,
        template.is_active,
        template.markdown_content,
        template.use_markdown
      ]);
    }
    console.log(`   ✅ ${templatesResult.rows.length} email templates synced\n`);

    // 4. Sync email_automations from DEV
    console.log('⚡ Syncing email_automations...');

    // First, clear existing automations in PROD to avoid duplicates
    await client.query('DELETE FROM email_automations');

    const automationsResult = await devClient.query(`
      SELECT template_key, name, description, trigger_event, trigger_type,
             schedule_day, schedule_hour, audience_filter, is_active
      FROM email_automations
    `);

    for (const automation of automationsResult.rows) {
      await client.query(`
        INSERT INTO email_automations (template_key, name, description, trigger_event, trigger_type, schedule_day, schedule_hour, audience_filter, is_active)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9)
      `, [
        automation.template_key,
        automation.name,
        automation.description,
        automation.trigger_event,
        automation.trigger_type,
        automation.schedule_day,
        automation.schedule_hour,
        JSON.stringify(automation.audience_filter || {}),
        automation.is_active
      ]);
    }
    console.log(`   ✅ ${automationsResult.rows.length} email automations synced\n`);

    await devClient.end();

    // Verification
    console.log('🔍 Verification:');
    const counts = await client.query(`
      SELECT
        (SELECT COUNT(*) FROM system_configuration) as config_count,
        (SELECT COUNT(*) FROM teams) as teams_count,
        (SELECT COUNT(*) FROM email_templates) as templates_count,
        (SELECT COUNT(*) FROM email_automations) as automations_count
    `);

    const c = counts.rows[0];
    console.log(`   system_configuration: ${c.config_count} rows`);
    console.log(`   teams: ${c.teams_count} rows`);
    console.log(`   email_templates: ${c.templates_count} rows`);
    console.log(`   email_automations: ${c.automations_count} rows`);

    console.log('\n🎉 PROD sync complete!');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

syncToProd();

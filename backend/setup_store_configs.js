const { Pool } = require('pg');
const { v4: uuidv4 } = require('uuid');

async function setup() {
  const pool = new Pool({
    host: 'localhost',
    port: 5433,
    user: 'postgres',
    password: 'postgres',
    database: 'config_management'
  });

  try {
    // 1. Check for Default User's Org
    const userRes = await pool.query(`SELECT organization_id FROM users WHERE email = 'test2@example.com' LIMIT 1`);
    if (userRes.rows.length === 0) throw new Error("test2 user not found");
    const orgId = userRes.rows[0].organization_id;

    // 2. Create or Get Project 'NeonKart Store'
    let projectRes = await pool.query(`SELECT id FROM projects WHERE name = 'NeonKart Store' AND organization_id = $1`, [orgId]);
    let projectId;
    if (projectRes.rows.length === 0) {
      projectId = uuidv4();
      await pool.query(`INSERT INTO projects (id, organization_id, name) VALUES ($1, $2, 'NeonKart Store')`, [projectId, orgId]);
    } else {
      projectId = projectRes.rows[0].id;
    }

    // 3. Create or Get Environment 'production'
    let envRes = await pool.query(`SELECT id FROM environments WHERE name = 'production' AND project_id = $1`, [projectId]);
    let envId;
    if (envRes.rows.length === 0) {
      envId = uuidv4();
      await pool.query(`INSERT INTO environments (id, project_id, name) VALUES ($1, $2, 'production')`, [envId, projectId]);
    } else {
      envId = envRes.rows[0].id;
    }

    // 4. Create or Get Config 'store.flash_sale.enabled'
    let configRes = await pool.query(`SELECT id FROM config_keys WHERE key_name = 'store.flash_sale.enabled' AND environment_id = $1`, [envId]);
    let configId;
    if (configRes.rows.length === 0) {
      configId = uuidv4();
      await pool.query(`INSERT INTO config_keys (id, organization_id, project_id, environment_id, key_name, value_type, current_value) 
                        VALUES ($1, $2, $3, $4, 'store.flash_sale.enabled', 'boolean', 'false')`, 
                        [configId, orgId, projectId, envId]);
    } else {
      configId = configRes.rows[0].id;
    }

    // 5. Setup API Key 'neonkart-test-key-12345'
    // 'neonkart' + 'test-key-12345'
    const prefix = 'neonkart';
    const plainString = prefix + '-test-key-12345';
    // $2b$10$FWVUGlWjm5.72Dcr7F81IOGdZFKXuwzIbceFXrL6rYcUtp0uSh9XC is bcrypt.hashSync(plainString, 10);
    const hash = '$2b$10$FWVUGlWjm5.72Dcr7F81IOGdZFKXuwzIbceFXrL6rYcUtp0uSh9XC';
    
    // UPSERT API KEY
    const keyExists = await pool.query(`SELECT id FROM api_keys WHERE prefix = 'neonkart' AND project_id = $1`, [projectId]);
    if (keyExists.rows.length > 0) {
      await pool.query(`UPDATE api_keys SET key_hash = $1, revoked = false WHERE id = $2`, [hash, keyExists.rows[0].id]);
    } else {
      await pool.query(`INSERT INTO api_keys (id, prefix, key_hash, project_id, environment_id, created_by) 
                        VALUES ($1, $2, $3, $4, $5, (SELECT id FROM users LIMIT 1))`, 
                        [uuidv4(), prefix, hash, projectId, envId]);
    }

    console.log("SUCCESS. Config ID for rules is:", configId);
  } catch (err) {
    console.error("Failed:", err);
  } finally {
    pool.end();
  }
}

setup();

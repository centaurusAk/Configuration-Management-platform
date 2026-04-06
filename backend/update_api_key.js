const { Client } = require('pg'); 
const client = new Client({ 
    port: 5433, 
    user: 'postgres', 
    password: 'postgres', 
    database: 'config_management' 
}); 

client.connect()
    .then(() => client.query("UPDATE api_keys SET project_id = 'a59d5767-30b9-422f-95c1-37f2ea21a95f', environment_id = '3c78fe30-1601-4ae5-9a72-c339af273ed3' WHERE prefix = 'neonkart'"))
    .then(res => { console.log('UPDATED API KEY', res.rowCount); client.end(); })
    .catch(console.error);

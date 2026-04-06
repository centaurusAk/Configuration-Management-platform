const jwt = require('jsonwebtoken');

const token = jwt.sign(
    { user_id: '0a4339cd-ffad-4591-aab2-54911ea75ffd', organization_id: '497f1b55-2c99-441e-88d2-715916189e0c', role: 'Admin' },
    'dev-secret-key-change-in-production'
);

async function request(url, options) {
    const res = await fetch(url, options);
    const data = await res.json();
    if (!res.ok) throw new Error(JSON.stringify(data));
    return data;
}

async function createAndTestRule() {
    try {
        console.log('Testing evaluation before rule is created (should be false)');
        let testBeforeResult = await request('http://localhost:3000/api/v1/rules/test', {
            method: 'POST',
            body: JSON.stringify({
                config_key_id: '468c9485-d9e9-44de-ae5b-dfbb362f958e',
                context: { region: 'US' }
            }),
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
        });
        console.log('Result before rule:', testBeforeResult);
        
        console.log('\nCreating a new rule');
        let createRuleRes = await request('http://localhost:3000/api/v1/rules', {
            method: 'POST',
            body: JSON.stringify({
                config_key_id: '468c9485-d9e9-44de-ae5b-dfbb362f958e',
                priority: 100,
                conditions: [{ attribute: 'region', operator: 'equals', value: 'US' }],
                value: true,
                enabled: true
            }),
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
        });
        console.log('Rule created:', createRuleRes);

        console.log('\nTesting evaluation after rule is created (should be true)');
        let testAfterResult = await request('http://localhost:3000/api/v1/rules/test', {
            method: 'POST',
            body: JSON.stringify({
                config_key_id: '468c9485-d9e9-44de-ae5b-dfbb362f958e',
                context: { region: 'US' }
            }),
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
        });
        console.log('Result after rule:', testAfterResult);
        
        console.log('\nTesting evaluation with IN context (should be false)');
        let testInResult = await request('http://localhost:3000/api/v1/rules/test', {
            method: 'POST',
            body: JSON.stringify({
                config_key_id: '468c9485-d9e9-44de-ae5b-dfbb362f958e',
                context: { region: 'IN' }
            }),
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
        });
        console.log('Result with IN region:', testInResult);
        
        // Also test the SDK endpoint
        console.log('\nTesting SDK endpoint');
        let sdkRes = await request('http://localhost:3000/api/v1/sdk/config/store.flash_sale.enabled?region=US', {
            headers: { Authorization: `Bearer neonkart-test-key-12345` }
        });
        console.log('SDK Result:', sdkRes);
        
    } catch (e) {
        console.error('Error:', e.message);
    }
}

createAndTestRule();

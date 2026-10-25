// Read-only diagnostic; prints no credentials and changes no data.
const fs = require('fs');
const vm = require('vm');
const sandbox = { window: {} };
vm.runInNewContext(fs.readFileSync('supabase-config.js', 'utf8'), sandbox);
const config = sandbox.window.SUPABASE_CONFIG;
const fields = 'id,combined_class_id,course_year,course_code,subject,teacher_name,day,start_time,end_time,room';
fetch(`${config.url}/rest/v1/schedules?select=${encodeURIComponent(fields)}&subject=ilike.*ART%20APPRECIATION*`, {
    headers: { apikey: config.anonKey, Authorization: `Bearer ${config.anonKey}` }
}).then(async response => {
    const body = await response.json();
    if (!response.ok) throw new Error(body.message || `HTTP ${response.status}`);
    console.log(JSON.stringify(body, null, 2));
}).catch(error => {
    console.error(`Probe failed: ${error.message}`);
    process.exitCode = 1;
});

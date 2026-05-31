// ==========================
// SETTINGS PAGE
// ==========================

const db = window.db;

let currentSection = 'company';

// INIT
document.addEventListener('DOMContentLoaded', async () => {
    await loadSettings();
});

// SECTION SWITCH

function showSection(section, btn){

    document
        .querySelectorAll('.section')
        .forEach(el => el.classList.remove('active'));

    document
        .querySelectorAll('.nav-item')
        .forEach(el => el.classList.remove('active'));

    document
        .getElementById(section)
        .classList.add('active');

    btn.classList.add('active');

    currentSection = section;
}

// LOAD SETTINGS

async function loadSettings(){

    try{

        const { data } = await db
            .from('settings')
            .select('*')
            .eq('agent_id', currentAgent.id)
            .single();

        if(!data) return;

        document.getElementById('company-name').value =
            data.company_name || '';

        document.getElementById('owner-name').value =
            data.owner_name || '';

        document.getElementById('company-email').value =
            data.email || '';

        document.getElementById('company-mobile').value =
            data.mobile || '';

        document.getElementById('company-address').value =
            data.address || '';

        document.getElementById('gst-number').value =
            data.gst_number || '';

        document.getElementById('rera-number').value =
            data.rera_number || '';

        document.getElementById('gst-percent').value =
            data.gst_percent || 5;

        document.getElementById('stamp-duty').value =
            data.stamp_duty_percent || 6;

        document.getElementById('registration').value =
            data.registration_percent || 1;

        document.getElementById('brokerage').value =
            data.brokerage_percent || 2;

        document.getElementById('tds').value =
            data.tds_percent || 1;

        document.getElementById('email-notification').checked =
            data.email_notifications || false;

        document.getElementById('whatsapp-notification').checked =
            data.whatsapp_notifications || false;

        document.getElementById('lead-alerts').checked =
            data.lead_alerts || false;

        document.getElementById('system-updates').checked =
            data.system_updates || false;

    }
    catch(err){
        console.error(err);
    }
}

// SAVE

async function saveAllSettings(){

    try{

        const payload = {

            agent_id: currentAgent.id,

            company_name:
                document.getElementById('company-name').value,

            owner_name:
                document.getElementById('owner-name').value,

            email:
                document.getElementById('company-email').value,

            mobile:
                document.getElementById('company-mobile').value,

            address:
                document.getElementById('company-address').value,

            gst_number:
                document.getElementById('gst-number').value,

            rera_number:
                document.getElementById('rera-number').value,

            gst_percent:
                Number(document.getElementById('gst-percent').value),

            stamp_duty_percent:
                Number(document.getElementById('stamp-duty').value),

            registration_percent:
                Number(document.getElementById('registration').value),

            brokerage_percent:
                Number(document.getElementById('brokerage').value),

            tds_percent:
                Number(document.getElementById('tds').value),

            email_notifications:
                document.getElementById('email-notification').checked,

            whatsapp_notifications:
                document.getElementById('whatsapp-notification').checked,

            lead_alerts:
                document.getElementById('lead-alerts').checked,

            system_updates:
                document.getElementById('system-updates').checked,

            updated_at:
                new Date().toISOString()
        };

        const { error } = await db
            .from('settings')
            .upsert(payload);

        if(error) throw error;

        alert('✅ Settings Saved Successfully');

    }
    catch(err){

        alert(err.message);

    }
}
